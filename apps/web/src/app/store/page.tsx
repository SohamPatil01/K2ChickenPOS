'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { exportToCSV } from '@/lib/exportCSV';
import { Skeleton, SkeletonCard, SkeletonStatCard } from '@/components/ui';
import { useDashboardStats } from '@/app/store/dashboard/hooks/useDashboardStats';
import DashboardOverview from '@/app/store/dashboard/components/DashboardOverview';
import DashboardToday from '@/app/store/dashboard/components/DashboardToday';
import DashboardHistory from '@/app/store/dashboard/components/DashboardHistory';
import DashboardQuickActions from '@/app/store/dashboard/components/DashboardQuickActions';

type TabId = 'overview' | 'today' | 'history' | 'actions';

export default function StoreDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const {
    stats,
    loading,
    error,
    refetch,
    pendingPaymentsTotal,
    pendingPaymentsCount,
    salesTrendLast7,
    historicalData,
    loadHistoricalData,
  } = useDashboardStats({ user: user ?? null });

  const handleRefetch = useCallback(() => {
    refetch().then(() => setLastRefresh(new Date()));
  }, [refetch]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role === 'CASHIER') {
      router.push('/store/pos');
      return;
    }
    handleRefetch();
  }, [user, router]);

  useEffect(() => {
    if (!user?.storeId) return;
    const handleSaleCreated = () => handleRefetch();
    const handleSaleUpdated = () => handleRefetch();
    const handleSaleDeleted = () => handleRefetch();
    window.addEventListener('sale-created', handleSaleCreated);
    window.addEventListener('sale-updated', handleSaleUpdated);
    window.addEventListener('sale-deleted', handleSaleDeleted);
    return () => {
      window.removeEventListener('sale-created', handleSaleCreated);
      window.removeEventListener('sale-updated', handleSaleUpdated);
      window.removeEventListener('sale-deleted', handleSaleDeleted);
    };
  }, [user?.storeId, handleRefetch]);

  useEffect(() => {
    if (!user?.storeId || !autoRefresh) return;
    const interval = setInterval(() => handleRefetch(), 60000);
    return () => clearInterval(interval);
  }, [user?.storeId, autoRefresh, handleRefetch]);

  if (!user) return null;

  if (loading && !stats) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Skeleton variant="text" height={32} width={200} className="mb-2" />
            <Skeleton variant="text" height={16} width={150} />
          </div>
          <div className="flex gap-2">
            <Skeleton variant="rectangular" height={40} width={120} />
            <Skeleton variant="rectangular" height={40} width={120} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard className="h-64" />
          <SkeletonCard className="h-64" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="w-full max-w-7xl mx-auto h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-semibold">
            {error || 'Failed to load dashboard'}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            Please refresh the page or contact support
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  const userRole = (user.role as string) || '';

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'today', label: 'Today' },
    { id: 'history', label: 'History & reports' },
    { id: 'actions', label: 'Quick actions' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col relative">
      <div className="sticky top-0 z-20 mb-3 sm:mb-4 flex flex-col gap-3 flex-shrink-0 bg-white dark:bg-gray-900 py-2 -mx-2 px-2 rounded-lg border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold dark:text-white">
              {userRole === 'OWNER'
                ? 'Admin Console'
                : userRole === 'MANAGER'
                  ? 'Manager Console'
                  : 'Store Dashboard'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              Welcome, {user.name} • Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                exportToCSV({
                  data: [
                    {
                      today: stats.today,
                      month: stats.month,
                      paymentBreakdown: stats.paymentBreakdown,
                      topProducts: stats.topProducts,
                    },
                  ],
                  filename: `dashboard_export_${new Date().toISOString().split('T')[0]}.csv`,
                });
              }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors touch-target flex items-center gap-1"
              title="Export dashboard data"
            >
              <span>📥</span>
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              type="button"
              onClick={handleRefetch}
              disabled={loading}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors touch-target flex items-center gap-1"
              title="Refresh dashboard"
            >
              <span className={loading ? 'animate-spin' : ''}>↻</span>
              <span className="hidden sm:inline">{loading && stats ? 'Updating...' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors touch-target ${
                autoRefresh
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200'
              }`}
              title={autoRefresh ? 'Auto-refresh enabled (60s)' : 'Auto-refresh disabled'}
            >
              <span className="hidden sm:inline">{autoRefresh ? 'Auto ✓' : 'Auto ✗'}</span>
              <span className="sm:hidden">{autoRefresh ? '⟳' : '⊗'}</span>
            </button>
            {userRole && (
              <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-lg font-medium text-xs sm:text-sm lg:text-base touch-target">
                {userRole}
              </div>
            )}
          </div>
        </div>

        <nav className="flex gap-1 border-b border-gray-200 dark:border-gray-700 -mb-px overflow-x-auto">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors touch-target ${
                activeTab === id
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400 dark:border-brand-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-6">
        {activeTab === 'overview' && (
          <DashboardOverview
            stats={stats}
            loading={loading}
            pendingPaymentsTotal={pendingPaymentsTotal}
            pendingPaymentsCount={pendingPaymentsCount}
            userRole={userRole}
          />
        )}
        {activeTab === 'today' && (
          <DashboardToday
            stats={stats}
            salesTrendLast7={salesTrendLast7}
            userRole={userRole}
          />
        )}
        {activeTab === 'history' && (
          <DashboardHistory
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onLoad={() => loadHistoricalData(selectedDate)}
            loading={loading}
            historicalData={historicalData}
            userRole={userRole}
          />
        )}
        {activeTab === 'actions' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 lg:p-6 border border-gray-100 dark:border-gray-700">
            <h2 className="text-base sm:text-lg font-bold dark:text-white mb-4">Quick Actions</h2>
            <DashboardQuickActions
              pendingPaymentsCount={pendingPaymentsCount}
              userRole={userRole}
            />
          </div>
        )}
      </div>
    </div>
  );
}
