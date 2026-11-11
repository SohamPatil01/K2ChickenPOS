import { describe, expect, it } from 'vitest';
import { normalizeIndianMobile, posPhoneVariants } from './phone.js';
import { lineSubtotalPaise, roundToRupee, rupeesToPaise, taxPaise } from './money.js';
import { buildQuote, type ProductSnapshot, type QuoteInput } from './quote.js';
import { getRewardsConfig, maxRedeemablePoints } from './rewards.js';
import { generateSlots, DEFAULT_HOURS, isValidSlot } from './slots.js';
import { istDateAt, istParts, isWithinWindow } from './time.js';
import { medianIntervalPredictor, isReorderReminderDue, median } from './prediction.js';
import { nextPlanOccurrence, upcomingPlanDates } from './weeklyPlan.js';
import { decideSend, DEFAULT_PREFS } from './notificationPolicy.js';
import { bucketOf, variantFor } from './experiments.js';
import { buildTimeline, deriveStatus } from './orderStatus.js';
import { sanitizeProperties } from './analyticsEvents.js';
import { generateOtp, hashOtp, otpMatches } from './otp.js';

process.env.JWT_SECRET ||= 'test-secret-for-unit-tests-only-32chars';

describe('phone', () => {
  it('accepts Indian mobiles in common formats', () => {
    expect(normalizeIndianMobile('9876543210')).toBe('9876543210');
    expect(normalizeIndianMobile('+91 98765-43210')).toBe('9876543210');
    expect(normalizeIndianMobile('919876543210')).toBe('9876543210');
    expect(normalizeIndianMobile('09876543210')).toBe('9876543210');
  });
  it('rejects landlines, short numbers and non-Indian prefixes', () => {
    expect(normalizeIndianMobile('1234567890')).toBeNull();
    expect(normalizeIndianMobile('98765')).toBeNull();
    expect(normalizeIndianMobile('')).toBeNull();
    expect(normalizeIndianMobile('5876543210')).toBeNull();
  });
  it('lists legacy POS variants', () => {
    expect(posPhoneVariants('9876543210')).toContain('919876543210');
  });
});

describe('money', () => {
  it('converts rupees to integer paise without float drift', () => {
    expect(rupeesToPaise(280.1)).toBe(28010);
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
  });
  it('prices per kg by grams and per piece', () => {
    expect(lineSubtotalPaise('KG', 28000, { grams: 750 })).toBe(21000);
    expect(lineSubtotalPaise('KG', 33333, { grams: 250 })).toBe(8333);
    expect(lineSubtotalPaise('PCS', 1200, { pieces: 6 })).toBe(7200);
  });
  it('computes exclusive tax and rupee rounding like the POS', () => {
    expect(taxPaise(10000, 5)).toBe(500);
    expect(taxPaise(10000, 0)).toBe(0);
    expect(roundToRupee(21049)).toEqual({ totalPaise: 21000, roundOffPaise: -49 });
    expect(roundToRupee(21050)).toEqual({ totalPaise: 21100, roundOffPaise: 50 });
  });
});

const product = (o: Partial<ProductSnapshot> = {}): ProductSnapshot => ({
  id: 'p1',
  name: 'Curry Cut',
  unitType: 'KG',
  taxRate: 0,
  ratePaise: 28000,
  isActive: true,
  stockGrams: 5000,
  stockPieces: 0,
  imageUrl: null,
  ...o,
});

function quoteInput(o: Partial<QuoteInput> = {}): QuoteInput {
  return {
    lines: [{ productId: 'p1', grams: 1000 }],
    products: new Map([['p1', product()]]),
    fulfillment: 'PICKUP',
    delivery: { enabled: false, feePaise: 0, freeAbovePaise: null, serviceable: null },
    minOrderPaise: 0,
    cutOptions: [{ id: 'small', label: 'Small pieces' }],
    loyalty: { requestedPoints: 0, availablePoints: null, config: getRewardsConfig() },
    ...o,
  };
}

