'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

export default function AnalyticsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    loadAnalyticsData();
  }, [user, router, dateRange]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const [dashboard, topItems] = await Promise.all([
        api.get('/api/v1/hq/dashboard', { params: dateRange }),
        api.get('/api/v1/analytics/top-items', { params: dateRange }),
      ]);
      setAnalyticsData({
        dashboard: dashboard.data,
        topItems: topItems.data || [],
      });
    } catch (error: any) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading analytics...</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Advanced Analytics</h1>
          <p className="text-sm text-gray-500">Comprehensive analytics and franchise comparison</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold">₹{analyticsData?.dashboard?.summary?.totalRevenue.toFixed(2) || '0.00'}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Sales</p>
            <p className="text-2xl font-bold">{analyticsData?.dashboard?.summary?.totalSales || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Customers</p>
            <p className="text-2xl font-bold">{analyticsData?.dashboard?.summary?.totalCustomers || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Avg per Franchise</p>
            <p className="text-2xl font-bold">₹{analyticsData?.dashboard?.summary?.avgRevenuePerFranchise.toFixed(2) || '0.00'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Top Products Across All Franchises</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analyticsData?.topItems?.slice(0, 10).map((item: any) => (
                    <tr key={item.productId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {item.qtyKg > 0 ? `${item.qtyKg.toFixed(2)} kg` : `${item.qtyPcs} pcs`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">₹{item.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(!analyticsData?.topItems || analyticsData.topItems.length === 0) && (
              <p className="text-gray-500 text-center py-4">No analytics data available</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Franchise Performance Comparison</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Bill</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analyticsData?.dashboard?.franchiseBreakdown?.map((franchise: any) => (
                    <tr key={franchise.franchiseId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{franchise.franchiseName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{franchise.sales}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">₹{franchise.revenue.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">₹{franchise.avgBillValue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </HQLayout>
  );
}

