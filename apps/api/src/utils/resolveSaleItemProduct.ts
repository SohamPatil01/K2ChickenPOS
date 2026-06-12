import type { PrismaClient } from '@azela-pos/db';

export const MANUAL_ENTRY_SKU = 'MANUAL-ENTRY';

type SaleLineInput = {
  productId: string;
  qtyKg?: number;
  qtyPcs?: number;
  rate: number;
  taxRate: number;
  metaJson?: Record<string, unknown>;
};

function isPlaceholderProductId(productId: string): boolean {
  const v = String(productId || '').trim().toLowerCase();
  return !v || v === 'manual' || v === 'manual-entry';
}

function skuFromMeta(meta?: Record<string, unknown>): string | null {
  if (!meta) return null;
  for (const key of ['sku', 'barcode', 'plu']) {
    const raw = meta[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return null;
}

async function getOrCreateManualProduct(
  db: Pick<PrismaClient, 'product' | 'category'>,
  ownerStoreId: string
): Promise<string> {
  const existing = await db.product.findFirst({
    where: { ownerStoreId, sku: MANUAL_ENTRY_SKU },
    select: { id: true },
  });
  if (existing) return existing.id;

  let category = await db.category.findFirst({
    where: { ownerStoreId },
    orderBy: { sortOrder: 'asc' },
    select: { id: true },
  });
  if (!category) {
    category = await db.category.create({
      data: { ownerStoreId, name: 'General', sortOrder: 0 },
      select: { id: true },
    });
  }

  const created = await db.product.create({
    data: {
      ownerStoreId,
      sku: MANUAL_ENTRY_SKU,
      plu: MANUAL_ENTRY_SKU,
      name: 'Manual entry',
      categoryId: category.id,
      unitType: 'KG',
      taxRate: 0,
      isActive: true,
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * Map client product ids (including "manual" / unknown SKU strings) to real Product rows.
 * Manual lines use a per-owner placeholder product and skip stock deduction via metaJson.manualLine.
 */
export async function resolveSaleItemsForCreate(
  db: Pick<PrismaClient, 'product' | 'category'>,
  items: SaleLineInput[],
  ownerStoreId: string
): Promise<SaleLineInput[]> {
  let manualProductId: string | null = null;
  const resolved: SaleLineInput[] = [];

  for (const item of items) {
    const meta = (item.metaJson || {}) as Record<string, unknown>;
    const byId = await db.product.findUnique({
      where: { id: item.productId },
      select: { id: true },
    });
    if (byId) {
      resolved.push(item);
      continue;
    }

    const hints = [skuFromMeta(meta), item.productId].filter(
      (h): h is string => !!h && !isPlaceholderProductId(h)
    );
    let matchedId: string | null = null;
    for (const hint of hints) {
      const bySku = await db.product.findFirst({
        where: {
          ownerStoreId,
          OR: [{ sku: hint }, { plu: hint }],
        },
        select: { id: true },
      });
      if (bySku) {
        matchedId = bySku.id;
        break;
      }
    }
    if (matchedId) {
      resolved.push({ ...item, productId: matchedId });
      continue;
    }

    if (!manualProductId) {
      manualProductId = await getOrCreateManualProduct(db, ownerStoreId);
    }
    resolved.push({
      ...item,
      productId: manualProductId,
      metaJson: {
        ...meta,
        manualEntry: true,
        manualLine: true,
        originalProductId: item.productId,
      },
    });
  }

  return resolved;
}
