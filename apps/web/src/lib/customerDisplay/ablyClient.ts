"use client";

import type { Realtime, RealtimeChannel } from "ably";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import {
  displayChannelName,
  displayInboundChannelName,
  DISPLAY_EVENTS,
  type CustomerProfileSubmitPayload,
  type DisplayEventName,
  type DraftFieldUpdatePayload,
} from "./types";

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

/** Refresh the cashier JWT if the access token expired (Ably renews every ~12h). */
async function refreshAccessTokenIfNeeded(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;
    const base = getApiBaseUrl();
    const origin = base || window.location.origin;
    const res = await fetch(`${origin}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken?: string };
    if (!data.accessToken) return null;
    localStorage.setItem("accessToken", data.accessToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

/**
 * Fetch a signed Ably TokenRequest from our API.
 * Uses a fresh JWT on every call (authCallback) so renewals don't 401 after ~15m.
 */
async function fetchAblyTokenRequest(opts: {
  getAccessToken?: () => string | null;
  sessionToken?: string;
}): Promise<Record<string, unknown>> {
  const url = new URL(tokenAuthUrl());
  if (opts.sessionToken) {
    url.searchParams.set("t", opts.sessionToken);
  }

  const requestToken = async (accessToken: string | null) => {
    const headers: Record<string, string> = {};
    if (!opts.sessionToken && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return fetch(url.toString(), { method: "GET", headers });
  };

  let accessToken = opts.getAccessToken?.() ?? null;
  let res = await requestToken(accessToken);

  if (res.status === 401 && !opts.sessionToken) {
    const refreshed = await refreshAccessTokenIfNeeded();
    if (refreshed) {
      accessToken = refreshed;
      res = await requestToken(accessToken);
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ably auth ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`);
  }

  return res.json() as Promise<Record<string, unknown>>;
}

function buildAblyAuthCallback(opts: {
  getAccessToken?: () => string | null;
  sessionToken?: string;
}) {
  return (
    _tokenParams: import("ably").TokenParams,
    callback: (
      error: string | import("ably").ErrorInfo | null,
      tokenRequest: import("ably").TokenRequest | import("ably").TokenDetails | string | null
    ) => void
  ) => {
    void fetchAblyTokenRequest(opts)
      .then((tokenRequest) =>
        callback(null, tokenRequest as unknown as import("ably").TokenRequest)
      )
      .catch((err: unknown) => {
        callback(err instanceof Error ? err.message : String(err), null);
      });
  };
}

function createAblyRealtime(
  AblyModule: typeof import("ably"),
  auth: { getAccessToken?: () => string | null; sessionToken?: string },
  extra?: { closeOnUnload?: boolean }
): Realtime {
  return new AblyModule.Realtime({
    authCallback: buildAblyAuthCallback(auth),
    ...RESILIENCE_OPTIONS,
    closeOnUnload: extra?.closeOnUnload ?? true,
  });
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
    client = createAblyRealtime(AblyModule, { getAccessToken: opts.getAccessToken });
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
  /** Publish a customer-typed profile submission back to the cashier. */
  publishProfile: (payload: CustomerProfileSubmitPayload) => void;
  /** Publish a live keystroke/open-close update for a field back to the cashier. */
  publishDraft: (payload: DraftFieldUpdatePayload) => void;
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
  const noop: DisplaySubscriberHandle = {
    publishProfile: () => {},
    publishDraft: () => {},
    close: () => {},
  };

  const AblyModule = await loadAbly();
  if (!AblyModule) {
    opts.onStatus?.("disabled");
    return noop;
  }

  let client: Realtime;
  try {
    client = createAblyRealtime(
      AblyModule,
      { sessionToken: opts.sessionToken },
      { closeOnUnload: false }
    );
  } catch {
    opts.onStatus?.("disabled");
    return noop;
  }

  const channel: RealtimeChannel = client.channels.get(
    displayChannelName(opts.storeId)
  );
  const inboundChannel: RealtimeChannel = client.channels.get(
    displayInboundChannelName(opts.storeId)
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
    publishProfile: (payload) => {
      try {
        void inboundChannel.publish(DISPLAY_EVENTS.CUSTOMER_PROFILE_SUBMIT, payload);
      } catch {
        // Best-effort — the display shows its own "couldn't send" state on failure.
      }
    },
    publishDraft: (payload) => {
      try {
        void inboundChannel.publish(DISPLAY_EVENTS.DRAFT_FIELD_UPDATE, payload);
      } catch {
        // Best-effort — live mirroring is a nice-to-have, never blocks input.
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

interface ProfileInboxOptions extends BaseOptions {
  /** Cashier app access token (JWT) used to authorize the Ably token request. */
  getAccessToken: () => string | null;
  onEvent: (event: string, data: any) => void;
}

export interface CustomerProfileInboxHandle {
  close: () => void;
}

/**
 * Cashier-side inbox. Subscribes only to the narrow inbound channel that the
 * display device is allowed to publish on — kept separate from
 * `createDisplayPublisher` so a compromised/misbehaving display can never
 * reach the main channel that drives the display's own bill/mode state.
 */
export async function createCustomerProfileInbox(
  opts: ProfileInboxOptions
): Promise<CustomerProfileInboxHandle> {
  const noop: CustomerProfileInboxHandle = { close: () => {} };

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
    client = createAblyRealtime(AblyModule, { getAccessToken: opts.getAccessToken });
  } catch {
    opts.onStatus?.("disabled");
    return noop;
  }

  const channel = client.channels.get(displayInboundChannelName(opts.storeId));

  client.connection.on((stateChange: any) => {
    opts.onStatus?.(mapState(stateChange.current));
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
