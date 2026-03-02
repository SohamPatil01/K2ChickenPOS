'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { getHQConsoleUrl } from '@/lib/hq';
import Link from 'next/link';
import StatCard from '@/components/StatCard';
import { SkeletonStatCard, Skeleton, SkeletonCard, SkeletonText } from '@/components/ui';
import { exportToCSV } from '@/lib/exportCSV';
import { formatInrShort } from '@/lib/utils';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

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
  const [pendingPaymentsTotal, setPendingPaymentsTotal] = useState(0);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [historicalData, setHistoricalData] = useState<any>(null);
  const [salesTrendLast7, setSalesTrendLast7] = useState<Array<{ date: string; total: number }>>([]);

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

      // Load last 7 days revenue trend for chart (Manager/Owner only)
      if (userRole === "MANAGER" || userRole === "OWNER") {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
        api
          .get("/api/v1/analytics/sales-trend", {
            params: {
              startDate: sevenDaysAgo.toISOString().split("T")[0],
              endDate: todayStr,
            },
          })
          .then((res: any) => {
            const trend = Array.isArray(res?.data) ? res.data : [];
            setSalesTrendLast7(trend);
          })
          .catch(() => setSalesTrendLast7([]));
      } else {
        setSalesTrendLast7([]);
      }
      
      // Load pending payments
      loadPendingPayments();
    } catch (error: any) {
      console.error('[Dashboard] Failed to load dashboard:', error);
      alert(error.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingPayments = async () => {
    try {
      const response = await api.get('/api/v1/customers/pending-payments');
      const customers = response.data || [];
      const total = customers.reduce((sum: number, c: any) => sum + c.totalPending, 0);
      const count = customers.reduce((sum: number, c: any) => sum + c.orderCount, 0);
      setPendingPaymentsTotal(total);
      setPendingPaymentsCount(count);
    } catch (error) {
      console.error('[Dashboard] Failed to load pending payments:', error);
    }
  };

  const loadHistoricalData = async (date: string) => {
    try {
      setLoading(true);
      const dateObj = new Date(date + 'T00:00:00.000Z');
      const nextDay = new Date(dateObj);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);

      // Get sales for the selected date
      const salesRes = await api.get('/api/v1/sales', {
        params: {
          startDate: dateObj.toISOString(),
          endDate: nextDay.toISOString(),
          status: 'PAID',
        },
      });

      const sales = salesRes.data || [];
      
      // Calculate payment breakdown
      const paymentBreakdown = {
        cash: 0,
        upi: 0,
        card: 0,
        other: 0,
      };

      sales.forEach((sale: any) => {
        (sale.payments || []).forEach((payment: any) => {
          const method = (payment.method || '').toUpperCase();
          const amount = payment.amount || 0;
          if (method === 'CASH') {
            paymentBreakdown.cash += amount;
          } else if (method === 'UPI') {
            paymentBreakdown.upi += amount;
          } else if (method === 'CARD' || method === 'CREDIT_CARD' || method === 'DEBIT_CARD') {
            paymentBreakdown.card += amount;
          } else {
            paymentBreakdown.other += amount;
          }
        });
      });

      // Get pending payments for that date (OPEN sales created on that date)
      const openSalesRes = await api.get('/api/v1/sales', {
        params: {
          startDate: dateObj.toISOString(),
          endDate: nextDay.toISOString(),
          status: 'OPEN',
        },
      });

      const openSales = openSalesRes.data || [];
      const pendingAmount = openSales.reduce((sum: number, s: any) => sum + (s.grandTotal - s.totalPaid), 0);

      setHistoricalData({
        date,
        salesCount: sales.length,
        totalRevenue: sales.reduce((sum: number, s: any) => sum + s.grandTotal, 0),
        paymentBreakdown,
        pendingAmount,
        pendingCount: openSales.length,
      });
    } catch (error) {
      console.error('[Dashboard] Failed to load historical data:', error);
      alert('Failed to load historical data');
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
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6">
        {/* Header Skeleton */}
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

        {/* Stats Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
          <SkeletonStatCard />
        </div>

        {/* Main Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard className="h-64" />
          <SkeletonCard className="h-64" />
        </div>

        {/* Additional Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
          <SkeletonCard className="h-48" />
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

  const userRole = user?.role as string;

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col relative">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 mb-3 sm:mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 flex-shrink-0 bg-white dark:bg-gray-900 py-2 -mx-2 px-2 rounded-lg border-b border-gray-200 dark:border-gray-700">
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
            onClick={() => {
              const data = {
                today: stats?.today,
                month: stats?.month,
                paymentBreakdown: stats?.paymentBreakdown,
                topProducts: stats?.topProducts,
              };
              exportToCSV({ data: [data], filename: `dashboard_export_${new Date().toISOString().split('T')[0]}.csv` });
            }}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors touch-target flex items-center gap-1"
            title="Export dashboard data"
          >
            <span>📥</span>
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors touch-target flex items-center gap-1"
            title="Refresh dashboard"
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span>
            <span className="hidden sm:inline">{loading && stats ? 'Updating...' : 'Refresh'}</span>
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

      {/* Key Metrics - Modern Console Style */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Quick Insights Bar */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl shadow-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">Performance</p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-100 mt-1">
                {stats.yesterday.revenue > 0 
                  ? `${((stats.today.revenue - stats.yesterday.revenue) / stats.yesterday.revenue * 100).toFixed(1)}%`
                  : 'N/A'}
              </p>
            </div>
            <span className="text-3xl">
              {stats.yesterday.revenue > 0 && stats.today.revenue > stats.yesterday.revenue ? '📈' : 
               stats.yesterday.revenue > 0 && stats.today.revenue < stats.yesterday.revenue ? '📉' : '➡️'}
            </span>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            {stats.yesterday.revenue > 0 && stats.today.revenue > stats.yesterday.revenue ? 'Up from yesterday' :
             stats.yesterday.revenue > 0 && stats.today.revenue < stats.yesterday.revenue ? 'Down from yesterday' :
             'No comparison data'}
          </p>
        </div>
        
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl shadow-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">Avg Order Value</p>
              <p className="text-lg font-bold text-green-900 dark:text-green-100 mt-1">
                ₹{stats.today.avgBill.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
            <span className="text-3xl">💎</span>
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            {stats.today.count > 0 ? `${stats.today.count} orders today` : 'No orders yet'}
          </p>
        </div>
        
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl shadow-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">Monthly Progress</p>
              <p className="text-lg font-bold text-purple-900 dark:text-purple-100 mt-1">
                {stats.month.count} sales
              </p>
            </div>
            <span className="text-3xl">🎯</span>
          </div>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
            ₹{stats.month.revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })} this month
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6 mb-6">
        {loading && stats ? (
          <>
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
            <SkeletonStatCard />
          </>
        ) : (
          <>
            <StatCard
              title="Today's Revenue"
              value={formatInrShort(stats.today.revenue)}
              subtitle={`${stats.today.count} sales today`}
              icon="💰"
              gradient="bg-gradient-to-br from-green-500 to-green-600"
              comparison={{
                label: 'vs yesterday',
                value: stats.yesterday.revenue,
                change: stats.yesterday.revenue > 0
                  ? ((stats.today.revenue - stats.yesterday.revenue) / stats.yesterday.revenue) * 100
                  : 0
              }}
            />
            <StatCard
              title="Today's Sales Count"
              value={stats.today.count}
              subtitle={`Avg: ${formatInrShort(stats.today.avgBill)}`}
              icon="📊"
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
              comparison={{
                label: 'vs yesterday',
                value: stats.yesterday.count,
                change: stats.yesterday.count > 0
                  ? ((stats.today.count - stats.yesterday.count) / stats.yesterday.count) * 100
                  : 0
              }}
            />
            <StatCard
              title="Pending Payments"
              value={formatInrShort(pendingPaymentsTotal)}
              subtitle={`${pendingPaymentsCount} pending orders`}
              icon="⏳"
              gradient="bg-gradient-to-br from-orange-500 to-orange-600"
            />
            <StatCard
              title="Monthly Revenue"
              value={formatInrShort(stats.month.revenue)}
              subtitle={`${stats.month.count} total sales`}
              icon="📈"
              gradient="bg-gradient-to-br from-purple-500 to-purple-600"
            />
          </>
        )}
      </div>

      {/* Quick Actions - above the fold */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 sm:p-4 lg:p-6 border border-gray-100 dark:border-gray-700">
        <h2 className="text-base sm:text-lg lg:text-xl font-bold dark:text-white mb-3 sm:mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {pendingPaymentsCount > 0 && (
            <Link
              href="/store/pending-payments"
              className="flex flex-col items-center justify-center p-3 sm:p-4 bg-orange-100 dark:bg-orange-900/30 rounded-xl hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors touch-target border-2 border-orange-300 dark:border-orange-700"
            >
              <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">⏳</span>
              <span className="font-medium text-xs sm:text-sm text-orange-700 dark:text-orange-300 text-center">Pending Payments</span>
              <span className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">{pendingPaymentsCount} order(s)</span>
            </Link>
          )}
          <Link
            href="/store/pos"
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-brand-50 dark:bg-brand-900/20 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors touch-target"
          >
            <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">🛒</span>
            <span className="font-medium text-xs sm:text-sm text-brand-600 dark:text-brand-400 text-center">New Sale</span>
          </Link>
          <Link
            href="/store/inventory"
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors touch-target"
          >
            <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📦</span>
            <span className="font-medium text-xs sm:text-sm text-blue-600 dark:text-blue-400 text-center">Inventory</span>
          </Link>
          <Link
            href="/store/stock-ledger"
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-green-50 dark:bg-green-900/20 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors touch-target"
          >
            <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📋</span>
            <span className="font-medium text-xs sm:text-sm text-green-600 dark:text-green-400 text-center">Stock Ledger</span>
          </Link>
          <Link
            href="/store/reports"
            className="flex flex-col items-center justify-center p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors touch-target"
          >
            <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📈</span>
            <span className="font-medium text-xs sm:text-sm text-purple-600 dark:text-purple-400 text-center">Reports</span>
          </Link>
        </div>
        {(user?.role === 'MANAGER' || user?.role === 'OWNER') && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">Manager Tools</h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <Link
                href="/store/wastage"
                className="flex flex-col items-center justify-center p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors touch-target"
              >
                <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">🗑️</span>
                <span className="font-medium text-xs sm:text-sm text-red-600 dark:text-red-400 text-center">Wastage Management</span>
              </Link>
              <Link
                href="/store/yield"
                className="flex flex-col items-center justify-center p-3 sm:p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors touch-target"
              >
                <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">📊</span>
                <span className="font-medium text-xs sm:text-sm text-orange-600 dark:text-orange-400 text-center">Yield Tracking</span>
              </Link>
            </div>
          </div>
        )}
        {user?.role === 'OWNER' && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3">Owner Tools</h3>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {(() => {
                const hqHref = getHQConsoleUrl();
                const isExternal = hqHref.startsWith('http');
                const className = 'flex flex-col items-center justify-center p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors touch-target';
                const content = (
                  <>
                    <span className="text-2xl sm:text-3xl mb-1 sm:mb-2">🏢</span>
                    <span className="font-medium text-xs sm:text-sm text-blue-600 dark:text-blue-400 text-center">HQ Console</span>
                  </>
                );
                if (isExternal) {
                  return (
                    <a
                      href={hqHref}
                      className={className}
                      onClick={(e) => {
                        if (typeof window !== 'undefined') {
                          const accessToken = localStorage.getItem('accessToken');
                          const refreshToken = localStorage.getItem('refreshToken');
                          if (accessToken) {
                            e.preventDefault();
                            const params = new URLSearchParams({ accessToken, refreshToken: refreshToken || '' });
                            window.location.href = `${hqHref}#${params.toString()}`;
                          }
                        }
                      }}
                    >
                      {content}
                    </a>
                  );
                }
                return (
                  <Link href={hqHref} className={className}>
                    {content}
                  </Link>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Historical Data Viewer */}
      {(userRole === 'MANAGER' || userRole === 'OWNER') && (
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-6 mb-6 border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
              <span className="text-2xl">📅</span>
              Historical Data
            </h2>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 dark:[color-scheme:dark]"
              />
              <button
                onClick={() => loadHistoricalData(selectedDate)}
                disabled={loading}
                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
              >
                {loading ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>

          {historicalData && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-4">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1 font-semibold">Total Sales</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{historicalData.salesCount}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">₹{Math.round(historicalData.totalRevenue).toLocaleString()}</p>
                </div>
                <div className="bg-orange-100 dark:bg-orange-900/30 rounded-lg p-4">
                  <p className="text-xs text-orange-600 dark:text-orange-400 mb-1 font-semibold">Pending</p>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">{historicalData.pendingCount}</p>
                  <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">₹{Math.round(historicalData.pendingAmount).toLocaleString()}</p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900/30 rounded-lg p-4 col-span-2 md:col-span-1">
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-1 font-semibold">Date</p>
                  <p className="text-lg font-bold text-purple-900 dark:text-purple-300">
                    {new Date(historicalData.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-400 mb-1">Cash</p>
                  <p className="text-xl font-bold text-green-900 dark:text-green-300">
                    ₹{Math.round(historicalData.paymentBreakdown.cash).toLocaleString()}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">UPI</p>
                  <p className="text-xl font-bold text-blue-900 dark:text-blue-300">
                    ₹{Math.round(historicalData.paymentBreakdown.upi).toLocaleString()}
                  </p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Card</p>
                  <p className="text-xl font-bold text-purple-900 dark:text-purple-300">
                    ₹{Math.round(historicalData.paymentBreakdown.card).toLocaleString()}
                  </p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                  <p className="text-xs text-orange-600 dark:text-orange-400 mb-1">Other</p>
                  <p className="text-xl font-bold text-orange-900 dark:text-orange-300">
                    ₹{Math.round(historicalData.paymentBreakdown.other).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!historicalData && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Select a date and click Load to view historical data
            </div>
          )}
        </div>
      )}

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

      {/* Payment Breakdown Box - Modern Design */}
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-6 mb-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
            <span className="text-2xl">💳</span>
            Today's Payment Breakdown
          </h2>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total: <span className="font-bold text-gray-900 dark:text-white">₹{Math.round(stats.paymentBreakdown.total).toLocaleString()}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white/90 uppercase tracking-wide">Cash</span>
              <span className="text-2xl">💵</span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">
              ₹{Math.round(stats.paymentBreakdown.cash).toLocaleString()}
            </p>
            <div className="flex items-center gap-2 text-white/80 text-xs">
              <span>{stats.paymentBreakdown.total > 0 ? ((stats.paymentBreakdown.cash / stats.paymentBreakdown.total) * 100).toFixed(1) : 0}%</span>
              <span>of total</span>
          </div>
            </div>
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white/90 uppercase tracking-wide">UPI</span>
              <span className="text-2xl">📱</span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">
              ₹{Math.round(stats.paymentBreakdown.upi).toLocaleString()}
            </p>
            <div className="flex items-center gap-2 text-white/80 text-xs">
              <span>{stats.paymentBreakdown.total > 0 ? ((stats.paymentBreakdown.upi / stats.paymentBreakdown.total) * 100).toFixed(1) : 0}%</span>
              <span>of total</span>
          </div>
            </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white/90 uppercase tracking-wide">Card</span>
              <span className="text-2xl">💳</span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">
              ₹{Math.round(stats.paymentBreakdown.card).toLocaleString()}
            </p>
            <div className="flex items-center gap-2 text-white/80 text-xs">
              <span>{stats.paymentBreakdown.total > 0 ? ((stats.paymentBreakdown.card / stats.paymentBreakdown.total) * 100).toFixed(1) : 0}%</span>
              <span>of total</span>
          </div>
            </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 shadow-lg hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white/90 uppercase tracking-wide">Other</span>
              <span className="text-2xl">🔄</span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">
              ₹{Math.round(stats.paymentBreakdown.other).toLocaleString()}
            </p>
            <div className="flex items-center gap-2 text-white/80 text-xs">
              <span>{stats.paymentBreakdown.total > 0 ? ((stats.paymentBreakdown.other / stats.paymentBreakdown.total) * 100).toFixed(1) : 0}%</span>
              <span>of total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      {(userRole === 'MANAGER' || userRole === 'OWNER') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue trend: real last 7 days from API, or 3-point comparison fallback */}
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <span className="text-2xl">📈</span>
                {salesTrendLast7.length > 0 ? "Last 7 Days Revenue" : "Revenue Comparison"}
              </h2>
              <button
                onClick={() => {
                  const chartData = salesTrendLast7.length > 0
                    ? salesTrendLast7.map((d) => ({ day: d.date, revenue: d.total }))
                    : [
                        { day: "Last week (same day)", revenue: stats.lastWeek.revenue },
                        { day: "Yesterday", revenue: stats.yesterday.revenue },
                        { day: "Today", revenue: stats.today.revenue },
                      ];
                  exportToCSV({ data: chartData, filename: `revenue_${new Date().toISOString().split("T")[0]}.csv` });
                }}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                📥 Export
              </button>
            </div>
            {(() => {
              const barData =
                salesTrendLast7.length > 0
                  ? salesTrendLast7.map((d) => {
                      const [, m, day] = d.date.split("-").map(Number);
                      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                      return { day: `${day} ${months[m - 1]}`, revenue: d.total };
                    })
                  : [
                      { day: "Last week", revenue: stats.lastWeek.revenue },
                      { day: "Yesterday", revenue: stats.yesterday.revenue },
                      { day: "Today", revenue: stats.today.revenue },
                    ];
              const hasRevenueData = barData.some((d) => d.revenue > 0);
              if (!hasRevenueData) {
                return (
                  <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-600 min-h-[300px]" aria-label="No revenue data">
                    <p className="text-gray-500 dark:text-gray-400 font-medium mb-2">No revenue data for this period</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Record sales to see trends here</p>
                    <Link href="/store/pos" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors">
                      Go to POS
                    </Link>
                  </div>
                );
              }
              return (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} aria-label="Revenue trend chart">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <YAxis
                      stroke="#6b7280"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      formatter={(value: any) => [`₹${Number(value).toLocaleString("en-IN")}`, "Revenue"]}
                      contentStyle={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()}
            <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
              <div className="text-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400 block mb-1">Last week</span>
                <span className="font-bold text-gray-900 dark:text-white">₹{stats.lastWeek.revenue.toLocaleString()}</span>
              </div>
              <div className="text-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <span className="text-gray-600 dark:text-gray-400 block mb-1">Yesterday</span>
                <span className="font-bold text-gray-900 dark:text-white">₹{stats.yesterday.revenue.toLocaleString()}</span>
              </div>
              <div className="text-center p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                <span className="text-brand-600 dark:text-brand-400 block mb-1">Today</span>
                <span className="font-bold text-brand-900 dark:text-brand-300">₹{stats.today.revenue.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Payment Method Pie Chart - Using Recharts */}
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <span className="text-2xl">🥧</span>
                Payment Distribution
              </h2>
              <button
                onClick={() => {
                  const paymentData = [
                    { method: 'Cash', amount: stats.paymentBreakdown.cash },
                    { method: 'UPI', amount: stats.paymentBreakdown.upi },
                    { method: 'Card', amount: stats.paymentBreakdown.card },
                    { method: 'Other', amount: stats.paymentBreakdown.other },
                  ];
                  exportToCSV({ data: paymentData, filename: `payment_distribution_${new Date().toISOString().split('T')[0]}.csv` });
                }}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                📥 Export
              </button>
            </div>
            {stats.paymentBreakdown.total <= 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-600 min-h-[300px]" aria-label="No payment data">
                <p className="text-gray-500 dark:text-gray-400 font-medium mb-2">No payments today</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Payment distribution will appear after sales</p>
                <Link href="/store/pos" className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors">
                  Go to POS
                </Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart aria-label="Payment distribution chart">
                  <Pie
                    data={[
                      { name: 'Cash', value: stats.paymentBreakdown.cash },
                      { name: 'UPI', value: stats.paymentBreakdown.upi },
                      { name: 'Card', value: stats.paymentBreakdown.card },
                      { name: 'Other', value: stats.paymentBreakdown.other },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#3b82f6" />
                    <Cell fill="#8b5cf6" />
                    <Cell fill="#f59e0b" />
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => `₹${value.toLocaleString('en-IN')}`}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="w-4 h-4 rounded-full bg-green-500"></div>
                <div className="flex-1">
                  <div className="text-xs text-gray-600 dark:text-gray-400">Cash</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    ₹{Math.round(stats.paymentBreakdown.cash).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                <div className="flex-1">
                  <div className="text-xs text-gray-600 dark:text-gray-400">UPI</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    ₹{Math.round(stats.paymentBreakdown.upi).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                <div className="flex-1">
                  <div className="text-xs text-gray-600 dark:text-gray-400">Card</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    ₹{Math.round(stats.paymentBreakdown.card).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                <div className="flex-1">
                  <div className="text-xs text-gray-600 dark:text-gray-400">Other</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    ₹{Math.round(stats.paymentBreakdown.other).toLocaleString()}
                  </div>
                </div>
              </div>
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
      </div>
    </div>
  );
}

