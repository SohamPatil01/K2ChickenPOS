"use client";

import { create } from "zustand";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import { useNotificationStore } from "@/store/notification";

/**
 * Live till-to-till pre-order claim warnings over Ably Free Tier + BroadcastChannel.
 *
 * Free-tier budget design:
 *  - Reuses the single session Ably WebSocket in `useCustomerProfileInbox` (0 extra connections).
 *  - Uses one store channel `store:{storeId}:pos` with NO Ably Presence and NO heartbeats.
 *  - Publishes ONLY when the set of pre-order IDs in cart actually changes (load / clear / pay),
 *    NEVER on weight edits, keystrokes, or timers (~2 messages per pre-order total).
 */

export const PRE_ORDER_TILL_EVENTS = {
  CLAIM: "preorder.claim",
  RELEASE: "preorder.release",
  BILLED: "preorder.billed",
  SYNC_REQ: "preorder.sync_req",
} as const;

/** Expire stale remote claims if another browser tab crashed without releasing. */
const CLAIM_TTL_MS = 15 * 60 * 1000;
/** Minimum gap between late-joiner sync requests per tab. */
const SYNC_REQ_COOLDOWN_MS = 60 * 1000;
const CLAIM_DEBOUNCE_MS = 250;
const BROADCAST_CHANNEL_NAME = "k2-pos-till-sync";

export const LOCAL_TILL_ID = `till-${Date.now().toString(36)}-${Math.random()
  .toString(36)
  .slice(2, 7)}`;

export interface RemoteTillClaim {
  preOrderId: string;
  tillId: string;
  cashierName: string;
  trackingCode?: string;
  customerName?: string;
  at: number;
}

interface ClaimOrderMeta {
  id: string;
  trackingCode?: string;
  customerName?: string;
}

interface ClaimPayload {
  msgId: string;
  storeId: string;
  tillId: string;
  cashierName: string;
  orders: ClaimOrderMeta[];
  at: number;
}

interface ReleasePayload {
  msgId: string;
  storeId: string;
  tillId: string;
  preOrderIds: string[];
  at: number;
}

interface BilledPayload {
  msgId: string;
  storeId: string;
  tillId: string;
  cashierName: string;
  preOrderIds: string[];
  saleNo: string;
  at: number;
}

interface SyncReqPayload {
  msgId: string;
  storeId: string;
  tillId: string;
  at: number;
}

interface PreOrderTillSyncState {
  /** Active claims held by OTHER tills, keyed by preOrderId. */
  remoteClaims: Record<string, RemoteTillClaim[]>;
  /** Bumped when another till bills/releases an order so open lists refresh immediately. */
  lastRemoteChangeAt: number;
  clearExpired: () => void;
}

export const usePreOrderTillSyncStore = create<PreOrderTillSyncState>((set) => ({
  remoteClaims: {},
  lastRemoteChangeAt: 0,
  clearExpired: () => {
    const cutoff = Date.now() - CLAIM_TTL_MS;
    set((state) => {
      let changed = false;
      const next: Record<string, RemoteTillClaim[]> = {};
      for (const [poId, list] of Object.entries(state.remoteClaims)) {
        const fresh = list.filter((c) => c.at >= cutoff && c.tillId !== LOCAL_TILL_ID);
        if (fresh.length !== list.length) changed = true;
        if (fresh.length > 0) next[poId] = fresh;
      }
      return changed ? { remoteClaims: next } : state;
    });
  },
}));

let ablyPublishFn: ((event: string, data: any) => Promise<boolean>) | null = null;
let broadcastChannel: BroadcastChannel | null = null;
let lastSyncReqAt = 0;
let checkoutInFlight = false;
/** Pre-order IDs already announced via `preorder.billed` so `clearCart` skips redundant `release`. */
const recentlyBilledIds = new Set<string>();
/** Avoid repeating the same conflict toast for the same (tillId, preOrderId) pair. */
const warnedConflictPairs = new Set<string>();
/** Bounded deduplication set so BroadcastChannel + Ably echo never double-processes. */
const seenMsgIds: string[] = [];
const seenMsgIdSet = new Set<string>();

function markMsgSeen(msgId?: string): boolean {
  if (!msgId) return false;
  if (seenMsgIdSet.has(msgId)) return true;
  seenMsgIdSet.add(msgId);
  seenMsgIds.push(msgId);
  if (seenMsgIds.length > 150) {
    const oldest = seenMsgIds.shift();
    if (oldest) seenMsgIdSet.delete(oldest);
  }
  return false;
}

