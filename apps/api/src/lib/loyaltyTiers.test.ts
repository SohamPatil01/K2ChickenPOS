import { describe, expect, it } from 'vitest';
import {
  LOYALTY_TIERS,
  computeTierEarnPoints,
  formatEarnRate,
  loyaltyProgress,
  loyaltyTier,
  promoteTier,
  tierForVisits,
} from '@azela-pos/shared';

describe('K2 Family loyalty tiers', () => {
  it('has the agreed thresholds and rates (+0.50% per tier)', () => {
    expect(LOYALTY_TIERS.map((t) => [t.key, t.name, t.minVisits, t.earnRate])).toEqual([
      ['BRONZE', 'Member', 0, 0.0125],
      ['SILVER', 'Regular', 15, 0.0175],
      ['GOLD', 'Loyal', 50, 0.0225],
      ['PLATINUM', 'K2 Family', 100, 0.0275],
    ]);
  });

  it('picks the tier by visits at the exact thresholds', () => {
    expect(tierForVisits(0).key).toBe('BRONZE');
    expect(tierForVisits(14).key).toBe('BRONZE');
    expect(tierForVisits(15).key).toBe('SILVER');
    expect(tierForVisits(49).key).toBe('SILVER');
    expect(tierForVisits(50).key).toBe('GOLD');
    expect(tierForVisits(99).key).toBe('GOLD');
    expect(tierForVisits(100).key).toBe('PLATINUM');
    expect(tierForVisits(5000).key).toBe('PLATINUM');
  });

  it('never downgrades', () => {
    expect(promoteTier('GOLD', 3).key).toBe('GOLD');
    expect(promoteTier('SILVER', 60).key).toBe('GOLD');
    expect(promoteTier(null, 20).key).toBe('SILVER');
    expect(promoteTier('nonsense', 0).key).toBe('BRONZE');
  });

  it('earns points at the tier rate, floored', () => {
    expect(computeTierEarnPoints(1000, 'BRONZE')).toBe(12); // 12.5
    expect(computeTierEarnPoints(1000, 'SILVER')).toBe(17); // 17.5
    expect(computeTierEarnPoints(1000, 'GOLD')).toBe(22); // 22.5
    expect(computeTierEarnPoints(1000, 'PLATINUM')).toBe(27); // 27.5
    expect(computeTierEarnPoints(-50, 'GOLD')).toBe(0);
    expect(computeTierEarnPoints(1000, undefined)).toBe(12);
  });

  it('reports progress toward the next tier for the rooster', () => {
    expect(loyaltyProgress('BRONZE', 12)).toMatchObject({ visits: 12, visitsToNext: 3, progress: 0.8 });
    expect(loyaltyProgress('BRONZE', 12).next?.name).toBe('Regular');
    expect(loyaltyProgress('GOLD', 50)).toMatchObject({ visitsToNext: 50, progress: 0.5 });
    // Stored tier above the visit count (e.g. after a one-off placement) still shows the stored tier.
    expect(loyaltyProgress('GOLD', 20).tier.key).toBe('GOLD');
    expect(loyaltyProgress('PLATINUM', 140)).toMatchObject({ next: null, visitsToNext: 0, progress: 1 });
  });

  it('formats rates for display', () => {
    expect(formatEarnRate(loyaltyTier('BRONZE').earnRate)).toBe('1.25%');
    expect(formatEarnRate(loyaltyTier('SILVER').earnRate)).toBe('1.75%');
    expect(formatEarnRate(0.02)).toBe('2%');
  });
});
