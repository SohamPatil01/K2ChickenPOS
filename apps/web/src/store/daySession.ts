'use client';

import { create } from 'zustand';
import api from '@/lib/api';

export type DayCurrentResponse = {
  open: boolean;
  shift: any | null;
  suggestedCarry: number;
  daySummary: any | null;
  needsDayOutReminder: boolean;
  canOverride: boolean;
  stuckOpen: boolean;
};

const CHANNEL = 'k2-day-session';
const POLL_MS = 20_000;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let bc: BroadcastChannel | null = null;
let subscriberCount = 0;

function ensureChannel() {
  if (typeof window === 'undefined') return null;
  if (bc) return bc;
  try {
    bc = new BroadcastChannel(CHANNEL);
  } catch {
    bc = null;
  }
  return bc;
}

function emitPeers() {
  try {
    ensureChannel()?.postMessage({ type: 'day-session-changed', at: Date.now() });
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('day-session-changed'));
  }
}

type DaySessionState = {
  status: DayCurrentResponse | null;
  loading: boolean;
  error: string | null;
  /** lite poll by default; pass { full: true } for Day Out totals. */
  refresh: (opts?: { full?: boolean }) => Promise<DayCurrentResponse | null>;
  /** Call after local Day In / Day Out / movement so every console refreshes. */
  notifyChanged: () => void;
  /** Start poll + cross-tab sync; returns cleanup. */
  subscribeLifecycle: () => () => void;
};

export const useDaySessionStore = create<DaySessionState>((set, get) => ({
  status: null,
  loading: true,
  error: null,

  refresh: async (opts) => {
    try {
      const res = await api.get('/api/v1/shifts/current', {
        // Lite skips loading every PAID sale for the day — keeps Pay fast on busy counters
        params: opts?.full ? undefined : { lite: '1' },
      });
      const data = res.data as DayCurrentResponse;
      set((state) => {
        // Preserve last full daySummary when a lite poll returns null summary
        if (!opts?.full && data.open && data.daySummary == null && state.status?.daySummary) {
          return {
            status: { ...data, daySummary: state.status.daySummary },
            loading: false,
            error: null,
          };
        }
        return { status: data, loading: false, error: null };
      });
      return get().status;
    } catch (e: any) {
      // Keep last known status — never flip an open day back to "Day In required"
      // just because one poll failed.
      set({
        loading: false,
        error: e?.response?.data?.error || e?.message || 'Could not load day session',
      });
      return get().status;
    }
  },

  notifyChanged: () => {
    emitPeers();
    void get().refresh({ full: true });
  },

  subscribeLifecycle: () => {
    if (typeof window === 'undefined') return () => {};

    subscriberCount += 1;
    const channel = ensureChannel();

    const onPeer = () => {
      void get().refresh();
    };
    channel?.addEventListener('message', onPeer);
    window.addEventListener('day-session-changed', onPeer);
    window.addEventListener('pos-day-in-required', onPeer);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void get().refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    if (pollTimer == null) {
      pollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') void get().refresh();
      }, POLL_MS);
    }

    void get().refresh();

    return () => {
      subscriberCount = Math.max(0, subscriberCount - 1);
      channel?.removeEventListener('message', onPeer);
      window.removeEventListener('day-session-changed', onPeer);
      window.removeEventListener('pos-day-in-required', onPeer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      if (subscriberCount === 0 && pollTimer != null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };
  },
}));

export async function fetchDayCurrent(): Promise<DayCurrentResponse> {
  // Full summary for Day Out / daily closing
  const res = await api.get('/api/v1/shifts/current');
  return res.data;
}
