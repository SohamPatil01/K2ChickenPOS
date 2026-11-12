import { offlineDB, QueuedEvent } from './db';

const MAX_RETRIES = 8;

export interface SyncResult {
  success: boolean;
  ackedIds: number[];
  errors: Array<{ id: number; error: string }>;
}

function newClientEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function queueEvent(
  eventType: string,
  payload: Record<string, any>
): Promise<number> {
  const event: Omit<QueuedEvent, 'id'> = {
    clientEventId: newClientEventId(),
    eventType,
    payloadJson: payload,
    clientCreatedAt: new Date().toISOString(),
    retryCount: 0,
    syncStatus: 'pending',
  };
  return await offlineDB.queuedEvents.add(event);
}

export async function getPendingEvents(): Promise<QueuedEvent[]> {
  const now = Date.now();
  return await offlineDB.queuedEvents
    .filter((event) => {
      if (event.ackedAt !== undefined && event.ackedAt !== null) {
        return false;
      }
      if (event.deadLetter || event.syncStatus === 'dead') {
        return false;
      }
      if (!event.nextRetryAt) {
        return true;
      }
      return new Date(event.nextRetryAt).getTime() <= now;
    })
    .toArray();
}

/** Manager-visible permanently failed queue rows (never auto-deleted). */
export async function getDeadLetterEvents(): Promise<QueuedEvent[]> {
  return offlineDB.queuedEvents
    .filter((e) => !!e.deadLetter || e.syncStatus === 'dead')
    .toArray();
}

export async function retryDeadLetterEvent(eventId: number): Promise<void> {
  await offlineDB.queuedEvents.update(eventId, {
    deadLetter: false,
    syncStatus: 'pending',
    retryCount: 0,
    lastError: undefined,
    nextRetryAt: undefined,
  });
}

export async function markEventsAcked(eventIds: number[]): Promise<void> {
  const now = new Date().toISOString();
  await offlineDB.queuedEvents
    .where('id')
    .anyOf(eventIds)
    .modify({ ackedAt: now });
}

export async function markEventError(
  eventId: number,
  error: string
): Promise<void> {
  const row = await offlineDB.queuedEvents.get(eventId);
  const nextRetryCount = (row?.retryCount ?? 0) + 1;
  if (nextRetryCount >= MAX_RETRIES) {
    await offlineDB.queuedEvents.update(eventId, {
      lastError: error,
      retryCount: nextRetryCount,
      lastAttemptAt: new Date().toISOString(),
      deadLetter: true,
      syncStatus: 'dead',
      nextRetryAt: undefined,
    });
    return;
  }
  const delayMs = getRetryDelayMs(nextRetryCount);
  await offlineDB.queuedEvents.update(eventId, {
    lastError: error,
    retryCount: nextRetryCount,
    lastAttemptAt: new Date().toISOString(),
    nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
    syncStatus: 'failed',
  });
}

function getRetryDelayMs(retryCount: number): number {
  const schedule = [
    5_000,
    15_000,
    30_000,
    60_000,
    5 * 60_000,
    15 * 60_000,
  ];
  return schedule[Math.min(retryCount - 1, schedule.length - 1)];
}

export function buildSyncEventsPayload(
  deviceId: string,
  pendingEvents: QueuedEvent[]
) {
  return {
    deviceId,
    events: pendingEvents.map((e) => ({
      eventType: e.eventType,
      payloadJson: e.payloadJson,
      clientCreatedAt: e.clientCreatedAt,
      clientQueueId: e.id,
      clientEventId: e.clientEventId || `q:${e.id}:${e.eventType}:${e.clientCreatedAt}`,
    })),
  };
}

/** Apply a successful /api/v1/sync/events response to the local queue. */
export async function applySyncServerResult(
  pendingEvents: QueuedEvent[],
  result: { ackedQueueIds?: unknown }
): Promise<SyncResult> {
  const ackedQueueIds: number[] = Array.isArray(result.ackedQueueIds)
    ? result.ackedQueueIds.filter((n: unknown) => typeof n === 'number')
    : [];

  if (ackedQueueIds.length > 0) {
    await markEventsAcked(ackedQueueIds);
  }

  const attemptedIds = pendingEvents
    .map((event) => event.id)
    .filter((id): id is number => typeof id === 'number');
  if (attemptedIds.length > 0) {
    await offlineDB.queuedEvents
      .where('id')
      .anyOf(attemptedIds)
      .modify({
        lastAttemptAt: new Date().toISOString(),
        lastError: undefined,
        nextRetryAt: undefined,
      });
  }

  const errors: Array<{ id: number; error: string }> = [];
  const ackedSet = new Set(ackedQueueIds);
  for (const event of pendingEvents) {
    if (!ackedSet.has(event.id!)) {
      await markEventError(event.id!, 'Not acknowledged by server');
      errors.push({ id: event.id!, error: 'Not acknowledged by server' });
    }
  }

  return { success: true, ackedIds: ackedQueueIds, errors };
}

export async function markSyncEventsFailed(
  pendingEvents: QueuedEvent[],
  errorMessage: string
): Promise<SyncResult> {
  for (const event of pendingEvents) {
    await markEventError(event.id!, errorMessage);
  }
  return {
    success: false,
    ackedIds: [],
    errors: pendingEvents.map((e) => ({ id: e.id!, error: errorMessage })),
  };
}

export async function syncEventsToServer(
  deviceId: string,
  apiUrl: string,
  token: string
): Promise<SyncResult> {
  const pendingEvents = await getPendingEvents();
  if (pendingEvents.length === 0) {
    return { success: true, ackedIds: [], errors: [] };
  }

  try {
    const syncUrl =
      !apiUrl || apiUrl.trim() === ''
        ? '/api/v1/sync/events'
        : `${apiUrl.replace(/\/$/, '')}/api/v1/sync/events`;
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(buildSyncEventsPayload(deviceId, pendingEvents)),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync failed: ${errorText}`);
    }

    const result = await response.json();
    return applySyncServerResult(pendingEvents, result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return markSyncEventsFailed(pendingEvents, errorMessage);
  }
}
