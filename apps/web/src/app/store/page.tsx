'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { exportToCSV } from '@/lib/exportCSV';
import { BrandLoader } from '@/components/ui';
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
  const [showUpdatedFeedback, setShowUpdatedFeedback] = useState(false);
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

  const handleRefetch = useCallback(
    (opts?: { light?: boolean }) => {
      refetch(opts).then(() => {
        setLastRefresh(new Date());
        setShowUpdatedFeedback(true);
        setTimeout(() => setShowUpdatedFeedback(false), 2000);
      });
    },
    [refetch]
  );

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
    const handleSaleCreated = () => handleRefetch({ light: true });
    const handleSaleUpdated = () => handleRefetch({ light: true });
    const handleSaleDeleted = () => handleRefetch({ light: true });
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
    // 5 min light refresh (today only) — cuts Neon public transfer vs full dashboard every 2 min
    const interval = setInterval(() => handleRefetch({ light: true }), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user?.storeId, autoRefresh, handleRefetch]);

  if (!user) return null;

  if (loading && !stats) {
    return <BrandLoader fullscreen label="Loading dashboard…" />;
  }

  if (error || !stats) {
    return (
      <div className="w-full max-w-7xl mx-auto h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4" aria-hidden>⚠️</div>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-semibold">
            {error || 'Failed to load dashboard'}
          </p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
            Please refresh the page or contact support
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-medium transition-all active:scale-95"
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
      <div className="sticky top-0 z-20 mb-3 sm:mb-4 flex flex-col gap-3 flex-shrink-0 glass-panel-strong py-2 -mx-2 px-2 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-ink">
              {userRole === 'OWNER'
                ? 'Admin Console'
                : userRole === 'MANAGER'
                  ? 'Manager Console'
                  : 'Store Dashboard'}
            </h1>
            <p className="text-xs sm:text-sm text-ink-muted mt-1 flex items-center gap-2 flex-wrap">
              <span>Welcome, {user.name} • Last updated: {lastRefresh.toLocaleTimeString()}</span>
              {showUpdatedFeedback && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
                  Updated
                </span>
              )}
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
              className="px-3 py-1.5 glass-panel text-ink rounded-xl text-xs sm:text-sm font-medium transition-all touch-target flex items-center gap-1 active:scale-95 hover:shadow-glow-brand"
              title="Export dashboard data"
            >
              <span>📥</span>
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              type="button"
              onClick={() => handleRefetch()}
              disabled={loading}
              className="px-3 py-1.5 bg-gradient-brand text-white shadow-glow-brand hover:shadow-glow-brand-lg hover:brightness-105 disabled:opacity-60 disabled:shadow-none rounded-xl text-xs sm:text-sm font-medium transition-all touch-target flex items-center gap-1 active:scale-95 disabled:active:scale-100"
              title="Refresh dashboard"
            >
              <span className={loading ? 'animate-spin' : ''}>↻</span>
              <span className="hidden sm:inline">{loading && stats ? 'Updating...' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all touch-target active:scale-95 ${
                autoRefresh
                  ? 'bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30'
                  : 'glass-panel text-ink-secondary'
              }`}
              title={autoRefresh ? 'Auto-refresh enabled (5 min, today only)' : 'Auto-refresh disabled'}
            >
              <span className="hidden sm:inline">{autoRefresh ? 'Auto ✓' : 'Auto ✗'}</span>
              <span className="sm:hidden">{autoRefresh ? '⟳' : '⊗'}</span>
            </button>
            {userRole && (
              <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-xl font-medium text-xs sm:text-sm lg:text-base touch-target">
                {userRole}
              </div>
            )}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto p-1 rounded-xl bg-surface-2/60">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`relative px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-colors touch-target ${
                activeTab === id
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-ink-secondary hover:text-ink'
              }`}
            >
              {activeTab === id && (
                <motion.span
                  layoutId="dash-tab"
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 rounded-lg bg-surface shadow-card border border-brand-500/20"
                  aria-hidden
                />
              )}
              <span className="relative">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-6">
        {activeTab === 'overview' && (
          <div key="overview" className="animate-fade-in">
            <DashboardOverview
              stats={stats}
              loading={loading}
              pendingPaymentsTotal={pendingPaymentsTotal}
              pendingPaymentsCount={pendingPaymentsCount}
              userRole={userRole}
            />
          </div>
        )}
        {activeTab === 'today' && (
          <div key="today" className="animate-fade-in">
            <DashboardToday
              stats={stats}
              salesTrendLast7={salesTrendLast7}
              userRole={userRole}
            />
          </div>
        )}
        {activeTab === 'history' && (
          <div key="history" className="animate-fade-in">
            <DashboardHistory
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onLoad={() => loadHistoricalData(selectedDate)}
              loading={loading}
              historicalData={historicalData}
              userRole={userRole}
            />
          </div>
        )}
        {activeTab === 'actions' && (
          <div key="actions" className="animate-fade-in">
            <div className="glass-panel rounded-2xl p-4 lg:p-6">
              <h2 className="text-base sm:text-lg font-bold text-ink mb-4">Quick Actions</h2>
              <DashboardQuickActions
                pendingPaymentsCount={pendingPaymentsCount}
                userRole={userRole}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
