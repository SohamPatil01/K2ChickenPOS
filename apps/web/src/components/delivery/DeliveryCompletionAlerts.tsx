'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button, Card } from '@/components/ui';

type CompletionItem = {
  id: string;
  status: string;
  type: string;
  deliveryFee: number;
  deliveredAt: string | null;
  failureReason?: string | null;
  sale: {
    saleNo: string;
    grandTotal: number;
    status?: string;
    customer: { id?: string; name: string; phone: string } | null;
    payments?: Array<{ method: string; amount: number }>;
    items?: Array<{
      qtyKg: number | null;
      qtyPcs: number | null;
      lineTotal: number;
      product: { name: string; unitType: string } | null;
    }>;
  };
  address: {
    line1: string;
    line2?: string | null;
    city: string;
    state?: string | null;
    zip?: string | null;
  } | null;
  assignedDriver: { id: string; name: string; phone?: string | null } | null;
};

function ackKey(userId: string) {
  return `k2-delivery-completion-acks:${userId}`;
}

function loadAcks(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(ackKey(userId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveAcks(userId: string, ids: Set<string>) {
  try {
    // Keep last 200 so storage stays small
    const list = [...ids].slice(-200);
    localStorage.setItem(ackKey(userId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function paymentLines(payments?: Array<{ method: string; amount: number }>) {
  if (!payments?.length) return '—';
  return payments
    .map((p) => `${String(p.method).toUpperCase()} ₹${Math.round(Number(p.amount) || 0)}`)
    .join(' · ');
}

function addressLine(a: CompletionItem['address']) {
  if (!a) return '—';
  return [a.line1, a.line2, a.city, a.state, a.zip].filter(Boolean).join(', ');
}

/**
 * Manager/Owner: small toast when a driver marks Delivered; tap for full details.
 */
export default function DeliveryCompletionAlerts() {
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const [items, setItems] = useState<CompletionItem[]>([]);
  const [acks, setAcks] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<CompletionItem | null>(null);

  const enabled =
    hasHydrated && (user?.role === 'MANAGER' || user?.role === 'OWNER');

  useEffect(() => {
    if (!user?.id || !enabled) return;
    setAcks(loadAcks(user.id));
  }, [user?.id, enabled]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await api.get('/api/v1/delivery/recent-completions', {
        params: { hours: 12 },
      });
      const list = Array.isArray(res.data?.items) ? res.data.items : [];
      setItems(list);
      return list as CompletionItem[];
    } catch {
      /* non-fatal — toast is best-effort */
      return [] as CompletionItem[];
    }
  }, [enabled]);

  // First successful load: remember existing completions so we only toast *new* ones
  // after the console is open (plus anything not yet dismissed from this device).
  const [primed, setPrimed] = useState(false);

  useEffect(() => {
    if (!enabled || !user?.id) return;
    let cancelled = false;
    (async () => {
      const list = (await refresh()) || [];
      if (cancelled) return;
      setAcks((prev) => {
        const next = new Set(prev);
        // Auto-ack anything older than 45 minutes so login isn't a toast flood
        const cutoff = Date.now() - 45 * 60 * 1000;
        for (const it of list) {
          const t = it.deliveredAt ? new Date(it.deliveredAt).getTime() : 0;
          if (t && t < cutoff) next.add(it.id);
        }
        saveAcks(user.id, next);
        return next;
      });
      setPrimed(true);
    })();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 25_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, user?.id, refresh]);

  const pending = useMemo(() => {
    if (!primed) return [];
    return items.filter((it) => it.id && !acks.has(it.id)).slice(0, 5);
  }, [items, acks, primed]);

  const dismiss = (id: string) => {
    if (!user?.id) return;
    setAcks((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveAcks(user.id, next);
      return next;
    });
    if (selected?.id === id) setSelected(null);
  };

  const openDetails = (item: CompletionItem) => {
    setSelected(item);
  };

  if (!enabled || typeof document === 'undefined') return null;

  const toasts =
    pending.length > 0
      ? createPortal(
          <div className="fixed bottom-4 right-2 sm:right-4 z-[10050] flex flex-col gap-2 max-w-[calc(100vw-1rem)] sm:max-w-sm pointer-events-none">
            {pending.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openDetails(item)}
                className="pointer-events-auto text-left rounded-2xl border border-emerald-200 bg-white/95 dark:bg-gray-900/95 shadow-xl px-4 py-3 hover:border-emerald-400 transition active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                      Driver delivered
                    </p>
                    <p className="font-bold text-ink truncate">
                      {item.sale?.saleNo} · {item.sale?.customer?.name || 'Customer'}
                    </p>
                    <p className="text-xs text-ink-muted mt-0.5 truncate">
                      {item.assignedDriver?.name
                        ? `By ${item.assignedDriver.name}`
                        : 'Driver'}
                      {' · '}
                      ₹{Math.round(item.sale?.grandTotal || 0).toLocaleString('en-IN')}
                      {' · '}
                      Tap for details
                    </p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    className="shrink-0 text-ink-muted hover:text-ink px-1 text-lg leading-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismiss(item.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.stopPropagation();
                        dismiss(item.id);
                      }
                    }}
                    aria-label="Dismiss"
                  >
                    ×
                  </span>
                </div>
              </button>
            ))}
          </div>,
          document.body
        )
      : null;

  const modal =
    selected &&
    createPortal(
      <div
        className="fixed inset-0 z-[10060] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setSelected(null)}
      >
        <div
          className="w-full max-w-md max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
        <Card className="space-y-3 p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Delivery completed
              </p>
              <h2 className="text-xl font-bold text-ink">{selected.sale?.saleNo}</h2>
            </div>
            <button
              type="button"
              className="text-ink-muted hover:text-ink text-xl px-1"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 px-3 py-2 text-sm">
            <p className="font-semibold text-emerald-900 dark:text-emerald-100">
              Delivered
              {selected.deliveredAt
                ? ` · ${new Date(selected.deliveredAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : ''}
            </p>
            <p className="text-emerald-800/80 dark:text-emerald-200/80 text-xs mt-0.5">
              Driver: {selected.assignedDriver?.name || '—'}
              {selected.assignedDriver?.phone ? ` · ${selected.assignedDriver.phone}` : ''}
            </p>
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-semibold text-ink">
              {selected.sale?.customer?.name || 'Customer'}
            </p>
            <p className="text-ink-secondary">{selected.sale?.customer?.phone || '—'}</p>
            <p className="text-ink-secondary">{addressLine(selected.address)}</p>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-gray-800/60 px-3 py-2 text-sm">
            <p className="text-xs text-ink-muted font-medium">Payment</p>
            <p className="font-semibold text-ink">{paymentLines(selected.sale?.payments)}</p>
            <p className="text-lg font-black text-brand-700 mt-1">
              ₹{Math.round(selected.sale?.grandTotal || 0).toLocaleString('en-IN')}
              {selected.deliveryFee > 0
                ? ` · fee ₹${Math.round(selected.deliveryFee)}`
                : ''}
            </p>
          </div>

          {(selected.sale?.items?.length || 0) > 0 && (
            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">Items</p>
              <ul className="text-sm space-y-1">
                {selected.sale!.items!.map((it, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>
                      {it.product?.name || 'Item'} —{' '}
                      {it.product?.unitType === 'PCS'
                        ? `${it.qtyPcs ?? 0} pcs`
                        : `${it.qtyKg ?? 0} kg`}
                    </span>
                    <span className="text-ink-muted">
                      ₹{Math.round(it.lineTotal || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                dismiss(selected.id);
              }}
            >
              Dismiss
            </Button>
            <Button
              type="button"
              onClick={() => {
                dismiss(selected.id);
              }}
            >
              Got it
            </Button>
          </div>
        </Card>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      {toasts}
      {modal}
    </>
  );
}
