import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format INR for display: compact form (e.g. ₹1.2L, ₹50K) for scanability. */
export function formatInrShort(amount: number): string {
  const n = Math.round(amount);
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1).replace(/\.0$/, '')}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

/** Format INR with full locale (e.g. 1,23,456.00). */
export function formatInr(amount: number, options?: { minFractionDigits?: number; maxFractionDigits?: number }): string {
  const { minFractionDigits = 0, maxFractionDigits = 2 } = options ?? {};
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: minFractionDigits, maximumFractionDigits: maxFractionDigits })}`;
}

