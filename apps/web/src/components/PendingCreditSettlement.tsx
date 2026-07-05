'use client';

import { useEffect, useState } from 'react';
import { useCartStore } from '@/store/cart';
import { fetchCustomerPendingOrders } from '@/lib/fetchCustomerPendingOrders';
import { openOrdersToSettlementLines } from '@/lib/pendingCreditCheckout';

type Props = {
  customerId: string | null;
  /** When true (walk-in), hide the section entirely. */
  hidden?: boolean;
  compact?: boolean;
};

export default function PendingCreditSettlement({ customerId, hidden, compact }: Props) {
  const pendingSettlements = useCartStore((s) => s.pendingSettlements);
  const initPendingSettlements = useCartStore((s) => s.initPendingSettlements);
  const togglePendingSettlement = useCartStore((s) => s.togglePendingSettlement);
  const setPendingSettlementAmount = useCartStore((s) => s.setPendingSettlementAmount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hidden || !customerId) {
      initPendingSettlements([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const orders = await fetchCustomerPendingOrders(customerId);
        if (!cancelled) {
          initPendingSettlements(openOrdersToSettlementLines(orders));
        }
      } catch (err) {
        console.error('[PendingCreditSettlement] Failed to load pending orders:', err);
        if (!cancelled) initPendingSettlements([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId, hidden, initPendingSettlements]);

  if (hidden || !customerId) return null;
  if (!loading && pendingSettlements.length === 0) return null;

  const pad = compact ? 'p-3' : 'p-4';
  const textSm = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={`${pad} border-t border-amber-200/80 dark:border-amber-800/40 bg-amber-50/60 dark:bg-amber-900/10`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className={`${textSm} font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Previous credit
        </h3>
        {loading && <span className="text-[10px] text-amber-700 dark:text-amber-300">Loading…</span>}
      </div>
      <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 mb-3">
        Add old pending bills to this checkout. Payment is recorded on the original bill.
      </p>

      <div className="space-y-2">
        {pendingSettlements.map((line) => (
          <div
            key={line.saleId}
            className="rounded-lg border border-amber-200/70 dark:border-amber-800/50 bg-white/80 dark:bg-gray-800/60 p-2.5"
          >
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={line.selected}
                onChange={(e) => togglePendingSettlement(line.saleId, e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`${textSm} font-semibold text-gray-900 dark:text-white truncate`}>
                    Bill #{line.saleNo}
                  </span>
                  <span className={`${textSm} font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap`}>
                    ₹{line.maxPending}
                  </span>
                </div>
                {line.createdAt && (
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    {new Date(line.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                )}
              </div>
            </label>

            {line.selected && (
              <div className="mt-2 pl-6 flex items-center gap-2">
                <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 shrink-0">Pay</span>
                <input
                  type="number"
                  min={0}
                  max={line.maxPending}
                  step={1}
                  value={line.amount || ''}
                  onChange={(e) => {
                    const v = Math.round(parseFloat(e.target.value) || 0);
                    setPendingSettlementAmount(line.saleId, Math.max(0, Math.min(v, line.maxPending)));
                  }}
                  className="flex-1 px-2 py-1.5 text-sm font-semibold border border-amber-300 dark:border-amber-700 dark:bg-gray-700 dark:text-white rounded-md text-right focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setPendingSettlementAmount(line.saleId, line.maxPending)}
                  className="px-2 py-1.5 text-[10px] font-semibold rounded-md bg-amber-500 text-white hover:bg-amber-600"
                >
                  Full
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
