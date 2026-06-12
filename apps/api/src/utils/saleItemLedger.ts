// @ts-nocheck
/**
 * Map sale line quantities to ledger OUT fields using product unit type.
 * Prevents missing deductions when clients send qty in the wrong field (PCS vs KG).
 */
export function quantitiesForInventoryDeduction(
  item: { qtyKg?: number | null; qtyPcs?: number | null },
  unitType: 'KG' | 'PCS'
): { qtyKg: number | null; qtyPcs: number | null } {
  if (unitType === 'KG') {
    const kg = item.qtyKg;
    if (kg != null && Number(kg) > 0) {
      return { qtyKg: Number(kg), qtyPcs: null };
    }
    const mistaken = item.qtyPcs;
    if (mistaken != null && Number(mistaken) > 0) {
      return { qtyKg: Number(mistaken), qtyPcs: null };
    }
    return { qtyKg: null, qtyPcs: null };
  }

  const pcs = item.qtyPcs;
  if (pcs != null && Number(pcs) > 0) {
    return { qtyKg: null, qtyPcs: Math.round(Number(pcs)) };
  }
  const mistaken = item.qtyKg;
  if (mistaken != null && Number(mistaken) > 0) {
    return { qtyKg: null, qtyPcs: Math.round(Number(mistaken)) };
  }
  return { qtyKg: null, qtyPcs: null };
}

export function shouldDeductInventoryForProduct(productId: string | null | undefined): boolean {
  if (!productId) return false;
  const id = String(productId).trim();
  if (!id || id === 'manual' || id === 'MANUAL') return false;
  return true;
}

type LedgerDb = {
  inventoryLedger: {
    findMany: (args: any) => Promise<
      Array<{ productId: string; qtyKg: number | null; qtyPcs: number | null }>
    >;
    create: (args: any) => Promise<unknown>;
  };
};

/**
 * Idempotent sale inventory sync: compares SALE OUT totals per product to sale lines
 * and writes OUT (or IN adjustment) for any missing/excess quantity.
 */
export async function ensureInventoryDeductedForSale(
  db: LedgerDb,
  saleId: string,
  storeId: string,
  items: Array<{
    productId: string;
    qtyKg?: number | null;
    qtyPcs?: number | null;
    metaJson?: { manualLine?: boolean; manualEntry?: boolean } | null;
  }>,
  unitTypeByProductId: Map<string, 'KG' | 'PCS'>
): Promise<void> {
  const existing = await db.inventoryLedger.findMany({
    where: {
      refId: saleId,
      reason: 'SALE',
      type: 'OUT',
      storeId,
    },
    select: { productId: true, qtyKg: true, qtyPcs: true },
  });

  const deductedByProduct = new Map<string, { kg: number; pcs: number }>();
  for (const row of existing) {
    const cur = deductedByProduct.get(row.productId) || { kg: 0, pcs: 0 };
    cur.kg += Number(row.qtyKg) || 0;
    cur.pcs += Number(row.qtyPcs) || 0;
    deductedByProduct.set(row.productId, cur);
  }

  const expectedByProduct = new Map<string, { kg: number; pcs: number }>();
  for (const item of items) {
    if (item.metaJson?.manualLine) continue;
    if (!shouldDeductInventoryForProduct(item.productId)) continue;
    if (!unitTypeByProductId.has(item.productId)) continue;

    const ut = unitTypeByProductId.get(item.productId) || 'KG';
    const { qtyKg, qtyPcs } = quantitiesForInventoryDeduction(item, ut);
    const addKg = qtyKg != null && qtyKg > 0 ? Number(qtyKg) : 0;
    const addPcs = qtyPcs != null && qtyPcs > 0 ? Number(qtyPcs) : 0;
    if (addKg <= 0 && addPcs <= 0) continue;

    const cur = expectedByProduct.get(item.productId) || { kg: 0, pcs: 0 };
    cur.kg = Math.round((cur.kg + addKg) * 1000) / 1000;
    cur.pcs += addPcs;
    expectedByProduct.set(item.productId, cur);
  }

  const allProductIds = new Set([...deductedByProduct.keys(), ...expectedByProduct.keys()]);
  for (const productId of allProductIds) {
    const expected = expectedByProduct.get(productId) || { kg: 0, pcs: 0 };
    const deducted = deductedByProduct.get(productId) || { kg: 0, pcs: 0 };
    const deltaKg = Math.round((expected.kg - deducted.kg) * 1000) / 1000;
    const deltaPcs = Math.round(expected.pcs - deducted.pcs);

    if (Math.abs(deltaKg) < 0.001 && deltaPcs === 0) continue;

    if (deltaKg > 0.001 || deltaPcs > 0) {
      await db.inventoryLedger.create({
        data: {
          storeId,
          productId,
          type: 'OUT',
          qtyKg: deltaKg > 0.001 ? deltaKg : null,
          qtyPcs: deltaPcs > 0 ? deltaPcs : null,
          reason: 'SALE',
          refId: saleId,
        },
      });
      continue;
    }

    const restoreKg = deltaKg < -0.001 ? Math.abs(deltaKg) : null;
    const restorePcs = deltaPcs < 0 ? Math.abs(deltaPcs) : null;
    if (restoreKg != null || (restorePcs != null && restorePcs > 0)) {
      await db.inventoryLedger.create({
        data: {
          storeId,
          productId,
          type: 'IN',
          qtyKg: restoreKg,
          qtyPcs: restorePcs,
          reason: 'ADJUSTMENT',
          refId: saleId,
        },
      });
    }
  }
}
