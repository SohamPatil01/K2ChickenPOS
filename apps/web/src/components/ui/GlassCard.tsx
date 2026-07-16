'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 'strong' uses a more opaque surface — required for tabular/data content. */
  intensity?: 'default' | 'strong';
  /** Adds a persistent brand glow shadow. */
  glow?: boolean;
  /** Hover lift + glow for clickable cards. */
  interactive?: boolean;
  children: React.ReactNode;
}

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ intensity = 'default', glow = false, interactive = false, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          intensity === 'strong' ? 'glass-panel-strong' : 'glass-panel',
          'rounded-2xl p-5',
          glow && 'shadow-glow-brand',
          interactive &&
            'cursor-pointer transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-glow-brand active:translate-y-0 active:scale-[0.99]',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
