'use client';

import { cn } from '@/lib/utils';

export interface BrandLoaderProps {
  /** Optional text under the monogram, e.g. "Loading inventory…" */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Fill the parent and center (use for full-page/first loads). */
  fullscreen?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: 'h-10 w-10 rounded-xl text-lg', wrap: 'h-16 w-16' },
  md: { box: 'h-14 w-14 rounded-2xl text-2xl', wrap: 'h-24 w-24' },
  lg: { box: 'h-20 w-20 rounded-3xl text-4xl', wrap: 'h-32 w-32' },
};

/**
 * Branded loading indicator: the "A" monogram breathing inside
 * expanding orange glow rings. Falls back to a static logo under
 * prefers-reduced-motion (handled in CSS).
 */
export function BrandLoader({ label, size = 'md', fullscreen = false, className }: BrandLoaderProps) {
  const s = sizes[size];

  const core = (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <div className={cn('relative flex items-center justify-center', s.wrap)}>
        {/* Expanding glow rings */}
        <span
          className="animate-glow-ring absolute inset-0 rounded-full bg-brand-500/25"
          aria-hidden
        />
        <span
          className="animate-glow-ring absolute inset-0 rounded-full bg-brand-500/20"
          style={{ animationDelay: '0.6s' }}
          aria-hidden
        />
        {/* Breathing monogram */}
        <span
          className={cn(
            'animate-brand-breathe relative flex items-center justify-center bg-gradient-brand text-white font-bold shadow-glow-brand',
            s.box
          )}
        >
          A
        </span>
      </div>
      {label && <p className="text-sm text-ink-muted">{label}</p>}
      <span className="sr-only" role="status">
        {label || 'Loading'}
      </span>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="flex h-full min-h-[40vh] w-full items-center justify-center">{core}</div>
    );
  }
  return core;
}
