"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import { useCustomerDisplayStore } from "./controller";
import { buildBillPayload } from "./publishHelpers";

const DEBOUNCE_MS = 250;
// Ably never replays missed messages, so if the display drops a single bill
// snapshot it would freeze on a stale bill. Heartbeat re-publishes while a
// bill is active — and also re-sends idle when the cart is empty but the
// display may still be stuck on old items.
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
  const publishIdle = useCustomerDisplayStore((s) => s.publishIdle);
  const status = useCustomerDisplayStore((s) => s.status);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushCartSnapshot = useCallback(() => {
    const cd = useCustomerDisplayStore.getState();
    if (!cd.active) return;

    // Don't clobber payment / success screens.
    if (cd.localMode === "payment" || cd.localMode === "success") return;

    const cart = useCartStore.getState();
    const hasItems = !!(cart.items && cart.items.length > 0);

    try {
      if (!hasItems) {
        // Clear the display when the cart is emptied (Clear Cart, hold, etc.).
        if (cd.localMode === "billing") {
          publishIdle();
        }
        return;
      }
      publishBill(buildBillPayload());
    } catch {
      // never break billing
    }
  }, [publishBill, publishIdle]);

  // Re-send live state so a missed Ably message can't freeze the display on old items.
  const resync = useCallback(() => {
    const cd = useCustomerDisplayStore.getState();
    if (!cd.active) return;
    if (cd.localMode === "payment" || cd.localMode === "success") return;

    const cart = useCartStore.getState();
    const hasItems = !!(cart.items && cart.items.length > 0);

    try {
      if (!hasItems) {
        // Re-broadcast idle while the cart is empty so a display that missed
        // the clear cannot stay stuck on the previous bill forever.
        publishIdle();
        return;
      }
      // Only refresh while already billing. Never promote idle → billing from
      // heartbeat — leftover cart rows after a sale were re-pushing "Hot Tandoor"
      // (etc.) and freezing the display on a finished bill.
      if (cd.localMode === "billing") {
        publishBill(buildBillPayload());
      }
    } catch {
      // never break billing
    }
  }, [publishBill, publishIdle]);

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
        pushCartSnapshot();
      }, DEBOUNCE_MS);
    };

    // Publish an immediate snapshot so a freshly-paired display isn't blank.
    publishNow();

    const unsub = useCartStore.subscribe(publishNow);
    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [active, pushCartSnapshot]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(resync, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [active, resync]);

  useEffect(() => {
    if (!active || status !== "connected") return;
    const id = setTimeout(resync, 300);
    return () => clearTimeout(id);
  }, [active, status, resync]);
}
