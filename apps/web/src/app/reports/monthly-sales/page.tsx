'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  downloadStyledReportBundle,
  formatCurrency,
} from '@/lib/reportExport';
import api from '@/lib/api';

interface MonthRow {
  month: string;
  label: string;
  totalSales: number;
  totalRevenue: number;
  avgBillSize: number;
  distinctCustomers: number;
  distinctProducts: number;
  topProducts: { productId: string; name: string; qty: number; revenue: number }[];
}

function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-gray-400">—</span>;
  const up = value >= 0;
  return (
    <span className={`text-xs font-semibold ${up ? 'text-green-600' : 'text-red-600'}`}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

export default function MonthlySalesReportPage() {
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [monthsCount, setMonthsCount] = useState(6);

  useEffect(() => {
    loadData(monthsCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsCount]);

  const loadData = async (count: number) => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/reports/monthly-sales', {
        params: { months: count },
      });
      setMonths(response.data.months || []);
    } catch (error) {
      console.error('Failed to load monthly sales report:', error);
    } finally {
      setLoading(false);
    }
  };

  const latest = months[months.length - 1];
  const previous = months.length > 1 ? months[months.length - 2] : null;

  const handleExport = () => {
    if (!months.length) return;
    downloadStyledReportBundle({
      title: 'Monthly Sales Comparison',
      filename: `monthly-sales-comparison-last-${monthsCount}-months`,
      period: `Last ${monthsCount} months`,
      summary: latest
        ? [
            { label: 'Latest Month', value: latest.label },
            { label: 'Revenue', value: formatCurrency(latest.totalRevenue) },
            { label: 'Avg Bill Size', value: formatCurrency(latest.avgBillSize) },
            { label: 'Customers', value: String(latest.distinctCustomers) },
          ]
        : [],
      tables: [
        {
          title: 'Monthly Sales',
          headers: ['Month', 'Orders', 'Revenue', 'Avg Bill', 'Customers', 'Top Product'],
          columnAlign: ['left', 'right', 'right', 'right', 'right', 'left'],
          rows: months.map((m) => ({
            kind: 'data' as const,
            cells: [
              m.label,
              m.totalSales,
              formatCurrency(m.totalRevenue),
              formatCurrency(m.avgBillSize),
              m.distinctCustomers,
              m.topProducts[0]?.name || '—',
            ],
          })),
        },
      ],
    });
  };

  return (
    <Layout>
      <ReportLayout
        title="Monthly Sales Comparison"
        dateRange={false}
        exportable={true}
        onExport={handleExport}
      >
        <div className="mb-6 flex items-center gap-2">
          <label className="text-sm text-gray-700 dark:text-gray-300">Months:</label>
          <select
            value={monthsCount}
            onChange={(e) => setMonthsCount(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
          >
            <option value={3}>3</option>
            <option value={6}>6</option>
            <option value={12}>12</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading data...</div>
        ) : months.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No data available.</div>
        ) : (
          <>
            {/* Latest vs previous month comparison */}
            {latest && (
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-primary-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Revenue ({latest.label})
                  </div>
                  <div className="text-2xl font-bold dark:text-white">
                    {formatCurrency(latest.totalRevenue)}
                  </div>
                  <ChangeBadge
                    value={previous ? pctChange(latest.totalRevenue, previous.totalRevenue) : null}
                  />
                </div>
                <div className="p-4 bg-primary-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Avg Bill Size</div>
                  <div className="text-2xl font-bold dark:text-white">
                    {formatCurrency(latest.avgBillSize)}
                  </div>
                  <ChangeBadge
                    value={previous ? pctChange(latest.avgBillSize, previous.avgBillSize) : null}
                  />
                </div>
                <div className="p-4 bg-primary-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Customers</div>
                  <div className="text-2xl font-bold dark:text-white">{latest.distinctCustomers}</div>
                  <ChangeBadge
                    value={
                      previous
                        ? pctChange(latest.distinctCustomers, previous.distinctCustomers)
                        : null
                    }
                  />
                </div>
              </div>
            )}

            {/* Revenue by month */}
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-4 dark:text-white">Revenue by Month</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Bar
                    dataKey="totalRevenue"
                    fill="#f97316"
                    name="Revenue"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly table */}
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-4 dark:text-white">Month-by-Month Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Month</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Orders</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Revenue</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Avg Bill</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Customers</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Top Product</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {months.map((m) => (
                      <tr key={m.month}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{m.label}</td>
                        <td className="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-300">{m.totalSales}</td>
                        <td className="px-6 py-4 text-sm text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(m.totalRevenue)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-300">
                          {formatCurrency(m.avgBillSize)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-500 dark:text-gray-300">
                          {m.distinctCustomers}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-300">
                          {m.topProducts[0]?.name || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </ReportLayout>
    </Layout>
  );
}
