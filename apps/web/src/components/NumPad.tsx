'use client';

import { useState, useEffect } from 'react';

interface NumPadProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit?: () => void;
  placeholder?: string;
  maxLength?: number;
  maskValue?: boolean; // For password/PIN masking
}

export default function NumPad({ value, onChange, onClose, onSubmit, placeholder = 'Enter number', maxLength = 15, maskValue = false }: NumPadProps) {
  const [displayValue, setDisplayValue] = useState(value);

  // Sync displayValue with value prop when it changes
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleNumberClick = (num: string) => {
    if (displayValue.length < maxLength) {
      const newValue = displayValue + num;
      setDisplayValue(newValue);
      onChange(newValue);
    }
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

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end justify-center z-50 safe-top safe-bottom">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-2xl shadow-2xl animate-fade-in-up border-t border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Enter Number</h3>
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

        {/* Display */}
        <div className="p-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
            <div className="text-3xl font-semibold text-gray-900 dark:text-white text-center min-h-[2.5rem] flex items-center justify-center">
              {displayValue ? (
                maskValue ? (
                  <span className="tracking-widest">{'•'.repeat(displayValue.length)}</span>
                ) : (
                  displayValue
                )
              ) : (
                <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
              )}
            </div>
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                className="aspect-square bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-2xl font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-95 transition-all duration-200 touch-target"
              >
                {num}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="aspect-square bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all duration-200 touch-target"
            >
              Clear
            </button>
            <button
              onClick={() => handleNumberClick('0')}
              className="aspect-square bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl text-2xl font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-95 transition-all duration-200 touch-target"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              className="aspect-square bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all duration-200 touch-target"
            >
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
              </svg>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-target"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium shadow-sm hover:shadow transition-all duration-200 touch-target"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

