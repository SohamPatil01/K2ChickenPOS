/** Built-in POS percent coupons — server is authoritative. */
export const BUILTIN_PERCENT_COUPONS: Record<string, number> = {
  K2CHICKEN10: 10,
  WELCOME5: 5,
  PADWA5: 5,
  PADWA10: 10,
};

export function normalizeCouponCode(code: unknown): string | null {
  if (!code) return null;
  const cleaned = String(code).trim().toUpperCase().slice(0, 32);
  return cleaned || null;
}

/**
 * Recalculate discount when a known coupon is present.
 * Returns null when no builtin coupon applies (manual / franchise discount path).
 */
export function expectedDiscountForCoupon(
  couponCode: unknown,
  subTotal: number
): { code: string; percent: number; amount: number } | null {
  const code = normalizeCouponCode(couponCode);
  if (!code || BUILTIN_PERCENT_COUPONS[code] == null) return null;
  const percent = BUILTIN_PERCENT_COUPONS[code];
  const amount = Math.round(((subTotal * percent) / 100) * 100) / 100;
  return { code, percent, amount };
}
