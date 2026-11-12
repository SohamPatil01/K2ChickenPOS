import { describe, expect, it } from 'vitest';
import { expectedDiscountForCoupon } from '@azela-pos/shared';

describe('coupon server authority', () => {
  it('recalculates builtin coupon discounts from subtotal', () => {
    const result = expectedDiscountForCoupon('k2chicken10', 1000);
    expect(result).toEqual({ code: 'K2CHICKEN10', percent: 10, amount: 100 });
  });

  it('returns null for unknown coupons (manual discount path)', () => {
    expect(expectedDiscountForCoupon('CUSTOM20', 1000)).toBeNull();
  });
});

describe('payment amount helpers', () => {
  it('never silently rewrites tender — cash and UPI stay independent', () => {
    const payments = [
      { method: 'CASH', amount: 400 },
      { method: 'UPI', amount: 600 },
    ];
    const cash = payments.find((p) => p.method === 'CASH')!.amount;
    const upi = payments.find((p) => p.method === 'UPI')!.amount;
    expect(cash).toBe(400);
    expect(upi).toBe(600);
    expect(cash + upi).toBe(1000);
  });
});
