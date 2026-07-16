'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface StatCardGlassProps {
  title: string;
  /** Display value. Ignored when rawValue is provided. */
  value: string | number;
  /** Numeric source for count-up animation; formatted via `format`. */
  rawValue?: number;
  format?: (value: number) => string;
  subtitle?: string;
  /** Emoji or any node (lucide icon) for the icon slot. */
  icon: React.ReactNode;
  comparison?: { label: string; value: number; change: number };
  /** Accent tint for the icon chip. */
  tone?: 'brand' | 'green' | 'blue' | 'purple' | 'orange';
  className?: string;
  style?: React.CSSProperties;
}

const tones = {
  brand: 'bg-brand-500/15 text-brand-600 dark:text-brand-400',
  green: 'bg-green-500/15 text-green-600 dark:text-green-400',
  blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  orange: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
};

export default function StatCardGlass({
  title,
  value,
  rawValue,
  format,
  subtitle,
  icon,
  comparison,
  tone = 'brand',
  className = '',
  style,
}: StatCardGlassProps) {
  const TrendIcon =
    comparison && comparison.change > 0
      ? TrendingUp
      : comparison && comparison.change < 0
        ? TrendingDown
        : Minus;

  return (
    <div
      className={cn(
        'glass-panel relative overflow-hidden rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glow-brand',
        className
      )}
      style={style}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-2xl', tones[tone])}>
          {icon}
        </div>
        {comparison && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
              comparison.change > 0
                ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                : comparison.change < 0
                  ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                  : 'bg-surface-2 text-ink-muted'
            )}
          >
            <TrendIcon className="h-3.5 w-3.5" />
            {Math.abs(comparison.change).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-1.5">{title}</p>
      <p className="text-3xl font-bold text-ink mb-1 truncate tabular-nums">
        {rawValue !== undefined ? (
          <AnimatedNumber value={rawValue} format={format} />
        ) : (
          value
        )}
      </p>
      {subtitle && <p className="text-sm text-ink-secondary truncate">{subtitle}</p>}
      {comparison && <p className="text-xs text-ink-muted mt-2">{comparison.label}</p>}
    </div>
  );
}
