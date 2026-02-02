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

  // Handle Enter key to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (onSubmit) {
          onSubmit();
        }
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSubmit, onClose]);

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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 safe-top safe-bottom p-2 sm:p-3">
      <div className="bg-white dark:bg-gray-800 w-full max-w-[280px] sm:max-w-xs rounded-xl sm:rounded-2xl shadow-2xl animate-fade-in-up border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        {/* Header - compact */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate pr-2">{placeholder}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - compact */}
        <div className="p-3 space-y-2">
          {/* Input - smaller */}
          <div>
            <input
              ref={inputRef}
              type="text"
              inputMode={allowDecimal ? "decimal" : "numeric"}
              value={displayValue}
              onChange={handleInputChange}
              placeholder={placeholder}
              maxLength={maxLength}
              className="w-full px-3 py-2 text-base font-semibold text-gray-900 dark:text-white text-center bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-gray-300 dark:border-gray-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all"
              autoFocus
            />
            <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center mt-1">
              Type or use pad • Enter to confirm
            </p>
          </div>

          {/* Display - only when maskValue or minimal when value exists */}
          {displayValue && maskValue && (
            <div className="bg-brand-50 dark:bg-brand-900/20 rounded-lg py-1.5 px-2 border border-brand-200 dark:border-brand-800">
              <div className="text-sm font-semibold text-brand-700 dark:text-brand-300 text-center">
                <span className="tracking-widest">{'•'.repeat(displayValue.length)}</span>
              </div>
            </div>
          )}

          {/* Quick Presets - smaller */}
          {quickPresets.length > 0 && (
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 text-center">Quick</label>
              <div className="grid grid-cols-4 gap-1">
                {quickPresets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetClick(preset)}
                    className="px-2 py-1.5 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded-md text-xs font-semibold text-brand-700 dark:text-brand-300 transition-colors active:scale-95"
                  >
                    {preset}{allowDecimal ? 'kg' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Compact Number Pad - smaller buttons */}
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleNumberClick(num.toString())}
                className="aspect-square min-h-0 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-base font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-brand-400 active:scale-95 transition-all duration-200"
              >
                {num}
              </button>
            ))}
            {allowDecimal ? (
              <button
                onClick={handleDecimalClick}
                disabled={displayValue.includes('.')}
                className="aspect-square min-h-0 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-base font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                .
              </button>
            ) : (
              <button
                onClick={handleClear}
                className="aspect-square min-h-0 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => handleNumberClick('0')}
              className="aspect-square min-h-0 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-base font-semibold text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 active:scale-95"
            >
              0
            </button>
            {allowDecimal ? (
              <button
                onClick={handleClear}
                className="aspect-square min-h-0 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95"
              >
                Clear
              </button>
            ) : (
              <button
                onClick={handleBackspace}
                className="aspect-square min-h-0 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95"
              >
                <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                </svg>
              </button>
            )}
          </div>

          {/* Action Buttons - compact */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 px-3 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium shadow-sm hover:shadow transition-all duration-200"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

