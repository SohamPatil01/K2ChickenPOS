'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface StoreRollupRow {
  storeId: string;
  storeName: string;
  netSales: number;
  orderCount: number;
  netProfit: number;
}

interface HqOverviewResponse {
  overview?: {
    netSales?: number;
    orderCount?: number;
    netProfit?: number;
  };
  byStore?: StoreRollupRow[];
}

const HQ_ROLLUP_REPORTS = [
  { id: 'overview', label: 'Business Summary', description: 'Franchise KPI rollup' },
  { id: 'financial', label: 'Financial Summary', description: 'Revenue and profit by store' },
  { id: 'inventory', label: 'Inventory Overview', description: 'Stock and wastage rollup' },
  { id: 'sales', label: 'Sales Monitoring', description: 'See Sales tab for live monitoring' },
] as const;

export default function HQBusinessReportsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [overview, setOverview] = useState<HqOverviewResponse | null>(null);

  useEffect(() => {
    if (user && user.role !== 'OWNER') router.push('/dashboard');
  }, [user, router]);

  useEffect(() => {
    api
      .get('/api/v1/hq/reporting/overview?preset=last30')
      .then((r) => setOverview(r.data))
      .catch(() => setOverview(null));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Business Reports</h1>
      <p className="text-sm text-gray-500 mb-6">Franchise rollup across all stores</p>

      {overview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Net Sales', value: overview.overview?.netSales },
              { label: 'Orders', value: overview.overview?.orderCount },
              { label: 'Net Profit', value: overview.overview?.netProfit },
              { label: 'Stores', value: overview.byStore?.length },
            ].map((k) => (
              <div key={k.label} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className="text-xl font-semibold mt-1">
                  {typeof k.value === 'number' ? k.value.toLocaleString('en-IN') : k.value ?? '—'}
                </p>
              </div>
            ))}
          </div>

          {overview.byStore && overview.byStore.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left p-3">Store</th>
                    <th className="text-right p-3">Net Sales</th>
                    <th className="text-right p-3">Orders</th>
                    <th className="text-right p-3">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.byStore.map((s) => (
                    <tr key={s.storeId} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="p-3">{s.storeName}</td>
                      <td className="p-3 text-right">₹{s.netSales?.toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right">{s.orderCount}</td>
                      <td className="p-3 text-right">₹{s.netProfit?.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <h2 className="text-lg font-semibold mb-3">Report catalog</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {HQ_ROLLUP_REPORTS.map((r) => (
          <div key={r.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <p className="font-medium">{r.label}</p>
            <p className="text-xs text-gray-500 mt-1">{r.description}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500 mt-4">
        Open store console for detailed reports:{' '}
        <Link href="/dashboard" className="text-blue-600">Store POS</Link>
      </p>
    </div>
  );
}
