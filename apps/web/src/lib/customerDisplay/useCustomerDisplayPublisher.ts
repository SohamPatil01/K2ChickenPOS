"use client";

import { useEffect, useRef } from "react";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import { useCustomerDisplayStore } from "./controller";
import { buildBillPayload } from "./publishHelpers";

const DEBOUNCE_MS = 250;

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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
}
