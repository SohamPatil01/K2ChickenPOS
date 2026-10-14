'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { isMasaleProduct } from '@azela-pos/shared';
import { getApiBaseUrl } from '@/lib/apiBaseUrl';
import { BRAND } from '@/lib/customerDisplay/brand';
import { resolveBookProductImage } from './productImages';

type StoreOpt = { id: string; name: string };
type CatalogProduct = {
  id: string;
  name: string;
  unitType: 'KG' | 'PCS';
  pricePerUnit: number;
  categoryName: string | null;
  imageUrl?: string | null;
  outOfStock?: boolean;
  stockQtyKg?: number;
  stockQtyPcs?: number;
  availableLabel?: string;
};

type FilterChip =
  | { key: 'All'; kind: 'all'; label: string }
  | { key: string; kind: 'category'; label: string }
  | { key: 'Masale'; kind: 'masale'; label: string };

function productIsMasale(p: CatalogProduct) {
  return isMasaleProduct(p.categoryName, p.name);
}

type LineDraft = {
  key: string;
  productId: string;
  productName: string;
  unitType: 'KG' | 'PCS';
  qty: string;
  imageUrl?: string | null;
};

const WEIGHT_PRESETS = ['0.250', '0.300', '0.500', '0.750', '1', '1.5', '2'];
const HERO_IMG = '/book/hero-chicken.jpg';
const HERO_PHOTO = '/book/hero-photo.jpg';
/** Served under /book so preorder.k2chicken.com always resolves the logo */
const BOOK_LOGO = '/book/logo.png';

function apiUrl(path: string) {
  return `${getApiBaseUrl()}${path}`;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  if (d.getTime() <= Date.now() + 30 * 60 * 1000) d.setDate(d.getDate() + 1);
  return toLocalInput(d);
}

