'use client';

import { useEffect, useState } from 'react';

interface CartAnimationProps {
  productName: string;
  productImage?: string | null;
  onComplete: () => void;
}

export default function CartAnimation({ productName, productImage, onComplete }: CartAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
      setTimeout(onComplete, 300);
    }, 800);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!isAnimating) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[10000]">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-cart-fly">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-4 border-2 border-brand-500 flex items-center gap-3 min-w-[220px] backdrop-blur-sm">
          {productImage ? (
            <img
              src={productImage}
              alt={productName}
              className="w-14 h-14 object-cover rounded-lg shadow-md"
            />
          ) : (
            <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-lg flex items-center justify-center shadow-md">
              <span className="text-gray-400 text-xl">📦</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {productName}
            </p>
            <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">Added to cart! ✨</p>
          </div>
        </div>
      </div>
    </div>
  );
}