describe('quote', () => {
  it('prices a simple pickup basket', () => {
    const q = buildQuote(quoteInput());
    expect(q.merchandisePaise).toBe(28000);
    expect(q.totalPaise).toBe(28000);
    expect(q.canCheckout).toBe(true);
  });
  it('flags unavailable, out-of-stock and insufficient stock lines', () => {
    const q = buildQuote(
      quoteInput({
        lines: [
          { productId: 'gone', grams: 500 },
          { productId: 'p1', grams: 6000 },
          { productId: 'p2', grams: 500 },
        ],
        products: new Map([
          ['p1', product()],
          ['p2', product({ id: 'p2', stockGrams: 0 })],
        ]),
      })
    );
    expect(q.lines.map((l) => l.status)).toEqual(['UNAVAILABLE', 'INSUFFICIENT_STOCK', 'OUT_OF_STOCK']);
    expect(q.canCheckout).toBe(false);
    expect(q.merchandisePaise).toBe(0);
  });
  it('rejects weights off the 250 g step', () => {
    const q = buildQuote(quoteInput({ lines: [{ productId: 'p1', grams: 300 }] }));
    expect(q.lines[0].status).toBe('INVALID_QUANTITY');
  });
  it('detects price changes for reorder', () => {
    const q = buildQuote(quoteInput({ lines: [{ productId: 'p1', grams: 1000, previousRatePaise: 26000 }] }));
    expect(q.lines[0].status).toBe('PRICE_CHANGED');
    expect(q.hasPriceChanges).toBe(true);
    expect(q.canCheckout).toBe(true);
  });
  it('caps loyalty redemption at 5% of merchandise and the balance', () => {
    const q = buildQuote(
      quoteInput({
        lines: [{ productId: 'p1', grams: 4000 }], // ₹1120
        loyalty: { requestedPoints: 500, availablePoints: 400, config: getRewardsConfig() },
      })
    );
    expect(q.loyalty.maxRedeemablePoints).toBe(56);
    expect(q.loyalty.appliedPoints).toBe(56);
    expect(q.totalPaise).toBe(112000 - 5600);
  });
  it('blocks delivery when the store has not enabled it', () => {
    const q = buildQuote(quoteInput({ fulfillment: 'DELIVERY' }));
    expect(q.issues.map((i) => i.code)).toContain('DELIVERY_UNAVAILABLE');
    expect(q.canCheckout).toBe(false);
  });
  it('applies delivery fee and free-delivery threshold', () => {
    const base = { enabled: true, feePaise: 3000, freeAbovePaise: 50000, serviceable: true };
    expect(buildQuote(quoteInput({ fulfillment: 'DELIVERY', delivery: base })).deliveryFeePaise).toBe(3000);
    expect(
      buildQuote(quoteInput({ fulfillment: 'DELIVERY', delivery: base, lines: [{ productId: 'p1', grams: 2000 }] }))
        .deliveryFeePaise
    ).toBe(0);
  });
  it('ignores unknown cut options and keeps known ones', () => {
    const q = buildQuote(
      quoteInput({ lines: [{ productId: 'p1', grams: 1000, cutOptionId: 'small' }, { productId: 'p1', grams: 500, cutOptionId: 'bogus' }] })
    );
    expect(q.lines[0].cutLabel).toBe('Small pieces');
    expect(q.lines[1].cutOptionId).toBeNull();
  });
});

describe('rewards', () => {
  const cfg = getRewardsConfig();
  it('returns zero below the minimum redeemable balance', () => {
    expect(maxRedeemablePoints({ availablePoints: cfg.minPointsToRedeem - 1, merchandisePaise: 1_000_000, config: cfg })).toBe(0);
  });
  it('never exceeds balance', () => {
    expect(maxRedeemablePoints({ availablePoints: 60, merchandisePaise: 10_000_000, config: cfg })).toBe(60);
  });
});

