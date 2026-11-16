/**
 * K2 Family loyalty tiers — rewards regularity, never spend.
 *
 * A "visit" is a day (IST) on which the customer had at least one PAID bill, at the counter or
 * in the app. Bill size never affects the tier, and no spend figure is shown to customers.
 *
 * Stored values on Customer.loyaltyTier stay BRONZE/SILVER/GOLD/PLATINUM (no migration); the
 * customer-facing names are Member / Regular / Loyal / K2 Family.
 *
 * Rules:
 *  - Earn rate for a bill = rate of the tier the customer holds when the bill is paid
 *    (an upgrade applies from the next bill).
 *  - No downgrades: a tier, once reached, is kept (see `promoteTier`).
 */
export type LoyaltyTierKey = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export type LoyaltyTier = {
  key: LoyaltyTierKey;
  /** Customer-facing name. */
  name: string;
  /** Visits needed to reach this tier. */
  minVisits: number;
  /** Fraction of the bill earned as points (0.0125 = 1.25%). */
  earnRate: number;
};

export const LOYALTY_TIERS: readonly LoyaltyTier[] = [
  { key: 'BRONZE', name: 'Member', minVisits: 0, earnRate: 0.0125 },
  { key: 'SILVER', name: 'Regular', minVisits: 15, earnRate: 0.0175 },
  { key: 'GOLD', name: 'Loyal', minVisits: 50, earnRate: 0.0225 },
  { key: 'PLATINUM', name: 'K2 Family', minVisits: 100, earnRate: 0.0275 },
] as const;

const BASE_TIER = LOYALTY_TIERS[0] as LoyaltyTier;

/** Tier for a stored value; unknown/empty values fall back to the base tier. */
export function loyaltyTier(key: string | null | undefined): LoyaltyTier {
  const k = String(key || '').toUpperCase();
  return LOYALTY_TIERS.find((t) => t.key === k) ?? BASE_TIER;
}

function rank(key: string | null | undefined): number {
  return LOYALTY_TIERS.indexOf(loyaltyTier(key));
}

/** Highest tier whose visit threshold is met. */
export function tierForVisits(visits: number): LoyaltyTier {
  const v = Math.max(0, Math.floor(Number(visits) || 0));
  let best = BASE_TIER;
  for (const t of LOYALTY_TIERS) if (v >= t.minVisits) best = t;
  return best;
}

/** No-downgrade promotion: the higher of the current tier and the tier earned by visits. */
export function promoteTier(currentKey: string | null | undefined, visits: number): LoyaltyTier {
  const byVisits = tierForVisits(visits);
  return rank(currentKey) >= LOYALTY_TIERS.indexOf(byVisits) ? loyaltyTier(currentKey) : byVisits;
}

/** Points for a settled bill at the given tier: floor(grandTotal × tier rate). */
export function computeTierEarnPoints(grandTotal: number, tierKey: string | null | undefined): number {
  return Math.floor(Math.max(0, Number(grandTotal) || 0) * loyaltyTier(tierKey).earnRate);
}

export type LoyaltyProgress = {
  tier: LoyaltyTier;
  next: LoyaltyTier | null;
  visits: number;
  /** Visits still needed for the next tier (0 at the top tier). */
  visitsToNext: number;
  /** 0..1 — visits / next tier's threshold (1 at the top tier). Used for the rooster fill. */
  progress: number;
};

/** Progress toward the next tier, for display. `tierKey` is the stored (never-downgraded) tier. */
export function loyaltyProgress(tierKey: string | null | undefined, visits: number): LoyaltyProgress {
  const v = Math.max(0, Math.floor(Number(visits) || 0));
  const tier = promoteTier(tierKey, v);
  const next = LOYALTY_TIERS[LOYALTY_TIERS.indexOf(tier) + 1] ?? null;
  if (!next) return { tier, next: null, visits: v, visitsToNext: 0, progress: 1 };
  return { tier, next, visits: v, visitsToNext: Math.max(0, next.minVisits - v), progress: Math.min(1, v / next.minVisits) };
}

/** "1.25%" style label for a rate. */
export function formatEarnRate(rate: number): string {
  return `${(rate * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}
