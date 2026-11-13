import { istParts } from './time.js';

/** Stable daily index so every customer sees the same random special. */
export function dailySpecialIndex(storeId: string, ymd: string, modulo: number): number {
  if (modulo <= 0) return 0;
  let h = 2166136261;
  const key = `${storeId}:${ymd}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % modulo;
}

/**
 * POS override wins when that product is still in stock; otherwise a deterministic
 * daily random among in-stock ids (same for all customers that IST day).
 */
export function resolveTodaysSpecialProductId(opts: {
  storeId: string;
  inStockProductIds: string[];
  manualProductId?: string | null;
  now?: Date;
}): { productId: string | null; mode: 'MANUAL' | 'RANDOM' | 'NONE' } {
  const ids = opts.inStockProductIds.filter(Boolean);
  if (!ids.length) return { productId: null, mode: 'NONE' };
  const manual = opts.manualProductId?.trim() || null;
  if (manual && ids.includes(manual)) return { productId: manual, mode: 'MANUAL' };
  const ymd = istParts(opts.now ?? new Date()).ymd;
  const sorted = [...ids].sort(); // stable order across catalog reshuffles
  return { productId: sorted[dailySpecialIndex(opts.storeId, ymd, sorted.length)], mode: 'RANDOM' };
}