describe('time and slots', () => {
  it('converts IST correctly', () => {
    const d = istDateAt('2026-11-08', 8 * 60);
    expect(d.toISOString()).toBe('2026-11-08T02:30:00.000Z');
    expect(istParts(d)).toEqual({ ymd: '2026-11-08', weekday: 0, minutes: 480 });
  });
  it('handles quiet windows that wrap midnight', () => {
    expect(isWithinWindow(23 * 60, 1290, 480)).toBe(true);
    expect(isWithinWindow(7 * 60, 1290, 480)).toBe(true);
    expect(isWithinWindow(12 * 60, 1290, 480)).toBe(false);
  });
  it('generates slots after lead time and skips closed Mondays', () => {
    const now = istDateAt('2026-11-08', 10 * 60); // Sunday 10:00 IST
    const slots = generateSlots({ now, hours: DEFAULT_HOURS, slotMinutes: 60, leadTimeMinutes: 60, maxDaysAhead: 1 });
    expect(slots[0].label).toBe('11:00–12:00');
    expect(slots.every((s) => s.ymd === '2026-11-08')).toBe(true); // Monday closed
    expect(isValidSlot(slots, slots[0].start)).not.toBeNull();
    expect(isValidSlot(slots, istDateAt('2026-11-08', 9 * 60).toISOString())).toBeNull();
  });
});

