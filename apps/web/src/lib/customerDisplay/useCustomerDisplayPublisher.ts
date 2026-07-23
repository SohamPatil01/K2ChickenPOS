"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import { useCustomerDisplayStore } from "./controller";
import { buildBillPayload } from "./publishHelpers";

const DEBOUNCE_MS = 150;
const HEARTBEAT_MS = 3000;
const POST_SALE_GRACE_MS = 8000;
const LEADER_KEY = "k2-cd-publisher-leader";
const LEADER_TTL_MS = 4000;

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
  return JSON.stringify(
    (cart.items || []).map((it) => ({
      id: it.id,
      productId: it.productId,
      qtyKg: it.qtyKg,
      qtyPcs: it.qtyPcs,
      rate: it.rate,
      lineTotal: it.lineTotal,
    }))
  );
}

function readLeader(): { id: string; ts: number; hasItems?: boolean } | null {
  try {
    const raw = localStorage.getItem(LEADER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.id || !parsed?.ts) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Only one browser tab may publish to the customer display. Otherwise an empty
 * cart tab keeps sending idle and wipes the live bill from the active cart tab.
 * Tabs with cart items steal leadership from empty tabs.
 */
function claimPublisherLeadership(tabId: string, hasItems: boolean): boolean {
  if (typeof window === "undefined") return false;
  const now = Date.now();
  const cur = readLeader();
  if (cur && now - cur.ts < LEADER_TTL_MS && cur.id !== tabId) {
    // Steal if we have a live cart and the current leader does not.
    if (!(hasItems && !cur.hasItems)) {
      return false;
    }
  }
  try {
    localStorage.setItem(
      LEADER_KEY,
      JSON.stringify({ id: tabId, ts: now, hasItems })
    );
  } catch {
    return true;
  }
  const again = readLeader();
  return !again || again.id === tabId;
}

/**
 * Cart → customer display sync (single-tab leader).
 */
export function useCustomerDisplayPublisher(): void {
  const user = useAuthStore((s) => s.user);
  const active = useCustomerDisplayStore((s) => s.active);
  const connect = useCustomerDisplayStore((s) => s.connect);
  const teardown = useCustomerDisplayStore((s) => s.teardown);
  const status = useCustomerDisplayStore((s) => s.status);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentFpRef = useRef<string>("");
  const ignoreBillUntilRef = useRef(0);
  const ghostFpRef = useRef<string>("");
  const prevModeRef = useRef(useCustomerDisplayStore.getState().localMode);
  const tabIdRef = useRef(
    `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  );
  const isLeaderRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    return useCustomerDisplayStore.subscribe((state) => {
      const prev = prevModeRef.current;
      prevModeRef.current = state.localMode;
      if (state.localMode === "success" && prev !== "success") {
        ghostFpRef.current = cartFingerprint();
        ignoreBillUntilRef.current = Date.now() + POST_SALE_GRACE_MS;
        lastSentFpRef.current = "";
      }
    });
  }, [active]);

  // Renew leadership while this tab has the display enabled.
  useEffect(() => {
    if (!active) {
      isLeaderRef.current = false;
      return;
    }
    const tick = () => {
      const hasItems = useCartStore.getState().items.length > 0;
      isLeaderRef.current = claimPublisherLeadership(tabIdRef.current, hasItems);
    };
    tick();
    const id = setInterval(tick, 1500);
    const onStorage = (e: StorageEvent) => {
      if (e.key === LEADER_KEY) tick();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      clearInterval(id);
      window.removeEventListener("storage", onStorage);
      // Release leadership if we still hold it.
      const cur = readLeader();
      if (cur?.id === tabIdRef.current) {
        try {
          localStorage.removeItem(LEADER_KEY);
        } catch {
          // ignore
        }
      }
      isLeaderRef.current = false;
    };
  }, [active]);

  const syncDisplay = useCallback((opts?: { force?: boolean }) => {
    const cd = useCustomerDisplayStore.getState();
    if (!cd.active) return;
    const cart = useCartStore.getState();
    const hasItems = !!(cart.items && cart.items.length > 0);
    if (
      !isLeaderRef.current &&
      !claimPublisherLeadership(tabIdRef.current, hasItems)
    ) {
      return;
    }
    isLeaderRef.current = true;

    const now = Date.now();
    const mode = cd.localMode;
    const fp = cartFingerprint();

    try {
      if (mode === "success") return;

      if (!hasItems) {
        // Only publish idle when leaving a live bill/payment — never spam idle
        // from empty tabs (that was wiping the live cart tab's bill).
        if (mode === "billing" || mode === "payment") {
          const ok = cd.publishIdle();
          if (ok) lastSentFpRef.current = "empty";
        }
        return;
      }

      const inGrace = now < ignoreBillUntilRef.current;
      if (inGrace && fp === ghostFpRef.current) {
        return;
      }

      if (mode === "payment") return;

      if (
        !opts?.force &&
        mode === "billing" &&
        fp === lastSentFpRef.current
      ) {
        return;
      }

      const ok = cd.publishBill(buildBillPayload());
      if (ok) lastSentFpRef.current = fp;
    } catch {
      // never break billing
    }
  }, []);

  useEffect(() => {
    if (active && user?.storeId) {
      connect(user.storeId, getAccessToken);
    } else if (!active) {
      teardown();
    }
  }, [active, user?.storeId, connect, teardown]);

  useEffect(() => {
    if (!active) return;

    const schedule = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => syncDisplay({ force: true }), DEBOUNCE_MS);
    };

    schedule();
    const unsub = useCartStore.subscribe(schedule);
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
    lastSentFpRef.current = "";
    const id = setTimeout(() => syncDisplay({ force: true }), 200);
    return () => clearTimeout(id);
  }, [active, status, syncDisplay]);
}
