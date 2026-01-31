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
} from 'recharts';

const COLORS = ['#f97316', '#ea580c', '#facc15', '#eab308', '#fb923c'];

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
    // Wait for user to load
    if (user === undefined) {
      return; // Still loading
    }

    if (!user) {
      router.push('/login');
      return;
    }

    // Only OWNER can access analytics
    if (user.role !== 'OWNER') {
      alert('Access denied. Only Owners can access analytics.');
      router.push('/pos');
      return;
    }
  }, [user, router]);

  useEffect(() => {
    // Only load analytics if user is OWNER
    if (user && user.role === 'OWNER') {
      // Add a small delay to debounce rapid date changes
      const timer = setTimeout(() => {
        loadAnalytics();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [dateRange, user]);

  const loadAnalytics = async () => {
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
        trend: trend.data,
        items: items.data,
        heatmap: heatmap.data,
        payments: payments.data,
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

  return (
    <StoreLayout>
      <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-xl sm:text-2xl font-bold">Analytics</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm sm:text-base w-full sm:w-auto dark:[color-scheme:dark]"
          />
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm sm:text-base w-full sm:w-auto dark:[color-scheme:dark]"
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && salesTrend.length > 0 && (
        <div className="mb-4 p-4 bg-primary-50 border border-primary-200 rounded-md text-primary-700">
          <strong>Data loaded:</strong> {salesTrend.length} day(s) of sales data, {topItems.length} top items
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-bold mb-4">Sales Trend</h2>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Loading...
            </div>
          ) : salesTrend.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No sales data available for the selected period
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
              <YAxis />
                <Tooltip 
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString();
                  }}
                />
              <Legend />
                <Line type="monotone" dataKey="total" stroke="#f97316" name="Revenue (₹)" />
              <Line type="monotone" dataKey="count" stroke="#facc15" name="Count" />
            </LineChart>
          </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-bold mb-4">Top Items</h2>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Loading...
            </div>
          ) : topItems.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No items data available for the selected period
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topItems}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
                <Tooltip formatter={(value: any) => `₹${value ? value.toFixed(2) : '0.00'}`} />
                <Bar dataKey="revenue" fill="#f97316" name="Revenue (₹)" />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-bold mb-4">Time Heatmap</h2>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Loading...
            </div>
          ) : timeHeatmap.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No time-based data available for the selected period
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timeHeatmap}>
              <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" label={{ value: 'Hour', position: 'insideBottom', offset: -5 }} />
              <YAxis />
                <Tooltip formatter={(value: any) => `₹${value ? value.toFixed(2) : '0.00'}`} />
                <Bar dataKey="total" fill="#facc15" name="Revenue (₹)" />
            </BarChart>
          </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-bold mb-4">Payment Mix</h2>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Loading...
            </div>
          ) : paymentMix.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No payment data available for the selected period
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentMix}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : '0'}%`}
                outerRadius={80}
                fill="#f97316"
                dataKey="total"
              >
                {paymentMix.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
                <Tooltip formatter={(value: any) => `₹${value ? value.toFixed(2) : '0.00'}`} />
            </PieChart>
          </ResponsiveContainer>
          )}
        </div>
      </div>

      {deliveryKPIs && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-bold mb-4">Delivery KPIs</h2>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Total Deliveries</div>
              <div className="text-2xl font-bold">{deliveryKPIs.total || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Delivered</div>
              <div className="text-2xl font-bold text-accent-600">{deliveryKPIs.delivered || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Success Rate</div>
              <div className="text-2xl font-bold">{deliveryKPIs.successRate ? deliveryKPIs.successRate.toFixed(1) : '0.0'}%</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Avg Delivery Time</div>
              <div className="text-2xl font-bold">{deliveryKPIs.avgDeliveryTimeMinutes || 0} min</div>
            </div>
          </div>
        </div>
      )}
    </StoreLayout>
  );
}

