'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

interface Row {
  productId: string;
  productName: string;
  unitType: string;
  soldQtyKg: number;
  soldQtyPcs: number;
  ledgerOutKg: number;
  ledgerOutPcs: number;
  deltaKg: number;
  deltaPcs: number;
}

export default function InventoryReconciliationPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [startDate, setStartDate] = useState(
    () => new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'MANAGER' && user.role !== 'OWNER') {
      router.push('/store');
    }
  }, [user, router]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/v1/inventory/reconciliation', {
        params: { startDate, endDate },
      });
      setRows(res.data?.rows || []);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || (user.role !== 'MANAGER' && user.role !== 'OWNER')) return;
    const t = window.setTimeout(load, 300);
    return () => window.clearTimeout(t);
  }, [startDate, endDate, user]);

  if (!user || (user.role !== 'MANAGER' && user.role !== 'OWNER')) {
    return null;
  }

  const flagged = rows.filter(
    (r) =>
      Math.abs(r.deltaKg) > 0.001 || Math.abs(r.deltaPcs) > 0
  );

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-bold dark:text-white">
          Stock reconciliation
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Sale line totals vs inventory ledger (SALE / OUT) in the selected
          range. Large deltas may indicate timing, voids, or sync issues.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Start
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            End
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {flagged.length} product(s) with non-zero delta · {rows.length}{' '}
            total rows
          </p>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-sm dark:text-gray-100">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="text-left p-3 font-semibold">Product</th>
                  <th className="text-left p-3 font-semibold">Unit</th>
                  <th className="text-right p-3 font-semibold">Sold kg</th>
                  <th className="text-right p-3 font-semibold">Ledger kg</th>
                  <th className="text-right p-3 font-semibold">Δ kg</th>
                  <th className="text-right p-3 font-semibold">Sold pcs</th>
                  <th className="text-right p-3 font-semibold">Ledger pcs</th>
                  <th className="text-right p-3 font-semibold">Δ pcs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const warn =
                    Math.abs(r.deltaKg) > 0.001 || Math.abs(r.deltaPcs) > 0;
                  return (
                    <tr
                      key={r.productId}
                      className={
                        warn
                          ? 'bg-amber-50/80 dark:bg-amber-900/10'
                          : 'odd:bg-white even:bg-gray-50/50 dark:odd:bg-gray-800 dark:even:bg-gray-800/80'
                      }
                    >
                      <td className="p-3">{r.productName}</td>
                      <td className="p-3">{r.unitType}</td>
                      <td className="p-3 text-right tabular-nums">
                        {r.soldQtyKg}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {r.ledgerOutKg}
                      </td>
                      <td className="p-3 text-right tabular-nums font-medium">
                        {r.deltaKg}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {r.soldQtyPcs}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {r.ledgerOutPcs}
                      </td>
                      <td className="p-3 text-right tabular-nums font-medium">
                        {r.deltaPcs}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
