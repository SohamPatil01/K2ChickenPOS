"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import { useCustomerDisplayStore } from "./controller";
import { buildBillPayload } from "./publishHelpers";

const DEBOUNCE_MS = 200;
const HEARTBEAT_MS = 5000;
/** After a sale, ignore leftover IndexedDB cart rows so they can't re-freeze the TV. */
const POST_SALE_GRACE_MS = 12000;

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("accessToken");
  } catch {
    return null;
  }
}

function cartFingerprint(): string {
  const cart = useCartStore.getState();
  return JSON.stringify({
    items: (cart.items || []).map((it) => ({
      id: it.id,
      productId: it.productId,
      qtyKg: it.qtyKg,
      qtyPcs: it.qtyPcs,
      rate: it.rate,
      lineTotal: it.lineTotal,
    })),
    customerName: cart.customerName,
    discountTotal: cart.discountTotal,
    deliveryFee: cart.deliveryFee,
  });
}

/**
 * Mounts once (in StoreLayout). Cart is the source of truth for the display:
 *  - items present → billing snapshot
 *  - cart empty → idle (clears a stuck bill)
 *  - payment / success briefly suppress overwrites
 *  - post-sale grace ignores ghost cart rows that reappear from IndexedDB
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
  const lastFpRef = useRef<string>("");
  const lastIdleHealRef = useRef(0);
  const ignoreBillUntilRef = useRef(0);
  const prevModeRef = useRef(useCustomerDisplayStore.getState().localMode);

  // When success starts, open a grace window so a late clearCart / loadCart race
  // cannot push the just-paid items back onto the TV.
  useEffect(() => {
    if (!active) return;
    return useCustomerDisplayStore.subscribe((state) => {
      const prev = prevModeRef.current;
      prevModeRef.current = state.localMode;
      if (state.localMode === "success" && prev !== "success") {
        ignoreBillUntilRef.current = Date.now() + POST_SALE_GRACE_MS;
        lastFpRef.current = "";
      }
      if (state.localMode === "idle" && prev === "success") {
        ignoreBillUntilRef.current = Date.now() + POST_SALE_GRACE_MS;
      }
    });
  }, [active]);

  const syncDisplay = useCallback(
    (opts?: { force?: boolean }) => {
      const cd = useCustomerDisplayStore.getState();
      if (!cd.active) return;

      const cart = useCartStore.getState();
      const hasItems = !!(cart.items && cart.items.length > 0);
      const now = Date.now();
      const inGrace = now < ignoreBillUntilRef.current;
      const mode = cd.localMode;

      try {
        // Success animation owns the screen briefly.
        if (mode === "success") {
          return;
        }

        // Empty cart always clears the display (even if we were mid-payment).
        if (!hasItems) {
          if (mode !== "idle" || opts?.force) {
            publishIdle();
            lastFpRef.current = "empty";
            lastIdleHealRef.current = now;
            return;
          }
          // Heal a TV that missed idle — at most once every 15s while empty.
          if (now - lastIdleHealRef.current > 15000) {
            publishIdle();
            lastIdleHealRef.current = now;
          }
          return;
        }

        // Ghost rows after sale — do not resurrect the old bill.
        if (inGrace) {
          return;
        }

        // Payment QR owns the screen while the cashier is checking out.
        if (mode === "payment") {
          return;
        }

        const fp = cartFingerprint();
        if (!opts?.force && fp === lastFpRef.current && mode === "billing") {
          return;
        }
        lastFpRef.current = fp;
        publishBill(buildBillPayload());
      } catch {
        // never break billing
      }
    },
    [publishBill, publishIdle]
  );

  useEffect(() => {
    if (active && user?.storeId) {
      connect(user.storeId, getAccessToken);
    } else if (!active) {
      teardown();
    }
  }, [active, user?.storeId, connect, teardown]);

  useEffect(() => {
    if (!active) return;

    const publishNow = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => syncDisplay(), DEBOUNCE_MS);
    };

    publishNow();
    const unsub = useCartStore.subscribe(publishNow);
    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [active, syncDisplay]);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => syncDisplay({ force: false }), HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [active, syncDisplay]);

  useEffect(() => {
    if (!active || status !== "connected") return;
    const id = setTimeout(() => syncDisplay({ force: true }), 400);
    return () => clearTimeout(id);
  }, [active, status, syncDisplay]);
}
