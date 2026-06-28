"use client";

import type { Realtime, RealtimeChannel } from "ably";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { displayChannelName, type DisplayEventName } from "./types";

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "failed"
  | "disabled";

interface BaseOptions {
  storeId: string;
  onStatus?: (status: ConnectionStatus) => void;
}

/**
 * Shared connection-resilience tuning for both sides:
 *  - Faster reconnect attempts than Ably's defaults so a blip recovers in a few
 *    seconds instead of 15–30s.
 *  - Generous auth/request timeouts so a cold-starting Vercel `/token` function
 *    doesn't cause a token renewal (and therefore the connection) to fail.
 */
const RESILIENCE_OPTIONS = {
  autoConnect: true,
  disconnectedRetryTimeout: 4000,
  suspendedRetryTimeout: 8000,
  realtimeRequestTimeout: 20000,
  httpRequestTimeout: 20000,
} as const;

interface PublisherOptions extends BaseOptions {
  /** Cashier app access token (JWT) used to authorize the Ably token request. */
  getAccessToken: () => string | null;
}

interface SubscriberOptions extends BaseOptions {
  /** Long-lived display session token obtained during pairing. */
  sessionToken: string;
  onEvent: (event: string, data: any) => void;
}

function tokenAuthUrl(): string {
  const base = getApiBaseUrl();
  const origin =
    base || (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}/api/v1/customer-display/token`;
}

/** Lazily load the Ably SDK so it never affects SSR or unrelated bundles. */
async function loadAbly(): Promise<typeof import("ably") | null> {
  try {
    return await import("ably");
  } catch {
    return null;
  }
}

function mapState(state: string): ConnectionStatus {
  switch (state) {
    case "connected":
      return "connected";
    case "connecting":
    case "initialized":
      return "connecting";
    case "disconnected":
      return "reconnecting";
    case "suspended":
      return "reconnecting";
    case "failed":
    case "closed":
      return "failed";
    default:
      return "connecting";
  }
}

export interface DisplayPublisherHandle {
  publish: (event: DisplayEventName, data: any) => void;
  isDisplayConnected: () => Promise<boolean>;
  close: () => void;
}

/**
 * Cashier-side publisher. Connects to the store channel and pushes bill / mode
 * snapshots. Fails closed: if realtime can't initialise, every call is a no-op
 * so billing is never blocked.
 */
export async function createDisplayPublisher(
  opts: PublisherOptions
): Promise<DisplayPublisherHandle> {
  const noop: DisplayPublisherHandle = {
    publish: () => {},
    isDisplayConnected: async () => false,
    close: () => {},
  };

  const token = opts.getAccessToken();
  if (!token || !opts.storeId) {
    opts.onStatus?.("disabled");
    return noop;
  }

  const AblyModule = await loadAbly();
  if (!AblyModule) {
    opts.onStatus?.("disabled");
    return noop;
  }

  let client: Realtime;
  try {
    client = new AblyModule.Realtime({
      authUrl: tokenAuthUrl(),
      authMethod: "GET",
      authHeaders: { Authorization: `Bearer ${token}` },
      ...RESILIENCE_OPTIONS,
      closeOnUnload: true,
    });
  } catch {
    opts.onStatus?.("disabled");
    return noop;
  }

  const channel = client.channels.get(displayChannelName(opts.storeId));

  client.connection.on((stateChange: any) => {
    opts.onStatus?.(mapState(stateChange.current));
  });

  return {
    publish: (event, data) => {
      try {
        void channel.publish(event, data);
      } catch {
        // Never let a publish failure surface into the billing flow.
      }
    },
    isDisplayConnected: async () => {
      try {
        const members = await channel.presence.get();
        return (members || []).some((m: any) =>
          String(m.clientId || "").startsWith("display:")
        );
      } catch {
        return false;
      }
    },
    close: () => {
      try {
        client.close();
      } catch {
        // ignore
      }
    },
  };
}

export interface DisplaySubscriberHandle {
  close: () => void;
}

/**
 * Display-side subscriber. Connects with the paired session token, enters
 * presence (so the cashier can see the display is live) and forwards every
 * event to `onEvent`. The Ably SDK auto-reconnects with backoff.
 */
export async function createDisplaySubscriber(
  opts: SubscriberOptions
): Promise<DisplaySubscriberHandle> {
  const AblyModule = await loadAbly();
  if (!AblyModule) {
    opts.onStatus?.("disabled");
    return { close: () => {} };
  }

  let client: Realtime;
  try {
    client = new AblyModule.Realtime({
      authUrl: tokenAuthUrl(),
      authMethod: "GET",
      authParams: { t: opts.sessionToken },
      ...RESILIENCE_OPTIONS,
      // Always-on display: don't tear the connection down on a stray page
      // lifecycle event (some TV/kiosk browsers fire pagehide on blur). The SDK
      // keeps the socket alive / recovers it instead.
      closeOnUnload: false,
    });
  } catch {
    opts.onStatus?.("disabled");
    return { close: () => {} };
  }

  const channel: RealtimeChannel = client.channels.get(
    displayChannelName(opts.storeId)
  );

  client.connection.on((stateChange: any) => {
    opts.onStatus?.(mapState(stateChange.current));
  });

  // Watch the *channel* (not just the connection). A channel can silently go
  // suspended/detached while the connection still reports "connected" — that's
  // the case where the display looks fine but stops receiving bill updates.
  // Re-attach so messages start flowing again, and re-enter presence so the
  // cashier keeps seeing the display as live.
  channel.on((stateChange: any) => {
    const s = stateChange.current;
    if (s === "attached") {
      try {
        void channel.presence.enter({ at: Date.now() });
      } catch {
        // presence is best-effort
      }
    } else if (s === "suspended" || s === "detached" || s === "failed") {
      opts.onStatus?.("reconnecting");
      try {
        void channel.attach();
      } catch {
        // attach is best-effort; the SDK keeps retrying the connection too
      }
    }
  });

  try {
    // subscribe() implicitly attaches the channel, which fires the "attached"
    // handler above (presence enter). Ably re-attaches automatically on
    // reconnect, so the same handler re-runs and re-enters presence.
    await channel.subscribe((message: any) => {
      opts.onEvent(message.name, message.data);
    });
  } catch {
    opts.onStatus?.("failed");
  }

  return {
    close: () => {
      try {
        client.close();
      } catch {
        // ignore
      }
    },
  };
}
