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
 * Batched lookups — one query per resolution pass instead of per line item.
 */
export async function resolveSaleItemsForCreate(
  db: Pick<PrismaClient, 'product' | 'category'>,
  items: SaleLineInput[],
  ownerStoreId: string
): Promise<SaleLineInput[]> {
  if (!items.length) return [];

  const candidateIds = [
    ...new Set(
      items
        .map((item) => item.productId)
        .filter((id) => id && !isPlaceholderProductId(id))
    ),
  ];

  const byId = new Map<string, string>();
  if (candidateIds.length > 0) {
    const rows = await db.product.findMany({
      where: { id: { in: candidateIds } },
      select: { id: true },
    });
    for (const row of rows) {
      byId.set(row.id, row.id);
    }
  }

  const unresolvedHints = new Set<string>();
  for (const item of items) {
    if (byId.has(item.productId)) continue;
    const meta = (item.metaJson || {}) as Record<string, unknown>;
    for (const hint of [skuFromMeta(meta), item.productId]) {
      if (hint && !isPlaceholderProductId(hint)) {
        unresolvedHints.add(hint);
      }
    }
  }

  const bySkuOrPlu = new Map<string, string>();
  if (unresolvedHints.size > 0) {
    const hints = [...unresolvedHints];
    const rows = await db.product.findMany({
      where: {
        ownerStoreId,
        OR: [{ sku: { in: hints } }, { plu: { in: hints } }],
      },
      select: { id: true, sku: true, plu: true },
    });
    for (const row of rows) {
      if (row.sku) bySkuOrPlu.set(row.sku, row.id);
      if (row.plu) bySkuOrPlu.set(row.plu, row.id);
    }
  }

  let manualProductId: string | null = null;
  const resolved: SaleLineInput[] = [];

  for (const item of items) {
    if (byId.has(item.productId)) {
      resolved.push(item);
      continue;
    }

    const meta = (item.metaJson || {}) as Record<string, unknown>;
    const hints = [skuFromMeta(meta), item.productId].filter(
      (h): h is string => !!h && !isPlaceholderProductId(h)
    );

    let matchedId: string | null = null;
    for (const hint of hints) {
      const id = bySkuOrPlu.get(hint);
      if (id) {
        matchedId = id;
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
