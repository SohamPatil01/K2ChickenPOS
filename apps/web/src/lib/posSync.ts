import { getPendingEvents, syncEventsToServer } from '@azela-pos/offline';
import { getPosDeviceId } from '@/lib/posDevice';

/**
 * Push queued offline events to POST /api/v1/sync/events (same-origin).
 */
export async function flushPendingPosSync(apiBaseUrl = ''): Promise<{
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
  const res = await syncEventsToServer(getPosDeviceId(), apiBaseUrl, token);
  return {
    ok: res.success && res.errors.length === 0,
    acked: res.ackedIds.length,
    error: res.errors[0]?.error,
  };
}

export async function getPendingSyncCount(): Promise<number> {
  const pending = await getPendingEvents();
  return pending.length;
}
