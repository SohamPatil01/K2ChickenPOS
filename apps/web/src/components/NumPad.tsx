'use client';

import { useState, useEffect, useRef } from 'react';

interface NumPadProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit?: () => void;
  placeholder?: string;
  maxLength?: number;
  maskValue?: boolean; // For password/PIN masking
  allowDecimal?: boolean; // For weight/decimal entry
  quickPresets?: number[]; // Quick preset buttons (e.g., [0.5, 1, 2, 5] for kg)
}

export default function NumPad({ 
  value, 
  onChange, 
  onClose, 
  onSubmit, 
  placeholder = 'Enter number', 
  maxLength = 15, 
  maskValue = false,
  allowDecimal = false,
  quickPresets = []
}: NumPadProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync displayValue with value prop when it changes
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  // Focus input when component mounts
  useEffect(() => {
    // Small delay to ensure modal is fully rendered
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  const handleNumberClick = (num: string) => {
    if (displayValue.length < maxLength) {
      const newValue = displayValue + num;
      setDisplayValue(newValue);
      onChange(newValue);
    }
  };

  const handleDecimalClick = () => {
    if (!allowDecimal) return;
    // Only add decimal if there isn't one already
    if (!displayValue.includes('.')) {
      const newValue = displayValue ? displayValue + '.' : '0.';
      setDisplayValue(newValue);
      onChange(newValue);
    }
  };

  const handlePresetClick = (preset: number) => {
    const newValue = preset.toString();
    setDisplayValue(newValue);
    onChange(newValue);
  };

  const handleBackspace = () => {
    const newValue = displayValue.slice(0, -1);
    setDisplayValue(newValue);
    onChange(newValue);
  };

  const handleClear = () => {
    setDisplayValue('');
    onChange('');
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit();
    }
    onClose();
  };

  // Handle keyboard input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    if (allowDecimal) {
      // Allow numbers and one decimal point
      newValue = newValue.replace(/[^0-9.]/g, '');
      // Ensure only one decimal point
      const parts = newValue.split('.');
      if (parts.length > 2) {
        newValue = parts[0] + '.' + parts.slice(1).join('');
      }
    } else {
      // Only allow numbers
      newValue = newValue.replace(/[^0-9]/g, '');
    }
    
    if (newValue.length <= maxLength) {
      setDisplayValue(newValue);
      onChange(newValue);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 safe-top safe-bottom p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-2xl shadow-2xl animate-fade-in-up border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{placeholder}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - No scrolling needed */}
        <div className="p-4 space-y-4">
          {/* Keyboard Input Field */}
          <div>
            <input
              ref={inputRef}
              type="text"
              inputMode={allowDecimal ? "decimal" : "numeric"}
              value={displayValue}
              onChange={handleInputChange}
              placeholder={placeholder}
              maxLength={maxLength}
              className="w-full px-4 py-4 text-2xl font-semibold text-gray-900 dark:text-white text-center bg-gray-50 dark:bg-gray-700/50 rounded-xl border-2 border-gray-300 dark:border-gray-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500 focus:outline-none transition-all"
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
              Type on keyboard or use pad below
            </p>
          </div>

          {/* Display (for visual feedback) */}
          {displayValue && (
            <div className="bg-brand-50 dark:bg-brand-900/20 rounded-lg p-3 border border-brand-200 dark:border-brand-800">
              <div className="text-xl font-semibold text-brand-700 dark:text-brand-300 text-center">
                {maskValue ? (
                  <span className="tracking-widest">{'•'.repeat(displayValue.length)}</span>
                ) : (
                  displayValue
                )}
              </div>
            </div>
          )}

          {/* Quick Preset Buttons */}
          {quickPresets.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 text-center">
                Quick Select
              </label>
              <div className="grid grid-cols-4 gap-2">
                {quickPresets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetClick(preset)}
                    className="px-3 py-2 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded-lg text-sm font-semibold text-brand-700 dark:text-brand-300 transition-colors active:scale-95"
                  >
                    {preset}{allowDecimal ? 'kg' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Compact Number Pad */}
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                className="aspect-square bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-xl font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-brand-400 active:scale-95 transition-all duration-200 touch-target"
              >
                {num}
              </button>
            ))}
            {allowDecimal ? (
              <button
                onClick={handleDecimalClick}
                disabled={displayValue.includes('.')}
                className="aspect-square bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-xl font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-brand-400 active:scale-95 transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed"
              >
                .
              </button>
            ) : (
              <button
                onClick={handleClear}
                className="aspect-square bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all duration-200 touch-target"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => handleNumberClick('0')}
              className="aspect-square bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-xl font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-brand-400 active:scale-95 transition-all duration-200 touch-target"
            >
              0
            </button>
            {allowDecimal ? (
              <button
                onClick={handleClear}
                className="aspect-square bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all duration-200 touch-target"
              >
                Clear
              </button>
            ) : (
              <button
                onClick={handleBackspace}
                className="aspect-square bg-gray-100 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all duration-200 touch-target"
              >
                <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                </svg>
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-base font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-target"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-base font-medium shadow-sm hover:shadow transition-all duration-200 touch-target"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

