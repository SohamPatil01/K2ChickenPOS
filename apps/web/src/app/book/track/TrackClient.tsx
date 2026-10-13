'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
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
      return 'Ready for you';
    case 'FULFILLED':
      return 'Collected';
    case 'CANCELLED':
      return 'Cancelled';
    case 'NO_SHOW':
      return 'No-show';
    default:
      return status;
  }
}

const displayFont = { fontFamily: 'var(--font-book-display), Georgia, serif' } as const;

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
    const t = setInterval(() => load(phone, code), 20000);
    return () => clearInterval(t);
  }, [order, phone, code, load]);

  const stepIndex = useMemo(() => {
    if (!order) return -1;
    if (order.status === 'CANCELLED' || order.status === 'NO_SHOW') return -1;
    return STEPS.indexOf(order.status as (typeof STEPS)[number]);
  }, [order]);

  return (
    <div className="min-h-screen bg-[#f7fbf4] pb-10">
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, #d8f0d0 0%, transparent 55%)',
        }}
      />

      <div className="relative max-w-lg mx-auto px-4 pt-5 space-y-4">
        <header>
          <a href="/book" className="flex items-center gap-2.5 mb-4">
            <div className="relative w-10 h-10 rounded-2xl overflow-hidden bg-white border border-[#d7e8d4]">
              <Image
                src="/chicken-vicken-logo.png"
                alt="K2 Chicken"
                fill
                className="object-contain p-1"
                sizes="40px"
              />
            </div>
            <div>
              <p className="font-extrabold text-[#1a2e1c] leading-none" style={displayFont}>
                K2 Chicken
              </p>
              <p className="text-[11px] text-[#5a7a60] mt-0.5">← Book a cut</p>
            </div>
          </a>
          <h1 className="text-2xl font-extrabold text-[#1a2e1c]" style={displayFont}>
            Track your order
          </h1>
          <p className="text-sm text-[#4a6350] mt-1">Live updates from the shop</p>
        </header>

        <form
          className="bg-white rounded-3xl border border-[#d7e8d4] p-4 shadow-sm space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            load(phone, code);
          }}
        >
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="Phone (10 digits)"
            value={phone}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '');
              setPhone(digits.length > 10 ? digits.slice(-10) : digits.slice(0, 10));
            }}
            className="w-full px-3 py-3 rounded-xl border border-[#c8e0c4] bg-[#f7fbf4] text-[#1a2e1c] placeholder:text-[#8aa890]"
          />
          <input
            autoComplete="off"
            maxLength={8}
            placeholder="Tracking code"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
            }
            className="w-full px-3 py-3 rounded-xl border border-[#c8e0c4] bg-[#f7fbf4] text-[#1a2e1c] tracking-[0.2em] font-bold uppercase placeholder:tracking-normal placeholder:font-normal placeholder:text-[#8aa890]"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-[#2d8a4e] text-white font-bold disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Show status'}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        {order && (
          <div className="bg-white rounded-3xl border border-[#d7e8d4] p-5 shadow-sm space-y-4">
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-xs text-[#5a7a60]">{order.storeName || 'K2 Chicken'}</p>
                <p className="text-xl font-extrabold text-[#1a2e1c]" style={displayFont}>
                  {statusTitle(order.status)}
                </p>
                <p className="text-sm text-[#4a6350]">{statusLabel}</p>
              </div>
              <div className="text-right rounded-2xl bg-[#eef8ea] border border-[#c8e0c4] px-3 py-2">
                <p className="text-[10px] text-[#5a7a60]">Code</p>
                <p className="font-bold tracking-widest text-[#1a2e1c]">{order.trackingCode}</p>
              </div>
            </div>

            {order.status !== 'CANCELLED' && order.status !== 'NO_SHOW' && (
              <div className="flex gap-1.5">
                {STEPS.map((s, i) => (
                  <div
                    key={s}
                    className={`flex-1 h-2 rounded-full ${
                      stepIndex >= i ? 'bg-[#2d8a4e]' : 'bg-[#d7e8d4]'
                    }`}
                  />
                ))}
              </div>
            )}

            {(order.status === 'CANCELLED' || order.cancelReason) && (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-900">
                <p className="font-semibold">Cancelled</p>
                <p>{order.cancelReason || 'This pre-order was cancelled.'}</p>
              </div>
            )}

            <p className="text-xs text-[#4a6350] leading-relaxed">
              {disclaimer ||
                'We try our best near your requested time. During rush it may take longer.'}
            </p>

            <div>
              <p className="text-sm font-bold text-[#1a2e1c] mb-1">Items</p>
              <ul className="text-sm text-[#4a6350] space-y-0.5">
                {order.items.map((it, i) => (
                  <li key={i}>
                    {it.productName} —{' '}
                    {it.unitType === 'KG' ? `${it.qtyKg} kg` : `${it.qtyPcs} pcs`}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-sm font-bold text-[#1a2e1c] mb-2">Updates</p>
              <ol className="space-y-2 border-l-2 border-[#c8e0c4] pl-3">
                {(order.events || []).length === 0 ? (
                  <li className="text-sm text-[#5a7a60]">No updates yet</li>
                ) : (
                  [...(order.events || [])].reverse().map((ev) => (
                    <li key={ev.id} className="text-sm">
                      <p className="text-[#1a2e1c]">{ev.message}</p>
                      <p className="text-xs text-[#5a7a60]">
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
