'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { useCartStore } from '@/store/cart';
import { useNotificationStore } from '@/store/notification';
import {
  loadPreOrderIntoCart,
  type LoadablePreOrder,
} from '@/lib/loadPreOrderIntoCart';

/**
 * When a customer is attached on cart/POS, offer to load their open pre-order.
 * Weights stay editable in the cart after load. Billing fulfills the pre-order.
 */
export default function CustomerPreOrderBanner() {
  const customerId = useCartStore((s) => s.customerId);
  const customerPhone = useCartStore((s) => s.customerPhone);
  const customerName = useCartStore((s) => s.customerName);
  const linkedPreOrderIds = useCartStore((s) => s.linkedPreOrderIds);
  const { showNotification } = useNotificationStore();

  const [openOrders, setOpenOrders] = useState<LoadablePreOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    if (!customerId && !customerPhone && !customerName) {
      setOpenOrders([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/api/v1/pre-orders/for-customer', {
        params: {
          customerId: customerId || undefined,
          phone: customerPhone || undefined,
          name: customerName || undefined,
        },
      });
      setOpenOrders(res.data?.items || []);
    } catch (err) {
      console.warn('[preorder] for-customer failed:', err);
      setOpenOrders([]);
    } finally {
      setLoading(false);
    }
  }, [customerId, customerPhone, customerName]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setDismissedIds([]);
  }, [customerId, customerPhone, customerName]);

  const visible = openOrders.filter(
    (po) =>
      !dismissedIds.includes(po.id) && !(linkedPreOrderIds || []).includes(po.id)
  );

  if (!visible.length && !loading) return null;
  if (!visible.length) return null;

  const loadOne = async (po: LoadablePreOrder) => {
    setBusyId(po.id);
    try {
      const { loadedCount } = await loadPreOrderIntoCart({
        api,
        preOrder: po,
        replaceCart: true,
        markConfirmed: true,
      });
      if (loadedCount <= 0) {
        showNotification('Pre-order has no billable items yet', 'warning');
        return;
      }
      showNotification(
        `Loaded ${po.customerName}'s pre-order — adjust weights in cart, then bill`,
        'success',
        5000
      );
      setDismissedIds((ids) => [...ids, po.id]);
    } catch (e: any) {
      showNotification(e?.response?.data?.error || 'Could not load pre-order', 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-sky-300 bg-sky-50 dark:bg-sky-900/20 dark:border-sky-700 px-4 py-3 space-y-2">
      <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">
        Open pre-order{visible.length > 1 ? 's' : ''} for this customer
      </p>
      <p className="text-xs text-sky-800 dark:text-sky-200">
        Load into cart, tweak the weights (they&apos;re approximate), then bill — the
        pre-order will be marked completed.
      </p>
      <ul className="space-y-2">
        {visible.map((po) => {
          const summary = (po.items || [])
            .map((it) => {
              const qty =
                it.unitType === 'KG'
                  ? `${Number(it.qtyKg) || 0} kg`
                  : `${Number(it.qtyPcs) || 0} pcs`;
              return `${it.productName} (${qty})`;
            })
            .join(', ');
          return (
            <li
              key={po.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg bg-white/70 dark:bg-gray-900/40 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {po.customerName}
                  {po.customerPhone ? ` · ${po.customerPhone}` : ''}
                </p>
                <p className="text-xs text-ink-muted truncate">{summary || 'No items'}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busyId === po.id}
                  onClick={() => void loadOne(po)}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold disabled:opacity-50"
                >
                  {busyId === po.id ? 'Loading…' : 'Load into cart'}
                </button>
                <button
                  type="button"
                  onClick={() => setDismissedIds((ids) => [...ids, po.id])}
                  className="px-2 py-1.5 text-xs font-semibold text-ink-muted hover:underline"
                >
                  Dismiss
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
