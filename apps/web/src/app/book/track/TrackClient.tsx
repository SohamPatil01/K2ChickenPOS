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
    <div className="book-page min-h-screen relative pb-12">
      <div className="book-bg" aria-hidden />
      <div className="relative z-10 max-w-lg mx-auto px-4 pt-5 sm:pt-8 space-y-4">
        <header className="animate-book-in">
          <div className="flex items-center justify-between gap-3 mb-4">
            <a href="/book" className="flex items-center gap-3 group">
              <div className="relative w-11 h-11 rounded-2xl overflow-hidden bg-white shadow-md ring-1 ring-black/5">
                <Image
                  src="/chicken-vicken-logo.png"
                  alt="K2 Chicken"
                  fill
                  className="object-contain p-1"
                  sizes="44px"
                />
              </div>
              <div>
                <p
                  className="text-lg font-extrabold text-[#1c1410] leading-none group-hover:text-[#e85d04] transition-colors"
                  style={displayFont}
                >
                  K2 Chicken
                </p>
                <p className="text-[11px] text-[#8a6f58] mt-0.5">← Back to book</p>
              </div>
            </a>
          </div>
          <h1
            className="text-[1.85rem] sm:text-3xl font-extrabold text-[#1c1410] leading-tight"
            style={displayFont}
          >
            Track your order
          </h1>
          <p className="text-sm text-[#5c4a3d] mt-1.5">
            Live updates from the shop — refreshes automatically.
          </p>
        </header>

        <form
          className="book-panel p-4 sm:p-5 space-y-3 animate-book-in"
          style={{ animationDelay: '40ms' }}
          onSubmit={(e) => {
            e.preventDefault();
            load(phone, code);
          }}
        >
          <div>
            <label htmlFor="track-phone" className="book-label">
              Mobile number
            </label>
            <input
              id="track-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={13}
              placeholder="10-digit number"
              value={phone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setPhone(digits.length > 10 ? digits.slice(-10) : digits.slice(0, 10));
              }}
              className="book-input"
            />
          </div>
          <div>
            <label htmlFor="track-code" className="book-label">
              Tracking code
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
              className="book-input tracking-[0.2em] font-bold uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-[#e85d04] hover:bg-[#d54e00] text-white font-bold disabled:opacity-50 transition-transform active:scale-[0.98]"
          >
            {loading ? 'Loading…' : 'Show status'}
          </button>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </form>

        {order && (
          <div className="book-panel p-5 space-y-4 animate-book-in" style={{ animationDelay: '80ms' }}>
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-xs text-[#8a6f58]">{order.storeName || 'K2 Chicken'}</p>
                <p className="text-2xl font-extrabold text-[#1c1410] mt-0.5" style={displayFont}>
                  {statusTitle(order.status)}
                </p>
                <p className="text-sm text-[#5c4a3d]">{statusLabel}</p>
              </div>
              <div className="text-right rounded-2xl bg-[#1c1410] text-[#fff8f0] px-3 py-2">
                <p className="text-[10px] uppercase tracking-widest text-[#c4a882]">Code</p>
                <p className="font-bold tracking-widest text-lg">{order.trackingCode}</p>
              </div>
            </div>

            {order.status !== 'CANCELLED' && order.status !== 'NO_SHOW' && (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  {STEPS.map((s, i) => (
                    <div
                      key={s}
                      className={`flex-1 h-2.5 rounded-full transition-colors ${
                        stepIndex >= i ? 'bg-[#e85d04]' : 'bg-[#eadfce]'
                      }`}
                      title={s}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-[#8a6f58] px-0.5">
                  <span>Received</span>
                  <span>Ready</span>
                  <span>Done</span>
                </div>
              </div>
            )}

            {(order.status === 'CANCELLED' || order.cancelReason) && (
              <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-900">
                <p className="font-semibold">Cancelled by shop</p>
                <p>{order.cancelReason || 'This pre-order was cancelled.'}</p>
              </div>
            )}

            <div className="rounded-2xl bg-[#fff6eb] border border-[#f0d2a8] p-3 text-sm text-[#5c3d1a]">
              {disclaimer ||
                'We try our best near your requested time. During shop rush it may take longer.'}
            </div>

            <div>
              <p className="text-sm font-bold text-[#1c1410] mb-1.5">Items</p>
              <ul className="text-sm text-[#5c4a3d] space-y-1">
                {order.items.map((it, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span>{it.productName}</span>
                    <span className="text-[#8a6f58] shrink-0">
                      {it.unitType === 'KG' ? `${it.qtyKg} kg` : `${it.qtyPcs} pcs`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-[#8a6f58] mt-2">
                Requested:{' '}
                {new Date(order.readyAt).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                })}{' '}
                · {order.fulfillment}
              </p>
            </div>

            <div>
              <p className="text-sm font-bold text-[#1c1410] mb-2">Live updates</p>
              <ol className="space-y-3 border-l-2 border-[#f0d2a8] pl-4">
                {(order.events || []).length === 0 ? (
                  <li className="text-sm text-[#8a6f58]">No updates yet</li>
                ) : (
                  [...(order.events || [])].reverse().map((ev) => (
                    <li key={ev.id} className="text-sm relative">
                      <span className="absolute -left-[1.35rem] top-1.5 w-2.5 h-2.5 rounded-full bg-[#e85d04] ring-2 ring-[#fffcf8]" />
                      <p className="text-[#1c1410]">{ev.message}</p>
                      <p className="text-xs text-[#8a6f58] mt-0.5">
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

      <style jsx global>{`
        .book-page {
          color: #1c1410;
          background: #1a120e;
        }
        .book-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          background:
            radial-gradient(ellipse 90% 60% at 10% -10%, rgba(232, 93, 4, 0.35), transparent 55%),
            radial-gradient(ellipse 70% 50% at 100% 0%, rgba(255, 180, 80, 0.2), transparent 50%),
            radial-gradient(ellipse 80% 40% at 50% 100%, rgba(45, 90, 55, 0.18), transparent 55%),
            linear-gradient(165deg, #2a1c14 0%, #1a120e 40%, #241810 100%);
        }
        .book-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          opacity: 0.07;
          background-image: repeating-linear-gradient(
            -18deg,
            transparent,
            transparent 11px,
            rgba(255, 240, 220, 0.5) 11px,
            rgba(255, 240, 220, 0.5) 12px
          );
          pointer-events: none;
        }
        .book-panel {
          background: rgba(255, 252, 248, 0.94);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(240, 210, 168, 0.55);
          border-radius: 1.25rem;
          box-shadow: 0 12px 40px rgba(20, 10, 0, 0.18);
        }
        .book-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 600;
          color: #8a6f58;
          margin-bottom: 0.35rem;
        }
        .book-input {
          width: 100%;
          padding: 0.7rem 0.9rem;
          border-radius: 0.9rem;
          border: 1px solid #eadfce;
          background: #fffcf8;
          color: #1c1410;
          font-size: 1rem;
          outline: none;
        }
        .book-input:focus {
          border-color: #e85d04;
          box-shadow: 0 0 0 3px rgba(232, 93, 4, 0.15);
        }
        @keyframes book-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-book-in {
          animation: book-in 0.45s ease-out both;
        }
      `}</style>
    </div>
  );
}