function nextMsgId(): string {
  return `${LOCAL_TILL_ID}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function setPreOrderCheckoutInFlight(inFlight: boolean): void {
  checkoutInFlight = inFlight;
}

/** Extract current pre-order IDs + display metadata from this till's local cart. */
export function getLocalCartPreOrders(): ClaimOrderMeta[] {
  const cart = useCartStore.getState();
  const byId = new Map<string, ClaimOrderMeta>();

  for (const rawId of cart.linkedPreOrderIds || []) {
    const id = String(rawId || "").trim();
    if (id) {
      byId.set(id, {
        id,
        customerName: cart.customerName || undefined,
      });
    }
  }

  for (const item of cart.items || []) {
    const meta = (item as any)?.metaJson;
    const id = typeof meta?.preOrderId === "string" ? meta.preOrderId.trim() : "";
    if (!id) continue;
    const prev = byId.get(id);
    byId.set(id, {
      id,
      trackingCode:
        (typeof meta?.preOrderTrackingCode === "string" && meta.preOrderTrackingCode) ||
        prev?.trackingCode,
      customerName:
        (typeof meta?.preOrderCustomerName === "string" && meta.preOrderCustomerName) ||
        prev?.customerName ||
        cart.customerName ||
        undefined,
    });
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function sendTillEvent(event: string, payload: Record<string, any>): void {
  try {
    broadcastChannel?.postMessage({ event, data: payload });
  } catch {
    // BroadcastChannel unavailable
  }
  if (ablyPublishFn) {
    void ablyPublishFn(event, payload).catch(() => undefined);
  }
}

/**
 * Called by `executeCheckout` right after an online sale settles for pre-order(s).
 * Notifies other tills immediately so they drop the already-billed order before hitting Pay.
 */
export function announcePreOrdersBilled(preOrderIds: string[], saleNo: string): void {
  const cleanIds = [...new Set((preOrderIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (cleanIds.length === 0) return;

  const user = useAuthStore.getState().user;
  if (!user?.storeId) return;

  for (const id of cleanIds) recentlyBilledIds.add(id);

  const payload: BilledPayload = {
    msgId: nextMsgId(),
    storeId: user.storeId,
    tillId: LOCAL_TILL_ID,
    cashierName: user.name || "Another till",
    preOrderIds: cleanIds,
    saleNo,
    at: Date.now(),
  };
  markMsgSeen(payload.msgId);
  sendTillEvent(PRE_ORDER_TILL_EVENTS.BILLED, payload);
}

/**
 * Throttled (>= 60s) late-joiner query when opening the Pre-orders drawer.
 * Tills with empty carts send ZERO replies; only a till actively holding a pre-order replies.
 */
export function requestPreOrderTillSync(): void {
  const now = Date.now();
  if (now - lastSyncReqAt < SYNC_REQ_COOLDOWN_MS) return;
  const user = useAuthStore.getState().user;
  if (!user?.storeId) return;
  lastSyncReqAt = now;

  const payload: SyncReqPayload = {
    msgId: nextMsgId(),
    storeId: user.storeId,
    tillId: LOCAL_TILL_ID,
    at: now,
  };
  markMsgSeen(payload.msgId);
  sendTillEvent(PRE_ORDER_TILL_EVENTS.SYNC_REQ, payload);
}

/** Remove specific pre-order lines + links from this till's cart without touching unrelated items. */
export async function removePreOrdersFromLocalCart(preOrderIds: string[]): Promise<void> {
  const drop = new Set((preOrderIds || []).map((id) => String(id).trim()).filter(Boolean));
  if (drop.size === 0) return;

  const cart = useCartStore.getState();
  const remainingNonMatching = (cart.items || []).filter((it: any) => {
    const poId = it?.metaJson?.preOrderId ? String(it.metaJson.preOrderId).trim() : "";
    return !poId || !drop.has(poId);
  });

  if (remainingNonMatching.length === 0 && (cart.items || []).length > 0) {
    await cart.clearCart();
    return;
  }

  for (const it of cart.items || []) {
    const poId = (it as any)?.metaJson?.preOrderId
      ? String((it as any).metaJson.preOrderId).trim()
      : "";
    if (it.id != null && poId && drop.has(poId)) {
      await cart.removeItem(it.id);
    }
  }
  cart.unlinkPreOrderIds([...drop]);
}

function formatOrderLabel(meta?: { id: string; trackingCode?: string }): string {
  if (!meta) return "Pre-order";
  return meta.trackingCode ? `#${meta.trackingCode}` : `#${meta.id.slice(-6)}`;
}

