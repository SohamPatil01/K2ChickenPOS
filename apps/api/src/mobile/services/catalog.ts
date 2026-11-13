import { prisma } from '@azela-pos/db';
import { isMasaleProduct } from '@azela-pos/shared';
import { stockByProductIds } from '../../routes/preOrders.js';
import { kgToGrams, rupeesToPaise, type UnitType } from '../domain/money.js';
import type { ProductSnapshot } from '../domain/quote.js';
import { resolveTodaysSpecialProductId } from '../domain/todaysSpecial.js';
import { HttpError } from '../errors.js';

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https:\/\//i.test(url)) return url;
  const base = process.env.MOBILE_PUBLIC_ASSET_BASE_URL;
  if (url.startsWith('/') && base) return `${base.replace(/\/$/, '')}${url}`;
  return null; // never hand the app an http:// or unresolvable URL
}

export async function listStores() {
  const stores = await prisma.store.findMany({ select: { id: true, name: true, type: true }, orderBy: { name: 'asc' } });
  const franchises = stores.filter((s) => s.type === 'FRANCHISE');
  const list = franchises.length ? franchises : stores; // same rule as the public booking page
  const configs = await prisma.mobileStoreConfig.findMany({ where: { storeId: { in: list.map((s) => s.id) } } });
  const byId = new Map(configs.map((c) => [c.storeId, c]));
  return list
    .filter((s) => byId.get(s.id)?.appOrderingEnabled !== false)
    .map((s) => ({ id: s.id, name: s.name, deliveryEnabled: byId.get(s.id)?.deliveryEnabled ?? false }));
}

async function storeContext(storeId: string) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, type: true, parentOwnerStoreId: true },
  });
  if (!store) throw new HttpError(404, 'STORE_NOT_FOUND', 'Store not found');
  const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
  if (!ownerStoreId) throw new HttpError(400, 'STORE_NOT_CONFIGURED', 'Store not configured');
  return { store, ownerStoreId };
}

export type CatalogProduct = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string | null;
  unitType: UnitType;
  unitLabel: string;
  pricePaise: number;
  taxRate: number;
  imageUrl: string | null;
  inStock: boolean;
  availableGrams: number | null;
  availablePieces: number | null;
};

/** Live POS catalog for a store: active products with a current store price + on-hand stock. */
export async function getCatalog(storeId: string) {
  const { store, ownerStoreId } = await storeContext(storeId);
  const products = await prisma.product.findMany({
    where: { ownerStoreId, isActive: true },
    include: {
      category: { select: { id: true, name: true, sortOrder: true } },
      storeProductPrices: { where: { storeId, isActive: true }, orderBy: { effectiveFrom: 'desc' }, take: 1 },
    },
    orderBy: { name: 'asc' },
  });
  const priced = products.filter((p) => (p.storeProductPrices[0]?.pricePerUnit || 0) > 0);
  const stock = await stockByProductIds(storeId, priced.map((p) => p.id));
  const items: CatalogProduct[] = priced.map((p) => {
    const s = stock.get(p.id) || { qtyKg: 0, qtyPcs: 0 };
    const isKg = p.unitType === 'KG';
    const availableGrams = isKg ? kgToGrams(s.qtyKg) : null;
    const availablePieces = isKg ? null : s.qtyPcs;
    return {
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      unitType: p.unitType as UnitType,
      unitLabel: isKg ? 'per kg' : 'per piece',
      pricePaise: rupeesToPaise(p.storeProductPrices[0].pricePerUnit),
      taxRate: p.taxRate || 0,
      imageUrl: isMasaleProduct(p.category?.name, p.name) ? null : resolveImageUrl(p.imageUrl),
      inStock: isKg ? (availableGrams as number) > 1 : (availablePieces as number) > 0,
      availableGrams,
      availablePieces,
    };
  });
  const catMap = new Map<string, { id: string; name: string; sortOrder: number; productCount: number }>();
  for (const p of products) {
    if (!priced.includes(p) || !p.category) continue;
    const c = catMap.get(p.category.id) || { ...p.category, productCount: 0 };
    c.productCount++;
    catMap.set(p.category.id, c);
  }
  const categories = [...catMap.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  items.sort((a, b) => Number(b.inStock) - Number(a.inStock) || a.name.localeCompare(b.name));
  const cfg = await prisma.mobileStoreConfig.findUnique({
    where: { storeId },
    select: { todaysSpecialProductId: true },
  });
  const special = resolveTodaysSpecialProductId({
    storeId,
    inStockProductIds: items.filter((p) => p.inStock).map((p) => p.id),
    manualProductId: cfg?.todaysSpecialProductId ?? null,
  });
  return {
    store: { id: store.id, name: store.name },
    categories,
    products: items,
    todaysSpecialProductId: special.productId,
    todaysSpecialMode: special.mode,
    generatedAt: new Date().toISOString(),
  };
}

/** Pricing/stock snapshots for quoting (always fresh — no cache). */
export async function getProductSnapshots(storeId: string, productIds: string[]): Promise<Map<string, ProductSnapshot>> {
  const { ownerStoreId } = await storeContext(storeId);
  const unique = [...new Set(productIds)].filter(Boolean);
  const map = new Map<string, ProductSnapshot>();
  if (!unique.length) return map;
  const products = await prisma.product.findMany({
    where: { id: { in: unique }, ownerStoreId },
    include: {
      category: { select: { name: true } },
      storeProductPrices: { where: { storeId, isActive: true }, orderBy: { effectiveFrom: 'desc' }, take: 1 },
    },
  });
  const stock = await stockByProductIds(storeId, products.map((p) => p.id));
  for (const p of products) {
    const s = stock.get(p.id) || { qtyKg: 0, qtyPcs: 0 };
    const price = p.storeProductPrices[0]?.pricePerUnit;
    map.set(p.id, {
      id: p.id,
      name: p.name,
      unitType: p.unitType as UnitType,
      taxRate: p.taxRate || 0,
      ratePaise: price && price > 0 ? rupeesToPaise(price) : null,
      isActive: p.isActive,
      stockGrams: kgToGrams(s.qtyKg),
      stockPieces: s.qtyPcs,
      imageUrl: isMasaleProduct(p.category?.name, p.name) ? null : resolveImageUrl(p.imageUrl),
    });
  }
  return map;
}

export async function getProduct(storeId: string, productId: string) {
  const catalog = await getCatalog(storeId);
  const product = catalog.products.find((p) => p.id === productId);
  if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not available at this store');
  const similar = catalog.products
    .filter((p) => p.id !== productId && p.categoryId === product.categoryId && p.inStock)
    .slice(0, 6);
  return { store: catalog.store, product, similar };
}
