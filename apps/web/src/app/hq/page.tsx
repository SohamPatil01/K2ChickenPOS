'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Link from 'next/link';

interface HQDashboard {
  summary: {
    totalFranchises: number;
    totalSales: number;
    totalRevenue: number;
    totalCustomers: number;
    avgRevenuePerFranchise: number;
  };
  franchiseBreakdown: Array<{
    franchiseId: string;
    franchiseName: string;
    sales: number;
    revenue: number;
    customers: number;
    avgBillValue: number;
    storeType?: string;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

export default function HQPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState<HQDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (user === undefined) {
      console.log('[HQ Dashboard] User still loading...');
      return; // Still loading
    }

    if (!user) {
      console.log('[HQ Dashboard] No user, redirecting to login');
      router.push('/login');
      return;
    }
    
    if (user.role !== 'OWNER') {
      console.log('[HQ Dashboard] User is not OWNER, redirecting to store:', user.role);
      router.push('/store');
      return;
    }

    // Load dashboard when user is authenticated and OWNER
    if (user.role === 'OWNER' && user.storeId) {
      console.log('[HQ Dashboard] User is OWNER, loading dashboard...', { storeId: user.storeId });
      loadDashboard();
    } else {
      console.log('[HQ Dashboard] Missing storeId:', { role: user.role, storeId: user.storeId });
    }
  }, [user, router, loadDashboard]);

  // Separate effect for reloading dashboard when dateRange changes (but not on initial mount)
  useEffect(() => {
    if (user?.role === 'OWNER' && user?.storeId && dashboard !== null) {
      // Only reload if dashboard data already exists (not initial load)
      console.log('[HQ Dashboard] Date range changed, reloading...');
      loadDashboard();
    }
  }, [dateRange, user, dashboard, loadDashboard]);

  const loadDashboard = useCallback(async () => {
    if (!user?.storeId) {
      console.log('[HQ Dashboard] Store ID missing:', user);
      setError('Store ID is missing');
      setLoading(false);
      return;
    }

    if (user.role !== 'OWNER') {
      console.log('[HQ Dashboard] User is not OWNER:', user.role);
      return; // Don't load if not OWNER
    }

    console.log('[HQ Dashboard] Loading dashboard data...', { storeId: user.storeId, dateRange });
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/v1/hq/dashboard', {
        params: dateRange,
      });
      console.log('[HQ Dashboard] Data loaded successfully:', response.data);
      setDashboard(response.data);
    } catch (error: any) {
      console.error('[HQ Dashboard] Failed to load:', error);
      console.error('[HQ Dashboard] Error response:', error.response?.data);
      setError(error.response?.data?.error || 'Failed to load HQ dashboard');
    } finally {
      setLoading(false);
    }
  }, [user, dateRange]);

  const StatCard = ({ title, value, subtitle, icon, gradient }: { 
    title: string; 
    value: string | number; 
    subtitle?: string; 
    icon: string;
    gradient?: string;
  }) => (
    <div className={`rounded-xl shadow-lg p-6 border ${
      gradient || 'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading HQ Dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-12">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <p className="text-red-800 dark:text-red-300 font-semibold">Error</p>
            <p className="text-red-600 dark:text-red-400 mt-2">{error}</p>
            <button
              onClick={loadDashboard}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!dashboard) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-12">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400">No dashboard data available</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold dark:text-white">Franchise HQ Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and monitor all franchise outlets</p>
          </div>
          <Link
            href="/store"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            ← Back to Store
          </Link>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:[color-scheme:dark]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:[color-scheme:dark]"
              />
            </div>
            <button
              onClick={loadDashboard}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="Total Franchises"
            value={dashboard.summary.totalFranchises}
            icon="🏪"
            gradient="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800"
          />
          <StatCard
            title="Total Sales"
            value={dashboard.summary.totalSales.toLocaleString()}
            subtitle={`${dashboard.summary.totalCustomers.toLocaleString()} customers`}
            icon="💰"
            gradient="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800"
          />
          <StatCard
            title="Total Revenue"
            value={`₹${dashboard.summary.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            subtitle={`Avg: ₹${dashboard.summary.avgRevenuePerFranchise.toLocaleString('en-IN', { maximumFractionDigits: 0 })} per franchise`}
            icon="📈"
            gradient="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800"
          />
          <StatCard
            title="Total Customers"
            value={dashboard.summary.totalCustomers.toLocaleString()}
            icon="👥"
            gradient="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800"
          />
        </div>

        {/* Franchise Performance Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold dark:text-white">Franchise Performance</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {dashboard.franchiseBreakdown.length} {dashboard.franchiseBreakdown.length === 1 ? 'store' : 'stores'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Store</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Sales</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Customers</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Bill</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {dashboard.franchiseBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      No franchise data available for the selected period
                    </td>
                  </tr>
                ) : (
                  dashboard.franchiseBreakdown.map((franchise) => (
                    <tr key={franchise.franchiseId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {franchise.franchiseName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          franchise.storeType === 'OWNER'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                        }`}>
                          {franchise.storeType || 'FRANCHISE'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">
                        {franchise.sales.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900 dark:text-white">
                        ₹{franchise.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">
                        {franchise.customers.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700 dark:text-gray-300">
                        ₹{franchise.avgBillValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Link href="/store" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition text-center border border-gray-200 dark:border-gray-700">
            <div className="text-3xl mb-2">🏪</div>
            <h3 className="font-semibold dark:text-white">Store Dashboard</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View store details</p>
          </Link>
          <Link href="/store/reports" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition text-center border border-gray-200 dark:border-gray-700">
            <div className="text-3xl mb-2">📊</div>
            <h3 className="font-semibold dark:text-white">Reports</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View all reports</p>
          </Link>
          <Link href="/analytics" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition text-center border border-gray-200 dark:border-gray-700">
            <div className="text-3xl mb-2">📈</div>
            <h3 className="font-semibold dark:text-white">Analytics</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View analytics</p>
          </Link>
          <Link href="/store/analytics/advanced" className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition text-center border border-gray-200 dark:border-gray-700">
            <div className="text-3xl mb-2">🔮</div>
            <h3 className="font-semibold dark:text-white">Advanced Analytics</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Predictive insights</p>
          </Link>
          </div>
      </div>
    </Layout>
  );
}
