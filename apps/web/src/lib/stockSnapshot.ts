/** In-memory stock map from the last POS inventory summary — used at Pay without a network round-trip. */

export type StockQty = { kg: number; pcs: number };

let byProductId = new Map<string, StockQty>();

export function setStockSnapshot(
  rows: Record<string, StockQty> | Array<{ productId: string; kg: number; pcs: number }>
): void {
  const next = new Map<string, StockQty>();
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (!r?.productId) continue;
      next.set(r.productId, { kg: r.kg, pcs: r.pcs });
    }
  } else {
    for (const [id, q] of Object.entries(rows)) {
      if (!id) continue;
      next.set(id, { kg: Number(q.kg) || 0, pcs: Number(q.pcs) || 0 });
    }
  }
  byProductId = next;
}

export function getStockSnapshot(): Map<string, StockQty> {
  return byProductId;
}

/**
 * Soft stock gate using the cached summary. Returns false when a line is short.
 * Empty cache = allow (fail-open) so Pay never blocks on missing inventory data.
 */
export function checkCartAgainstStockSnapshot(
  items: Array<{
    productId: string;
    productName?: string;
    qtyKg?: number | null;
    qtyPcs?: number | null;
  }>
): { ok: true } | { ok: false; message: string } {
  if (byProductId.size === 0) return { ok: true };

  for (const line of items) {
    if (!line.productId || line.productId === 'manual') continue;
    const st = byProductId.get(line.productId);
    if (!st) continue;
    const name = line.productName || 'item';
    if (line.qtyKg != null && line.qtyKg > 0 && st.kg + 1e-6 < line.qtyKg) {
      return {
        ok: false,
        message: `Not enough stock for ${name} — only ${st.kg.toFixed(3)} kg on hand`,
      };
    }
    if (line.qtyPcs != null && line.qtyPcs > 0 && st.pcs < line.qtyPcs) {
      return {
        ok: false,
        message: `Not enough stock for ${name} — only ${st.pcs} pcs on hand`,
      };
    }
  }
  return { ok: true };
}
