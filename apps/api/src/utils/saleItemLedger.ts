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
