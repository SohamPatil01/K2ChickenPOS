'use client';

import { useEffect, useState } from 'react';

interface BillSuccessAnimationProps {
  saleNo?: string;
  grandTotal: number;
  onComplete: () => void;
  /** Optional subtitle (e.g. "Order completed." on Orders page). Default: "Redirecting to POS..." */
  subtitle?: string;
  /** When set, shows Print / digital bill actions. */
  onPrint?: () => void;
  billUrl?: string | null;
  /**
   * Auto-dismiss after this many ms so the cashier can start the next bill.
   * Default keeps the overlay short (~2.5s); pass longer only when needed.
   * [checkout-success] — do not raise this without checking POS scan-during-success.
   */
  autoDismissMs?: number;
}

export default function BillSuccessAnimation({
  saleNo,
  grandTotal,
  onComplete,
  subtitle = 'Redirecting to POS...',
  onPrint,
  billUrl,
  autoDismissMs,
}: BillSuccessAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const hasActions = Boolean(onPrint || billUrl);
  // Short default so next bill / barcode can start quickly (was 8s with actions).
  const dismissAfter = Math.max(
    1200,
    autoDismissMs ?? (hasActions ? 2500 : 2000)
  );

  useEffect(() => {
    // Show checkmark first
    const timer1 = setTimeout(() => {
      setShowDetails(true);
    }, 400);

    const timer2 = setTimeout(() => {
      setIsAnimating(false);
      setTimeout(onComplete, 200);
    }, dismissAfter);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onComplete, dismissAfter]);

  if (!isAnimating) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-none"
      // pointer-events-none: hardware scanners keep typing into the POS barcode field.
      role="status"
      aria-live="polite"
    >
      <div className="relative pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            setIsAnimating(false);
            setTimeout(onComplete, 100);
          }}
          className="absolute -top-2 -right-2 z-10 h-9 w-9 rounded-full bg-white/90 text-ink font-bold shadow hover:bg-white"
          aria-label="Close and start next bill"
        >
          ✕
        </button>
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
              {hasActions && (
                <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                  {onPrint && (
                    <button
                      type="button"
                      onClick={onPrint}
                      className="px-4 py-2.5 rounded-xl bg-white text-ink text-sm font-bold shadow-sm hover:bg-white/90"
                    >
                      Print bill
                    </button>
                  )}
                  {billUrl && (
                    <a
                      href={billUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2.5 rounded-xl border border-white/40 text-white text-sm font-bold hover:bg-white/10"
                    >
                      Open digital bill
                    </a>
                  )}
                </div>
              )}
              <p className="text-xl text-gray-200 animate-pulse">
                {subtitle}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

