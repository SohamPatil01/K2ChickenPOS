'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { useState, useEffect } from 'react';
import { defaultDateRangeLast7Days } from '@/lib/dateRangeParams';
import {
  downloadStyledReportBundle,
  formatCurrency,
  formatReportPeriod,
  type ExportRow,
} from '@/lib/reportExport';
import api from '@/lib/api';

interface DailyTotal {
  date: string;
  revenue: number;
  chickenRevenue: number;
  masaleRevenue: number;
  qtyKg: number;
  qtyPcs: number;
  masaleQtyPcs: number;
}

interface DailyProductRow {
  date: string;
  productId: string;
  productName: string;
  isMasale?: boolean;
  qtyKg: number;
  qtyPcs: number;
  revenue: number;
}

interface ReportPayload {
  period: { startDate: string; endDate: string };
  summary: {
    totalRevenue: number;
    totalQtyKg: number;
    totalQtyPcs: number;
    daysCount: number;
    masaleRevenue?: number;
    masaleQtyPcs?: number;
    otherRevenue?: number;
  };
  dailyTotals: DailyTotal[];
  rows: DailyProductRow[];
}

function formatDayLabel(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function DailyProductTransactionPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [showDetail, setShowDetail] = useState(false);
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

  const dailyTotals = data?.dailyTotals || [];
  const summary = data?.summary;
  const detailRows = data?.rows || [];

  const handleExport = () => {
    if (!data || !summary) return;

    const dailyRows: ExportRow[] = dailyTotals.map((day) => ({
      kind: 'data' as const,
      cells: [
        formatDayLabel(day.date),
        formatCurrency(day.chickenRevenue),
        formatCurrency(day.masaleRevenue),
        formatCurrency(day.revenue),
        day.qtyKg > 0 ? day.qtyKg.toFixed(2) : '-',
        day.masaleQtyPcs > 0 ? day.masaleQtyPcs : '-',
      ],
    }));

    dailyRows.push({
      kind: 'data',
      bold: true,
      cells: [
        'GRAND TOTAL',
        formatCurrency(summary.otherRevenue ?? dailyTotals.reduce((s, d) => s + d.chickenRevenue, 0)),
        formatCurrency(summary.masaleRevenue ?? dailyTotals.reduce((s, d) => s + d.masaleRevenue, 0)),
        formatCurrency(summary.totalRevenue),
        summary.totalQtyKg.toFixed(2),
        String(summary.masaleQtyPcs ?? dailyTotals.reduce((s, d) => s + d.masaleQtyPcs, 0)),
      ],
    });

    downloadStyledReportBundle({
      title: 'Daily Sales Summary',
      filename: `daily-sales-summary-${startDate}-to-${endDate}`,
      period: formatReportPeriod(startDate, endDate),
      summary: [
        { label: 'Trading Days', value: String(summary.daysCount) },
        { label: 'Total Sales', value: formatCurrency(summary.totalRevenue) },
        {
          label: 'Chicken / Meat Sales',
          value: formatCurrency(summary.otherRevenue ?? 0),
        },
        { label: 'Masale Sales', value: formatCurrency(summary.masaleRevenue ?? 0) },
      ],
      tables: [
        {
          title: 'Day-wise Sales',
          headers: ['Date', 'Chicken / Meat', 'Masale', 'Day Total', 'Qty (KG)', 'Masale (PCS)'],
          columnAlign: ['left', 'right', 'right', 'right', 'right', 'right'],
          rows: dailyRows,
        },
      ],
    });
  };

  return (
    <Layout>
      <ReportLayout
        title="Daily Sales Summary"
        dateRange={true}
        onDateRangeChange={handleDateChange}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading data...</div>
        ) : !data || dailyTotals.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No sales data for the selected period.
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Day-wise totals for accounting review. Export sends a clean summary suitable for your CA.
            </p>

            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Trading days
                  </div>
                  <div className="text-2xl font-bold dark:text-white">{summary!.daysCount}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Total sales
                  </div>
                  <div className="text-2xl font-bold dark:text-white">
                    ₹{summary!.totalRevenue.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Chicken / meat
                  </div>
                  <div className="text-xl font-bold dark:text-white">
                    ₹{(summary!.otherRevenue ?? 0).toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Masale
                  </div>
                  <div className="text-xl font-bold text-brand-700 dark:text-brand-300">
                    ₹{(summary!.masaleRevenue ?? 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto mb-6">
              <h2 className="text-lg font-semibold mb-3 dark:text-white">Day-wise totals</h2>
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 dark:bg-gray-900/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Chicken / Meat
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Masale
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Day total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Qty (KG)
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Masale (PCS)
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {dailyTotals.map((day) => (
                    <tr key={day.date} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {formatDayLabel(day.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                        ₹{day.chickenRevenue.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-brand-700 dark:text-brand-300">
                        {day.masaleRevenue > 0 ? `₹${day.masaleRevenue.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-white">
                        ₹{day.revenue.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                        {day.qtyKg > 0 ? day.qtyKg.toFixed(2) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                        {day.masaleQtyPcs > 0 ? day.masaleQtyPcs : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 dark:bg-gray-900/50 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">Grand total</td>
                    <td className="px-4 py-3 text-sm text-right dark:text-white">
                      ₹{(summary!.otherRevenue ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-brand-700 dark:text-brand-300">
                      ₹{(summary!.masaleRevenue ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right dark:text-white">
                      ₹{summary!.totalRevenue.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right dark:text-white">
                      {summary!.totalQtyKg.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right dark:text-white">
                      {summary!.masaleQtyPcs ?? 0}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <button
                type="button"
                onClick={() => setShowDetail((v) => !v)}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                {showDetail ? 'Hide product detail' : 'Show product detail (optional)'}
              </button>

              {showDetail && (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {detailRows.map((row) => (
                        <tr key={`${row.date}-${row.productId}`}>
                          <td className="px-3 py-2 text-gray-500">{row.date}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{row.productName}</td>
                          <td className="px-3 py-2 text-gray-500">{row.isMasale ? 'Masale' : 'Chicken'}</td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {row.qtyKg > 0
                              ? `${row.qtyKg.toFixed(2)} KG`
                              : row.qtyPcs > 0
                                ? `${row.qtyPcs} PCS`
                                : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">₹{row.revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </ReportLayout>
    </Layout>
  );
}
