'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

function defaultReadyLocal(): string {
  const d = new Date();
  d.setHours(d.getHours() + 2);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

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
  const [pickProductId, setPickProductId] = useState('');

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
      const initial =
        list.find((s) => s.id === fromQuery)?.id || list[0]?.id || '';
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

  const addLine = () => {
    const p = products.find((x) => x.id === pickProductId);
    if (!p) return;
    setLines((prev) => [
      ...prev,
      {
        key: `${p.id}-${Date.now()}`,
        productId: p.id,
        productName: p.name,
        unitType: p.unitType,
        qty: p.unitType === 'KG' ? '1' : '1',
      },
    ]);
    setPickProductId('');
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!storeId) {
      setError('Select a store');
      return;
    }
    if (!name.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Enter name and a valid 10-digit phone');
      return;
    }
    if (lines.length === 0) {
      setError('Add at least one item');
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
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 space-y-3 text-center">
          <h1 className="text-2xl font-bold text-emerald-800">Booked</h1>
          <p className="text-gray-600">
            We got your request for around{' '}
            <strong>
              {when.toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </strong>
            .
          </p>
          <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 text-sm text-left text-orange-950">
            <p className="font-semibold mb-1">Please note</p>
            <p>
              A pre-order does <strong>not</strong> mean instant chicken. We will try our best to
              have it ready near your time, but during shop rush it may take longer.
            </p>
          </div>
          {done.trackingCode && (
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Your tracking code</p>
              <p className="text-2xl font-bold tracking-widest">{done.trackingCode}</p>
              <p className="text-xs text-gray-500 mt-1">Save this + your phone to follow live status</p>
            </div>
          )}
          <a
            href={trackHref}
            className="block w-full py-3 rounded-xl bg-orange-600 text-white font-semibold"
          >
            Track order live
          </a>
          <button
            type="button"
            className="w-full py-3 rounded-xl border font-semibold"
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
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-rose-50 p-4 pb-16">
      <div className="max-w-lg mx-auto">
        <header className="mb-6 pt-4">
          <p className="text-sm font-medium text-orange-700 uppercase tracking-wide">
            K2 Chicken
          </p>
          <h1 className="text-3xl font-bold text-gray-900 mt-1">Book your cut</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Tell us what you need and when. We&apos;ll try our best — during rush it may take longer.
          </p>
          <a href="/book/track" className="inline-block mt-2 text-sm text-orange-800 underline">
            Already booked? Track your order
          </a>
        </header>

        <div className="mb-4 rounded-xl bg-white/90 border border-orange-200 p-3 text-sm text-orange-950">
          Pre-order is a <strong>request</strong>, not an instant guarantee. Final weight and price
          are confirmed at the counter.
        </div>

        {loading ? (
          <div className="bg-white/80 rounded-2xl p-8 text-center text-gray-500">
            Loading…
          </div>
        ) : (
          <form onSubmit={submit} className="bg-white rounded-2xl shadow-md p-5 space-y-4">
            {stores.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-xl"
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 border rounded-xl"
                  required
                  placeholder="Name"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full px-3 py-2.5 border rounded-xl"
                  required
                  placeholder="10-digit mobile"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ready by</label>
              <input
                type="datetime-local"
                value={readyAt}
                onChange={(e) => setReadyAt(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-xl"
                required
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFulfillment('PICKUP')}
                className={`flex-1 py-2 rounded-xl border font-medium ${
                  fulfillment === 'PICKUP' ? 'bg-orange-100 border-orange-400' : ''
                }`}
              >
                Pickup
              </button>
              <button
                type="button"
                onClick={() => setFulfillment('DELIVERY')}
                className={`flex-1 py-2 rounded-xl border font-medium ${
                  fulfillment === 'DELIVERY' ? 'bg-orange-100 border-orange-400' : ''
                }`}
              >
                Delivery
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Add item</label>
              <div className="flex gap-2">
                <select
                  value={pickProductId}
                  onChange={(e) => setPickProductId(e.target.value)}
                  className="flex-1 px-3 py-2.5 border rounded-xl"
                >
                  <option value="">Select cut / product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · ₹{p.pricePerUnit}/{p.unitType === 'KG' ? 'kg' : 'pc'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addLine}
                  disabled={!pickProductId}
                  className="px-4 py-2 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>

            {lines.length > 0 && (
              <ul className="space-y-2">
                {lines.map((l) => (
                  <li
                    key={l.key}
                    className="flex items-center gap-2 p-3 rounded-xl bg-orange-50/80"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{l.productName}</div>
                      <div className="text-xs text-gray-500">
                        {l.unitType === 'KG' ? 'kg' : 'pcs'}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={l.unitType === 'KG' ? 0.1 : 1}
                      step={l.unitType === 'KG' ? 0.1 : 1}
                      value={l.qty}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((x) =>
                            x.key === l.key ? { ...x, qty: e.target.value } : x
                          )
                        )
                      }
                      className="w-20 px-2 py-1.5 border rounded-lg text-center"
                    />
                    <button
                      type="button"
                      onClick={() => removeLine(l.key)}
                      className="text-red-600 text-sm px-2"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {estimated > 0 && (
              <p className="text-sm text-gray-600">
                Approx. ₹{Math.round(estimated).toLocaleString('en-IN')} (final bill at counter)
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 border rounded-xl"
                placeholder="e.g. curry cut, less chili, call on arrival"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg disabled:opacity-50"
            >
              {submitting ? 'Booking…' : 'Confirm booking'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
