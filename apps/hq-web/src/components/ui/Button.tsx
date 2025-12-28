'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'font-semibold rounded-xl transition-all duration-180 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed';
    
    const variants = {
      primary: 'bg-brand-500 text-white hover:bg-brand-600 hover:shadow-buttonHover hover:-translate-y-0.5 active:bg-brand-700 active:shadow-[inset_0px_2px_6px_rgba(0,0,0,0.25)] disabled:bg-brand-200 disabled:text-brand-400 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 dark:hover:shadow-[0px_8px_24px_rgba(255,106,0,0.5)]',
      secondary: 'bg-transparent border-[1.5px] border-brand-500 text-brand-500 hover:bg-brand-100 active:bg-brand-200 disabled:border-brand-200 disabled:text-brand-400 dark:hover:bg-brand-900/30 dark:active:bg-brand-900/50 dark:disabled:border-gray-600 dark:disabled:text-gray-500',
      ghost: 'bg-transparent text-brand-500 hover:bg-brand-100 active:bg-brand-200 disabled:text-brand-400 dark:hover:bg-brand-900/30 dark:active:bg-brand-900/50 dark:disabled:text-gray-500',
      danger: 'bg-accent-danger text-white hover:bg-red-700 active:bg-red-800 disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400',
    };

    const sizes = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-[18px] py-3 text-base',
      lg: 'px-6 py-4 text-lg',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          isLoading && 'opacity-70 cursor-wait',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

