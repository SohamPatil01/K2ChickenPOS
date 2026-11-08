/**
 * Money is integer paise; weight is integer grams. The POS stores floats in rupees/kg —
 * conversion happens only at this boundary.
 *
 * Pricing mirrors POS billing in routes/sales.ts:
 *   lineTotal = round2(qty × rate); taxAmount = round2(lineTotal × taxRate / 100) (tax exclusive)
 *   grandTotal rounded to the nearest rupee.
 */
export type UnitType = 'KG' | 'PCS';

export function rupeesToPaise(rupees: number | null | undefined): number {
  const n = Number(rupees);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100;
}

export function kgToGrams(kg: number | null | undefined): number {
  const n = Number(kg);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 1000);
}

export function gramsToKg(grams: number): number {
  return Math.round(grams) / 1000;
}

/** Line subtotal (pre-tax) in paise for a per-kg or per-piece rate. */
export function lineSubtotalPaise(unitType: UnitType, ratePaise: number, qty: { grams?: number; pieces?: number }): number {
  if (unitType === 'KG') {
    const grams = Math.max(0, Math.round(qty.grams ?? 0));
    return Math.round((ratePaise * grams) / 1000);
  }
  const pieces = Math.max(0, Math.round(qty.pieces ?? 0));
  return ratePaise * pieces;
}

export function taxPaise(subtotalPaise: number, taxRatePercent: number): number {
  const rate = Number(taxRatePercent) || 0;
  if (rate <= 0) return 0;
  return Math.round((subtotalPaise * rate) / 100);
}

/** Nearest-rupee rounding as the POS does for grand totals. Returns the adjustment in paise. */
export function roundToRupee(paise: number): { totalPaise: number; roundOffPaise: number } {
  const totalPaise = Math.round(paise / 100) * 100;
  return { totalPaise, roundOffPaise: totalPaise - paise };
}

export function formatInr(paise: number): string {
  const r = paise / 100;
  return `₹${r.toLocaleString('en-IN', { minimumFractionDigits: r % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
