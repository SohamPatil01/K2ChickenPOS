import { getPendingEvents, syncEventsToServer } from '@azela-pos/offline';
import { getPosDeviceId } from '@/lib/posDevice';
import { getApiBaseUrl } from '@/lib/apiBaseUrl';

/**
 * Push queued offline events to POST /api/v1/sync/events.
 * Uses direct API URL when configured (same as axios) so Authorization is not stripped by rewrites.
 */
export async function flushPendingPosSync(apiBaseUrl?: string): Promise<{
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
  const base = apiBaseUrl ?? getApiBaseUrl();
  const res = await syncEventsToServer(getPosDeviceId(), base, token);
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
