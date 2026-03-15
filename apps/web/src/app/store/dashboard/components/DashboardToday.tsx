'use client';

import Link from 'next/link';
import {
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
import { exportToCSV } from '@/lib/exportCSV';
import type { DashboardStats } from '../hooks/useDashboardStats';

interface DashboardTodayProps {
  stats: DashboardStats;
  salesTrendLast7: Array<{ date: string; total: number }>;
  userRole: string;
}

export default function DashboardToday({
  stats,
  salesTrendLast7,
  userRole,
}: DashboardTodayProps) {
  const barData =
    salesTrendLast7.length > 0
      ? salesTrendLast7.map((d) => {
          const [, m, day] = d.date.split('-').map(Number);
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return { day: `${day} ${months[(m || 1) - 1]}`, revenue: d.total };
        })
      : [
          { day: 'Last week', revenue: stats.lastWeek.revenue },
          { day: 'Yesterday', revenue: stats.yesterday.revenue },
          { day: 'Today', revenue: stats.today.revenue },
        ];
  const hasRevenueData = barData.some((d) => d.revenue > 0);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
            <span className="text-2xl">💳</span>
            Today&apos;s Payment Breakdown
          </h2>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Total:{' '}
            <span className="font-bold text-gray-900 dark:text-white">
              ₹{Math.round(stats.paymentBreakdown.total).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { key: 'cash', label: 'Cash', emoji: '💵', value: stats.paymentBreakdown.cash },
            { key: 'upi', label: 'UPI', emoji: '📱', value: stats.paymentBreakdown.upi },
            { key: 'card', label: 'Card', emoji: '💳', value: stats.paymentBreakdown.card },
            { key: 'other', label: 'Other', emoji: '🔄', value: stats.paymentBreakdown.other },
          ].map(({ key, label, emoji, value }) => (
            <div
              key={key}
              className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-xl p-5 shadow-lg"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  {label}
                </span>
                <span className="text-2xl">{emoji}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ₹{Math.round(value).toLocaleString()}
              </p>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400 text-xs mt-1">
                <span>
                  {stats.paymentBreakdown.total > 0
                    ? ((value / stats.paymentBreakdown.total) * 100).toFixed(1)
                    : 0}
                  %
                </span>
                <span>of total</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {(userRole === 'MANAGER' || userRole === 'OWNER') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <span className="text-2xl">📈</span>
                {salesTrendLast7.length > 0 ? 'Last 7 Days Revenue' : 'Revenue Comparison'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  const chartData =
                    salesTrendLast7.length > 0
                      ? salesTrendLast7.map((d) => ({ day: d.date, revenue: d.total }))
                      : [
                          { day: 'Last week (same day)', revenue: stats.lastWeek.revenue },
                          { day: 'Yesterday', revenue: stats.yesterday.revenue },
                          { day: 'Today', revenue: stats.today.revenue },
                        ];
                  exportToCSV({
                    data: chartData,
                    filename: `revenue_${new Date().toISOString().split('T')[0]}.csv`,
                  });
                }}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                📥 Export
              </button>
            </div>
            {!hasRevenueData ? (
              <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-600 min-h-[300px]">
                <p className="text-gray-500 dark:text-gray-400 font-medium mb-2">No revenue data for this period</p>
                <Link
                  href="/store/pos"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Go to POS
                </Link>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="day" stroke="#6b7280" tick={{ fontSize: 11 }} />
                    <YAxis
                      stroke="#6b7280"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-6 grid grid-cols-3 gap-3 text-xs">
                  <div className="text-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <span className="text-gray-600 dark:text-gray-400 block mb-1">Last week</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      ₹{stats.lastWeek.revenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-center p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <span className="text-gray-600 dark:text-gray-400 block mb-1">Yesterday</span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      ₹{stats.yesterday.revenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-center p-2 bg-brand-100 dark:bg-brand-900/30 rounded-lg">
                    <span className="text-brand-600 dark:text-brand-400 block mb-1">Today</span>
                    <span className="font-bold text-brand-900 dark:text-brand-300">
                      ₹{stats.today.revenue.toLocaleString()}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold dark:text-white flex items-center gap-2">
                <span className="text-2xl">🥧</span>
                Payment Distribution
              </h2>
              <button
                type="button"
                onClick={() => {
                  const paymentData = [
                    { method: 'Cash', amount: stats.paymentBreakdown.cash },
                    { method: 'UPI', amount: stats.paymentBreakdown.upi },
                    { method: 'Card', amount: stats.paymentBreakdown.card },
                    { method: 'Other', amount: stats.paymentBreakdown.other },
                  ];
                  exportToCSV({
                    data: paymentData,
                    filename: `payment_distribution_${new Date().toISOString().split('T')[0]}.csv`,
                  });
                }}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                📥 Export
              </button>
            </div>
            {stats.paymentBreakdown.total <= 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-600 min-h-[300px]">
                <p className="text-gray-500 dark:text-gray-400 font-medium mb-2">No payments today</p>
                <Link
                  href="/store/pos"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Go to POS
                </Link>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
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
                      formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Cash', value: stats.paymentBreakdown.cash, bg: 'bg-green-50 dark:bg-green-900/20' },
                    { label: 'UPI', value: stats.paymentBreakdown.upi, bg: 'bg-blue-50 dark:bg-blue-900/20' },
                    { label: 'Card', value: stats.paymentBreakdown.card, bg: 'bg-purple-50 dark:bg-purple-900/20' },
                    { label: 'Other', value: stats.paymentBreakdown.other, bg: 'bg-orange-50 dark:bg-orange-900/20' },
                  ].map(({ label, value, bg }) => (
                    <div key={label} className={`flex items-center gap-2 p-2 ${bg} rounded-lg`}>
                      <div className="w-4 h-4 rounded-full bg-current opacity-60" />
                      <div className="flex-1">
                        <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          ₹{Math.round(value).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-3 sm:p-4 lg:p-6">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg lg:text-xl font-semibold dark:text-white">Recent Sales</h2>
            <Link
              href="/store/pos"
              className="text-brand-600 dark:text-brand-400 text-xs sm:text-sm hover:underline touch-target"
            >
              Go to POS →
            </Link>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {stats.recentSales.length > 0 ? (
              stats.recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex justify-between items-center p-2.5 sm:p-3 bg-gray-50 dark:bg-gray-700 rounded gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs sm:text-sm dark:text-white truncate">
                      {sale.customerName ?? 'Walk-in'}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {sale.saleNo} • {sale.itemCount} items
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-sm sm:text-base dark:text-white">
                      ₹{sale.grandTotal.toFixed(2)}
                    </p>
                    <p
                      className={`text-xs ${
                        sale.status === 'PAID'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-yellow-600 dark:text-yellow-400'
                      }`}
                    >
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

        {(userRole === 'MANAGER' || userRole === 'OWNER') && stats.topItems.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-3 sm:p-4 lg:p-6">
            <div className="flex justify-between items-center mb-3 sm:mb-4">
              <h2 className="text-base sm:text-lg lg:text-xl font-semibold dark:text-white">
                Top Products (Last 7 Days)
              </h2>
              <Link
                href="/store/reports"
                className="text-brand-600 dark:text-brand-400 text-xs sm:text-sm hover:underline touch-target"
              >
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {stats.topItems.slice(0, 5).map((item, idx) => (
                <div
                  key={item.productId}
                  className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded"
                >
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
            <h2 className="text-base sm:text-lg lg:text-xl font-bold dark:text-white mb-3 sm:mb-4">
              Top Products Today
            </h2>
            <div className="space-y-3">
              {stats.topProducts.length > 0 ? (
                stats.topProducts.map((product, index) => (
                  <div
                    key={product.productId}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-md"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400 dark:text-gray-500">#{index + 1}</span>
                      <div>
                        <p className="font-medium dark:text-white">{product.productName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {product.qtySold.toFixed(2)} units
                        </p>
                      </div>
                    </div>
                    <p className="font-bold text-brand-600 dark:text-brand-400">
                      ₹{product.revenue.toLocaleString()}
                    </p>
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
  );
}