function money(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function productImg(p: {
  imageUrl?: string | null;
  name?: string;
  categoryName?: string | null;
}) {
  return resolveBookProductImage({
    name: p.name || '',
    categoryName: p.categoryName,
    imageUrl: p.imageUrl,
  });
}

export default function BookPreOrderPage() {
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [storeId, setStoreId] = useState('');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [done, setDone] = useState<{
    readyAt: string;
    trackingCode: string;
    phone: string;
    name: string;
  } | null>(null);

  const [search, setSearch] = useState('');
  const [filterKey, setFilterKey] = useState('All');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [readyAt, setReadyAt] = useState(() => readyInHours(2));
  const [slot, setSlot] = useState('1 hr');
  const [notes, setNotes] = useState('');
  const [prep, setPrep] = useState('');
  const [fulfillment, setFulfillment] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [address, setAddress] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([]);

  const bookingRef = useRef<HTMLElement>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }, []);

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError('');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(apiUrl('/api/v1/public/pre-orders/stores'), {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load stores');
      const list: StoreOpt[] = data.stores || [];
      if (!list.length) throw new Error('No stores available for booking right now');
      setStores(list);
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('store') || params.get('storeId') || '';
      setStoreId(list.find((s) => s.id === fromQuery)?.id || list[0]?.id || '');
    } catch (e: any) {
      const msg =
        e?.name === 'AbortError'
          ? 'Menu took too long to load. Please try again.'
          : e.message || 'Could not load booking form';
      setError(msg);
      setStores([]);
      setStoreId('');
    } finally {
      clearTimeout(timer);
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

  useEffect(() => {
    if (!storeId) return;
    const t = setInterval(() => loadCatalog(storeId), 45000);
    return () => clearInterval(t);
  }, [storeId, loadCatalog]);

  useEffect(() => {
    if (!products.length) return;
    setLines((prev) =>
      prev.filter((l) => {
        const p = products.find((x) => x.id === l.productId);
        return p && !p.outOfStock;
      })
    );
  }, [products]);

  const filterChips = useMemo((): FilterChip[] => {
    const cutCats = new Set<string>();
    let hasMasale = false;
    for (const p of products) {
      if (productIsMasale(p)) {
        hasMasale = true;
        continue;
      }
      if (p.categoryName) cutCats.add(p.categoryName);
    }
    // Default "All Cuts" = chicken only; masale only via its own chip
    const chips: FilterChip[] = [{ key: 'All', kind: 'all', label: 'All Cuts' }];
    for (const name of Array.from(cutCats).sort()) {
      chips.push({ key: `cat:${name}`, kind: 'category', label: name });
    }
    if (hasMasale) chips.push({ key: 'Masale', kind: 'masale', label: 'Masale' });
    return chips;
  }, [products]);

  const activeFilter = useMemo(
    () => filterChips.find((c) => c.key === filterKey) || filterChips[0],
    [filterChips, filterKey]
  );

  useEffect(() => {
    if (!filterChips.some((c) => c.key === filterKey)) setFilterKey('All');
  }, [filterChips, filterKey]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      let filterOk = true;
      if (activeFilter?.kind === 'all' || !activeFilter) {
        // Landing view: chicken cuts only — hide masale until that filter is tapped
        filterOk = !productIsMasale(p);
      } else if (activeFilter.kind === 'category') {
        filterOk = !productIsMasale(p) && p.categoryName === activeFilter.label;
      } else if (activeFilter.kind === 'masale') {
        filterOk = productIsMasale(p);
      }
      const searchOk = !q || p.name.toLowerCase().includes(q);
      return filterOk && searchOk;
    });
  }, [products, activeFilter, search]);

  const maxAvailable = (p: CatalogProduct) =>
    p.unitType === 'KG' ? Number(p.stockQtyKg) || 0 : Number(p.stockQtyPcs) || 0;

  const lineQty = (productId: string) =>
    lines.find((l) => l.productId === productId)?.qty || '';

  const addOrBump = (p: CatalogProduct, delta = 0.05) => {
    if (p.outOfStock) {
      notify(`${p.name} is out of stock`);
      return;
    }
    const avail = maxAvailable(p);
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        const step = p.unitType === 'KG' ? delta : 1;
        let next =
          p.unitType === 'KG'
            ? Math.round((Number(existing.qty) + step) * 1000) / 1000
            : Number(existing.qty) + 1;
        if (avail > 0) next = Math.min(next, avail);
        notify(`${p.name} updated`);
        return prev.map((l) =>
          l.productId === p.id ? { ...l, qty: String(next) } : l
        );
      }
      let qty = p.unitType === 'KG' ? '0.500' : '1';
      if (p.unitType === 'KG' && avail > 0) qty = String(Math.min(0.5, avail));
      if (p.unitType === 'PCS' && avail > 0) qty = String(Math.min(1, avail));
      notify(`${p.name} added to your booking`);
      return [
        ...prev,
        {
          key: `${p.id}-${Date.now()}`,
          productId: p.id,
          productName: p.name,
          unitType: p.unitType,
          qty,
          imageUrl: p.imageUrl,
        },
      ];
    });
  };

  const setLineQty = (key: string, qty: string) => {
    const cleaned = qty.replace(/[^\d.]/g, '');
    const parts = cleaned.split('.');
    const normalized =
      parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join('').slice(0, 3)}`;
    setLines((prev) => prev.map((x) => (x.key === key ? { ...x, qty: normalized } : x)));
  };

  const bumpLine = (line: LineDraft, dir: 1 | -1) => {
    const step = line.unitType === 'KG' ? 0.05 : 1;
    const min = line.unitType === 'KG' ? 0.05 : 1;
    const product = products.find((p) => p.id === line.productId);
    const avail = product ? maxAvailable(product) : 0;
    let next = Math.max(min, Math.round((Number(line.qty) + dir * step) * 1000) / 1000);
    if (dir > 0 && avail > 0) next = Math.min(next, avail);
    if (dir < 0 && next < min) {
      setLines((prev) => prev.filter((x) => x.key !== line.key));
      return;
    }
    setLines((prev) =>
      prev.map((x) =>
        x.key === line.key
          ? {
              ...x,
              qty:
                line.unitType === 'KG'
                  ? next.toFixed(3).replace(/\.?0+$/, '') || String(next)
                  : String(next),
            }
          : x
      )
    );
  };

  const removeLine = (key: string) => setLines((prev) => prev.filter((l) => l.key !== key));

  const clearCart = () => {
    setLines([]);
    notify('Your selection has been cleared');
  };

  const estimated = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const p = products.find((x) => x.id === l.productId);
        return sum + (p ? p.pricePerUnit * (Number(l.qty) || 0) : 0);
      }, 0),
    [lines, products]
  );

  const itemCountLabel = lines.length
    ? `${lines.length} item${lines.length === 1 ? '' : 's'}`
    : '0 items';

  const applySlot = (label: string) => {
    setSlot(label);
    if (label === '1 hr') setReadyAt(readyInHours(1));
    else if (label === '2 hrs') setReadyAt(readyInHours(2));
    else if (label === '4 hrs') setReadyAt(readyInHours(4));
    else if (label === '7 PM+') setReadyAt(tonightAt(19));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!storeId) return setError('Select a store');
    if (!lines.length) {
      notify('Please select at least one cut first.');
      document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (!name.trim() || phone.replace(/\D/g, '').length < 10) {
      return setError('Enter your name and a valid 10-digit phone');
    }
    if (fulfillment === 'DELIVERY' && !address.trim()) {
      return setError('Please enter a delivery address');
    }
    const bad = lines.find((l) => !(Number(l.qty) > 0));
    if (bad) return setError('Enter a valid weight/quantity for each item');

    setSubmitting(true);
    try {
      const noteParts = [
        prep ? `Prep: ${prep}` : '',
        fulfillment === 'DELIVERY' && address.trim() ? `Address: ${address.trim()}` : '',
        notes.trim(),
      ].filter(Boolean);

      const items = lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        unitType: l.unitType,
        qtyKg: l.unitType === 'KG' ? Math.round(Number(l.qty) * 1000) / 1000 : null,
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
          notes: noteParts.join(' · ') || null,
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
        name: name.trim(),
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Booking failed');
      notify(err.message || 'Booking failed');
    } finally {
      setSubmitting(false);
    }
  };

  const trackHref = done
    ? `/book/track?phone=${encodeURIComponent(done.phone)}&code=${encodeURIComponent(done.trackingCode)}`
    : '/book/track';

  return (
    <>
      <header className="k2-topbar">
        <a className="k2-brand" href="/book" aria-label="K2 Chicken pre-order">
          <span className="k2-brand-mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BOOK_LOGO} alt={`${BRAND.name} logo`} />
          </span>
          <span>
            <span className="k2-brand-name">{BRAND.name}</span>
            <span className="k2-brand-tag">Fresh cuts, ready when you are</span>
          </span>
        </a>
        <div className="k2-top-right">
          <div className="k2-open">
            <span className="k2-dot" />
            <span>Store open · Pre-orders welcome</span>
          </div>
          <Link className="k2-link-quiet" href="/book/track">
            Track order
          </Link>
          <a className="k2-call" href={`tel:+91${BRAND.phone}`}>
            ☎ &nbsp; {BRAND.phoneDisplay}
          </a>
        </div>
      </header>

      <main className="k2-page">
        <section className="k2-hero" aria-label="Premium fresh chicken">
          <div className="k2-hero-copy">
            <div className="k2-eyebrow">
              Premium fresh chicken <span className="k2-eyebrow-line" aria-hidden />
            </div>
            <h1>
              Book your cut
              <br />
              in minutes.
            </h1>
            <p>Choose your favourite cuts. Pick a time. We&apos;ll have your order ready.</p>
            <div className="k2-benefits">
              <div className="k2-benefit">
                <i className="k2-ico k2-ico-leaf" aria-hidden />
                <span>Hygienic &amp; fresh everyday</span>
              </div>
              <div className="k2-benefit">
                <i className="k2-ico k2-ico-seal" aria-hidden />
                <span>Trusted quality</span>
              </div>
              <div className="k2-benefit">
                <i className="k2-ico k2-ico-truck" aria-hidden />
                <span>Clean handling and packaging</span>
              </div>
              <div className="k2-benefit">
                <i className="k2-ico k2-ico-cal" aria-hidden />
                <span>Choose your pickup time</span>
              </div>
            </div>
          </div>
          <div className="k2-hero-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={HERO_PHOTO}
              alt="Fresh chicken cuts ready to book — breasts, drumsticks, and diced pieces"
            />
          </div>
        </section>

        {loading ? (
          <div className="k2-panel" style={{ padding: 40, textAlign: 'center', color: '#73747a' }}>
            Loading fresh menu…
          </div>
        ) : error && !products.length ? (
          <div className="k2-panel" style={{ padding: 40, textAlign: 'center' }}>
            <p className="k2-error" style={{ display: 'inline-block', marginBottom: 14 }}>
              {error}
            </p>
            <div>
              <button type="button" className="k2-submit" style={{ maxWidth: 220, margin: '0 auto' }} onClick={loadStores}>
                Retry loading menu
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="k2-layout">
              <section className="k2-panel k2-catalogue" id="products">
                <div className="k2-section-head">
                  <div className="k2-head-left">
                    <span className="k2-step">01</span>
                    <div>
                      <h2>Choose your cuts</h2>
                      <p>Select your favourites and adjust quantities below.</p>
                    </div>
                  </div>
                  <span className="k2-counter">
                    {visibleProducts.length} {visibleProducts.length === 1 ? 'cut' : 'cuts'}
                  </span>
                </div>

                {stores.length > 1 && (
                  <select
                    className="k2-field"
                    style={{ width: '100%', marginBottom: 12 }}
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                )}

                <label className="k2-search">
                  <span>⌕</span>
                  <input
                    type="search"
                    placeholder="Search a cut (e.g. breast, liver, kheema…)"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search chicken cuts"
                  />
                </label>

                <div className="k2-categories" role="tablist" aria-label="Product filters">
                  {filterChips.map((c, i) => {
                    const prev = filterChips[i - 1];
                    const showMasaleBreak = c.kind === 'masale' && prev && prev.kind !== 'masale';
                    return (
                      <span key={c.key} className="k2-cat-wrap">
                        {showMasaleBreak ? <span className="k2-cat-break" aria-hidden /> : null}
                        <button
                          type="button"
                          role="tab"
                          aria-selected={filterKey === c.key}
                          className={`k2-cat${filterKey === c.key ? ' active' : ''}${
                            c.kind === 'masale' ? ' masale' : ''
                          }`}
                          onClick={() => setFilterKey(c.key)}
                        >
                          {c.label}
                        </button>
                      </span>
                    );
                  })}
                </div>

                <div className="k2-products" aria-live="polite">
                  {visibleProducts.length === 0 ? (
                    <div className="k2-empty" style={{ gridColumn: '1 / -1' }}>
                      No matching cuts. Try another search.
                    </div>
                  ) : (
                    visibleProducts.map((p, i) => {
                      const q = lineQty(p.id);
                      const selected = Boolean(q);
                      const oos = Boolean(p.outOfStock);
                      const img = productImg(p);
                      const masale = productIsMasale(p);
                      return (
                        <article
                          key={p.id}
                          className={`k2-product${selected ? ' selected' : ''}${oos ? ' oos' : ''}`}
                          style={{ animationDelay: `${i * 35}ms` }}
                        >
                          <div className={`k2-photo${masale || !img ? ' placeholder' : ''}`}>
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={img}
                                alt={p.name}
                                loading="lazy"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = HERO_IMG;
                                }}
                              />
                            ) : (
                              <div className="k2-photo-fallback" aria-hidden>
                                {masale ? '✦' : '♧'}
                              </div>
                            )}
                            {oos ? (
                              <span className="k2-tag oos-tag">Out of stock</span>
                            ) : masale ? (
                              <span className="k2-tag masale-tag">Masale</span>
                            ) : (
                              <span className="k2-tag">★ Fresh</span>
                            )}
                          </div>
                          <div className="k2-product-info">
                            <h3>{p.name}</h3>
                            <div className="k2-desc">
                              {p.availableLabel || (p.unitType === 'KG' ? 'Sold by kg' : 'Sold by piece')}
                              {p.categoryName ? `  ·  ${p.categoryName}` : ''}
                            </div>
                            <div className="k2-product-bottom">
                              <div className="k2-price">
                                {money(p.pricePerUnit)}{' '}
                                <span className="k2-unit">
                                  / {p.unitType === 'KG' ? 'kg' : 'pc'}
                                </span>
                              </div>
                              {oos ? null : selected ? (
                                <div className="k2-qty">
                                  <button
                                    type="button"
                                    aria-label={`Less ${p.name}`}
                                    onClick={() => {
                                      const line = lines.find((l) => l.productId === p.id);
                                      if (line) bumpLine(line, -1);
                                    }}
                                  >
                                    −
                                  </button>
                                  <strong>{q}</strong>
                                  <button
                                    type="button"
                                    aria-label={`More ${p.name}`}
                                    onClick={() => addOrBump(p)}
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="k2-add"
                                  aria-label={`Add ${p.name}`}
                                  onClick={() => addOrBump(p)}
                                >
                                  +
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>

              <aside className="k2-panel k2-booking" id="booking" ref={bookingRef}>
                <div className="k2-booking-head">
                  <div className="k2-head-left">
                    <span className="k2-step">02</span>
                    <div>
                      <h2>Your booking</h2>
                      <p>Review your items and provide your details.</p>
                    </div>
                  </div>
                  <button className="k2-clear" type="button" onClick={clearCart}>
                    Clear all
                  </button>
                </div>

                <div className="k2-selected-label">
                  <span>
                    Selected items (<span>{lines.length}</span>)
                  </span>
                  <span className="k2-items-count">{itemCountLabel}</span>
                </div>

                <div className="k2-cart-list">
                  {lines.length === 0 ? (
                    <div className="k2-empty">
                      <div className="k2-empty-icon">＋</div>
                      Your order starts here.
                      <br />
                      Add your favourite cuts to get started.
                    </div>
                  ) : (
                    lines.map((l) => {
                      const p = products.find((x) => x.id === l.productId);
                      const lineTotal = (p?.pricePerUnit || 0) * (Number(l.qty) || 0);
                      const cartImg = productImg({
                        name: l.productName,
                        categoryName: p?.categoryName,
                        imageUrl: l.imageUrl || p?.imageUrl,
                      });
                      const masale = productIsMasale({
                        name: l.productName,
                        categoryName: p?.categoryName,
                      } as CatalogProduct);
                      return (
                        <div key={l.key} className="k2-cart-row">
                          {cartImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={cartImg} alt="" loading="lazy" />
                          ) : (
                            <div className="k2-cart-thumb" aria-hidden>
                              {masale ? '✦' : '♧'}
                            </div>
                          )}
                          <div>
                            <div className="k2-cart-name">{l.productName}</div>
                            <div className="k2-cart-sub">
                              {l.unitType === 'KG'
                                ? `${l.qty} kg (${Math.round(Number(l.qty) * 1000) || 0} g)`
                                : `${l.qty} pcs`}
                            </div>
                            <div className="k2-cart-controls">
                              <button type="button" onClick={() => bumpLine(l, -1)} aria-label="Less">
                                −
                              </button>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={l.qty}
                                onChange={(e) => setLineQty(l.key, e.target.value)}
                                aria-label="Quantity"
                              />
                              <button type="button" onClick={() => bumpLine(l, 1)} aria-label="More">
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => removeLine(l.key)}
                                style={{ width: 'auto', padding: '0 6px', borderRadius: 6 }}
                              >
                                ✕
                              </button>
                            </div>
                            {l.unitType === 'KG' && (
                              <div className="k2-weight-chips">
                                {WEIGHT_PRESETS.filter((w) => {
                                  const avail = p ? maxAvailable(p) : 0;
                                  return avail <= 0 || Number(w) <= avail + 0.001;
                                }).map((w) => (
                                  <button
                                    key={w}
                                    type="button"
                                    className={Number(l.qty) === Number(w) ? 'active' : ''}
                                    onClick={() => setLineQty(l.key, w)}
                                  >
                                    {w} kg
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="k2-cart-total">{money(lineTotal)}</div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="k2-subtotal">
                  <span>Estimated subtotal</span>
                  <strong>{money(estimated)}</strong>
                </div>
                <div className="k2-fine">
                  Final amount may vary if products are sold by actual weight. The store will confirm
                  your order.
                </div>

                <div className="k2-rule" />

                <h3 className="k2-form-title">◉ &nbsp; Your details</h3>
                <div className="k2-fields">
                  <input
                    className="k2-field"
                    placeholder="Full name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <input
                    className="k2-field"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="10 digit mobile number"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  />
                </div>

                <label className="k2-field-label">◷ &nbsp; Preferred time slot</label>
                <div className="k2-slots">
                  {['1 hr', '2 hrs', '4 hrs', '7 PM+'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`k2-slot${slot === s ? ' active' : ''}`}
                      onClick={() => applySlot(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <label className="k2-field-label" htmlFor="k2-date">
                  Preferred date and time
                </label>
                <input
                  id="k2-date"
                  className="k2-field"
                  style={{ width: '100%' }}
                  type="datetime-local"
                  required
                  value={readyAt}
                  onChange={(e) => setReadyAt(e.target.value)}
                />

                <label className="k2-field-label">♧ &nbsp; Pickup or delivery</label>
                <div className="k2-fulfil">
                  <button
                    type="button"
                    className={fulfillment === 'PICKUP' ? 'active' : ''}
                    onClick={() => setFulfillment('PICKUP')}
                  >
                    <span>▣</span> Pickup from store
                  </button>
                  <button
                    type="button"
                    className={fulfillment === 'DELIVERY' ? 'active' : ''}
                    onClick={() => setFulfillment('DELIVERY')}
                  >
                    <span>♧</span> Home delivery
                  </button>
                </div>

                {fulfillment === 'DELIVERY' && (
                  <input
                    className="k2-field"
                    style={{ width: '100%', marginTop: 7 }}
                    placeholder="Delivery address and landmark"
                    autoComplete="street-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                )}

                <label className="k2-field-label" htmlFor="k2-prep">
                  Preparation preference{' '}
                  <span style={{ fontWeight: 500, color: 'var(--muted)' }}>(optional)</span>
                </label>
                <select
                  id="k2-prep"
                  className="k2-field"
                  style={{ width: '100%' }}
                  value={prep}
                  onChange={(e) => setPrep(e.target.value)}
                >
                  <option value="">Select if needed</option>
                  <option>Regular curry cut</option>
                  <option>Small curry cut</option>
                  <option>Large curry cut</option>
                  <option>Boneless preparation</option>
                  <option>Minced / kheema</option>
                  <option>Please call me to confirm</option>
                </select>

                <label className="k2-field-label" htmlFor="k2-notes">
                  Additional notes{' '}
                  <span style={{ fontWeight: 500, color: 'var(--muted)' }}>(optional)</span>
                </label>
                <textarea
                  id="k2-notes"
                  className="k2-field"
                  style={{ width: '100%' }}
                  placeholder="Any special instructions?"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />

                {error && <div className="k2-error">{error}</div>}

                <button className="k2-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Booking…' : 'Confirm booking'} <span aria-hidden="true">→</span>
                </button>
                <div className="k2-reassurance">
                  <span style={{ color: 'var(--red)' }}>◆</span>
                  <span>
                    <b>No payment required now.</b>
                    <br />
                    We&apos;ll confirm your order shortly.
                  </span>
                </div>
              </aside>
            </div>
          </form>
        )}

        <section className="k2-trust-strip">
          <div className="k2-trust">
            <span className="k2-trust-icon">♧</span>
            <div>
              <strong>Freshly prepared</strong>
              <small>Cut and cleaned as per your choice</small>
            </div>
          </div>
          <div className="k2-trust">
            <span className="k2-trust-icon">◷</span>
            <div>
              <strong>Choose your time</strong>
              <small>Pickup or delivery at your convenience</small>
            </div>
          </div>
          <div className="k2-trust">
            <span className="k2-trust-icon">✓</span>
            <div>
              <strong>Quick confirmation</strong>
              <small>Track live with your code</small>
            </div>
          </div>
        </section>

        <p
          style={{
            textAlign: 'center',
            fontSize: 13,
            color: '#8a7a76',
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          {BRAND.address}
          <br />
          Open 8:00 AM – 8:00 PM · {BRAND.phoneDisplay}
        </p>
      </main>

      <div className="k2-mobile-bar">
        <div className="k2-mobile-summary">
          <strong>
            {itemCountLabel} · {money(estimated)}
          </strong>
          <span>
            {lines.length ? 'Tap to review your order' : 'Choose your cuts to get started'}
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        >
          Review booking ↓
        </button>
      </div>

      <div className={`k2-toast${toast ? ' show' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>

      <div className={`k2-modal${done ? ' show' : ''}`} role="dialog" aria-modal="true">
        <div className="k2-modal-card">
          <div className="k2-check">✓</div>
          <h2>Booking confirmed!</h2>
          <p>
            Thanks{done?.name ? `, ${done.name}` : ''}! We&apos;ll try our best near{' '}
            {done
              ? new Date(done.readyAt).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'your time'}
            . Save your tracking code for live updates.
          </p>
          {done?.trackingCode && (
            <div className="k2-code-box">
              <span>Your tracking code</span>
              <strong>{done.trackingCode}</strong>
            </div>
          )}
          <div className="k2-modal-actions">
            <a href={trackHref}>Track order live →</a>
            <button
              type="button"
              onClick={() => {
                setDone(null);
                setLines([]);
                setNotes('');
                setPrep('');
                setAddress('');
              }}
            >
              Book another
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
