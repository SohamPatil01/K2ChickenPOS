'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated';
  hasAccent?: boolean;
  children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', hasAccent = false, className, children, ...props }, ref) => {
    const variants = {
      default: 'bg-white shadow-card dark:bg-gray-800 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]',
      bordered: 'bg-white border border-gray-200 dark:bg-gray-800 dark:border-gray-700',
      elevated: 'bg-white shadow-card hover:shadow-orangeGlow transition-shadow duration-180 dark:bg-gray-800 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] dark:hover:shadow-[0px_10px_30px_rgba(255,106,0,0.5)]',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl2 p-5 transition-all duration-180 ease-out',
          variants[variant],
          className
        )}
        {...props}
      >
        {hasAccent && (
          <div className="h-1 bg-brand-500 rounded-t-xl2 -mx-5 -mt-5 mb-4" />
        )}
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

