'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getApiBaseUrl } from '@/lib/apiBaseUrl';

type TrackEvent = {
  id: string;
  kind: string;
  message: string;
  status: string | null;
  createdAt: string;
};

type TrackOrder = {
  trackingCode: string;
  customerName: string;
  status: string;
  readyAt: string;
  cancelReason: string | null;
  storeName: string | null;
  fulfillment: string;
  items: Array<{
    productName: string;
    unitType: string;
    qtyKg: number | null;
    qtyPcs: number | null;
  }>;
  events: TrackEvent[];
};

const STEPS = ['PENDING', 'CONFIRMED', 'READY', 'FULFILLED'] as const;

function apiUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

function statusTitle(status: string) {
  switch (status) {
    case 'PENDING':
      return 'Received';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'READY':
      return 'Ready';
    case 'FULFILLED':
      return 'Done';
    case 'CANCELLED':
      return 'Cancelled';
    case 'NO_SHOW':
      return 'No-show';
    default:
      return status;
  }
}

export default function BookTrackPage() {
  const search = useSearchParams();
  const [phone, setPhone] = useState(search.get('phone') || '');
  const [code, setCode] = useState((search.get('code') || '').toUpperCase());
  const [order, setOrder] = useState<TrackOrder | null>(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [statusLabel, setStatusLabel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p: string, c: string) => {
    const phoneN = p.replace(/\D/g, '').slice(-10);
    const codeN = c.trim().toUpperCase();
    if (phoneN.length < 10 || codeN.length < 4) {
      setError('Enter your 10-digit phone and tracking code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        apiUrl(
          `/api/v1/public/pre-orders/track?phone=${encodeURIComponent(phoneN)}&code=${encodeURIComponent(codeN)}`
        )
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Not found');
      setOrder(data.preOrder);
      setDisclaimer(data.disclaimer || '');
      setStatusLabel(data.statusLabel || '');
    } catch (e: any) {
      setOrder(null);
      setError(e.message || 'Could not load order');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const p = search.get('phone');
    const c = search.get('code');
    if (p && c) {
      setPhone(p);
      setCode(c.toUpperCase());
      load(p, c);
    }
  }, [search, load]);

  useEffect(() => {
    if (!order) return;
    const t = setInterval(() => {
      load(phone, code);
    }, 20000);
    return () => clearInterval(t);
  }, [order, phone, code, load]);

  const stepIndex = useMemo(() => {
    if (!order) return -1;
    if (order.status === 'CANCELLED' || order.status === 'NO_SHOW') return -1;
    return STEPS.indexOf(order.status as (typeof STEPS)[number]);
  }, [order]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-orange-50 p-4 pb-16">
      <div className="max-w-lg mx-auto space-y-4">
        <header className="pt-4">
          <a href="/book" className="text-sm text-orange-800 underline">
            ← Book a cut
          </a>
          <h1 className="text-3xl font-bold mt-2">Track your order</h1>
          <p className="text-sm text-gray-600 mt-1">
            Live updates from the shop. We refresh automatically.
          </p>
        </header>

        <form
          className="bg-white rounded-2xl shadow p-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            load(phone, code);
          }}
        >
          <div>
            <label htmlFor="track-phone" className="block text-sm font-medium text-gray-700 mb-1">
              Mobile number (10 digits)
            </label>
            <input
              id="track-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={13}
              placeholder="e.g. 9022938302"
              value={phone}
              onChange={(e) => {
                // Keep last 10 digits so +91 / 0-prefix pastes still work
                const digits = e.target.value.replace(/\D/g, '');
                setPhone(digits.length > 10 ? digits.slice(-10) : digits.slice(0, 10));
              }}
              className="w-full px-3 py-2.5 border rounded-xl"
            />
          </div>
          <div>
            <label htmlFor="track-code" className="block text-sm font-medium text-gray-700 mb-1">
              Tracking code (from booking)
            </label>
            <input
              id="track-code"
              autoComplete="off"
              maxLength={8}
              placeholder="e.g. UETSMW"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
              }
              className="w-full px-3 py-2.5 border rounded-xl tracking-widest font-semibold uppercase"
            />
            <p className="text-xs text-gray-500 mt-1">6-character code shown after you book</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-orange-600 text-white font-bold disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Show status'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        {order && (
          <div className="bg-white rounded-2xl shadow p-5 space-y-4">
            <div className="flex justify-between gap-2">
              <div>
                <p className="text-xs text-gray-500">{order.storeName || 'K2 Chicken'}</p>
                <p className="text-xl font-bold">{statusTitle(order.status)}</p>
                <p className="text-sm text-gray-600">{statusLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Code</p>
                <p className="font-bold tracking-widest">{order.trackingCode}</p>
              </div>
            </div>

            {order.status !== 'CANCELLED' && order.status !== 'NO_SHOW' && (
              <div className="flex gap-1">
                {STEPS.map((s, i) => (
                  <div
                    key={s}
                    className={`flex-1 h-2 rounded-full ${
                      stepIndex >= i ? 'bg-orange-500' : 'bg-gray-200'
                    }`}
                    title={s}
                  />
                ))}
              </div>
            )}

            {(order.status === 'CANCELLED' || order.cancelReason) && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-900">
                <p className="font-semibold">Cancelled by shop</p>
                <p>{order.cancelReason || 'This pre-order was cancelled.'}</p>
              </div>
            )}

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-950">
              {disclaimer ||
                'We try our best near your requested time. During shop rush it may take longer.'}
            </div>

            <div>
              <p className="text-sm font-medium mb-1">Items</p>
              <ul className="text-sm text-gray-700 space-y-0.5">
                {order.items.map((it, i) => (
                  <li key={i}>
                    {it.productName} —{' '}
                    {it.unitType === 'KG' ? `${it.qtyKg} kg` : `${it.qtyPcs} pcs`}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-2">
                Requested ready:{' '}
                {new Date(order.readyAt).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                })}{' '}
                · {order.fulfillment}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Live updates</p>
              <ol className="space-y-3 border-l-2 border-orange-200 pl-4">
                {(order.events || []).length === 0 ? (
                  <li className="text-sm text-gray-500">No updates yet</li>
                ) : (
                  [...(order.events || [])].reverse().map((ev) => (
                    <li key={ev.id} className="text-sm">
                      <p className="text-gray-900">{ev.message}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(ev.createdAt).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </li>
                  ))
                )}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
