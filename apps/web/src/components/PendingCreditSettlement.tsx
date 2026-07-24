'use client';

import { useCallback, useEffect, useState } from 'react';
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
  const getPendingSettlementTotal = useCartStore((s) => s.getPendingSettlementTotal);
  const initPendingSettlements = useCartStore((s) => s.initPendingSettlements);
  const togglePendingSettlement = useCartStore((s) => s.togglePendingSettlement);
  const setPendingSettlementAmount = useCartStore((s) => s.setPendingSettlementAmount);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [customerId]);

  const reloadPending = useCallback(async () => {
    if (hidden || !customerId) {
      initPendingSettlements([]);
      setExpanded(false);
      return;
    }
    setLoading(true);
    try {
      const orders = await fetchCustomerPendingOrders(customerId);
      initPendingSettlements(openOrdersToSettlementLines(orders));
    } catch (err) {
      console.error('[PendingCreditSettlement] Failed to load pending orders:', err);
      initPendingSettlements([]);
    } finally {
      setLoading(false);
    }
  }, [customerId, hidden, initPendingSettlements]);

  useEffect(() => {
    void reloadPending();
  }, [reloadPending]);

  useEffect(() => {
    const onSaleDeleted = () => {
      void reloadPending();
    };
    window.addEventListener('sale-deleted', onSaleDeleted);
    return () => window.removeEventListener('sale-deleted', onSaleDeleted);
  }, [reloadPending]);

  if (hidden || !customerId) return null;
  if (!loading && pendingSettlements.length === 0) return null;

  const pad = compact ? 'p-2.5' : 'p-3';
  const textSm = compact ? 'text-xs' : 'text-sm';
  const selectedTotal = getPendingSettlementTotal();
  const totalAvailable = pendingSettlements.reduce((s, l) => s + l.maxPending, 0);
  const selectedCount = pendingSettlements.filter((l) => l.selected && l.amount > 0).length;

  return (
    <div
      className={`${pad} rounded-lg border border-amber-200/70 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-900/10 overflow-hidden`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 text-left group"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className={`${textSm} font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5`}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Previous credit</span>
            {loading ? (
              <span className="text-[10px] font-normal text-amber-700 dark:text-amber-300">Loading…</span>
            ) : (
              <span className="text-[10px] font-normal text-amber-800/70 dark:text-amber-300/70">
                {pendingSettlements.length} bill{pendingSettlements.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 mt-0.5 truncate">
            {loading
              ? 'Checking pending balance…'
              : selectedTotal > 0
                ? `₹${selectedTotal} added to this checkout`
                : `₹${totalAvailable} pending — not added until you tick`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!loading && pendingSettlements.length > 0 && selectedCount === 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                pendingSettlements.forEach((l) => togglePendingSettlement(l.saleId, true));
                setExpanded(true);
              }}
              className="px-2 py-1 rounded-md bg-amber-500 text-white text-[10px] font-bold hover:bg-amber-600"
            >
              Add all
            </button>
          )}
          {!loading && selectedCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold">
              {selectedCount}
            </span>
          )}
          <svg
            className={`w-5 h-5 text-amber-700 dark:text-amber-300 transition-transform duration-200 group-hover:text-amber-900 dark:group-hover:text-amber-100 ${
              expanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-amber-200/60 dark:border-amber-800/40 space-y-2 animate-fade-in">
          <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80">
            Select bills to include. Payment is recorded on the original sale.
          </p>

          {loading ? (
            <div className="py-4 text-center text-xs text-amber-700 dark:text-amber-300">Loading bills…</div>
          ) : (
            pendingSettlements.map((line) => (
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
            ))
          )}
        </div>
      )}
    </div>
  );
}
