'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Link from 'next/link';

interface EnhancedDashboard {
  summary: {
    totalProcurement: number;
    totalProcuredWeightKg: number;
    totalSales: number;
    totalSoldWeightKg: number;
    yieldLossPercent: number;
    totalFranchises: number;
    totalSalesCount: number;
  };
  wastageByStore: Array<{
    franchiseId: string;
    franchiseName: string;
    wastageKg: number;
    wastagePercent: number;
    allowedWastagePercent: number;
    isAbnormal: boolean;
  }>;
  topPerformingStores: Array<{
    franchiseId: string;
    franchiseName: string;
    revenue: number;
    salesCount: number;
    avgBillValue: number;
  }>;
  bottomPerformingStores: Array<{
    franchiseId: string;
    franchiseName: string;
    revenue: number;
    salesCount: number;
    avgBillValue: number;
  }>;
  alerts: Array<{
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    franchiseName?: string;
    createdAt: string;
    isRead: boolean;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

export default function EnhancedDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState<EnhancedDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthScores, setHealthScores] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      router.push('/login');
      return;
    }
    loadDashboard();
  }, [user, router, dateRange]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardRes, healthScoresRes] = await Promise.all([
        api.get('/api/v1/hq/dashboard/enhanced', {
          params: dateRange,
        }),
        api.get('/api/v1/hq/health-score', {
          params: {
            scoreDate: dateRange.endDate,
            limit: '10',
          },
        }),
      ]);
      setDashboard(dashboardRes.data);
      setHealthScores(healthScoresRes.data || []);
    } catch (err: any) {
      console.error('Failed to load enhanced dashboard:', err);
      if (err?.response?.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (err?.isNetworkError || err?.code === 'ERR_NETWORK') {
        setError('Cannot connect to the API. Make sure the server is running (e.g. port 3003).');
      } else {
        setError(err?.response?.data?.error || 'Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const markAlertAsRead = async (alertId: string) => {
    try {
      await api.patch(`/api/v1/hq/alerts/${alertId}/read`);
      loadDashboard();
    } catch (error: any) {
      console.error('Failed to mark alert as read:', error);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      await api.patch(`/api/v1/hq/alerts/${alertId}/resolve`);
      loadDashboard();
    } catch (error: any) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    }
  };

  if (error) {
    return (
      <HQLayout>
        <div className="text-center py-12 max-w-md mx-auto">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => { setError(null); loadDashboard(); }}
            className="px-4 py-2 bg-brand-600 text-white rounded-md hover:bg-brand-700"
          >
            Retry
          </button>
        </div>
      </HQLayout>
    );
  }

  if (loading) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading Enhanced Dashboard...</p>
        </div>
      </HQLayout>
    );
  }

  if (!dashboard) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Failed to load dashboard</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold dark:text-white">HQ Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Comprehensive franchise monitoring and management</p>
        </div>

        {/* Date Range Filter */}
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

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Procurement</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">₹{dashboard.summary.totalProcurement.toLocaleString()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{dashboard.summary.totalProcuredWeightKg.toFixed(2)} kg</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sales</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">₹{dashboard.summary.totalSales.toLocaleString()}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{dashboard.summary.totalSoldWeightKg.toFixed(2)} kg sold</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Yield Loss</p>
            <p className={`text-2xl font-bold mt-2 ${dashboard.summary.yieldLossPercent > 10 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
              {dashboard.summary.yieldLossPercent.toFixed(2)}%
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Procured vs Sold</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Active Alerts</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{dashboard.alerts.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Unresolved issues</p>
          </div>
        </div>

        {/* Health Scores Widget */}
        {healthScores.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">Franchise Health Scores</h2>
              <button
                onClick={async () => {
                  try {
                    await api.post('/api/v1/hq/health-score/calculate-all', {
                      scoreDate: dateRange.endDate,
                    });
                    alert('Health scores calculated successfully!');
                    loadDashboard();
                  } catch (error: any) {
                    alert(error.response?.data?.error || 'Failed to calculate health scores');
                  }
                }}
                className="px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 text-sm"
              >
                Calculate All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {healthScores.map((score) => (
                <div key={score.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold dark:text-white">
                      {score.franchiseConfig?.franchiseStore?.name || 'Unknown'}
                    </h3>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${
                      score.overallScore >= 80
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : score.overallScore >= 60
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                    }`}>
                      {score.overallScore.toFixed(1)}
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Sales Growth:</span>
                      <span className="font-medium dark:text-white">{score.salesGrowthScore.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Yield:</span>
                      <span className="font-medium dark:text-white">{score.yieldEfficiencyScore.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Wastage:</span>
                      <span className="font-medium dark:text-white">{score.wastageScore.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Compliance:</span>
                      <span className="font-medium dark:text-white">{score.complianceScore.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerts Section */}
        {dashboard.alerts.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold dark:text-white">Active Alerts</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {dashboard.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      alert.severity === 'CRITICAL'
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                        : alert.severity === 'HIGH'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10'
                        : alert.severity === 'MEDIUM'
                        ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10'
                        : 'border-blue-500 bg-blue-50 dark:bg-blue-900/10'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${getSeverityColor(alert.severity)}`}>
                            {alert.severity}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{alert.type.replace(/_/g, ' ')}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{alert.title}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{alert.message}</p>
                        {alert.franchiseName && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Franchise: {alert.franchiseName}</p>
                        )}
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {new Date(alert.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {!alert.isRead && (
                          <button
                            onClick={() => markAlertAsRead(alert.id)}
                            className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            Mark Read
                          </button>
                        )}
                        <button
                          onClick={() => resolveAlert(alert.id)}
                          className="px-3 py-1 text-xs bg-brand-500 text-white rounded hover:bg-brand-600"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Wastage by Store */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold dark:text-white">Wastage by Store</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Franchise</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Wastage %</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Allowed %</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {dashboard.wastageByStore.map((store) => (
                  <tr key={store.franchiseId} className={store.isAbnormal ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{store.franchiseName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{store.wastagePercent.toFixed(2)}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{store.allowedWastagePercent}%</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {store.isAbnormal ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                          Abnormal
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                          Normal
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top/Bottom Performing Stores */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Performing */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold dark:text-white">Top Performing Stores</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {dashboard.topPerformingStores.map((store, index) => (
                  <div key={store.franchiseId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-brand-500">#{index + 1}</span>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{store.franchiseName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{store.salesCount} sales</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-white">₹{store.revenue.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Avg: ₹{store.avgBillValue.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Performing */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold dark:text-white">Bottom Performing Stores</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {dashboard.bottomPerformingStores.map((store, index) => (
                  <div key={store.franchiseId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-orange-500">#{index + 1}</span>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{store.franchiseName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{store.salesCount} sales</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-white">₹{store.revenue.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Avg: ₹{store.avgBillValue.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </HQLayout>
  );
}

