'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** 'glass' opts out of the legacy dark shim (via .input-glass) and uses semantic tokens. */
  variant?: 'default' | 'glass';
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, variant = 'default', className, ...props }, ref) => {
    const isGlass = variant === 'glass';
    return (
      <div className="w-full">
        {label && (
          <label
            className={cn(
              'block text-sm font-medium mb-1.5',
              isGlass ? 'text-ink-secondary' : 'text-gray-700'
            )}
          >
            {label}
            {props.required && <span className="text-red-600 ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full px-[14px] py-3 rounded-[10px] border transition-all duration-180 ease-out',
            'focus:outline-none focus:ring-0',
            isGlass
              ? 'input-glass rounded-xl'
              : 'placeholder:text-gray-500 disabled:bg-gray-100 disabled:text-gray-500',
            error
              ? 'border-red-600 shadow-inputError focus:border-red-600'
              : isGlass
                ? ''
                : 'border-gray-300 focus:border-brand-500 focus:shadow-inputFocus',
            'disabled:cursor-not-allowed',
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-600">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

