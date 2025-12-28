'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Card } from '@/components/ui';

export default function EnhancedAnalyticsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [storeComparison, setStoreComparison] = useState<any>(null);
  const [yieldLeaderboard, setYieldLeaderboard] = useState<any[]>([]);
  const [wastageHeatmap, setWastageHeatmap] = useState<any[]>([]);
  const [discountAbuse, setDiscountAbuse] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [activeTab, setActiveTab] = useState<'comparison' | 'yield' | 'wastage' | 'discount'>('comparison');

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    loadData();
  }, [user, router, dateRange, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'comparison') {
        const res = await api.get('/api/v1/hq/analytics/store-comparison', { params: dateRange });
        setStoreComparison(res.data);
      } else if (activeTab === 'yield') {
        const res = await api.get('/api/v1/hq/analytics/yield-leaderboard', { params: dateRange });
        setYieldLeaderboard(res.data);
      } else if (activeTab === 'wastage') {
        const res = await api.get('/api/v1/hq/analytics/wastage-heatmap', { params: dateRange });
        setWastageHeatmap(res.data);
      } else if (activeTab === 'discount') {
        const res = await api.get('/api/v1/hq/analytics/discount-abuse', { params: dateRange });
        setDiscountAbuse(res.data);
      }
    } catch (error: any) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500';
      case 'HIGH':
        return 'bg-orange-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      default:
        return 'bg-green-500';
    }
  };

  if (loading) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading analytics...</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold dark:text-white">Analytics & Benchmarking</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Compare stores, track efficiency, and detect issues</p>
        </div>

        {/* Date Range */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'comparison', label: 'Store Comparison', icon: '📊' },
              { id: 'yield', label: 'Yield Leaderboard', icon: '🏆' },
              { id: 'wastage', label: 'Wastage Heatmap', icon: '🔥' },
              { id: 'discount', label: 'Discount Abuse', icon: '⚠️' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Store Comparison Tab */}
        {activeTab === 'comparison' && storeComparison && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-4 dark:text-white">Store Performance</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Franchise</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sales</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Bill</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Yield %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Wastage %</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Discount %</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {storeComparison.storeComparison.map((store: any) => (
                      <tr key={store.franchiseId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{store.franchiseName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">₹{store.revenue.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{store.salesCount}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">₹{store.avgBillValue.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{store.yieldEfficiency.toFixed(2)}%</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{store.wastagePercent.toFixed(2)}%</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={store.discountAbuse ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-gray-900 dark:text-white'}>
                            {store.discountPercent.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {storeComparison.regionComparison && storeComparison.regionComparison.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4 dark:text-white">Region Comparison</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {storeComparison.regionComparison.map((region: any) => (
                    <Card key={region.region}>
                      <h3 className="font-semibold dark:text-white mb-2">{region.region}</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Total Revenue:</span>
                          <span className="font-semibold dark:text-white">₹{region.totalRevenue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Avg Yield:</span>
                          <span className="font-semibold dark:text-white">{region.avgYieldEfficiency.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Avg Wastage:</span>
                          <span className="font-semibold dark:text-white">{region.avgWastagePercent.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Stores:</span>
                          <span className="font-semibold dark:text-white">{region.stores.length}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Yield Leaderboard Tab */}
        {activeTab === 'yield' && (
          <div>
            <h2 className="text-xl font-bold mb-4 dark:text-white">Yield Efficiency Leaderboard</h2>
            <div className="space-y-4">
              {yieldLeaderboard.map((store, index) => (
                <Card key={store.franchiseId}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-3xl font-bold text-brand-500">#{index + 1}</span>
                      <div>
                        <h3 className="font-semibold dark:text-white">{store.franchiseName}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Sold: {store.soldWeightKg.toFixed(2)} kg | Received: {store.receivedWeightKg.toFixed(2)} kg
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold dark:text-white">{store.yieldEfficiency.toFixed(2)}%</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Yield Efficiency</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Wastage Heatmap Tab */}
        {activeTab === 'wastage' && (
          <div>
            <h2 className="text-xl font-bold mb-4 dark:text-white">Wastage Heatmap</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wastageHeatmap.map((store) => (
                <Card key={store.franchiseId}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold dark:text-white">{store.franchiseName}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      store.severity === 'CRITICAL' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                      store.severity === 'HIGH' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400' :
                      store.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                      'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    }`}>
                      {store.severity}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Wastage:</span>
                      <span className="font-semibold dark:text-white">{store.wastagePercent.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Allowed:</span>
                      <span className="text-gray-500 dark:text-gray-400">{store.allowedWastagePercent}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Wastage (kg):</span>
                      <span className="text-gray-500 dark:text-gray-400">{store.wastageKg.toFixed(2)}</span>
                    </div>
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getSeverityColor(store.severity)}`}
                          style={{ width: `${Math.min(store.wastagePercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Discount Abuse Tab */}
        {activeTab === 'discount' && (
          <div>
            <h2 className="text-xl font-bold mb-4 dark:text-white">Discount Abuse Detection</h2>
            {discountAbuse.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No discount abuse detected</p>
              </div>
            ) : (
              <div className="space-y-4">
                {discountAbuse.map((store) => (
                  <Card key={store.franchiseId}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold dark:text-white">{store.franchiseName}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Discount: {store.discountPercent.toFixed(2)}% | Allowed: {store.allowedDiscountPercent}%
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400 font-semibold mt-1">
                          Excess: {store.excessDiscount.toFixed(2)}%
                        </p>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                        ABUSING
                      </span>
                    </div>
                    {store.highDiscountSales && store.highDiscountSales.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-semibold dark:text-white mb-2">High Discount Sales:</p>
                        <div className="space-y-1">
                          {store.highDiscountSales.slice(0, 5).map((sale: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm bg-gray-50 dark:bg-gray-700/50 p-2 rounded">
                              <span className="dark:text-white">Sale #{sale.saleNo}</span>
                              <span className="text-red-600 dark:text-red-400">
                                {sale.discountPercent.toFixed(2)}% (₹{sale.discountAmount.toFixed(2)})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </HQLayout>
  );
}

