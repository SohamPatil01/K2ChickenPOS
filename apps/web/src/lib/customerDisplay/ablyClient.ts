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
      autoConnect: true,
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
      autoConnect: true,
      closeOnUnload: true,
    });
  } catch {
    opts.onStatus?.("disabled");
    return { close: () => {} };
  }

  const channel: RealtimeChannel = client.channels.get(
    displayChannelName(opts.storeId)
  );

  client.connection.on((stateChange: any) => {
    const status = mapState(stateChange.current);
    opts.onStatus?.(status);
    if (status === "connected") {
      try {
        void channel.presence.enter({ at: Date.now() });
      } catch {
        // presence is best-effort
      }
    }
  });

  try {
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
