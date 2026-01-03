'use client';

import { useEffect, useState } from 'react';

interface PaymentSuccessAnimationProps {
  amount: number;
  customerName: string;
  orderNo?: string;
  onComplete: () => void;
}

export default function PaymentSuccessAnimation({ 
  amount, 
  customerName, 
  orderNo, 
  onComplete 
}: PaymentSuccessAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Show checkmark first
    const timer1 = setTimeout(() => {
      setShowDetails(true);
    }, 500);

    // Auto-dismiss after 2.5 seconds
    const timer2 = setTimeout(() => {
      setIsAnimating(false);
      setTimeout(onComplete, 300);
    }, 2500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete]);

  if (!isAnimating) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative">
        {/* Success Checkmark Animation */}
        <div className="flex flex-col items-center justify-center">
          {/* Animated Checkmark Circle */}
          <div className="relative mb-6">
            <div className="w-32 h-32 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-2xl animate-scale-in border-4 border-white/20">
              <svg
                className="w-20 h-20 text-white animate-checkmark-draw"
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
              <h2 className="text-3xl font-bold text-white mb-3 drop-shadow-2xl">
                Payment Successful! 💰
              </h2>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-4 mb-4 border border-white/20">
                <p className="text-sm text-gray-200 mb-1">Amount Paid</p>
                <p className="text-3xl font-bold text-white drop-shadow-lg">
                  ₹{Math.round(amount)}
                </p>
              </div>
              <p className="text-lg text-gray-200 mb-1">
                {customerName}
              </p>
              {orderNo && (
                <p className="text-sm text-gray-300">
                  Order: {orderNo}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

