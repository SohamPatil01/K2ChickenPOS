'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { SimpleLineChart, SimpleBarChart, SimplePieChart } from '@/components/charts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

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
        },
      });

      const sales = salesResponse.data || [];

      // Process data for charts
      const analyticsData = processAnalyticsData(sales);
      setAnalytics(analyticsData);
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

    // Payment methods
    const paymentMethodSales: Record<string, number> = {};
    sales.forEach(sale => {
      sale.payments?.forEach((payment: any) => {
        paymentMethodSales[payment.method] = (paymentMethodSales[payment.method] || 0) + (payment.amount || 0);
      });
    });
    const paymentMethods = Object.entries(paymentMethodSales).map(([name, value]) => ({ name, value }));

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

