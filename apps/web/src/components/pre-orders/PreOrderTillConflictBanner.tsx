"use client";

import { useMemo, useState } from "react";
import { useCartStore } from "@/store/cart";
import {
  removePreOrdersFromLocalCart,
  usePreOrderTillSyncStore,
} from "@/lib/preOrderTillSync";

/**
 * Live banner shown on POS / Cart whenever this till's cart holds an app/pre-order
 * that is simultaneously loaded on another till. Renders nothing otherwise.
 */
export default function PreOrderTillConflictBanner() {
  const items = useCartStore((s) => s.items);
  const linkedPreOrderIds = useCartStore((s) => s.linkedPreOrderIds);
  const remoteClaims = usePreOrderTillSyncStore((s) => s.remoteClaims);
  const [removing, setRemoving] = useState(false);

  const conflicts = useMemo(() => {
    const localById = new Map<string, { id: string; trackingCode?: string }>();
    for (const rawId of linkedPreOrderIds || []) {
      const id = String(rawId || "").trim();
      if (id) localById.set(id, { id });
    }
    for (const it of items || []) {
      const meta = (it as any)?.metaJson;
      const id = typeof meta?.preOrderId === "string" ? meta.preOrderId.trim() : "";
      if (!id) continue;
      localById.set(id, {
        id,
        trackingCode:
          typeof meta?.preOrderTrackingCode === "string"
            ? meta.preOrderTrackingCode
            : localById.get(id)?.trackingCode,
      });
    }

    const active: Array<{
      id: string;
      label: string;
      cashiers: string[];
    }> = [];

    for (const [id, meta] of localById.entries()) {
      const holders = remoteClaims[id];
      if (!holders || holders.length === 0) continue;
      const tracking =
        meta.trackingCode || holders.find((h) => h.trackingCode)?.trackingCode;
      const label = tracking ? `#${tracking}` : `#${id.slice(-6)}`;
      const cashiers = [
        ...new Set(holders.map((h) => h.cashierName || "Another till")),
      ];
      active.push({ id, label, cashiers });
    }

    return active;
  }, [items, linkedPreOrderIds, remoteClaims]);

  if (conflicts.length === 0) return null;

  const summary = conflicts
    .map((c) => `${c.label} (${c.cashiers.join(", ")})`)
    .join(", ");

  const dropFromMyCart = async () => {
    setRemoving(true);
    try {
      await removePreOrdersFromLocalCart(conflicts.map((c) => c.id));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      role="alert"
      className="mb-3 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-600 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm"
    >
      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
        <span className="mt-1 sm:mt-0 inline-block h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
        <p className="text-xs sm:text-sm font-medium text-amber-950 dark:text-amber-100">
          <span className="font-bold">Being billed on another till:</span>{" "}
          Order {summary}. Coordinate before clicking Pay — only one bill will go through.
        </p>
      </div>
      <button
        type="button"
        disabled={removing}
        onClick={() => void dropFromMyCart()}
        className="self-start sm:self-center shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold disabled:opacity-50"
      >
        {removing ? "Removing…" : "Remove from my cart"}
      </button>
    </div>
  );
}
