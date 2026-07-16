'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'brand' | 'neutral';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

const variants = {
  success: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/25',
  warning: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/25',
  danger: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25',
  info: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25',
  brand: 'bg-brand-500/15 text-brand-600 dark:text-brand-400 border-brand-500/25',
  neutral: 'bg-surface-2 text-ink-secondary border-transparent',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'sm',
  className,
  children,
  ...props
}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap',
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      variants[variant],
      className
    )}
    {...props}
  >
    {children}
  </span>
);