export function handleIncomingTillEvent(
  event: string,
  raw: any,
  currentStoreId: string | undefined
): void {
  if (!raw || typeof raw !== "object" || !currentStoreId) return;
  if (raw.storeId && raw.storeId !== currentStoreId) return;
  if (raw.tillId === LOCAL_TILL_ID) return;
  if (markMsgSeen(raw.msgId)) return;

  const cutoff = Date.now() - CLAIM_TTL_MS;

  if (event === PRE_ORDER_TILL_EVENTS.CLAIM) {
    const data = raw as ClaimPayload;
    if (!Array.isArray(data.orders) || data.orders.length === 0) return;
    const at = Number(data.at) || Date.now();
    if (at < cutoff) return;

    usePreOrderTillSyncStore.setState((state) => {
      const next: Record<string, RemoteTillClaim[]> = {};
      // First clear any previous claims by this same remote tillId (cart replacement)
      for (const [poId, list] of Object.entries(state.remoteClaims)) {
        const filtered = list.filter((c) => c.tillId !== data.tillId && c.at >= cutoff);
        if (filtered.length > 0) next[poId] = filtered;
      }
      for (const ord of data.orders) {
        if (!ord?.id) continue;
        const entry: RemoteTillClaim = {
          preOrderId: ord.id,
          tillId: data.tillId,
          cashierName: data.cashierName || "Another till",
          trackingCode: ord.trackingCode,
          customerName: ord.customerName,
          at,
        };
        next[ord.id] = [...(next[ord.id] || []), entry];
      }
      return { remoteClaims: next };
    });

    // If THIS till also has the same order open right now, surface a one-shot live toast.
    const localOrders = getLocalCartPreOrders();
    const localIds = new Set(localOrders.map((o) => o.id));
    for (const ord of data.orders) {
      if (!ord?.id || !localIds.has(ord.id)) continue;
      const pairKey = `${data.tillId}:${ord.id}`;
      if (warnedConflictPairs.has(pairKey)) continue;
      warnedConflictPairs.add(pairKey);
      const localMeta = localOrders.find((o) => o.id === ord.id);
      const label = formatOrderLabel({
        id: ord.id,
        trackingCode: ord.trackingCode || localMeta?.trackingCode,
      });
      useNotificationStore
        .getState()
        .showNotification(
          `Order ${label} is also being billed on another till (${data.cashierName || "Staff"}). Only one bill can go through.`,
          "warning",
          6500
        );
    }
    return;
  }

  if (event === PRE_ORDER_TILL_EVENTS.RELEASE) {
    const data = raw as ReleasePayload;
    const releaseSet = new Set(
      (Array.isArray(data.preOrderIds) ? data.preOrderIds : []).map(String)
    );
    if (releaseSet.size === 0) return;

    for (const poId of releaseSet) {
      warnedConflictPairs.delete(`${data.tillId}:${poId}`);
    }

    usePreOrderTillSyncStore.setState((state) => {
      const next: Record<string, RemoteTillClaim[]> = {};
      for (const [poId, list] of Object.entries(state.remoteClaims)) {
        const filtered = releaseSet.has(poId)
          ? list.filter((c) => c.tillId !== data.tillId && c.at >= cutoff)
          : list.filter((c) => c.at >= cutoff);
        if (filtered.length > 0) next[poId] = filtered;
      }
      return { remoteClaims: next, lastRemoteChangeAt: Date.now() };
    });
    return;
  }

  if (event === PRE_ORDER_TILL_EVENTS.BILLED) {
    const data = raw as BilledPayload;
    const billedIds = (Array.isArray(data.preOrderIds) ? data.preOrderIds : [])
      .map((id) => String(id).trim())
      .filter(Boolean);
    if (billedIds.length === 0) return;
    const billedSet = new Set(billedIds);

    usePreOrderTillSyncStore.setState((state) => {
      const next: Record<string, RemoteTillClaim[]> = {};
      for (const [poId, list] of Object.entries(state.remoteClaims)) {
        if (billedSet.has(poId)) continue;
        const fresh = list.filter((c) => c.at >= cutoff);
        if (fresh.length > 0) next[poId] = fresh;
      }
      return { remoteClaims: next, lastRemoteChangeAt: Date.now() };
    });

    // If this till still has that order open in its cart (and isn't mid-POST /sales), remove it right away!
    const localOrders = getLocalCartPreOrders();
    const overlapping = localOrders.filter((o) => billedSet.has(o.id));
    if (overlapping.length > 0 && !checkoutInFlight) {
      const labels = overlapping.map((o) => formatOrderLabel(o)).join(", ");
      for (const o of overlapping) recentlyBilledIds.add(o.id);
      void removePreOrdersFromLocalCart(overlapping.map((o) => o.id)).finally(() => {
        useNotificationStore
          .getState()
          .showNotification(
            `Order ${labels} was just billed on another till (${data.saleNo || "paid"}) — removed from this cart.`,
            "warning",
            7500
          );
      });
    }
    return;
  }

  if (event === PRE_ORDER_TILL_EVENTS.SYNC_REQ) {
    // Only reply if THIS till actively holds an unpaid pre-order in its cart right now (0 messages otherwise).
    const localOrders = getLocalCartPreOrders();
    if (localOrders.length === 0) return;
    const user = useAuthStore.getState().user;
    if (!user?.storeId || user.storeId !== currentStoreId) return;

    const jitterMs = 80 + Math.floor(Math.random() * 180);
    window.setTimeout(() => {
      const stillHeld = getLocalCartPreOrders();
      if (stillHeld.length === 0) return;
      const payload: ClaimPayload = {
        msgId: nextMsgId(),
        storeId: currentStoreId,
        tillId: LOCAL_TILL_ID,
        cashierName: user.name || "Another till",
        orders: stillHeld,
        at: Date.now(),
      };
      markMsgSeen(payload.msgId);
      sendTillEvent(PRE_ORDER_TILL_EVENTS.CLAIM, payload);
    }, jitterMs);
  }
}

