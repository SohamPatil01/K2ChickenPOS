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
    
    // Periodic refresh as fallback (every 30 seconds)
    const refreshInterval = setInterval(() => {
      loadDashboard();
    }, 30000);
    
    return () => {
      window.removeEventListener('sale-created', handleSaleCreated);
      window.removeEventListener('sale-updated', handleSaleUpdated);
      window.removeEventListener('sale-deleted', handleSaleDeleted);
      clearInterval(refreshInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const userRole = user?.role as string;
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

      // Also get today's detailed stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const salesRes = await api.get('/api/v1/sales', {
        params: {
          startDate: today.toISOString(),
          endDate: tomorrow.toISOString(),
        },
      }).catch(() => ({ data: [] }));

      const todaySales = salesRes.data || [];
      const paidSales = todaySales.filter((s: any) => s.status === 'PAID');

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

      const totalPayments = paymentBreakdown.cash + paymentBreakdown.upi + paymentBreakdown.card + paymentBreakdown.other;

      // Calculate stats
      const todayRevenue = paidSales.reduce((sum: number, s: any) => sum + s.grandTotal, 0);
      const todayWeight = paidSales.reduce((sum: number, s: any) => {
        return sum + (s.items || []).reduce((itemSum: number, item: any) => {
          return itemSum + (item.qtyKg || 0) + (item.qtyPcs || 0);
        }, 0);
      }, 0);

      // Get stock info
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

      setStats({
        today: dashboardData?.today || {
          revenue: todayRevenue,
          count: paidSales.length,
          avgBill: paidSales.length > 0 ? todayRevenue / paidSales.length : 0,
        },
        month: dashboardData?.month || {
          revenue: 0,
          count: 0,
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
      });
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
      alert(error.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Loading dashboard...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Failed to load dashboard</p>
      </div>
    );
  }

  const StatCard = ({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle?: string; icon: string }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-4 sm:p-5 lg:p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white mt-1 sm:mt-2 truncate">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{subtitle}</p>}
        </div>
        <div className="text-2xl sm:text-3xl lg:text-4xl flex-shrink-0 ml-2">{icon}</div>
      </div>
    </div>
  );

  const userRole = user?.role as string;

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col">
      <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold dark:text-white">
            {userRole === 'OWNER' ? 'Admin Console' : userRole === 'MANAGER' ? 'Manager Console' : 'Store Dashboard'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">Welcome, {user?.name}</p>
        </div>
        {userRole && (
          <div className="px-3 sm:px-4 py-1.5 sm:py-2 bg-brand-100 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-lg font-medium text-xs sm:text-sm lg:text-base flex-shrink-0 touch-target">
            {userRole}
          </div>
        )}
      </div>

      {/* Key Metrics - Console Style */}
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
        <StatCard
          title="Today's Revenue"
          value={`₹${stats.today.revenue.toFixed(2)}`}
          subtitle={`${stats.today.count} sales`}
          icon="💰"
        />
        <StatCard
          title="Today's Sales"
          value={stats.today.count}
          subtitle={`Avg: ₹${stats.today.avgBill.toFixed(2)}`}
          icon="📊"
        />
        <StatCard
          title="This Month"
          value={`₹${stats.month.revenue.toFixed(2)}`}
          subtitle={`${stats.month.count} total sales`}
          icon="📈"
        />
      </div>

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

