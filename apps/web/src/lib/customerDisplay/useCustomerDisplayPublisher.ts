"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import { useCustomerDisplayStore } from "./controller";
import { buildBillPayload } from "./publishHelpers";

const DEBOUNCE_MS = 250;
// Ably never replays missed messages, so if the display drops a single bill
// snapshot (a websocket blip, a channel silently going suspended/detached, or a
// brief cashier-side reconnect) it would freeze on a stale bill while still
// looking connected. Re-publishing the live bill on a short heartbeat lets the
// display self-heal within a few seconds. Only fires while a bill is actively
// being built, so message volume stays negligible on Ably's free tier.
const HEARTBEAT_MS = 4000;

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("accessToken");
  } catch {
    return null;
  }
}

/**
 * Mounts once (in StoreLayout). When the cashier has enabled the customer
 * display, it connects to Ably and republishes a debounced bill snapshot on
 * every cart change. Completely passive otherwise — it never alters cart state.
 */
export function useCustomerDisplayPublisher(): void {
  const user = useAuthStore((s) => s.user);
  const active = useCustomerDisplayStore((s) => s.active);
  const connect = useCustomerDisplayStore((s) => s.connect);
  const teardown = useCustomerDisplayStore((s) => s.teardown);
  const publishBill = useCustomerDisplayStore((s) => s.publishBill);
  const status = useCustomerDisplayStore((s) => s.status);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-send the current bill if (and only if) the cashier is actively building
  // one. Safe to call repeatedly: it never clobbers the payment / success
  // screens and is a no-op when the cart is empty.
  const resyncBill = useCallback(() => {
    const cd = useCustomerDisplayStore.getState();
    if (!cd.active || cd.localMode !== "billing") return;
    const cart = useCartStore.getState();
    if (!cart.items || cart.items.length === 0) return;
    try {
      publishBill(buildBillPayload());
    } catch {
      // never break billing
    }
  }, [publishBill]);

  // Connect / disconnect based on active flag + auth presence.
  useEffect(() => {
    if (active && user?.storeId) {
      connect(user.storeId, getAccessToken);
    } else if (!active) {
      teardown();
    }
  }, [active, user?.storeId, connect, teardown]);

  // Subscribe to cart changes and publish debounced snapshots while active.
  useEffect(() => {
    if (!active) return;

    const publishNow = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        // Don't clobber the payment / success screen with a stray bill update.
        const localMode = useCustomerDisplayStore.getState().localMode;
        if (localMode === "payment" || localMode === "success") return;
        try {
          publishBill(buildBillPayload());
        } catch {
          // never break billing
        }
      }, DEBOUNCE_MS);
    };

    // Publish an immediate snapshot so a freshly-paired display isn't blank.
    publishNow();

    const unsub = useCartStore.subscribe(publishNow);
    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [active, publishBill]);

  // Heartbeat: keep the display converged on the live bill even if it silently
  // missed a snapshot. Cheap because it only emits while a bill is in progress.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(resyncBill, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [active, resyncBill]);

  // When the cashier's own realtime connection recovers, immediately push the
  // current bill so the display doesn't wait up to a full heartbeat to refresh.
  useEffect(() => {
    if (!active || status !== "connected") return;
    const id = setTimeout(resyncBill, 300);
    return () => clearTimeout(id);
  }, [active, status, resyncBill]);
}
