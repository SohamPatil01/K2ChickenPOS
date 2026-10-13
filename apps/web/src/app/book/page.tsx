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
  return `${getApiBaseUrl()}${path}`;
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

const displayFont = { fontFamily: 'var(--font-book-display), Georgia, serif' } as const;

export default function BookPreOrderPage() {
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [storeId, setStoreId] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{
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
      setStoreId(list.find((s) => s.id === fromQuery)?.id || list[0]?.id || '');
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
          qty: '1',
        },
      ];
    });
  };

  const bumpLine = (line: LineDraft, dir: 1 | -1) => {
    const step = line.unitType === 'KG' ? 0.5 : 1;
    const next = Math.max(step, Math.round((Number(line.qty) + dir * step) * 10) / 10);
    setLines((prev) => prev.map((x) => (x.key === line.key ? { ...x, qty: String(next) } : x)));
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const estimated = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const p = products.find((x) => x.id === l.productId);
        return sum + (p ? p.pricePerUnit * (Number(l.qty) || 0) : 0);
      }, 0),
    [lines, products]
  );

  const timePresets = useMemo(
    () => [
      { label: '1 hr', value: readyInHours(1) },
      { label: '2 hrs', value: readyInHours(2) },
      { label: '6 PM', value: tonightAt(18) },
      { label: '7 PM', value: tonightAt(19) },
    ],
    []
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!storeId) return setError('Select a store');
    if (!name.trim() || phone.replace(/\D/g, '').length < 10) {
      return setError('Enter name and 10-digit phone');
    }
    if (lines.length === 0) return setError('Tap a cut to add it');
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
      <div className="min-h-screen bg-[#f7fbf4] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-[#d7e8d4] p-6 space-y-4 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-bold">
            ✓
          </div>
          <h1 className="text-2xl font-extrabold text-[#1a2e1c]" style={displayFont}>
            Booked!
          </h1>
          <p className="text-sm text-[#4a6350]">
            Ready around{' '}
            <strong className="text-[#1a2e1c]">
              {when.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>
          </p>
          {done.trackingCode && (
            <div className="rounded-2xl bg-[#eef8ea] border border-[#c8e0c4] p-4">
              <p className="text-xs text-[#5a7a60]">Your code</p>
              <p className="text-2xl font-extrabold tracking-[0.2em] text-[#1a2e1c]" style={displayFont}>
                {done.trackingCode}
              </p>
              <p className="text-xs text-[#5a7a60] mt-1">Save it to track your order</p>
            </div>
          )}
          <p className="text-xs text-[#6b8570] leading-relaxed">
            We&apos;ll try our best near your time. During rush it may take a little longer.
          </p>
          <a
            href={trackHref}
            className="block w-full py-3.5 rounded-2xl bg-[#2d8a4e] text-white font-bold"
          >
            Track order
          </a>
          <button
            type="button"
            className="w-full py-3 rounded-2xl border border-[#c8e0c4] font-semibold text-[#1a2e1c]"
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
    );
  }

  return (
    <div className="min-h-screen bg-[#f7fbf4] pb-28">
      {/* Soft fresh wash */}
      <div
        className="pointer-events-none fixed inset-0 opacity-90"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, #d8f0d0 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 100% 20%, #fff3e0 0%, transparent 45%)',
        }}
      />

      <div className="relative max-w-lg mx-auto px-4 pt-5">
        <header className="mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="relative w-11 h-11 rounded-2xl overflow-hidden bg-white border border-[#d7e8d4] shadow-sm">
                <Image
                  src="/chicken-vicken-logo.png"
                  alt="K2 Chicken"
                  fill
                  className="object-contain p-1"
                  sizes="44px"
                  priority
                />
              </div>
              <div>
                <p className="text-lg font-extrabold text-[#1a2e1c] leading-none" style={displayFont}>
                  K2 Chicken
                </p>
                <p className="text-[11px] text-[#5a7a60] mt-0.5">Fresh · Cut to order</p>
              </div>
            </div>
            <a href="/book/track" className="text-sm font-semibold text-[#2d8a4e] underline-offset-2 hover:underline">
              Track
            </a>
          </div>

          <h1 className="text-[1.75rem] font-extrabold text-[#1a2e1c] leading-tight" style={displayFont}>
            Book in 1 minute
          </h1>
          <p className="text-sm text-[#4a6350] mt-1">
            Tap your cut → pick a time → done. Fresh chicken waiting for you.
          </p>
        </header>

        {loading ? (
          <div className="bg-white rounded-3xl border border-[#d7e8d4] p-10 text-center text-[#5a7a60]">
            Loading menu…
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {stores.length > 1 && (
              <div className="bg-white rounded-2xl border border-[#d7e8d4] p-3">
                <label className="text-xs font-semibold text-[#5a7a60]">Store</label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl border border-[#c8e0c4] bg-[#f7fbf4] text-[#1a2e1c]"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cuts */}
            <section className="bg-white rounded-3xl border border-[#d7e8d4] p-4 shadow-sm">
              <h2 className="font-bold text-[#1a2e1c] mb-1" style={displayFont}>
                What do you need?
              </h2>
              <p className="text-xs text-[#5a7a60] mb-3">Tap to add · tap again for more</p>
              <div className="grid grid-cols-2 gap-2">
                {products.map((p) => {
                  const inBag = lines.find((l) => l.productId === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addOrBumpProduct(p)}
                      className={`text-left rounded-2xl border p-3 transition-all active:scale-[0.97] ${
                        inBag
                          ? 'border-[#2d8a4e] bg-[#eef8ea] ring-1 ring-[#2d8a4e]'
                          : 'border-[#d7e8d4] bg-[#fafdf8] hover:border-[#2d8a4e]/50'
                      }`}
                    >
                      <div className="flex justify-between gap-1">
                        <span className="font-semibold text-sm text-[#1a2e1c] leading-snug">
                          {p.name}
                        </span>
                        {inBag && (
                          <span className="shrink-0 text-[10px] font-bold bg-[#2d8a4e] text-white rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                            {inBag.qty}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5a7a60] mt-1">
                        ₹{Math.round(p.pricePerUnit)}/{p.unitType === 'KG' ? 'kg' : 'pc'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Bag */}
            {lines.length > 0 && (
              <section className="bg-white rounded-3xl border border-[#d7e8d4] p-4 shadow-sm space-y-2">
                <h2 className="font-bold text-[#1a2e1c]" style={displayFont}>
                  Your bag
                </h2>
                {lines.map((l) => (
                  <div
                    key={l.key}
                    className="flex items-center gap-2 rounded-2xl bg-[#eef8ea] border border-[#c8e0c4] p-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-[#1a2e1c] truncate">{l.productName}</p>
                      <p className="text-[11px] text-[#5a7a60]">
                        {l.unitType === 'KG' ? 'kg' : 'pcs'}
                      </p>
                    </div>
                    <div className="flex items-center bg-white rounded-xl border border-[#c8e0c4]">
                      <button
                        type="button"
                        onClick={() => bumpLine(l, -1)}
                        className="w-8 h-8 text-lg font-bold text-[#1a2e1c]"
                        aria-label="Less"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-bold">{l.qty}</span>
                      <button
                        type="button"
                        onClick={() => bumpLine(l, 1)}
                        className="w-8 h-8 text-lg font-bold text-[#1a2e1c]"
                        aria-label="More"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(l.key)}
                      className="text-xs font-semibold text-[#c45c4a] px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {estimated > 0 && (
                  <p className="text-sm text-[#4a6350]">
                    Approx. <strong className="text-[#1a2e1c]">₹{Math.round(estimated)}</strong>
                    <span className="text-[#5a7a60]"> · final at counter</span>
                  </p>
                )}
              </section>
            )}

            {/* Details — compact */}
            <section className="bg-white rounded-3xl border border-[#d7e8d4] p-4 shadow-sm space-y-3">
              <h2 className="font-bold text-[#1a2e1c]" style={displayFont}>
                Almost done
              </h2>

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="col-span-2 sm:col-span-1 px-3 py-3 rounded-xl border border-[#c8e0c4] bg-[#f7fbf4] text-[#1a2e1c] placeholder:text-[#8aa890]"
                  required
                  placeholder="Your name"
                  autoComplete="name"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="col-span-2 sm:col-span-1 px-3 py-3 rounded-xl border border-[#c8e0c4] bg-[#f7fbf4] text-[#1a2e1c] placeholder:text-[#8aa890]"
                  required
                  placeholder="Phone (10 digits)"
                  autoComplete="tel"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-[#5a7a60] mb-1.5">Ready by</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {timePresets.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setReadyAt(t.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        readyAt === t.value
                          ? 'bg-[#2d8a4e] text-white border-[#2d8a4e]'
                          : 'bg-white text-[#4a6350] border-[#c8e0c4]'
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
                  className="w-full px-3 py-2.5 rounded-xl border border-[#c8e0c4] bg-[#f7fbf4] text-[#1a2e1c]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'PICKUP' as const, label: 'Pickup' },
                    { value: 'DELIVERY' as const, label: 'Delivery' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFulfillment(opt.value)}
                    className={`py-2.5 rounded-xl border text-sm font-bold ${
                      fulfillment === opt.value
                        ? 'border-[#2d8a4e] bg-[#eef8ea] text-[#1a2e1c] ring-1 ring-[#2d8a4e]'
                        : 'border-[#d7e8d4] bg-white text-[#4a6350]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#c8e0c4] bg-[#f7fbf4] text-[#1a2e1c] placeholder:text-[#8aa890] text-sm"
                placeholder="Notes? (optional)"
              />

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="hidden sm:flex w-full py-3.5 rounded-2xl bg-[#2d8a4e] hover:bg-[#247a42] text-white font-bold text-lg disabled:opacity-50 items-center justify-center gap-2"
              >
                {submitting ? 'Booking…' : 'Confirm booking'}
                {!submitting && estimated > 0 && (
                  <span className="text-sm opacity-90">· ≈ ₹{Math.round(estimated)}</span>
                )}
              </button>
            </section>

            {/* Sticky mobile CTA */}
            <div className="fixed bottom-0 inset-x-0 z-20 sm:hidden pointer-events-none">
              <div className="mx-auto max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 bg-gradient-to-t from-[#f7fbf4] via-[#f7fbf4]/95 to-transparent pointer-events-auto">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-2xl bg-[#2d8a4e] text-white font-bold shadow-lg shadow-emerald-700/20 disabled:opacity-50 flex items-center justify-between px-5"
                >
                  <span>{submitting ? 'Booking…' : 'Confirm booking'}</span>
                  <span className="text-sm opacity-90">
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
    </div>
  );
}
