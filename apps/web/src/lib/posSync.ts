import {
  applySyncServerResult,
  buildSyncEventsPayload,
  getPendingEvents,
  markSyncEventsFailed,
} from '@azela-pos/offline';
import { isAxiosError } from 'axios';
import api from '@/lib/api';
import { getPosDeviceId } from '@/lib/posDevice';

/**
 * Push queued offline events to POST /api/v1/sync/events.
 * Uses the shared axios client so expired access tokens are refreshed automatically.
 */
export async function flushPendingPosSync(): Promise<{
  ok: boolean;
  acked: number;
  error?: string;
}> {
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (!token) {
    return { ok: false, acked: 0, error: 'Not logged in' };
  }

  const pending = await getPendingEvents();
  if (pending.length === 0) {
    return { ok: true, acked: 0 };
  }

  try {
    const response = await api.post(
      '/api/v1/sync/events',
      buildSyncEventsPayload(getPosDeviceId(), pending)
    );
    const res = await applySyncServerResult(pending, response.data);
    return {
      ok: res.success && res.errors.length === 0,
      acked: res.ackedIds.length,
      error: res.errors[0]?.error,
    };
  } catch (error) {
    // Auth failures are handled by the axios interceptor (refresh or redirect).
    // Do not stamp retry backoff on the queue for a session problem.
    if (isAxiosError(error) && error.response?.status === 401) {
      return { ok: false, acked: 0, error: 'Session expired — sign in again' };
    }

    const message =
      isAxiosError(error) && error.response?.data?.error
        ? String(error.response.data.error)
        : error instanceof Error
          ? error.message
          : 'Sync failed';
    const res = await markSyncEventsFailed(pending, message);
    return {
      ok: false,
      acked: 0,
      error: res.errors[0]?.error || message,
    };
  }
}

export async function getPendingSyncCount(): Promise<number> {
  const pending = await getPendingEvents();
  return pending.length;
}
