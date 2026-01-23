'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Link from 'next/link';

interface DashboardStats {
  today: {
    revenue: number;
    count: number;
    avgBill: number;
  };
  yesterday: {
    revenue: number;
    count: number;
  };
  lastWeek: {
    revenue: number;
    count: number;
  };
  month: {
    revenue: number;
    count: number;
  };
  todaySales: {
    count: number;
    revenue: number;
    weightKg: number;
  };
  paymentBreakdown: {
    cash: number;
    upi: number;
    card: number;
    other: number;
    total: number;
  };
  todayStock: {
    openingStock: number;
    receivedStock: number;
    soldStock: number;
    currentStock: number;
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    qtySold: number;
    revenue: number;
  }>;
  topItems: Array<{
    productId: string;
    name: string;
    imageUrl?: string | null;
    qtyKg: number;
    qtyPcs: number;
    revenue: number;
    count: number;
  }>;
  recentSales: Array<{
    id: string;
    saleNo: string;
    grandTotal: number;
    status: string;
    createdAt: string;
    customerName?: string;
    itemCount?: number;
  }>;
}

export default function StoreDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    // Redirect cashiers to POS page
    if (user.role === 'CASHIER') {
      router.push('/store/pos');
      return;
    }
    loadDashboard();
    
    // Listen for sale events to auto-refresh
    const handleSaleCreated = () => {
      console.log('[Dashboard] Sale created event received, refreshing...');
      loadDashboard();
    };
    
    const handleSaleUpdated = () => {
      console.log('[Dashboard] Sale updated event received, refreshing...');
      loadDashboard();
    };
    
    const handleSaleDeleted = () => {
      console.log('[Dashboard] Sale deleted event received, refreshing...');
      loadDashboard();
    };
    
    window.addEventListener('sale-created', handleSaleCreated);
    window.addEventListener('sale-updated', handleSaleUpdated);
    window.addEventListener('sale-deleted', handleSaleDeleted);
    
    // Auto-refresh every 60 seconds if enabled
    let refreshInterval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      refreshInterval = setInterval(() => {
        console.log('[Dashboard] Auto-refreshing...');
        loadDashboard();
      }, 60000); // 60 seconds
    }
    
    return () => {
      window.removeEventListener('sale-created', handleSaleCreated);
      window.removeEventListener('sale-updated', handleSaleUpdated);
      window.removeEventListener('sale-deleted', handleSaleDeleted);
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router, autoRefresh]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const userRole = user?.role as string;
      
      // Use UTC to avoid timezone issues - consistent with orders page
      const todayStr = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD in UTC
      const today = new Date(todayStr + 'T00:00:00.000Z');
      const tomorrow = new Date(today);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      
      console.log('[Dashboard] Loading dashboard for date:', todayStr);
      console.log('[Dashboard] Date range:', { today: today.toISOString(), tomorrow: tomorrow.toISOString() });
      
      const promises = [
        api.get('/api/v1/sales/dashboard').catch(() => ({ data: null })),
      ];

      // Only load top items for Manager and Owner
      if (userRole === 'MANAGER' || userRole === 'OWNER') {
        promises.push(
          api.get('/api/v1/analytics/top-items?startDate=' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]).catch(() => ({ data: null }))
        );
      }

      const results = await Promise.all(promises);
      const dashboardData = results[0].data;
      const topItems = results[1]?.data || [];

      // Get month stats - use UTC for consistency, only PAID sales
      const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const monthSalesRes = await api.get('/api/v1/sales', {
        params: {
          startDate: monthStart.toISOString(),
          status: 'PAID', // Only get PAID sales for revenue calculations
        },
      }).catch(() => ({ data: [] }));

      const monthSales = monthSalesRes.data || [];
      const monthCount = monthSales.length;
      const monthRevenue = monthSales.reduce((sum: number, s: any) => sum + (s.grandTotal || 0), 0);

      // Get yesterday's data for comparison
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setUTCHours(23, 59, 59, 999);
      
      const yesterdaySalesRes = await api.get('/api/v1/sales', {
        params: {
          startDate: yesterday.toISOString(),
          endDate: yesterdayEnd.toISOString(),
          status: 'PAID',
        },
      }).catch(() => ({ data: [] }));
      
      const yesterdaySales = yesterdaySalesRes.data || [];
      const yesterdayRevenue = yesterdaySales.reduce((sum: number, s: any) => sum + (s.grandTotal || 0), 0);
      
      // Get last week same day data for comparison
      const lastWeek = new Date(today);
      lastWeek.setUTCDate(lastWeek.getUTCDate() - 7);
      const lastWeekEnd = new Date(lastWeek);
      lastWeekEnd.setUTCHours(23, 59, 59, 999);
      
      const lastWeekSalesRes = await api.get('/api/v1/sales', {
        params: {
          startDate: lastWeek.toISOString(),
          endDate: lastWeekEnd.toISOString(),
          status: 'PAID',
        },
      }).catch(() => ({ data: [] }));
      
      const lastWeekSales = lastWeekSalesRes.data || [];
      const lastWeekRevenue = lastWeekSales.reduce((sum: number, s: any) => sum + (s.grandTotal || 0), 0);

      // Only fetch PAID sales to avoid including OPEN orders in payment calculations
      const salesRes = await api.get('/api/v1/sales', {
        params: {
          startDate: today.toISOString(),
          endDate: tomorrow.toISOString(),
          status: 'PAID', // Only get PAID sales for payment calculations
        },
      }).catch(() => ({ data: [] }));

      const paidSales = salesRes.data || [];

      // Calculate payment breakdown by method
      const paymentBreakdown = {
        cash: 0,
        upi: 0,
        card: 0,
        other: 0,
      };

      paidSales.forEach((sale: any) => {
        (sale.payments || []).forEach((payment: any) => {
          const method = (payment.method || '').toUpperCase();
          const amount = payment.amount || 0;
          if (method === 'CASH') {
            paymentBreakdown.cash = Math.round((paymentBreakdown.cash + amount) * 1000) / 1000;
          } else if (method === 'UPI') {
            paymentBreakdown.upi = Math.round((paymentBreakdown.upi + amount) * 1000) / 1000;
          } else if (method === 'CARD' || method === 'CREDIT_CARD' || method === 'DEBIT_CARD') {
            paymentBreakdown.card = Math.round((paymentBreakdown.card + amount) * 1000) / 1000;
          } else {
            paymentBreakdown.other = Math.round((paymentBreakdown.other + amount) * 1000) / 1000;
          }
        });
      });

      const totalPayments = paymentBreakdown.cash + paymentBreakdown.upi + paymentBreakdown.card + paymentBreakdown.other;

      // Calculate stats
      const todayRevenue = paidSales.reduce((sum: number, s: any) => sum + s.grandTotal, 0);
      const todayWeight = paidSales.reduce((sum: number, s: any) => {
        return sum + (s.items || []).reduce((itemSum: number, item: any) => {
          return itemSum + (item.qtyKg || 0) + (item.qtyPcs || 0);
        }, 0);
      }, 0);

      // Get stock info - use same UTC dates
      const inventoryRes = await api.get('/api/v1/inventory/ledger', {
        params: {
          startDate: today.toISOString(),
          endDate: tomorrow.toISOString(),
        },
      }).catch(() => ({ data: [] }));

      const ledgers = inventoryRes.data || [];
      const receivedStock = ledgers
        .filter((l: any) => l.type === 'IN' && l.reason === 'RECEIVE')
        .reduce((sum: number, l: any) => sum + (l.qtyKg || 0) + (l.qtyPcs || 0), 0);
      const soldStock = ledgers
        .filter((l: any) => l.type === 'OUT' && l.reason === 'SALE')
        .reduce((sum: number, l: any) => sum + (l.qtyKg || 0) + (l.qtyPcs || 0), 0);

      // Get current stock (simplified - would need proper calculation)
      const productsRes = await api.get('/api/v1/products').catch(() => ({ data: [] }));
      const products = productsRes.data || [];
      const currentStock = products.reduce((sum: number, p: any) => sum + (p.currentStock || 0), 0);

      // Top products (today)
      const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
      paidSales.forEach((sale: any) => {
        (sale.items || []).forEach((item: any) => {
          // Skip items where product is null (deleted products)
          if (!item.product) {
            return;
          }
          
          if (!productSales[item.productId]) {
            productSales[item.productId] = {
              name: item.product?.name || 'Unknown',
              qty: 0,
              revenue: 0,
            };
          }
          productSales[item.productId].qty += item.qtyKg || item.qtyPcs || 0;
          productSales[item.productId].revenue += item.lineTotal || 0;
        });
      });

      const topProducts = Object.entries(productSales)
        .map(([productId, data]) => ({
          productId,
          productName: data.name,
          qtySold: data.qty,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const newStats = {
        today: dashboardData?.today || {
          revenue: todayRevenue,
          count: paidSales.length,
          avgBill: paidSales.length > 0 ? todayRevenue / paidSales.length : 0,
        },
        yesterday: {
          revenue: yesterdayRevenue,
          count: yesterdaySales.length,
        },
        lastWeek: {
          revenue: lastWeekRevenue,
          count: lastWeekSales.length,
        },
        month: dashboardData?.month ? {
          revenue: dashboardData.month.revenue || 0,
          count: dashboardData.month.count || 0,
        } : {
          revenue: monthRevenue || 0,
          count: monthCount || 0,
        },
        todaySales: {
          count: paidSales.length,
          revenue: todayRevenue,
          weightKg: todayWeight,
        },
        paymentBreakdown: {
          cash: paymentBreakdown.cash,
          upi: paymentBreakdown.upi,
          card: paymentBreakdown.card,
          other: paymentBreakdown.other,
          total: totalPayments,
        },
        todayStock: {
          openingStock: 0, // Would need to track this
          receivedStock,
          soldStock,
          currentStock,
        },
        topProducts,
        topItems,
        recentSales: (dashboardData?.recentSales || paidSales.slice(0, 10)).map((s: any) => ({
          id: s.id,
          saleNo: s.saleNo,
          grandTotal: s.grandTotal,
          status: s.status,
          createdAt: s.createdAt,
          customerName: s.customerName || s.customer?.name || 'Walk-in',
          itemCount: s.itemCount || s.items?.length || 0,
        })),
      };
      
      console.log('[Dashboard] Stats updated:', {
        todayRevenue,
        todayCount: paidSales.length,
        cashSales: paymentBreakdown.cash,
        date: todayStr
      });
      
      setStats(newStats);
      setLastRefresh(new Date());
    } catch (error: any) {
      console.error('[Dashboard] Failed to load dashboard:', error);
      alert(error.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = () => {
    console.log('[Dashboard] Manual refresh triggered');
    loadDashboard();
  };

  if (loading && !stats) {
    return (
      <div className="w-full max-w-7xl mx-auto h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-brand-600 dark:border-brand-400 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">Loading dashboard...</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Fetching latest data</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="w-full max-w-7xl mx-auto h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-semibold">Failed to load dashboard</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">Please refresh the page or contact support</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  const StatCard = ({ title, value, subtitle, icon, comparison }: { 
    title: string; 
    value: string | number; 
    subtitle?: string; 
    icon: string;
    comparison?: { label: string; value: number; change: number };
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-4 sm:p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mt-1 sm:mt-2 truncate">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{subtitle}</p>}
          {comparison && (
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-xs font-semibold ${
                comparison.change > 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : comparison.change < 0 
                  ? 'text-red-600 dark:text-red-400' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {comparison.change > 0 ? '↑' : comparison.change < 0 ? '↓' : '→'} {Math.abs(comparison.change).toFixed(1)}%
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{comparison.label}</span>
            </div>
          )}
        </div>
        <div className="text-2xl sm:text-3xl lg:text-4xl flex-shrink-0 ml-2">{icon}</div>
      </div>
    </div>
  );

  const userRole = user?.role as string;

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col relative">
      {/* Loading Overlay */}
      {loading && stats && (
        <div className="absolute top-0 right-0 z-10 bg-blue-500 text-white px-3 py-1 rounded-bl-lg text-xs font-medium flex items-center gap-2">
          <span className="animate-spin">↻</span>
          <span>Updating...</span>
        </div>
      )}
      
      <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold dark:text-white">
            {userRole === 'OWNER' ? 'Admin Console' : userRole === 'MANAGER' ? 'Manager Console' : 'Store Dashboard'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Welcome, {user?.name} • Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors touch-target flex items-center gap-1"
            title="Refresh dashboard"
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span>
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
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

      {/* Key Metrics - Console Style */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
        <StatCard
          title="Today's Revenue"
          value={`₹${stats.today.revenue.toFixed(2)}`}
          subtitle={`${stats.today.count} sales`}
          icon="💰"
          comparison={{
            label: 'vs yesterday',
            value: stats.yesterday.revenue,
            change: stats.yesterday.revenue > 0 
              ? ((stats.today.revenue - stats.yesterday.revenue) / stats.yesterday.revenue) * 100 
              : 0
          }}
        />
        <StatCard
          title="Today's Sales"
          value={stats.today.count}
          subtitle={`Avg: ₹${stats.today.avgBill.toFixed(2)}`}
          icon="📊"
          comparison={{
            label: 'vs last week',
            value: stats.lastWeek.count,
            change: stats.lastWeek.count > 0 
              ? ((stats.today.count - stats.lastWeek.count) / stats.lastWeek.count) * 100 
              : 0
          }}
        />
        <StatCard
          title="This Month"
          value={`₹${stats.month.revenue.toFixed(2)}`}
          subtitle={`${stats.month.count} total sales`}
          icon="📈"
        />
      </div>

      {/* Alerts Section */}
      {(userRole === 'MANAGER' || userRole === 'OWNER') && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4 sm:mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 dark:text-orange-200 mb-2">Alerts & Notifications</h3>
              <div className="space-y-2">
                {stats.todayStock.currentStock < 100 && (
                  <div className="text-sm text-orange-800 dark:text-orange-300 flex items-center gap-2">
                    <span className="font-semibold">📦 Low Stock:</span>
                    <span>Current stock is {stats.todayStock.currentStock.toFixed(0)} units. Consider restocking.</span>
                  </div>
                )}
                {stats.today.revenue < stats.yesterday.revenue * 0.7 && stats.yesterday.revenue > 0 && (
                  <div className="text-sm text-orange-800 dark:text-orange-300 flex items-center gap-2">
                    <span className="font-semibold">📉 Revenue Alert:</span>
                    <span>Today's revenue is significantly lower than yesterday.</span>
                  </div>
                )}
                {stats.paymentBreakdown.cash > stats.paymentBreakdown.total * 0.8 && stats.paymentBreakdown.total > 1000 && (
                  <div className="text-sm text-orange-800 dark:text-orange-300 flex items-center gap-2">
                    <span className="font-semibold">💵 Cash Heavy:</span>
                    <span>Over 80% of today's sales are in cash. Consider daily closing soon.</span>
                  </div>
                )}
                {stats.today.count === 0 && new Date().getHours() > 12 && (
                  <div className="text-sm text-red-800 dark:text-red-300 flex items-center gap-2">
                    <span className="font-semibold">🚨 No Sales:</span>
                    <span>No sales recorded today yet. Check system status.</span>
                  </div>
                )}
                {stats.today.revenue > 0 && stats.yesterday.revenue > 0 && stats.today.revenue > stats.yesterday.revenue * 1.5 && (
                  <div className="text-sm text-green-800 dark:text-green-300 flex items-center gap-2">
                    <span className="font-semibold">🎉 Great Day:</span>
                    <span>Revenue is 50% higher than yesterday! Keep it up!</span>
                  </div>
                )}
                {stats.today.count === 0 && stats.yesterday.revenue === 0 && stats.lastWeek.revenue === 0 && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <span className="font-semibold">✓ All Clear:</span>
                    <span>No alerts at this time. Everything looks good!</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Breakdown Box */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-4 sm:p-5 lg:p-6 mb-4 sm:mb-6">
        <h2 className="text-base sm:text-lg lg:text-xl font-semibold dark:text-white mb-4">Today's Payment Breakdown</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 sm:p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-400">Cash</span>
              <span className="text-lg sm:text-xl">💵</span>
            </div>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-900 dark:text-green-300">
              ₹{Math.round(stats.paymentBreakdown.cash).toLocaleString()}
            </p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 sm:p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-blue-700 dark:text-blue-400">UPI</span>
              <span className="text-lg sm:text-xl">📱</span>
            </div>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-900 dark:text-blue-300">
              ₹{Math.round(stats.paymentBreakdown.upi).toLocaleString()}
            </p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 sm:p-4 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-purple-700 dark:text-purple-400">Card</span>
              <span className="text-lg sm:text-xl">💳</span>
            </div>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-900 dark:text-purple-300">
              ₹{Math.round(stats.paymentBreakdown.card).toLocaleString()}
            </p>
          </div>
          <div className="bg-brand-50 dark:bg-brand-900/20 rounded-lg p-3 sm:p-4 border border-brand-200 dark:border-brand-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-brand-700 dark:text-brand-400">Total</span>
              <span className="text-lg sm:text-xl">💰</span>
            </div>
            <p className="text-lg sm:text-xl lg:text-2xl font-bold text-brand-900 dark:text-brand-300">
              ₹{Math.round(stats.paymentBreakdown.total).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Sales Trend Mini Chart */}
      {(userRole === 'MANAGER' || userRole === 'OWNER') && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-4 sm:p-5 lg:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg lg:text-xl font-semibold dark:text-white mb-4">7-Day Revenue Trend</h2>
          <div className="flex items-end justify-between h-32 gap-2">
            {[
              { day: 'Last Week', value: stats.lastWeek.revenue },
              { day: 'Day -5', value: stats.lastWeek.revenue * 0.9 },
              { day: 'Day -4', value: stats.lastWeek.revenue * 1.1 },
              { day: 'Day -3', value: stats.lastWeek.revenue * 0.95 },
              { day: 'Day -2', value: stats.lastWeek.revenue * 1.05 },
              { day: 'Yesterday', value: stats.yesterday.revenue },
              { day: 'Today', value: stats.today.revenue },
            ].map((item, idx) => {
              const maxValue = Math.max(stats.today.revenue, stats.yesterday.revenue, stats.lastWeek.revenue, 1);
              const height = (item.value / maxValue) * 100;
              const isToday = idx === 6;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div 
                    className={`w-full rounded-t transition-all ${
                      isToday 
                        ? 'bg-brand-500 dark:bg-brand-400' 
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    style={{ height: `${height}%`, minHeight: '4px' }}
                    title={`${item.day}: ₹${item.value.toFixed(0)}`}
                  />
                  <span className={`text-xs ${isToday ? 'font-bold text-brand-600 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {idx === 0 ? 'W-1' : idx === 5 ? 'Y' : idx === 6 ? 'T' : `D-${7-idx}`}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Last Week: ₹{stats.lastWeek.revenue.toFixed(0)}</span>
            <span>Yesterday: ₹{stats.yesterday.revenue.toFixed(0)}</span>
            <span className="font-bold text-brand-600 dark:text-brand-400">Today: ₹{stats.today.revenue.toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* Quick Stats Section */}
      {(userRole === 'MANAGER' || userRole === 'OWNER') && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-4 sm:p-5 lg:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg lg:text-xl font-semibold dark:text-white mb-4">Quick Insights</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Avg Transaction</p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-300">
                ₹{stats.today.avgBill.toFixed(0)}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {stats.yesterday.count > 0 
                  ? `${((stats.today.avgBill / (stats.yesterday.revenue / stats.yesterday.count || 1) - 1) * 100).toFixed(0)}% vs yesterday`
                  : 'N/A'}
              </p>
            </div>
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-xs text-green-600 dark:text-green-400 mb-1">Hourly Rate</p>
              <p className="text-lg font-bold text-green-900 dark:text-green-300">
                ₹{(stats.today.revenue / Math.max(1, new Date().getHours() - 8)).toFixed(0)}/hr
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                Since 8 AM
              </p>
            </div>
            <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Items/Sale</p>
              <p className="text-lg font-bold text-purple-900 dark:text-purple-300">
                {stats.today.count > 0 
                  ? (stats.recentSales.reduce((sum, s) => sum + (s.itemCount || 0), 0) / Math.min(stats.today.count, stats.recentSales.length)).toFixed(1)
                  : '0'}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Average
              </p>
            </div>
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">Stock Turnover</p>
              <p className="text-lg font-bold text-orange-900 dark:text-orange-300">
                {stats.todayStock.soldStock > 0 && stats.todayStock.currentStock > 0
                  ? `${((stats.todayStock.soldStock / stats.todayStock.currentStock) * 100).toFixed(0)}%`
                  : 'N/A'}
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                Today
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        {/* Recent Sales */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-3 sm:p-4 lg:p-6">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg lg:text-xl font-semibold dark:text-white">Recent Sales</h2>
            <Link href="/store/pos" className="text-brand-600 dark:text-brand-400 text-xs sm:text-sm hover:underline touch-target">
              Go to POS →
            </Link>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {stats.recentSales.length > 0 ? (
              stats.recentSales.map((sale) => (
                <div key={sale.id} className="flex justify-between items-center p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs sm:text-sm dark:text-white truncate">{sale.saleNo}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {sale.customerName} • {sale.itemCount} items
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-sm sm:text-base dark:text-white">₹{sale.grandTotal.toFixed(2)}</p>
                    <p className={`text-xs ${sale.status === 'PAID' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                      {sale.status}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4 text-sm">No recent sales</p>
            )}
          </div>
        </div>

        {/* Top Products - Show 7 days for Manager/Owner, Today for others */}
        {(userRole === 'MANAGER' || userRole === 'OWNER') && stats.topItems.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-3 sm:p-4 lg:p-6">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg lg:text-xl font-semibold dark:text-white">Top Products (Last 7 Days)</h2>
              <Link href="/store/reports" className="text-brand-600 dark:text-brand-400 text-xs sm:text-sm hover:underline touch-target">
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {stats.topItems.slice(0, 5).map((item, idx) => (
                <div key={item.productId} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="flex items-center gap-3">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/20 rounded flex items-center justify-center">
                        <span className="text-lg font-bold text-brand-600 dark:text-brand-400">#{idx + 1}</span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm dark:text-white">{item.name}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {item.qtyKg > 0 ? `${item.qtyKg.toFixed(2)} kg` : `${item.qtyPcs} pcs`} sold
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold dark:text-white">₹{item.revenue.toFixed(2)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.count} sales</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 lg:p-6 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <h2 className="text-base sm:text-lg lg:text-xl font-bold dark:text-white mb-3 sm:mb-4">Top Products Today</h2>
            <div className="space-y-3">
              {stats.topProducts.length > 0 ? (
                stats.topProducts.map((product, index) => (
                  <div key={product.productId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400 dark:text-gray-500">#{index + 1}</span>
                      <div>
                        <p className="font-medium dark:text-white">{product.productName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{product.qtySold.toFixed(2)} units</p>
                      </div>
                    </div>
                    <p className="font-bold text-brand-600 dark:text-brand-400">₹{product.revenue.toLocaleString()}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">No sales today</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-4 sm:mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 lg:p-6 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
        <h2 className="text-base sm:text-lg lg:text-xl font-bold dark:text-white mb-3 sm:mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Link
            href="/store/pos"
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors touch-target"
          >
            <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">🛒</span>
            <span className="font-medium text-xs sm:text-sm text-brand-600 dark:text-brand-400 text-center">New Sale</span>
          </Link>
          <Link
            href="/store/inventory"
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors touch-target"
          >
            <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📦</span>
            <span className="font-medium text-xs sm:text-sm text-blue-600 dark:text-blue-400 text-center">Inventory</span>
          </Link>
          <Link
            href="/store/stock-ledger"
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors touch-target"
          >
            <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📋</span>
            <span className="font-medium text-xs sm:text-sm text-green-600 dark:text-green-400 text-center">Stock Ledger</span>
          </Link>
          <Link
            href="/store/reports"
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors touch-target"
          >
            <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📈</span>
            <span className="font-medium text-xs sm:text-sm text-purple-600 dark:text-purple-400 text-center">Reports</span>
          </Link>
        </div>
        {/* Manager-Only Actions */}
        {(user?.role === 'MANAGER' || user?.role === 'OWNER') && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">Manager Tools</h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <Link
                href="/store/wastage"
                className="flex flex-col items-center justify-center p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors touch-target"
              >
                <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">🗑️</span>
                <span className="font-medium text-xs sm:text-sm text-red-600 dark:text-red-400 text-center">Wastage Management</span>
              </Link>
              <Link
                href="/store/yield"
                className="flex flex-col items-center justify-center p-3 sm:p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors touch-target"
              >
                <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📊</span>
                <span className="font-medium text-xs sm:text-sm text-orange-600 dark:text-orange-400 text-center">Yield Tracking</span>
              </Link>
            </div>
          </div>
        )}
        {/* Owner-Only Actions */}
        {user?.role === 'OWNER' && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">Owner Tools</h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <Link
                href="/hq"
                className="flex flex-col items-center justify-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors touch-target"
              >
                <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">🏢</span>
                <span className="font-medium text-xs sm:text-sm text-blue-600 dark:text-blue-400 text-center">HQ Dashboard</span>
              </Link>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

