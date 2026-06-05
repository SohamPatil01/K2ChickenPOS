/** Masale/spices — same rules as POS and inventory. */
export function isMasaleProduct(
  categoryName?: string | null,
  productName?: string | null
): boolean {
  const cat = (categoryName || '').toLowerCase();
  const name = (productName || '').toLowerCase();
  return (
    cat.includes('spice') ||
    cat.includes('masale') ||
    cat.includes('masala') ||
    name.includes('masala') ||
    name.includes('masale')
  );
}

export interface MasaleSplitTotals {
  masaleRevenue: number;
  masaleQtyKg: number;
  masaleQtyPcs: number;
  masaleLineCount: number;
  otherRevenue: number;
  otherQtyKg: number;
  otherQtyPcs: number;
}

export function emptyMasaleSplit(): MasaleSplitTotals {
  return {
    masaleRevenue: 0,
    masaleQtyKg: 0,
    masaleQtyPcs: 0,
    masaleLineCount: 0,
    otherRevenue: 0,
    otherQtyKg: 0,
    otherQtyPcs: 0,
  };
}

export function addToMasaleSplit(
  totals: MasaleSplitTotals,
  opts: {
    isMasale: boolean;
    revenue: number;
    qtyKg?: number;
    qtyPcs?: number;
    lines?: number;
  }
): void {
  const qtyKg = opts.qtyKg || 0;
  const qtyPcs = opts.qtyPcs || 0;
  if (opts.isMasale) {
    totals.masaleRevenue = Math.round((totals.masaleRevenue + opts.revenue) * 1000) / 1000;
    totals.masaleQtyKg = Math.round((totals.masaleQtyKg + qtyKg) * 100) / 100;
    totals.masaleQtyPcs += qtyPcs;
    totals.masaleLineCount += opts.lines ?? 1;
  } else {
    totals.otherRevenue = Math.round((totals.otherRevenue + opts.revenue) * 1000) / 1000;
    totals.otherQtyKg = Math.round((totals.otherQtyKg + qtyKg) * 100) / 100;
    totals.otherQtyPcs += qtyPcs;
  }
}

export function masaleSplitFromRows(
  rows: Array<{
    isMasale?: boolean;
    revenue?: number;
    qtyKg?: number;
    qtyPcs?: number;
    lineCount?: number;
  }>
): MasaleSplitTotals {
  const totals = emptyMasaleSplit();
  for (const row of rows) {
    addToMasaleSplit(totals, {
      isMasale: !!row.isMasale,
      revenue: row.revenue || 0,
      qtyKg: row.qtyKg || 0,
      qtyPcs: row.qtyPcs || 0,
      lines: row.lineCount ?? 1,
    });
  }
  return totals;
}
