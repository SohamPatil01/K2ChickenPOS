'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import StoreLayout from '@/components/StoreLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

const COLORS = ['#f97316', '#ea580c', '#facc15', '#eab308', '#fb923c', '#fdba74'];

export default function AnalyticsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [salesTrend, setSalesTrend] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [timeHeatmap, setTimeHeatmap] = useState([]);
  const [paymentMix, setPaymentMix] = useState([]);
  const [deliveryKPIs, setDeliveryKPIs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (user === undefined) {
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'OWNER') {
      alert('Access denied. Only Owners can access analytics.');
      router.push('/pos');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    if (user && user.role === 'OWNER') {
      const timer = setTimeout(() => {
        loadAnalytics();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [dateRange, user]);

  const loadAnalytics = async () => {
    if (!user?.storeId) {
      setError('Store ID is missing. Please log in again.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    const params = {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    };
    
    console.log('Loading analytics with params:', params);

    try {
      const [trend, items, heatmap, payments, kpis] = await Promise.all([
        api.get('/api/v1/analytics/sales-trend', { params }).catch((err) => {
          console.error('Sales trend error:', err);
          return { data: [] };
        }),
        api.get('/api/v1/analytics/top-items', { params }).catch((err) => {
          console.error('Top items error:', err);
          return { data: [] };
        }),
        api.get('/api/v1/analytics/time-heatmap', { params }).catch((err) => {
          console.error('Time heatmap error:', err);
          return { data: [] };
        }),
        api.get('/api/v1/analytics/payment-mix', { params }).catch((err) => {
          console.error('Payment mix error:', err);
          return { data: [] };
        }),
        api.get('/api/v1/analytics/delivery-kpis', { params }).catch((err) => {
          console.error('Delivery KPIs error:', err);
          return { data: null };
        }),
      ]);

      console.log('Analytics data received:', {
        trend: trend.data?.length,
        items: items.data?.length,
        heatmap: heatmap.data?.length,
        payments: payments.data?.length,
        kpis: kpis.data,
      });

      setSalesTrend(trend.data || []);
      setTopItems((items.data || []).slice(0, 10));
      setTimeHeatmap(heatmap.data || []);
      setPaymentMix(payments.data || []);
      setDeliveryKPIs(kpis.data);
    } catch (error: any) {
      console.error('Failed to load analytics:', error);
      setError(error?.response?.data?.error || error?.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate summary stats
  const totalRevenue = salesTrend.reduce((sum: number, day: any) => sum + (day.total || 0), 0);
  const totalOrders = salesTrend.reduce((sum: number, day: any) => sum + (day.count || 0), 0);
  const avgDailyRevenue = salesTrend.length > 0 ? totalRevenue / salesTrend.length : 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Calculate growth (comparing first half vs second half of period)
  const midPoint = Math.floor(salesTrend.length / 2);
  const firstHalfRevenue = salesTrend.slice(0, midPoint).reduce((sum: number, day: any) => sum + (day.total || 0), 0);
  const secondHalfRevenue = salesTrend.slice(midPoint).reduce((sum: number, day: any) => sum + (day.total || 0), 0);
  const growth = firstHalfRevenue > 0 ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 : 0;

  return (
    <StoreLayout>
      <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Analytics Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Comprehensive sales insights and performance metrics
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm dark:[color-scheme:dark]"
            />
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm dark:[color-scheme:dark]"
            />
            <button
              onClick={loadAnalytics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Revenue</p>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                  ₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="text-4xl">💰</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-6 border border-green-200 dark:border-green-800 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">Total Orders</p>
                <p className="text-3xl font-bold text-green-900 dark:text-green-100 mt-2">
                  {totalOrders.toLocaleString()}
                </p>
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Avg Daily Revenue</p>
                <p className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-2">
                  ₹{avgDailyRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-6 border border-orange-200 dark:border-orange-800 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Avg Order Value</p>
                <p className="text-3xl font-bold text-orange-900 dark:text-orange-100 mt-2">
                  ₹{avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>
              <div className="text-4xl">🛒</div>
            </div>
          </div>
        </div>

        {/* Growth Indicator */}
        {salesTrend.length > 1 && (
          <div className={`p-4 rounded-lg border ${
            growth > 0 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
              : growth < 0
              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{growth > 0 ? '📈' : growth < 0 ? '📉' : '➡️'}</span>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {growth > 0 ? 'Growth' : growth < 0 ? 'Decline' : 'Stable'} Trend
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.abs(growth).toFixed(1)}% change comparing first half vs second half of period
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Trend Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Sales Trend</h2>
            {loading ? (
              <div className="h-[350px] flex items-center justify-center text-gray-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : salesTrend.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-lg mb-2">No sales data available</p>
                  <p className="text-sm">Try selecting a different date range</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={salesTrend}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                    stroke="#6b7280"
                  />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    labelFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    }}
                    formatter={(value: any) => `₹${value?.toLocaleString('en-IN') || '0'}`}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#f97316" 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                    name="Revenue (₹)" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#facc15" 
                    strokeWidth={2}
                    name="Orders" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top Items Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Top Selling Items</h2>
            {loading ? (
              <div className="h-[350px] flex items-center justify-center text-gray-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : topItems.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-lg mb-2">No items data available</p>
                  <p className="text-sm">Try selecting a different date range</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topItems} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" stroke="#6b7280" />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={120}
                    tick={{ fontSize: 12 }}
                    stroke="#6b7280"
                  />
                  <Tooltip 
                    formatter={(value: any) => `₹${value ? value.toLocaleString('en-IN') : '0'}`}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Bar dataKey="revenue" fill="#f97316" name="Revenue (₹)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Time Heatmap */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Hourly Sales Pattern</h2>
            {loading ? (
              <div className="h-[350px] flex items-center justify-center text-gray-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : timeHeatmap.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-lg mb-2">No time-based data available</p>
                  <p className="text-sm">Try selecting a different date range</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={timeHeatmap}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="hour" 
                    label={{ value: 'Hour of Day', position: 'insideBottom', offset: -5 }}
                    stroke="#6b7280"
                  />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    formatter={(value: any) => `₹${value ? value.toLocaleString('en-IN') : '0'}`}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Bar dataKey="total" fill="#facc15" name="Revenue (₹)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Payment Mix */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Payment Methods</h2>
            {loading ? (
              <div className="h-[350px] flex items-center justify-center text-gray-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : paymentMix.length === 0 ? (
              <div className="h-[350px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <p className="text-lg mb-2">No payment data available</p>
                  <p className="text-sm">Try selecting a different date range</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={paymentMix}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : '0'}%`}
                    outerRadius={100}
                    fill="#f97316"
                    dataKey="total"
                  >
                    {paymentMix.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => `₹${value ? value.toLocaleString('en-IN') : '0'}`}
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Delivery KPIs */}
        {deliveryKPIs && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Delivery Performance</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Deliveries</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{deliveryKPIs.total || 0}</div>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Delivered</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{deliveryKPIs.delivered || 0}</div>
              </div>
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {deliveryKPIs.successRate ? deliveryKPIs.successRate.toFixed(1) : '0.0'}%
                </div>
              </div>
              <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Avg Delivery Time</div>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {deliveryKPIs.avgDeliveryTimeMinutes || 0} min
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </StoreLayout>
  );
}
