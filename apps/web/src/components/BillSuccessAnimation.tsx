'use client';

import { useEffect, useState } from 'react';

interface BillSuccessAnimationProps {
  saleNo?: string;
  grandTotal: number;
  onComplete: () => void;
}

export default function BillSuccessAnimation({ saleNo, grandTotal, onComplete }: BillSuccessAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Show checkmark first
    const timer1 = setTimeout(() => {
      setShowDetails(true);
    }, 500);

    // Auto-dismiss after 3 seconds
    const timer2 = setTimeout(() => {
      setIsAnimating(false);
      setTimeout(onComplete, 300);
    }, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  if (!isAnimating) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="relative">
        {/* Success Checkmark Animation */}
        <div className="flex flex-col items-center justify-center">
          {/* Animated Checkmark Circle */}
          <div className="relative mb-8">
            <div className="w-40 h-40 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-2xl animate-scale-in border-4 border-white/20">
              <svg
                className="w-24 h-24 text-white animate-checkmark-draw"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={4}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            {/* Ripple Effect */}
            <div className="absolute inset-0 bg-green-500 rounded-full animate-ripple opacity-75"></div>
            <div className="absolute inset-0 bg-green-500 rounded-full animate-ripple-delayed opacity-50"></div>
          </div>

          {/* Success Message */}
          {showDetails && (
            <div className="text-center animate-fade-in-up">
              <h2 className="text-5xl font-bold text-white mb-4 drop-shadow-2xl">
                Bill Completed! 🎉
              </h2>
              {saleNo && saleNo !== 'N/A' && (
                <p className="text-2xl text-green-200 mb-4 font-semibold drop-shadow-lg">
                  Sale #{saleNo}
                </p>
              )}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-8 py-6 mb-6 border border-white/20">
                <p className="text-sm text-gray-200 mb-2">Total Amount</p>
                <p className="text-4xl font-bold text-white drop-shadow-lg">
                  ₹{grandTotal}
                </p>
              </div>
              <p className="text-xl text-gray-200 animate-pulse">
                Redirecting to POS...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

