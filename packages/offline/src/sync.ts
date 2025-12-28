import { offlineDB, QueuedEvent } from './db';

export interface SyncResult {
  success: boolean;
  ackedIds: number[];
  errors: Array<{ id: number; error: string }>;
}

export async function queueEvent(
  eventType: string,
  payload: Record<string, any>
): Promise<number> {
  const event: Omit<QueuedEvent, 'id'> = {
    eventType,
    payloadJson: payload,
    clientCreatedAt: new Date().toISOString(),
    retryCount: 0,
  };
  return await offlineDB.queuedEvents.add(event);
}

export async function getPendingEvents(): Promise<QueuedEvent[]> {
  return await offlineDB.queuedEvents
    .filter((event) => event.ackedAt === undefined || event.ackedAt === null)
    .toArray();
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
  await offlineDB.queuedEvents.update(eventId, {
    lastError: error,
    retryCount: (await offlineDB.queuedEvents.get(eventId))?.retryCount || 0 + 1,
  });
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
    const response = await fetch(`${apiUrl}/api/v1/sync/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId,
        events: pendingEvents.map((e) => ({
          eventType: e.eventType,
          payloadJson: e.payloadJson,
          clientCreatedAt: e.clientCreatedAt,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Sync failed: ${errorText}`);
    }

    const result = await response.json();
    const ackedIds = result.ackedIds || [];

    await markEventsAcked(ackedIds);

    const errors: Array<{ id: number; error: string }> = [];
    for (const event of pendingEvents) {
      if (!ackedIds.includes(event.id!)) {
        await markEventError(event.id!, 'Not acknowledged by server');
        errors.push({ id: event.id!, error: 'Not acknowledged by server' });
      }
    }

    return { success: true, ackedIds, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    for (const event of pendingEvents) {
      await markEventError(event.id!, errorMessage);
    }
    return {
      success: false,
      ackedIds: [],
      errors: pendingEvents.map((e) => ({ id: e.id!, error: errorMessage })),
    };
  }
}

