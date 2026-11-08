import { createHash } from 'node:crypto';

/** Stable bucket 0..9999 for (identity, experiment). Same input → same bucket forever. */
export function bucketOf(identityId: string, experimentKey: string): number {
  const h = createHash('sha256').update(`${experimentKey}:${identityId}`).digest();
  return h.readUInt32BE(0) % 10_000;
}

export const REORDER_REMINDER_EXPERIMENT = 'reorder-reminders-v1';

export function variantFor(identityId: string, experimentKey: string, holdoutPercent: number): 'HOLDOUT' | 'TREATMENT' {
  const pct = Math.max(0, Math.min(100, holdoutPercent));
  return bucketOf(identityId, experimentKey) < pct * 100 ? 'HOLDOUT' : 'TREATMENT';
}
