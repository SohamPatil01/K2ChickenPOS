'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { getApiBaseUrl } from '@/lib/apiBaseUrl';

type StoreOpt = { id: string; name: string };
type CatalogProduct = {
  id: string;
  name: string;
  unitType: 'KG' | 'PCS';
  pricePerUnit: number;
  categoryName: string | null;
};

type LineDraft = {
  key: string;
  productId: string;
  productName: string;
  unitType: 'KG' | 'PCS';
  qty: string;
};

function apiUrl(path: string) {
  const base = getApiBaseUrl();
  return `${base}${path}`;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultReadyLocal(): string {
  const d = new Date();
  d.setHours(d.getHours() + 2, 0, 0, 0);
  return toLocalInput(d);
}

function readyInHours(hours: number): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + hours);
  return toLocalInput(d);
}

function tonightAt(hour: number): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(hour);
  if (d.getTime() <= Date.now() + 30 * 60 * 1000) {
    d.setDate(d.getDate() + 1);
  }
  return toLocalInput(d);
}

function fmtReadyChip(value: string): string {
  try {
    return new Date(value).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

const displayFont = { fontFamily: 'var(--font-book-display), Georgia, serif' } as const;

export default function BookPreOrderPage() {
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [storeId, setStoreId] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{
    id: string;
    readyAt: string;
    trackingCode: string;
    phone: string;
  } | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [readyAt, setReadyAt] = useState(defaultReadyLocal);
  const [notes, setNotes] = useState('');
  const [fulfillment, setFulfillment] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/v1/public/pre-orders/stores'));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load stores');
      const list: StoreOpt[] = data.stores || [];
      setStores(list);
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('store') || params.get('storeId') || '';
      const initial = list.find((s) => s.id === fromQuery)?.id || list[0]?.id || '';
      setStoreId(initial);
    } catch (e: any) {
      setError(e.message || 'Could not load booking form');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const res = await fetch(
        apiUrl(`/api/v1/public/pre-orders/catalog?storeId=${encodeURIComponent(id)}`)
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load menu');
      setProducts(data.products || []);
    } catch (e: any) {
      setError(e.message || 'Could not load products');
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  useEffect(() => {
    if (storeId) loadCatalog(storeId);
  }, [storeId, loadCatalog]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      if (p.categoryName) set.add(p.categoryName);
    }
    return Array.from(set).sort();
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (categoryFilter === 'ALL') return products;
    return products.filter((p) => p.categoryName === categoryFilter);
  }, [products, categoryFilter]);

  const addOrBumpProduct = (p: CatalogProduct) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        const nextQty =
          p.unitType === 'KG'
            ? String(Math.round((Number(existing.qty) + 0.5) * 10) / 10)
            : String(Number(existing.qty) + 1);
        return prev.map((l) => (l.productId === p.id ? { ...l, qty: nextQty } : l));
      }
      return [
        ...prev,
        {
          key: `${p.id}-${Date.now()}`,
          productId: p.id,
          productName: p.name,
          unitType: p.unitType,
          qty: p.unitType === 'KG' ? '1' : '1',
        },
      ];
    });
  };

  const setLineQty = (key: string, qty: string) => {
    setLines((prev) => prev.map((x) => (x.key === key ? { ...x, qty } : x)));
  };

  const bumpLine = (line: LineDraft, dir: 1 | -1) => {
    const step = line.unitType === 'KG' ? 0.5 : 1;
    const next = Math.max(step, Math.round((Number(line.qty) + dir * step) * 10) / 10);
    setLineQty(line.key, String(next));
  };

  const removeLine = (key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  };

  const estimated = useMemo(() => {
    return lines.reduce((sum, l) => {
      const p = products.find((x) => x.id === l.productId);
      const q = Number(l.qty) || 0;
      return sum + (p ? p.pricePerUnit * q : 0);
    }, 0);
  }, [lines, products]);

  const timePresets = useMemo(
    () => [
      { label: 'In 1 hour', value: readyInHours(1) },
      { label: 'In 2 hours', value: readyInHours(2) },
      { label: '6:00 PM', value: tonightAt(18) },
      { label: '7:00 PM', value: tonightAt(19) },
    ],
    // Refresh presets when the page has been open a while — only on mount is fine.
    []
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!storeId) {
      setError('Select a store');
      return;
    }
    if (!name.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Enter your name and a valid 10-digit phone');
      return;
    }
    if (lines.length === 0) {
      setError('Tap a cut below to add it to your bag');
      return;
    }
    setSubmitting(true);
    try {
      const items = lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        unitType: l.unitType,
        qtyKg: l.unitType === 'KG' ? Number(l.qty) : null,
        qtyPcs: l.unitType === 'PCS' ? Math.round(Number(l.qty)) : null,
      }));
      const res = await fetch(apiUrl('/api/v1/public/pre-orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          customerName: name.trim(),
          customerPhone: phone,
          fulfillment,
          readyAt,
          notes: notes.trim() || null,
          source: 'WEB_FORM',
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      setDone({
        id: data.preOrder?.id,
        readyAt: data.preOrder?.readyAt || readyAt,
        trackingCode: data.trackingCode || data.preOrder?.trackingCode || '',
        phone: phone.replace(/\D/g, '').slice(-10),
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    const when = new Date(done.readyAt);
    const trackHref = `/book/track?phone=${encodeURIComponent(done.phone)}&code=${encodeURIComponent(done.trackingCode)}`;
    return (
      <div className="book-page min-h-screen relative overflow-hidden">
        <div className="book-bg" aria-hidden />
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md book-panel p-6 sm:p-8 space-y-5 text-center animate-book-in">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-700 flex items-center justify-center text-3xl font-bold">
              ✓
            </div>
            <h1 className="text-3xl font-extrabold text-[#1c1410]" style={displayFont}>
              You&apos;re booked
            </h1>
            <p className="text-[#5c4a3d] text-sm leading-relaxed">
              We&apos;ll aim for around{' '}
              <strong className="text-[#1c1410]">
                {when.toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </strong>
              . Save your code to track live updates.
            </p>
            <div className="rounded-2xl bg-[#fff6eb] border border-[#f0d2a8] p-4 text-sm text-left text-[#5c3d1a]">
              <p className="font-semibold mb-1">Heads up</p>
              <p>
                A pre-order is a request, not an instant guarantee. During shop rush it may take a
                little longer — thank you for understanding.
              </p>
            </div>
            {done.trackingCode && (
              <div className="rounded-2xl bg-[#1c1410] text-[#fff8f0] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[#c4a882]">Tracking code</p>
                <p className="text-3xl font-extrabold tracking-[0.25em] mt-1" style={displayFont}>
                  {done.trackingCode}
                </p>
              </div>
            )}
            <a
              href={trackHref}
              className="block w-full py-3.5 rounded-2xl bg-[#e85d04] hover:bg-[#d54e00] text-white font-bold text-lg transition-transform active:scale-[0.98]"
            >
              Track order live
            </a>
            <button
              type="button"
              className="w-full py-3 rounded-2xl border border-[#e5d5c5] font-semibold text-[#1c1410] hover:bg-[#fff8f0] transition-colors"
              onClick={() => {
                setDone(null);
                setLines([]);
                setNotes('');
              }}
            >
              Book another
            </button>
          </div>
        </div>
        <BookStyles />
      </div>
    );
  }

  return (
    <div className="book-page min-h-screen relative pb-28">
      <div className="book-bg" aria-hidden />

      <div className="relative z-10 max-w-lg mx-auto px-4 pt-5 sm:pt-8">
        <header className="mb-6 animate-book-in">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-white shadow-md ring-1 ring-black/5">
                <Image
                  src="/chicken-vicken-logo.png"
                  alt="K2 Chicken"
                  fill
                  className="object-contain p-1"
                  sizes="48px"
                  priority
                />
              </div>
              <div>
                <p
                  className="text-xl font-extrabold tracking-tight text-[#1c1410] leading-none"
                  style={displayFont}
                >
                  K2 Chicken
                </p>
                <p className="text-xs text-[#8a6f58] mt-0.5">Fresh · Cut to order</p>
              </div>
            </div>
            <a
              href="/book/track"
              className="text-xs sm:text-sm font-semibold text-[#e85d04] bg-white/80 backdrop-blur px-3 py-2 rounded-full border border-[#f0d2a8] hover:bg-white transition-colors"
            >
              Track order
            </a>
          </div>

          <h1
            className="text-[2rem] sm:text-4xl font-extrabold text-[#1c1410] leading-[1.1] tracking-tight"
            style={displayFont}
          >
            Book your cut
          </h1>
          <p className="text-[#5c4a3d] mt-2 text-sm sm:text-[15px] leading-relaxed max-w-md">
            Tap what you need, pick a time, and we&apos;ll prepare it at the shop. Easy as that.
          </p>
        </header>

        {loading ? (
          <div className="book-panel p-10 text-center text-[#8a6f58] animate-pulse">
            Loading fresh menu…
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 animate-book-in" style={{ animationDelay: '60ms' }}>
            {stores.length > 1 && (
              <section className="book-panel p-4">
                <label className="book-label">Store</label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="book-input"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </section>
            )}

            {/* Products — primary action */}
            <section className="book-panel p-4 sm:p-5 space-y-3">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-[#1c1410]" style={displayFont}>
                    1. Choose your cut
                  </h2>
                  <p className="text-xs text-[#8a6f58] mt-0.5">Tap to add · tap again for more</p>
                </div>
                {lines.length > 0 && (
                  <span className="text-xs font-bold text-[#e85d04] bg-[#fff0e4] px-2.5 py-1 rounded-full">
                    {lines.length} in bag
                  </span>
                )}
              </div>

              {categories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('ALL')}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      categoryFilter === 'ALL'
                        ? 'bg-[#1c1410] text-white border-[#1c1410]'
                        : 'bg-white text-[#5c4a3d] border-[#e8d9c8]'
                    }`}
                  >
                    All
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoryFilter(c)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        categoryFilter === c
                          ? 'bg-[#1c1410] text-white border-[#1c1410]'
                          : 'bg-white text-[#5c4a3d] border-[#e8d9c8]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {visibleProducts.map((p) => {
                  const inBag = lines.find((l) => l.productId === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addOrBumpProduct(p)}
                      className={`text-left rounded-2xl border p-3 transition-all active:scale-[0.97] ${
                        inBag
                          ? 'border-[#e85d04] bg-[#fff4ea] shadow-[0_0_0_1px_#e85d04]'
                          : 'border-[#eadfce] bg-[#fffcf8] hover:border-[#e85d04]/60 hover:bg-[#fff8f0]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm text-[#1c1410] leading-snug">{p.name}</p>
                        {inBag && (
                          <span className="shrink-0 text-[10px] font-bold bg-[#e85d04] text-white rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                            {inBag.qty}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#8a6f58] mt-1.5">
                        ₹{Math.round(p.pricePerUnit)}
                        <span className="opacity-70">/{p.unitType === 'KG' ? 'kg' : 'pc'}</span>
                      </p>
                    </button>
                  );
                })}
              </div>
              {visibleProducts.length === 0 && (
                <p className="text-sm text-[#8a6f58] text-center py-4">No items in this category</p>
              )}
            </section>

            {/* Bag */}
            {lines.length > 0 && (
              <section className="book-panel p-4 sm:p-5 space-y-3 animate-book-in">
                <h2 className="text-lg font-bold text-[#1c1410]" style={displayFont}>
                  Your bag
                </h2>
                <ul className="space-y-2">
                  {lines.map((l) => (
                    <li
                      key={l.key}
                      className="flex items-center gap-3 p-3 rounded-2xl bg-[#fff6eb] border border-[#f0d2a8]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-[#1c1410] truncate">
                          {l.productName}
                        </div>
                        <div className="text-[11px] text-[#8a6f58]">
                          {l.unitType === 'KG' ? 'Kilograms' : 'Pieces'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-white rounded-xl border border-[#eadfce] p-0.5">
                        <button
                          type="button"
                          onClick={() => bumpLine(l, -1)}
                          className="w-8 h-8 rounded-lg text-lg font-bold text-[#1c1410] hover:bg-[#fff0e4]"
                          aria-label="Decrease"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={l.unitType === 'KG' ? 0.1 : 1}
                          step={l.unitType === 'KG' ? 0.1 : 1}
                          value={l.qty}
                          onChange={(e) => setLineQty(l.key, e.target.value)}
                          className="w-12 text-center text-sm font-bold bg-transparent outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => bumpLine(l, 1)}
                          className="w-8 h-8 rounded-lg text-lg font-bold text-[#1c1410] hover:bg-[#fff0e4]"
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        className="text-[#c45c4a] text-xs font-semibold px-1"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                {estimated > 0 && (
                  <p className="text-sm text-[#5c4a3d]">
                    Approx.{' '}
                    <strong className="text-[#1c1410]">
                      ₹{Math.round(estimated).toLocaleString('en-IN')}
                    </strong>
                    <span className="text-[#8a6f58]"> · final at counter</span>
                  </p>
                )}
              </section>
            )}

            {/* Details */}
            <section className="book-panel p-4 sm:p-5 space-y-4">
              <h2 className="text-lg font-bold text-[#1c1410]" style={displayFont}>
                2. Your details
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="book-label">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="book-input"
                    required
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="book-label">Mobile</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="book-input"
                    required
                    placeholder="10-digit number"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div>
                <label className="book-label">Ready by</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {timePresets.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setReadyAt(t.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        readyAt === t.value
                          ? 'bg-[#e85d04] text-white border-[#e85d04]'
                          : 'bg-white text-[#5c4a3d] border-[#e8d9c8] hover:border-[#e85d04]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <input
                  type="datetime-local"
                  value={readyAt}
                  onChange={(e) => setReadyAt(e.target.value)}
                  className="book-input"
                  required
                />
                <p className="text-[11px] text-[#8a6f58] mt-1.5">
                  Aiming for {fmtReadyChip(readyAt)} · we&apos;ll try our best
                </p>
              </div>

              <div>
                <label className="book-label">How will you collect?</label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { value: 'PICKUP' as const, title: 'Pickup', sub: 'From the shop' },
                      { value: 'DELIVERY' as const, title: 'Delivery', sub: 'If we cover your area' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFulfillment(opt.value)}
                      className={`rounded-2xl border p-3 text-left transition-all ${
                        fulfillment === opt.value
                          ? 'border-[#e85d04] bg-[#fff4ea] shadow-[0_0_0_1px_#e85d04]'
                          : 'border-[#eadfce] bg-white hover:border-[#e85d04]/50'
                      }`}
                    >
                      <div className="font-bold text-sm text-[#1c1410]">{opt.title}</div>
                      <div className="text-[11px] text-[#8a6f58] mt-0.5">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="book-label">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="book-input resize-none"
                  placeholder="e.g. curry cut, less fat, call on arrival"
                />
              </div>

              <div className="rounded-2xl bg-[#f3f7f1] border border-[#c8dbc8] p-3 text-xs text-[#3d5a3d] leading-relaxed">
                Pre-order is a <strong>request</strong>, not an instant guarantee. Weight and price
                are confirmed at the counter.
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
            </section>

            <button
              type="submit"
              disabled={submitting}
              className="hidden sm:flex w-full py-4 rounded-2xl bg-[#e85d04] hover:bg-[#d54e00] text-white font-bold text-lg disabled:opacity-50 transition-transform active:scale-[0.99] items-center justify-center gap-2"
            >
              {submitting ? 'Booking…' : 'Confirm booking'}
              {!submitting && estimated > 0 && (
                <span className="text-sm font-semibold opacity-90">
                  · ≈ ₹{Math.round(estimated)}
                </span>
              )}
            </button>

            {/* Sticky mobile CTA — stays inside the form for native submit */}
            <div className="fixed bottom-0 inset-x-0 z-20 sm:hidden pointer-events-none">
              <div className="mx-auto max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 bg-gradient-to-t from-[#1a120e]/80 via-[#1a120e]/40 to-transparent pointer-events-auto">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-2xl bg-[#e85d04] text-white font-bold text-base shadow-lg shadow-[#e85d04]/35 disabled:opacity-50 flex items-center justify-between px-5 active:scale-[0.98] transition-transform"
                >
                  <span>{submitting ? 'Booking…' : 'Confirm booking'}</span>
                  <span className="text-sm font-semibold opacity-90">
                    {lines.length === 0
                      ? 'Add a cut'
                      : estimated > 0
                        ? `≈ ₹${Math.round(estimated)}`
                        : `${lines.length} item${lines.length > 1 ? 's' : ''}`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      <BookStyles />
    </div>
  );
}

function BookStyles() {
  return (
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
        letter-spacing: 0.02em;
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
        transition: border-color 0.15s, box-shadow 0.15s;
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
      .scrollbar-none::-webkit-scrollbar {
        display: none;
      }
      .scrollbar-none {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `}</style>
  );
}