describe('reorder prediction', () => {
  const at = (ymd: string) => istDateAt(ymd, 10 * 60);
  it('requires three purchase days', () => {
    const p = medianIntervalPredictor.predict(
      [{ at: at('2026-10-01'), grams: 1000, productIds: ['a'] }, { at: at('2026-10-08'), grams: 1000, productIds: ['a'] }],
      at('2026-10-10')
    );
    expect(p.eligible).toBe(false);
  });
  it('uses the median interval and collapses same-day bills', () => {
    const purchases = ['2026-10-04', '2026-10-11', '2026-10-11', '2026-10-18', '2026-10-25'].map((d) => ({
      at: at(d),
      grams: 1000,
      productIds: ['curry'],
    }));
    const p = medianIntervalPredictor.predict(purchases, at('2026-10-30'));
    expect(p.purchaseCount).toBe(4);
    expect(p.medianIntervalDays).toBe(7);
    expect(p.usualWeekday).toBe(0);
    expect(p.nextExpectedAt?.toISOString()).toBe(at('2026-11-01').toISOString());
    expect(p.avgOrderGrams).toBe(1250);
    expect(p.preferredProductIds).toEqual(['curry']);
    expect(isReorderReminderDue(p, at('2026-10-31'))).toBe(true);
    expect(isReorderReminderDue(p, at('2026-10-27'))).toBe(false);
  });
  it('marks lapsed customers ineligible for reorder reminders', () => {
    const purchases = ['2026-06-01', '2026-06-08', '2026-06-15'].map((d) => ({ at: at(d), grams: 500, productIds: [] }));
    expect(medianIntervalPredictor.predict(purchases, at('2026-10-01')).eligible).toBe(false);
  });
  it('computes medians', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

describe('weekly plan schedule', () => {
  it('finds the next Sunday 8am reminder and honours skips', () => {
    const now = istDateAt('2026-11-04', 12 * 60); // Wednesday
    const plan = { dayOfWeek: 0, reminderMinutes: 8 * 60, skipDates: [] as string[], status: 'ACTIVE' as const };
    expect(nextPlanOccurrence(plan, now)?.forDate).toBe('2026-11-08');
    expect(nextPlanOccurrence({ ...plan, skipDates: ['2026-11-08'] }, now)?.forDate).toBe('2026-11-15');
    expect(nextPlanOccurrence({ ...plan, status: 'PAUSED' }, now)).toBeNull();
  });
  it('rolls to next week after the reminder time has passed', () => {
    const now = istDateAt('2026-11-08', 9 * 60);
    expect(nextPlanOccurrence({ dayOfWeek: 0, reminderMinutes: 480, skipDates: [], status: 'ACTIVE' }, now)?.forDate).toBe(
      '2026-11-15'
    );
    expect(upcomingPlanDates({ dayOfWeek: 0 }, now, 2)).toEqual(['2026-11-08', '2026-11-15']);
  });
});

describe('notification policy', () => {
  const noon = istDateAt('2026-11-08', 12 * 60);
  const base = { prefs: DEFAULT_PREFS, marketingConsent: false, marketingSentLast7Days: 0, now: noon, suppressed: false };
  it('sends transactional order updates even in quiet hours', () => {
    expect(decideSend({ ...base, kind: 'ORDER_STATUS', now: istDateAt('2026-11-08', 23 * 60) })).toEqual({ allowed: true });
  });
  it('requires explicit consent for reorder reminders', () => {
    expect(decideSend({ ...base, kind: 'REORDER_REMINDER' })).toEqual({ allowed: false, reason: 'NO_MARKETING_CONSENT' });
    expect(decideSend({ ...base, kind: 'REORDER_REMINDER', marketingConsent: true })).toEqual({ allowed: true });
  });
  it('enforces frequency caps, holdout and quiet hours', () => {
    const m = { ...base, kind: 'REORDER_REMINDER' as const, marketingConsent: true };
    expect(decideSend({ ...m, marketingSentLast7Days: 2 })).toMatchObject({ reason: 'FREQUENCY_CAP' });
    expect(decideSend({ ...m, holdout: true })).toMatchObject({ reason: 'EXPERIMENT_HOLDOUT' });
    expect(decideSend({ ...m, now: istDateAt('2026-11-08', 22 * 60) })).toMatchObject({ reason: 'QUIET_HOURS' });
  });
  it('respects preference toggles and suppression', () => {
    expect(decideSend({ ...base, kind: 'PLAN_REMINDER', prefs: { ...DEFAULT_PREFS, planReminders: false } })).toMatchObject({
      reason: 'PREFERENCE_OFF',
    });
    expect(decideSend({ ...base, kind: 'ORDER_STATUS', suppressed: true })).toMatchObject({ reason: 'SUPPRESSED' });
  });
});

describe('experiments', () => {
  it('is deterministic and roughly proportional', () => {
    expect(bucketOf('abc', 'x')).toBe(bucketOf('abc', 'x'));
    let holdout = 0;
    for (let i = 0; i < 2000; i++) if (variantFor(`id-${i}`, 'exp', 10) === 'HOLDOUT') holdout++;
    expect(holdout).toBeGreaterThan(140);
    expect(holdout).toBeLessThan(260);
  });
});

describe('order status', () => {
  it('maps pre-order and delivery states', () => {
    expect(deriveStatus({ status: 'PENDING', fulfillment: 'PICKUP' }, null)).toBe('PLACED');
    expect(deriveStatus({ status: 'CONFIRMED', fulfillment: 'PICKUP' }, null)).toBe('ACCEPTED');
    expect(deriveStatus({ status: 'FULFILLED', fulfillment: 'PICKUP' }, { status: 'PAID' })).toBe('COMPLETED');
    expect(
      deriveStatus({ status: 'FULFILLED', fulfillment: 'DELIVERY' }, { status: 'PAID', deliveryOrder: { status: 'OUT_FOR_DELIVERY' } })
    ).toBe('OUT_FOR_DELIVERY');
    expect(deriveStatus({ status: 'FULFILLED', fulfillment: 'DELIVERY' }, { status: 'REFUNDED' })).toBe('REFUNDED');
    expect(deriveStatus(null, { status: 'VOID' })).toBe('CANCELLED');
  });
  it('builds timelines without marking cancelled orders as progressed', () => {
    expect(buildTimeline('READY', 'PICKUP').filter((s) => s.reached).map((s) => s.key)).toEqual(['PLACED', 'ACCEPTED', 'READY']);
    expect(buildTimeline('CANCELLED', 'PICKUP').some((s) => s.reached)).toBe(false);
  });
});

describe('analytics & otp', () => {
  it('drops PII-like and unknown properties', () => {
    expect(sanitizeProperties({ productId: 'p_1', phone: '9876543210', name: 'Asha', grams: 500, reason: 'has space' })).toEqual({
      productId: 'p_1',
      grams: 500,
    });
  });
  it('generates 6-digit OTPs and verifies hashes in constant time', () => {
    const code = generateOtp();
    expect(code).toMatch(/^\d{6}$/);
    const h = hashOtp('9876543210', code, 'c1');
    expect(otpMatches(h, '9876543210', code, 'c1')).toBe(true);
    expect(otpMatches(h, '9876543210', code, 'c2')).toBe(false);
    expect(otpMatches(h, '9876543211', code, 'c1')).toBe(false);
  });
});
