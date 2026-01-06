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
    totalProductSales?: number; // Sum of lineTotal (before discounts/taxes)
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
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

export default function HQDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState<HQDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const timestamp = Date.now();
      const response = await api.get('/api/v1/hq/dashboard', {
        params: {
          ...dateRange,
          _t: timestamp, // Cache busting
        },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      setDashboard(response.data);
    } catch (error: any) {
      console.error('Failed to load HQ dashboard:', error);
      console.error('Error response:', error.response);
      console.error('Error details:', error.response?.data);
      
      let errorMessage = 'Failed to load HQ dashboard';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
        if (error.response.data.details) {
          errorMessage += `: ${error.response.data.details}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Network error: Cannot connect to API. Please check if the API is running.';
      }
      
      setError(errorMessage);
      console.error('[HQ Dashboard] Dashboard load error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    // Wait for user to load from localStorage
    if (user === undefined) {
      return; // Still loading
    }

    // If no user, redirect to login
    if (!user) {
      console.log('[HQ Dashboard] No user found, redirecting to login');
      router.push('/login');
      return;
    }

    // Check user role
    console.log('[HQ Dashboard] User role:', user.role, 'User:', user);
    
    if (user.role !== 'OWNER') {
      console.log('[HQ Dashboard] User is not OWNER, redirecting to console');
      router.push('/console');
      return;
    }

    // User is OWNER, load dashboard
    console.log('[HQ Dashboard] User is OWNER, loading dashboard');
    loadDashboard();
  }, [user?.role, router, dateRange.startDate, dateRange.endDate, loadDashboard]);

  // Auto-refresh dashboard every 30 seconds and when window gains focus
  useEffect(() => {
    if (user?.role !== 'OWNER') return;

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadDashboard();
    }, 30000);

    // Refresh when window gains focus (user switches back to tab)
    const handleFocus = () => {
      loadDashboard();
    };
    window.addEventListener('focus', handleFocus);

    // Refresh when page becomes visible (user switches tabs)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadDashboard();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.role, loadDashboard]);

  const StatCard = ({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle?: string; icon: string }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="text-4xl text-primary-600">{icon}</div>
      </div>
    </div>
  );

  // Show loading state while checking user or loading dashboard
  if (user === undefined || loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">
            {user === undefined ? 'Checking authentication...' : 'Loading HQ Dashboard...'}
          </p>
        </div>
      </Layout>
    );
  }

  // If no user or not OWNER, show nothing (will redirect)
  if (!user || user.role !== 'OWNER') {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-12">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800">
              {!user ? 'No user found. Redirecting to login...' : `Access denied. Your role is ${user.role}. Only OWNER can access HQ dashboard. Redirecting...`}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">HQ Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Monitor and analyze franchise performance</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/hq"
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 flex items-center gap-2"
              >
                <span>←</span>
                <span>Back to HQ</span>
              </Link>
              <button
                onClick={loadDashboard}
                disabled={loading}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400 flex items-center gap-2 text-sm"
                title="Refresh dashboard (auto-refreshes every 30 seconds)"
              >
                <span>🔄</span>
                <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-800 font-medium">Error loading dashboard</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={() => {
                  setError(null);
                  loadDashboard();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Show message if dashboard is null and not loading */}
        {!loading && !error && !dashboard && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center mb-6">
            <p className="text-yellow-800">No dashboard data available. Click retry to reload.</p>
            <button
              onClick={loadDashboard}
              className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Only show dashboard content if we have data */}
        {dashboard && (
          <>
            {/* Date Range Filter */}
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

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <StatCard
                title="Total Franchises"
                value={dashboard.summary.totalFranchises}
                icon="🏪"
              />
              <StatCard
                title="Total Sales"
                value={dashboard.summary.totalSales}
                subtitle={`${dashboard.summary.totalCustomers} customers`}
                icon="💰"
              />
              <StatCard
                title="Total Product Sales"
                value={`₹${(dashboard.summary.totalProductSales || dashboard.summary.totalRevenue).toFixed(2)}`}
                subtitle="Sum of all product line totals"
                icon="🛒"
              />
              <StatCard
                title="Total Revenue"
                value={`₹${dashboard.summary.totalRevenue.toFixed(2)}`}
                subtitle={`After discounts & taxes | Avg: ₹${dashboard.summary.avgRevenuePerFranchise.toFixed(2)} per franchise`}
                icon="📈"
              />
            </div>
            
            {/* Show difference explanation */}
            {dashboard.summary.totalProductSales && Math.abs(dashboard.summary.totalProductSales - dashboard.summary.totalRevenue) > 0.01 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Product Sales (₹{dashboard.summary.totalProductSales.toFixed(2)}) is the sum of all product line totals before discounts and taxes. 
                  Total Revenue (₹{dashboard.summary.totalRevenue.toFixed(2)}) is the final amount after discounts and taxes.
                  Difference: ₹{Math.abs(dashboard.summary.totalProductSales - dashboard.summary.totalRevenue).toFixed(2)}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <StatCard
                title="Total Customers"
                value={dashboard.summary.totalCustomers}
                icon="👥"
              />
            </div>

            {/* Franchise Performance Table */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Franchise Performance</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Franchise
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sales
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customers
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Bill
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboard.franchiseBreakdown.map((franchise) => (
                      <tr key={franchise.franchiseId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {franchise.franchiseName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {franchise.sales}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ₹{franchise.revenue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {franchise.customers}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ₹{franchise.avgBillValue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/franchises/${franchise.franchiseId}`}
                            className="text-primary-600 hover:text-primary-800"
                          >
                            View Details →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

