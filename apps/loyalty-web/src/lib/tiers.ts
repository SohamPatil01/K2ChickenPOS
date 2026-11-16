/**
 * K2 Family tiers are computed by the API (visits, never spend). This file only formats them.
 * Stored keys BRONZE/SILVER/GOLD/PLATINUM map to Member/Regular/Loyal/K2 Family.
 */
const NAMES: Record<string, string> = { BRONZE: 'Member', SILVER: 'Regular', GOLD: 'Loyal', PLATINUM: 'K2 Family' };

export function tierDisplayName(key: string | null | undefined, apiName?: string | null): string {
  return apiName || NAMES[String(key || 'BRONZE').toUpperCase()] || 'Member';
}

/** 0.0175 → "1.75%" */
export function formatRate(rate: number | null | undefined): string {
  const r = typeof rate === 'number' && rate > 0 ? rate : 0.0125;
  return `${(r * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
}
