'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getApiBaseUrl } from '@/lib/apiBaseUrl';
import { BRAND } from '@/lib/customerDisplay/brand';

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

const STEPS = [
  { key: 'PENDING', label: 'Received' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'READY', label: 'Ready' },
  { key: 'FULFILLED', label: 'Done' },
] as const;

function apiUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

function statusTitle(status: string) {
  switch (status) {
    case 'PENDING':
      return 'Order received';
    case 'CONFIRMED':
      return 'Confirmed by store';
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

function statusHint(status: string) {
  switch (status) {
    case 'PENDING':
      return 'The shop has your request and will confirm shortly.';
    case 'CONFIRMED':
      return 'Your cuts are being prepared. Hang tight!';
    case 'READY':
      return 'Come pick up — or wait for delivery if you chose that.';
    case 'FULFILLED':
      return 'Thanks for choosing K2 Chicken. Enjoy your meal!';
    case 'CANCELLED':
      return 'This booking was cancelled. You can place a new one anytime.';
    default:
      return '';
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
  const [pulse, setPulse] = useState(false);

  const load = useCallback(async (p: string, c: string, silent = false) => {
    const phoneN = p.replace(/\D/g, '').slice(-10);
    const codeN = c.trim().toUpperCase();
    if (phoneN.length < 10 || codeN.length < 4) {
      setError('Enter your 10-digit phone and tracking code');
      return;
    }
    if (!silent) setLoading(true);
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
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } catch (e: any) {
      setOrder(null);
      setError(e.message || 'Could not load order');
    } finally {
      if (!silent) setLoading(false);
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
    const t = setInterval(() => load(phone, code, true), 15000);
    return () => clearInterval(t);
  }, [order, phone, code, load]);

  const stepIndex = useMemo(() => {
    if (!order) return -1;
    if (order.status === 'CANCELLED' || order.status === 'NO_SHOW') return -1;
    return STEPS.findIndex((s) => s.key === order.status);
  }, [order]);

  const cancelled = order?.status === 'CANCELLED' || order?.status === 'NO_SHOW';

  return (
    <>
      <header className="k2-topbar">
        <Link className="k2-brand" href="/book" aria-label="Back to book">
          <span className="k2-brand-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/book/logo.png" alt={`${BRAND.name} logo`} />
          </span>
          <span>
            <span className="k2-brand-name">{BRAND.name}</span>
            <span className="k2-brand-tag">← Book another cut</span>
          </span>
        </Link>
        <div className="k2-top-right">
          <a className="k2-call" href={`tel:+91${BRAND.phone}`}>
            ☎ &nbsp; {BRAND.phoneDisplay}
          </a>
        </div>
      </header>

      <main className="k2-page k2-track-page">
        <section className="k2-track-hero">
          <div className="k2-eyebrow">Live tracking</div>
          <h1>
            Follow your
            <br />
            <span>order.</span>
          </h1>
          <p>Enter your phone and tracking code for real-time updates from the shop.</p>
        </section>

        <form
          className="k2-panel k2-track-form"
          onSubmit={(e) => {
            e.preventDefault();
            load(phone, code);
          }}
        >
          <div className="k2-fields" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div>
              <label className="k2-field-label" htmlFor="track-phone">
                Phone
              </label>
              <input
                id="track-phone"
                className="k2-field"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10 digits"
                value={phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setPhone(digits.length > 10 ? digits.slice(-10) : digits.slice(0, 10));
                }}
              />
            </div>
            <div>
              <label className="k2-field-label" htmlFor="track-code">
                Tracking code
              </label>
              <input
                id="track-code"
                className="k2-field"
                autoComplete="off"
                maxLength={8}
                placeholder="e.g. AB12CD"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))
                }
                style={{ letterSpacing: '0.18em', fontWeight: 700, textTransform: 'uppercase' }}
              />
            </div>
          </div>
          <button className="k2-submit" type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Show live status'} <span aria-hidden="true">→</span>
          </button>
          {error && <div className="k2-error">{error}</div>}
        </form>

        {order && (
          <article className={`k2-panel k2-track-card${pulse ? ' pulse' : ''}`}>
            <div className="k2-track-status-row">
              <div>
                <p className="k2-track-store">{order.storeName || BRAND.name}</p>
                <h2>{statusTitle(order.status)}</h2>
                <p className="k2-track-hint">
                  {statusLabel || statusHint(order.status)}
                </p>
              </div>
              <div className="k2-track-code-pill">
                <span>Code</span>
                <strong>{order.trackingCode}</strong>
              </div>
            </div>

            {!cancelled && (
              <div className="k2-track-steps" aria-label="Order progress">
                {STEPS.map((s, i) => {
                  const done = stepIndex >= i;
                  const current = stepIndex === i;
                  return (
                    <div
                      key={s.key}
                      className={`k2-track-step${done ? ' done' : ''}${current ? ' current' : ''}`}
                    >
                      <div className="k2-track-step-dot">
                        {done && stepIndex > i ? '✓' : i + 1}
                      </div>
                      <span>{s.label}</span>
                      {i < STEPS.length - 1 && <div className="k2-track-step-line" />}
                    </div>
                  );
                })}
              </div>
            )}

            {(cancelled || order.cancelReason) && (
              <div className="k2-error" style={{ marginTop: 0 }}>
                <strong style={{ display: 'block', marginBottom: 4 }}>Cancelled</strong>
                {order.cancelReason || 'This pre-order was cancelled.'}
              </div>
            )}

            <div className="k2-track-meta">
              <div>
                <span>Ready around</span>
                <strong>
                  {new Date(order.readyAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </strong>
              </div>
              <div>
                <span>Fulfillment</span>
                <strong>{order.fulfillment === 'DELIVERY' ? 'Home delivery' : 'Store pickup'}</strong>
              </div>
              <div>
                <span>Customer</span>
                <strong>{order.customerName}</strong>
              </div>
            </div>

            <p className="k2-fine" style={{ margin: '12px 0 0' }}>
              {disclaimer ||
                'We try our best near your requested time. During rush hours it may take a little longer.'}
            </p>

            <div className="k2-rule" />

            <h3 className="k2-form-title">Your cuts</h3>
            <ul className="k2-track-items">
              {order.items.map((it, i) => (
                <li key={i} style={{ animationDelay: `${i * 40}ms` }}>
                  <span>{it.productName}</span>
                  <strong>
                    {it.unitType === 'KG' ? `${it.qtyKg} kg` : `${it.qtyPcs} pcs`}
                  </strong>
                </li>
              ))}
            </ul>

            <h3 className="k2-form-title" style={{ marginTop: 18 }}>
              Updates
            </h3>
            <ol className="k2-track-timeline">
              {(order.events || []).length === 0 ? (
                <li className="muted">No updates yet — we&apos;ll refresh automatically.</li>
              ) : (
                [...(order.events || [])].reverse().map((ev, i) => (
                  <li key={ev.id} style={{ animationDelay: `${i * 50}ms` }}>
                    <div className="k2-track-tl-dot" />
                    <div>
                      <p>{ev.message}</p>
                      <time>
                        {new Date(ev.createdAt).toLocaleString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  </li>
                ))
              )}
            </ol>

            <div className="k2-track-live">
              <span className="k2-dot" />
              Auto-refreshing every 15s
            </div>
          </article>
        )}

        {!order && !loading && (
          <section className="k2-trust-strip" style={{ marginTop: 14 }}>
            <div className="k2-trust">
              <span className="k2-trust-icon">◷</span>
              <div>
                <strong>Live from the shop</strong>
                <small>Status updates as we prepare</small>
              </div>
            </div>
            <div className="k2-trust">
              <span className="k2-trust-icon">♧</span>
              <div>
                <strong>Same day ready</strong>
                <small>Pick a time that works for you</small>
              </div>
            </div>
            <div className="k2-trust">
              <span className="k2-trust-icon">☎</span>
              <div>
                <strong>Need help?</strong>
                <small>Call {BRAND.phoneDisplay}</small>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
