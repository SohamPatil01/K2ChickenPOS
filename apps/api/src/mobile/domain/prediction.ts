import { istParts } from './time.js';

/**
 * Deterministic reorder-cadence rules (no ML). Swappable via the ReorderPredictor interface.
 * A model must never override price, stock, payment or consent — callers re-check all of those.
 */
export const PREDICTION_RULE_VERSION = 'median-interval-v1';
export const MIN_PURCHASES = 3;

export type Purchase = {
  at: Date; // completed purchase instant
  grams: number; // total KG-product grams in the purchase
  productIds: string[];
};

export type Prediction = {
  ruleVersion: string;
  eligible: boolean;
  rationale: string;
  purchaseCount: number;
  medianIntervalDays: number | null;
  usualWeekday: number | null;
  avgOrderGrams: number | null;
  lastPurchaseAt: Date | null;
  nextExpectedAt: Date | null;
  preferredProductIds: string[];
  confidence: number;
};

export interface ReorderPredictor {
  version: string;
  predict(purchases: Purchase[], now: Date): Prediction;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const DAY_MS = 86_400_000;

export const medianIntervalPredictor: ReorderPredictor = {
  version: PREDICTION_RULE_VERSION,
  predict(purchases: Purchase[], now: Date): Prediction {
    // One purchase per IST calendar day (several bills on one day = one shopping trip).
    const byDay = new Map<string, Purchase>();
    for (const p of [...purchases].sort((a, b) => a.at.getTime() - b.at.getTime())) {
      const ymd = istParts(p.at).ymd;
      const existing = byDay.get(ymd);
      if (existing) {
        existing.grams += p.grams;
        existing.productIds.push(...p.productIds);
      } else {
        byDay.set(ymd, { at: p.at, grams: p.grams, productIds: [...p.productIds] });
      }
    }
    const days = [...byDay.values()];
    const count = days.length;
    const productFreq = new Map<string, number>();
    for (const d of days) for (const id of new Set(d.productIds)) productFreq.set(id, (productFreq.get(id) || 0) + 1);
    const preferredProductIds = [...productFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
    const last = count ? days[count - 1].at : null;
    const avgOrderGrams = count ? Math.round(days.reduce((s, d) => s + d.grams, 0) / count) : null;

    const base: Prediction = {
      ruleVersion: PREDICTION_RULE_VERSION,
      eligible: false,
      rationale: '',
      purchaseCount: count,
      medianIntervalDays: null,
      usualWeekday: null,
      avgOrderGrams,
      lastPurchaseAt: last,
      nextExpectedAt: null,
      preferredProductIds,
      confidence: 0,
    };
    if (count < MIN_PURCHASES) {
      return { ...base, rationale: `Needs ${MIN_PURCHASES} purchase days, has ${count}` };
    }

    const intervals: number[] = [];
    for (let i = 1; i < count; i++) intervals.push((days[i].at.getTime() - days[i - 1].at.getTime()) / DAY_MS);
    const med = median(intervals) as number;
    const weekdayCounts = new Array(7).fill(0);
    for (const d of days) weekdayCounts[istParts(d.at).weekday]++;
    const topWeekday = weekdayCounts.indexOf(Math.max(...weekdayCounts));
    const weekdayShare = weekdayCounts[topWeekday] / count;

    // Spread of intervals relative to median → confidence.
    const mad = median(intervals.map((v) => Math.abs(v - med))) ?? 0;
    const regularity = med > 0 ? Math.max(0, 1 - mad / med) : 0;
    const confidence = Math.round(Math.min(1, regularity * Math.min(1, count / 6)) * 100) / 100;

    if (med < 2 || med > 45) {
      return {
        ...base,
        medianIntervalDays: Math.round(med * 10) / 10,
        usualWeekday: weekdayShare >= 0.5 ? topWeekday : null,
        confidence,
        rationale: `Median interval ${med.toFixed(1)}d outside the 2–45 day reminder range`,
      };
    }

    const next = new Date((last as Date).getTime() + Math.round(med * DAY_MS));
    const overdueDays = (now.getTime() - next.getTime()) / DAY_MS;
    const lapsed = overdueDays > Math.max(14, med * 2);
    return {
      ...base,
      eligible: !lapsed,
      medianIntervalDays: Math.round(med * 10) / 10,
      usualWeekday: weekdayShare >= 0.5 ? topWeekday : null,
      nextExpectedAt: next,
      confidence,
      rationale: lapsed
        ? `Lapsed: ${overdueDays.toFixed(0)} days past expected date (win-back segment, not reorder reminder)`
        : `${count} purchase days, median ${med.toFixed(1)}d, regularity ${regularity.toFixed(2)}`,
    };
  },
};

/** A reminder is due when we are within the window [expected − 1d, expected + 2d]. */
export function isReorderReminderDue(p: Prediction, now: Date): boolean {
  if (!p.eligible || !p.nextExpectedAt) return false;
  const t = now.getTime();
  const e = p.nextExpectedAt.getTime();
  return t >= e - DAY_MS && t <= e + 2 * DAY_MS;
}
