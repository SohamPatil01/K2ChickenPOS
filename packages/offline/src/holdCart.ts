import { offlineDB, type HeldCartRow } from './db';

export interface HeldCartSnapshot {
  customerId: string | null;
  customerPhone: string | null;
  customerName: string | null;
  discountTotal: number;
  discountType: 'amount' | 'percentage';
  discountPercentage: number;
  fulfillmentType: 'PICKUP' | 'DELIVERY';
  items: Array<{
    productId: string;
    productName: string;
    qtyKg?: number;
    qtyPcs?: number;
    rate: number;
    taxRate: number;
    lineTotal: number;
    metaJson?: Record<string, unknown>;
  }>;
}

export async function saveHeldCart(
  label: string,
  snapshot: HeldCartSnapshot
): Promise<number> {
  return offlineDB.heldCarts.add({
    label: label.trim().slice(0, 80) || `Hold ${new Date().toLocaleTimeString()}`,
    createdAt: Date.now(),
    snapshotJson: JSON.stringify(snapshot),
  });
}

export async function listHeldCarts(): Promise<
  Array<{ id: number; label: string; createdAt: number }>
> {
  const rows = await offlineDB.heldCarts
    .orderBy('createdAt')
    .reverse()
    .toArray();
  return rows
    .filter((r): r is HeldCartRow & { id: number } => typeof r.id === 'number')
    .map((r) => ({ id: r.id, label: r.label, createdAt: r.createdAt }));
}

export async function deleteHeldCart(id: number): Promise<void> {
  await offlineDB.heldCarts.delete(id);
}

export async function getHeldCart(
  id: number
): Promise<{ label: string; snapshot: HeldCartSnapshot } | null> {
  const row = await offlineDB.heldCarts.get(id);
  if (!row) return null;
  return {
    label: row.label,
    snapshot: JSON.parse(row.snapshotJson) as HeldCartSnapshot,
  };
}