/**
 * Attach cart watcher + BroadcastChannel + shared Ably publish function for the session.
 * Called once inside `useCustomerProfileInbox` (RootWrapper).
 */
export function attachPreOrderTillSyncSession(opts: {
  storeId: string;
  publishPosEvent: (event: string, data: any) => Promise<boolean>;
}): () => void {
  const { storeId, publishPosEvent } = opts;
  ablyPublishFn = publishPosEvent;

  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    try {
      broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      broadcastChannel.onmessage = (ev: MessageEvent) => {
        const msg = ev?.data;
        if (msg?.event && msg?.data) {
          handleIncomingTillEvent(msg.event, msg.data, storeId);
        }
      };
    } catch {
      broadcastChannel = null;
    }
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastClaimedIdsKey = "";
  let prevHeldIds: string[] = [];

  const syncCartClaims = () => {
    const currentOrders = getLocalCartPreOrders();
    const currentIds = currentOrders.map((o) => o.id);
    const nextKey = currentIds.join(",");

    if (nextKey === lastClaimedIdsKey) return;

    const droppedIds = prevHeldIds.filter(
      (id) => !currentIds.includes(id) && !recentlyBilledIds.has(id)
    );
    for (const id of prevHeldIds) {
      if (!currentIds.includes(id)) {
        recentlyBilledIds.delete(id);
        for (const k of [...warnedConflictPairs]) {
          if (k.endsWith(`:${id}`)) warnedConflictPairs.delete(k);
        }
      }
    }

    lastClaimedIdsKey = nextKey;
    prevHeldIds = currentIds;

    const user = useAuthStore.getState().user;
    if (!user?.storeId || user.storeId !== storeId) return;

    if (droppedIds.length > 0) {
      const releasePayload: ReleasePayload = {
        msgId: nextMsgId(),
        storeId,
        tillId: LOCAL_TILL_ID,
        preOrderIds: droppedIds,
        at: Date.now(),
      };
      markMsgSeen(releasePayload.msgId);
      sendTillEvent(PRE_ORDER_TILL_EVENTS.RELEASE, releasePayload);
    }

    if (currentOrders.length > 0) {
      const claimPayload: ClaimPayload = {
        msgId: nextMsgId(),
        storeId,
        tillId: LOCAL_TILL_ID,
        cashierName: user.name || "Another till",
        orders: currentOrders,
        at: Date.now(),
      };
      markMsgSeen(claimPayload.msgId);
      sendTillEvent(PRE_ORDER_TILL_EVENTS.CLAIM, claimPayload);
    }
  };

  const scheduleSync = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(syncCartClaims, CLAIM_DEBOUNCE_MS);
  };

  // Announce if cart already holds a pre-order on page reload, and ask other open tills once.
  scheduleSync();
  requestPreOrderTillSync();

  const unsubCart = useCartStore.subscribe(scheduleSync);
  const pruneInterval = window.setInterval(() => {
    usePreOrderTillSyncStore.getState().clearExpired();
  }, 60 * 1000);

  const onPageHide = () => {
    if (prevHeldIds.length === 0) return;
    const releasePayload: ReleasePayload = {
      msgId: nextMsgId(),
      storeId,
      tillId: LOCAL_TILL_ID,
      preOrderIds: prevHeldIds,
      at: Date.now(),
    };
    try {
      broadcastChannel?.postMessage({
        event: PRE_ORDER_TILL_EVENTS.RELEASE,
        data: releasePayload,
      });
    } catch {
      // ignore
    }
  };
  window.addEventListener("pagehide", onPageHide);

  return () => {
    unsubCart();
    window.clearInterval(pruneInterval);
    window.removeEventListener("pagehide", onPageHide);
    if (debounceTimer) clearTimeout(debounceTimer);
    if (ablyPublishFn === publishPosEvent) ablyPublishFn = null;
    try {
      broadcastChannel?.close();
    } catch {
      // ignore
    }
    broadcastChannel = null;
  };
}
