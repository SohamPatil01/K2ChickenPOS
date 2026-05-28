'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { useState, useEffect, Fragment } from 'react';
import { defaultDateRangeLast7Days } from '@/lib/dateRangeParams';
import api from '@/lib/api';

interface DailyProductRow {
  date: string;
  productId: string;
  productName: string;
  sku: string;
  category: string;
  unitType: string;
  qtyKg: number;
  qtyPcs: number;
  revenue: number;
  lineCount: number;
}

interface ReportPayload {
  period: { startDate: string; endDate: string };
  summary: {
    totalRevenue: number;
    totalQtyKg: number;
    totalQtyPcs: number;
    productDayCount: number;
    daysCount: number;
  };
  rows: DailyProductRow[];
}

export default function DailyProductTransactionPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportPayload | null>(null);
  const defaultRange = defaultDateRangeLast7Days();
  const [startDate, setStartDate] = useState(defaultRange.start);
  const [endDate, setEndDate] = useState(defaultRange.end);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const effectiveStartDate = start !== undefined ? start : startDate;
      const effectiveEndDate = end !== undefined ? end : endDate;

      const response = await api.get('/api/v1/reports/daily-product-transaction', {
        params: { startDate: effectiveStartDate, endDate: effectiveEndDate },
      });

      setData(response.data || null);
    } catch (error: any) {
      console.error('Failed to load daily product transaction report:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    loadData(start, end);
  };

  const rows = data?.rows || [];

  const handleExport = () => {
    const csv = [
      ['Date', 'Product', 'SKU', 'Category', 'Unit', 'Qty (KG)', 'Qty (PCS)', 'Revenue', 'Line Items'],
      ...rows.map((item) => [
        item.date,
        `"${item.productName.replace(/"/g, '""')}"`,
        item.sku,
        `"${(item.category || '').replace(/"/g, '""')}"`,
        item.unitType,
        item.qtyKg,
        item.qtyPcs,
        item.revenue,
        item.lineCount,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-product-transaction-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  const formatDate = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  let lastDate = '';

  return (
    <Layout>
      <ReportLayout
        title="Daily Product Transaction Report"
        dateRange={true}
        onDateRangeChange={handleDateChange}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading data...</div>
        ) : !data || rows.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No transaction data for the selected period.
          </div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Days with sales</div>
                  <div className="text-2xl font-bold dark:text-white">{data.summary.daysCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Product-day rows</div>
                  <div className="text-2xl font-bold dark:text-white">{data.summary.productDayCount}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Qty (KG / PCS)</div>
                  <div className="text-lg font-bold dark:text-white">
                    {data.summary.totalQtyKg.toFixed(2)} / {data.summary.totalQtyPcs}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</div>
                  <div className="text-2xl font-bold dark:text-white">
                    ₹{data.summary.totalRevenue.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Qty (KG)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Qty (PCS)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Revenue
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Lines
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {rows.map((item) => {
                    const showDateHeader = item.date !== lastDate;
                    lastDate = item.date;
                    return (
                      <Fragment key={`${item.date}-${item.productId}`}>
                        {showDateHeader && (
                          <tr className="bg-brand-50/60 dark:bg-brand-900/20">
                            <td
                              colSpan={8}
                              className="px-4 py-2 text-sm font-semibold text-brand-800 dark:text-brand-200"
                            >
                              {formatDate(item.date)}
                            </td>
                          </tr>
                        )}
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{item.date}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {item.productName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{item.sku}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{item.category}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                            {item.qtyKg > 0 ? item.qtyKg.toFixed(2) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                            {item.qtyPcs > 0 ? item.qtyPcs : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                            ₹{item.revenue.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
                            {item.lineCount}
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ReportLayout>
    </Layout>
  );
}
