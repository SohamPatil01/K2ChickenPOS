'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { tallyPaymentsFromSales } from '@azela-pos/shared';
import api from '@/lib/api';
import { SimpleLineChart, SimpleBarChart, SimplePieChart } from '@/components/charts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

interface ProfitMarginSummary {
  totalSales: number;
  totalPurchases: number;
  expensesLabel: string;
  netProfit: number;
  profitMarginPct: number;
  productsMissingCost: number;
  paidOrderCount?: number;
  lineItemRevenue?: number;
}

interface AnalyticsData {
  salesTrend: Array<{ name: string; value: number }>;
  productPerformance: Array<{ name: string; value: number }>;
  categoryDistribution: Array<{ name: string; value: number }>;
  paymentMethods: Array<{ name: string; value: number }>;
  hourlyPattern: Array<{ name: string; value: number }>;
  weeklyPattern: Array<{ name: string; value: number }>;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [profitSummary, setProfitSummary] = useState<ProfitMarginSummary | null>(null);

  const canViewProfit =
    user?.role === 'OWNER' || user?.role === 'MANAGER';

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadAnalytics();
  }, [user, router, dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch sales data
      const salesResponse = await api.get('/api/v1/sales', {
        params: {
          startDate: dateRange.start,
          endDate: dateRange.end,
          status: 'PAID',
          limit: '10000',
        },
      });

      const sales = (salesResponse.data || []).filter(
        (s: { status?: string }) => s.status === 'PAID'
      );

      // Process data for charts
      const analyticsData = processAnalyticsData(sales);
      setAnalytics(analyticsData);

      if (canViewProfit) {
        try {
          const marginRes = await api.get('/api/v1/analytics/profit-margin', {
            params: {
              startDate: dateRange.start,
              endDate: dateRange.end,
            },
          });
          setProfitSummary(marginRes.data?.summary ?? null);
        } catch {
          setProfitSummary(null);
        }
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = (sales: any[]): AnalyticsData => {
    // Sales trend by date
    const salesByDate: Record<string, number> = {};
    sales.forEach(sale => {
      const date = format(new Date(sale.createdAt), 'MMM dd');
      salesByDate[date] = (salesByDate[date] || 0) + (sale.grandTotal || 0);
    });
    const salesTrend = Object.entries(salesByDate).map(([name, value]) => ({ name, value }));

    // Product performance
    const productSales: Record<string, number> = {};
    sales.forEach(sale => {
      sale.items?.forEach((item: any) => {
        const productName = item.product?.name || 'Unknown';
        productSales[productName] = (productSales[productName] || 0) + (item.lineTotal || 0);
      });
    });
    const productPerformance = Object.entries(productSales)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));

    // Category distribution
    const categorySales: Record<string, number> = {};
    sales.forEach(sale => {
      sale.items?.forEach((item: any) => {
        const category = item.product?.category?.name || 'Uncategorized';
        categorySales[category] = (categorySales[category] || 0) + (item.lineTotal || 0);
      });
    });
    const categoryDistribution = Object.entries(categorySales).map(([name, value]) => ({ name, value }));

    // Payment methods (ONLINE rolled into UPI for tally)
    const tallied = tallyPaymentsFromSales(sales);
    const paymentMethods = [
      { name: 'Cash', value: tallied.cash },
      { name: 'UPI', value: tallied.upi },
      { name: 'Card', value: tallied.card },
      ...(tallied.credit > 0 ? [{ name: 'Credit', value: tallied.credit }] : []),
      ...(tallied.other > 0 ? [{ name: 'Other', value: tallied.other }] : []),
    ].filter((r) => r.value > 0);

    // Hourly pattern
    const hourlySales: Record<string, number> = {};
    sales.forEach(sale => {
      const hour = new Date(sale.createdAt).getHours();
      const hourLabel = `${hour}:00`;
      hourlySales[hourLabel] = (hourlySales[hourLabel] || 0) + (sale.grandTotal || 0);
    });
    const hourlyPattern = Object.entries(hourlySales)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([name, value]) => ({ name, value }));

    // Weekly pattern
    const weeklySales: Record<string, number> = {
      'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0
    };
    sales.forEach(sale => {
      const dayName = format(new Date(sale.createdAt), 'EEE');
      weeklySales[dayName] = (weeklySales[dayName] || 0) + (sale.grandTotal || 0);
    });
    const weeklyPattern = Object.entries(weeklySales).map(([name, value]) => ({ name, value }));

    return {
      salesTrend,
      productPerformance,
      categoryDistribution,
      paymentMethods,
      hourlyPattern,
      weeklyPattern,
    };
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Detailed insights and visualizations
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      {canViewProfit && profitSummary && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Profit margin tracker
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Net profit = sales − purchases (expenses not tracked yet)
              </p>
            </div>
            <Link
              href="/store/analytics/advanced"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              View product breakdown →
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Sales</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {formatINR(profitSummary.totalSales)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Purchases</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {formatINR(profitSummary.totalPurchases)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Expenses</p>
              <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {profitSummary.expensesLabel}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Net profit</p>
              <p
                className={`text-xl font-bold mt-1 ${
                  profitSummary.netProfit >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {formatINR(profitSummary.netProfit)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs uppercase text-gray-500 dark:text-gray-400">Margin %</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {profitSummary.profitMarginPct.toFixed(1)}%
              </p>
            </div>
          </div>
          {profitSummary.productsMissingCost > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              ⚠ {profitSummary.productsMissingCost} product(s) sold without PO cost data — see
              Advanced Analytics for details.
            </p>
          )}
          {profitSummary.paidOrderCount != null && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Based on {profitSummary.paidOrderCount} paid order(s) in range (same rules as Sales
              Overview: business date when set, otherwise bill date).
            </p>
          )}
        </div>
      )}

      {/* Charts Grid */}
      {analytics && (
        <>
          {/* Sales Trend */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <SimpleLineChart
              data={analytics.salesTrend}
              dataKey="value"
              xAxisKey="name"
              title="Sales Trend"
              height={300}
              lineColor="#3b82f6"
            />
          </div>

          {/* Product & Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <SimpleBarChart
                data={analytics.productPerformance}
                dataKey="value"
                xAxisKey="name"
                title="Top 10 Products by Revenue"
                height={300}
                barColor="#10b981"
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <SimplePieChart
                data={analytics.categoryDistribution}
                title="Category Distribution"
                height={300}
              />
            </div>
          </div>

          {/* Payment Methods & Weekly Pattern */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <SimplePieChart
                data={analytics.paymentMethods}
                title="Payment Methods"
                height={300}
              />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <SimpleBarChart
                data={analytics.weeklyPattern}
                dataKey="value"
                xAxisKey="name"
                title="Sales by Day of Week"
                height={300}
                barColor="#8b5cf6"
              />
            </div>
          </div>

          {/* Hourly Pattern */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <SimpleBarChart
              data={analytics.hourlyPattern}
              dataKey="value"
              xAxisKey="name"
              title="Sales by Hour"
              height={300}
              barColor="#f59e0b"
            />
          </div>
        </>
      )}
    </div>
  );
}

