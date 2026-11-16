/** Keep in sync with apps/api customers tierThresholds (totalSpent INR). */
export const TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 5000,
  GOLD: 20000,
  PLATINUM: 50000,
} as const;

export type TierName = keyof typeof TIER_THRESHOLDS;

const ORDER: TierName[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

export function normalizeTier(raw: string | null | undefined): TierName {
  const u = String(raw || 'BRONZE').toUpperCase();
  return (ORDER.includes(u as TierName) ? u : 'BRONZE') as TierName;
}

export function nextTierProgress(totalSpent: number, currentTier: string) {
  const tier = normalizeTier(currentTier);
  const idx = ORDER.indexOf(tier);
  if (idx >= ORDER.length - 1) {
    return {
      current: tier,
      next: null as TierName | null,
      progress: 1,
      remaining: 0,
      target: TIER_THRESHOLDS.PLATINUM,
    };
  }
  const next = ORDER[idx + 1];
  const floor = TIER_THRESHOLDS[tier];
  const target = TIER_THRESHOLDS[next];
  const span = Math.max(1, target - floor);
  const progress = Math.min(1, Math.max(0, (totalSpent - floor) / span));
  const remaining = Math.max(0, Math.ceil(target - totalSpent));
  return { current: tier, next, progress, remaining, target };
}

export function titleCaseTier(tier: string): string {
  const t = normalizeTier(tier);
  return t.charAt(0) + t.slice(1).toLowerCase();
}
