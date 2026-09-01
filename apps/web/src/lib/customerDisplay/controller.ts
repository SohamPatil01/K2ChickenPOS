"use client";

import { create } from "zustand";
import {
  createDisplayPublisher,
  type ConnectionStatus,
  type DisplayPublisherHandle,
} from "./ablyClient";
import {
  DISPLAY_EVENTS,
  type BillUpdatePayload,
  type CustomerSelectionPayload,
  type DisplayMode,
  type DraftFieldKey,
  type PaymentModePayload,
  type SuccessModePayload,
} from "./types";

const ACTIVE_STORAGE_KEY = "k2-customer-display-active";

// The Ably publisher handle is kept module-side (non-reactive) so connection
// churn never triggers React re-renders. Only lightweight status lives in the store.
let handle: DisplayPublisherHandle | null = null;
let connecting = false;
let lastSeq = 0;
let presenceTimer: ReturnType<typeof setInterval> | null = null;
/** Last event queued while Ably was still connecting — flushed on connect. */
let pendingEvent: { name: string; data: any } | null = null;
let pendingRetryTimer: ReturnType<typeof setTimeout> | null = null;
let pendingRetryAttempts = 0;

/**
 * Monotonic sequence number based on the wall clock so it keeps increasing even
 * if the cashier reloads the page (a plain counter would reset to 1 and the
 * display would wrongly discard the new events as stale).
 */
function nextSeq(): number {
  const now = Date.now();
  lastSeq = now > lastSeq ? now : lastSeq + 1;
  return lastSeq;
}

function publishOrQueue(name: string, data: any): boolean {
  if (!handle) {
    pendingEvent = { name, data };
    return true; // queued — flushed when Ably connects
  }
  const event = { name, data };
  if (pendingEvent !== event) {
    pendingRetryAttempts = 0;
    if (pendingRetryTimer) {
      clearTimeout(pendingRetryTimer);
      pendingRetryTimer = null;
    }
  }
  pendingEvent = event;
  try {
    void handle
      .publish(name as any, data)
      .then((published) => {
        if (published && pendingEvent === event) {
          pendingEvent = null;
          pendingRetryAttempts = 0;
        } else if (!published && pendingEvent === event) {
          schedulePendingRetry();
        }
      })
      .catch(() => {
        if (pendingEvent === event) schedulePendingRetry();
      });
    return true;
  } catch {
    return true;
  }
}

function schedulePendingRetry(): void {
  if (!pendingEvent || !handle || pendingRetryTimer || pendingRetryAttempts >= 3) return;
  const delay = 500 * (pendingRetryAttempts + 1);
  pendingRetryTimer = setTimeout(() => {
    pendingRetryTimer = null;
    pendingRetryAttempts += 1;
    flushPending();
  }, delay);
}

function flushPending(): void {
  if (!handle || !pendingEvent) return;
  const event = pendingEvent;
  try {
    void handle
      .publish(event.name as any, event.data)
      .then((published) => {
        if (published && pendingEvent === event) {
          pendingEvent = null;
          pendingRetryAttempts = 0;
        } else if (!published && pendingEvent === event) {
          schedulePendingRetry();
        }
      })
      .catch(() => {
        if (pendingEvent === event) schedulePendingRetry();
      });
  } catch {
    // keep queued
  }
}

function readActiveFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ACTIVE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeActiveFlag(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(ACTIVE_STORAGE_KEY, "1");
    else window.localStorage.removeItem(ACTIVE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

interface CustomerDisplayState {
  active: boolean;
  status: ConnectionStatus;
  displayConnected: boolean;
  /** What the display is currently showing — used to suppress stray bill updates. */
  localMode: DisplayMode;
  /** Connect (idempotent). Called by the publisher hook when active + logged in. */
  connect: (storeId: string, getAccessToken: () => string | null) => void;
  /** Tear down the realtime connection. */
  teardown: () => void;
  enable: (storeId: string, getAccessToken: () => string | null) => void;
  disable: () => void;
  publishBill: (payload: Omit<BillUpdatePayload, "seq">) => boolean;
  publishPayment: (payload: Omit<PaymentModePayload, "seq">) => boolean;
  publishSuccess: (payload: Omit<SuccessModePayload, "seq">) => boolean;
  publishReview: () => boolean;
  publishIdle: (force?: boolean) => boolean;
  /** Confirm an existing customer selected by the cashier to the display. */
  publishCustomerSelection: (payload: Omit<CustomerSelectionPayload, "seq">) => boolean;
  /** Live keystroke mirroring — cashier's own field → display, and back. */
  publishDraftField: (field: DraftFieldKey, value: string, open: boolean) => boolean;
  /** True once the Ably publisher socket is usable. */
  isPublisherReady: () => boolean;
  _setStatus: (status: ConnectionStatus) => void;
}

export const useCustomerDisplayStore = create<CustomerDisplayState>(
  (set, get) => ({
    active: readActiveFlag(),
    status: "disabled",
    displayConnected: false,
    localMode: "idle",

    connect: (storeId, getAccessToken) => {
      if (handle || connecting) return;
      if (!storeId) return;
      connecting = true;
      void createDisplayPublisher({
        storeId,
        getAccessToken,
        onStatus: (status) => {
          get()._setStatus(status);
          if (status === "connected") flushPending();
        },
      })
        .then((h) => {
          handle = h;
          connecting = false;
          flushPending();
          // Poll presence occasionally to show "display connected" on the cashier UI.
          // Require two consecutive misses before showing "disconnected" so a
          // single dropped poll (or a momentary presence gap during the display's
          // reconnect) doesn't make the indicator flap.
          if (presenceTimer) clearInterval(presenceTimer);
          let misses = 0;
          presenceTimer = setInterval(async () => {
            if (!handle) return;
            const connected = await handle.isDisplayConnected();
            if (connected) {
              misses = 0;
              set({ displayConnected: true });
            } else {
              misses += 1;
              if (misses >= 2) set({ displayConnected: false });
            }
          }, 10000);
        })
        .catch(() => {
          connecting = false;
          set({ status: "disabled" });
        });
    },

    teardown: () => {
      if (presenceTimer) {
        clearInterval(presenceTimer);
        presenceTimer = null;
      }
      if (pendingRetryTimer) {
        clearTimeout(pendingRetryTimer);
        pendingRetryTimer = null;
      }
      pendingRetryAttempts = 0;
      pendingEvent = null;
      if (handle) {
        try {
          handle.close();
        } catch {
          // ignore
        }
        handle = null;
      }
      set({ status: "disabled", displayConnected: false });
    },

    enable: (storeId, getAccessToken) => {
      writeActiveFlag(true);
      set({ active: true });
      get().connect(storeId, getAccessToken);
    },

    disable: () => {
      writeActiveFlag(false);
      // Reset the display back to its idle/branding state before disconnecting.
      get().publishIdle(true);
      set({ active: false });
      setTimeout(() => get().teardown(), 300);
    },

    publishBill: (payload) => {
      set({ localMode: "billing" });
      return publishOrQueue(DISPLAY_EVENTS.BILL_UPDATE, {
        ...payload,
        seq: nextSeq(),
      });
    },
    publishPayment: (payload) => {
      set({ localMode: "payment" });
      return publishOrQueue(DISPLAY_EVENTS.MODE_PAYMENT, {
        ...payload,
        seq: nextSeq(),
      });
    },
    publishSuccess: (payload) => {
      set({ localMode: "success" });
      return publishOrQueue(DISPLAY_EVENTS.MODE_SUCCESS, {
        ...payload,
        seq: nextSeq(),
      });
    },
    publishReview: () => {
      return publishOrQueue(DISPLAY_EVENTS.MODE_REVIEW, {
        seq: nextSeq(),
      });
    },
    publishIdle: (force = false) => {
      set({ localMode: "idle" });
      return publishOrQueue(DISPLAY_EVENTS.MODE_IDLE, {
        seq: nextSeq(),
        force: force || undefined,
      });
    },
    publishCustomerSelection: (payload) => {
      return publishOrQueue(DISPLAY_EVENTS.CUSTOMER_SELECTED, {
        ...payload,
        seq: nextSeq(),
      });
    },
    publishDraftField: (field, value, open) => {
      // Doesn't touch localMode — this is a lightweight overlay on top of
      // whatever the display is already showing, not a mode transition.
      return publishOrQueue(DISPLAY_EVENTS.DRAFT_FIELD_UPDATE, {
        field,
        value,
        open,
        seq: nextSeq(),
      });
    },

    isPublisherReady: () => !!handle,

    _setStatus: (status) => set({ status }),
  })
);
