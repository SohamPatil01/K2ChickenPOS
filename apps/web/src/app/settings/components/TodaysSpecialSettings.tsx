'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Button, Card } from '@/components/ui';

type ProductRow = { id: string; name: string; isActive?: boolean };
type StoreConfig = {
  storeId: string;
  appOrderingEnabled: boolean;
  deliveryEnabled: boolean;
  serviceablePincodes: string[];
  deliveryFeePaise: number;
  freeDeliveryAbovePaise: number | null;
  minOrderPaise: number;
  slotMinutes: number;
  leadTimeMinutes: number;
  maxDaysAhead: number;
  hours: Record<string, [number, number] | null>;
  cutOptions: { id: string; label: string }[];
  customerCancelWindow: 'PENDING_ONLY' | 'NONE';
  supportPhone: string | null;
  todaysSpecialProductId: string | null;
};

export default function TodaysSpecialSettings() {
  const { user } = useAuthStore();
  const storeId = user?.storeId;
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [selected, setSelected] = useState<string>(''); // '' = Auto (daily random)
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [prodRes, cfgRes] = await Promise.all([
          api.get('/api/v1/products'),
          api.get(`/api/v1/mobile/admin/store-config/${storeId}`),
        ]);
        if (cancelled) return;
        const list: ProductRow[] = Array.isArray(prodRes.data)
          ? prodRes.data
          : Array.isArray(prodRes.data?.products)
            ? prodRes.data.products
            : [];
        setProducts(list.filter((p) => p.isActive !== false).sort((a, b) => a.name.localeCompare(b.name)));
        const cfg = cfgRes.data as StoreConfig;
        setConfig(cfg);
        setSelected(cfg.todaysSpecialProductId ?? '');
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const selectedName = useMemo(
    () => products.find((p) => p.id === selected)?.name ?? null,
    [products, selected]
  );

  const onSave = async () => {
    if (!storeId || !config) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload: StoreConfig = {
        ...config,
        todaysSpecialProductId: selected || null,
      };
      const res = await api.put(`/api/v1/mobile/admin/store-config/${storeId}`, payload);
      setConfig(res.data as StoreConfig);
      setSelected((res.data as StoreConfig).todaysSpecialProductId ?? '');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!storeId) return null;

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">Today&apos;s Special (Customer App)</h2>
        <p className="text-sm text-ink-muted mt-1">
          Choose which product appears on Home under Today&apos;s Specials. Leave on Auto for a random
          in-stock pick that stays the same for the whole day (IST).
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <>
          <label className="block text-sm font-medium text-ink">
            Featured product
            <select
              className="mt-1.5 w-full max-w-md rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Auto — daily random</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <p className="text-xs text-ink-muted">
            {selected
              ? `Pinned: ${selectedName ?? selected}. Shown whenever this product is in stock.`
              : 'Auto mode: server picks one in-stock product per day for this store.'}
          </p>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {saved ? <p className="text-sm text-green-700">Saved — customer app will update within ~30s.</p> : null}

          <Button type="button" onClick={() => void onSave()} disabled={saving || !config}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      )}
    </Card>
  );
}
