'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import StatCardGlass from '@/components/StatCardGlass';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Receipt, Wallet, Percent, Drumstick, Soup, ChevronDown } from 'lucide-react';
import { fadeInUp, staggerContainer, useMotionSafe } from '@/lib/motion';
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
  discount: number;
  billCount: number;
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
    totalDiscount: number;
    totalBills: number;
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
  const motionSafe = useMotionSafe();
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
        day.billCount,
        formatCurrency(day.chickenRevenue),
        formatCurrency(day.masaleRevenue),
        formatCurrency(day.discount),
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
        summary.totalBills,
        formatCurrency(summary.otherRevenue ?? dailyTotals.reduce((s, d) => s + d.chickenRevenue, 0)),
        formatCurrency(summary.masaleRevenue ?? dailyTotals.reduce((s, d) => s + d.masaleRevenue, 0)),
        formatCurrency(summary.totalDiscount ?? 0),
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
        { label: 'Total Bills', value: String(summary.totalBills) },
        { label: 'Total Sales (bill total)', value: formatCurrency(summary.totalRevenue) },
        { label: 'Discount Given', value: formatCurrency(summary.totalDiscount ?? 0) },
        {
          label: 'Chicken / Meat Sales',
          value: formatCurrency(summary.otherRevenue ?? 0),
        },
        { label: 'Masale Sales', value: formatCurrency(summary.masaleRevenue ?? 0) },
      ],
      tables: [
        {
          title: 'Day-wise Sales',
          headers: [
            'Date',
            'Bills',
            'Chicken / Meat',
            'Masale',
            'Discount',
            'Day Total',
            'Qty (KG)',
            'Masale (PCS)',
          ],
          columnAlign: ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
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
          <div className="text-center py-8 text-ink-muted">Loading data...</div>
        ) : !data || dailyTotals.length === 0 ? (
          <div className="text-center py-8 text-ink-muted">
            No sales data for the selected period.
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-secondary">
              Day-wise bill totals (PAID + OPEN), after discount — matches Bill Wise Sale. Product
              amounts are allocated from each bill total.
            </p>

            <motion.div
              className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              variants={motionSafe ? staggerContainer(0.05) : undefined}
              initial={motionSafe ? 'hidden' : false}
              animate="show"
            >
              <motion.div variants={motionSafe ? fadeInUp : undefined}>
                <StatCardGlass title="Trading Days" value={summary!.daysCount} icon={<CalendarDays className="h-5 w-5" />} tone="brand" />
              </motion.div>
              <motion.div variants={motionSafe ? fadeInUp : undefined}>
                <StatCardGlass title="Total Bills" value={summary!.totalBills} icon={<Receipt className="h-5 w-5" />} tone="blue" />
              </motion.div>
              <motion.div variants={motionSafe ? fadeInUp : undefined}>
                <StatCardGlass title="Total Sales" value={formatCurrency(summary!.totalRevenue)} icon={<Wallet className="h-5 w-5" />} tone="green" />
              </motion.div>
              <motion.div variants={motionSafe ? fadeInUp : undefined}>
                <StatCardGlass title="Discount Given" value={formatCurrency(summary!.totalDiscount ?? 0)} icon={<Percent className="h-5 w-5" />} tone="orange" />
              </motion.div>
              <motion.div variants={motionSafe ? fadeInUp : undefined}>
                <StatCardGlass title="Chicken / Meat" value={formatCurrency(summary!.otherRevenue ?? 0)} icon={<Drumstick className="h-5 w-5" />} tone="purple" />
              </motion.div>
              <motion.div variants={motionSafe ? fadeInUp : undefined}>
                <StatCardGlass title="Masale" value={formatCurrency(summary!.masaleRevenue ?? 0)} icon={<Soup className="h-5 w-5" />} tone="brand" />
              </motion.div>
            </motion.div>

            <div className="overflow-x-auto mb-6 glass-panel-strong rounded-2xl">
              <h2 className="text-lg font-semibold px-4 pt-4 pb-1 text-ink">Day-wise totals</h2>
              <table className="table-glass min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-surface-2">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Bills
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Chicken / Meat
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Masale
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">
                      Discount
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
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {dailyTotals.map((day) => (
                    <tr key={day.date} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {formatDayLabel(day.date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                        {day.billCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                        ₹{day.chickenRevenue.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-brand-700 dark:text-brand-300">
                        {day.masaleRevenue > 0 ? `₹${day.masaleRevenue.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-amber-700 dark:text-amber-400">
                        {day.discount > 0 ? `₹${day.discount.toFixed(2)}` : '—'}
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
                  <tr className="bg-surface-2 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">Grand total</td>
                    <td className="px-4 py-3 text-sm text-right dark:text-white">
                      {summary!.totalBills}
                    </td>
                    <td className="px-4 py-3 text-sm text-right dark:text-white">
                      ₹{(summary!.otherRevenue ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-brand-700 dark:text-brand-300">
                      ₹{(summary!.masaleRevenue ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-amber-700 dark:text-amber-400">
                      ₹{(summary!.totalDiscount ?? 0).toFixed(2)}
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

            <div className="border-t border-subtle pt-4">
              <button
                type="button"
                onClick={() => setShowDetail((v) => !v)}
                className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 flex items-center gap-1.5 transition-colors"
              >
                {showDetail ? 'Hide product detail' : 'Show product detail (optional)'}
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showDetail ? 'rotate-180' : ''}`} />
              </button>

              {showDetail && (
                <div className="mt-4 overflow-x-auto glass-panel rounded-xl">
                  <table className="table-glass min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                    <thead className="bg-surface-2">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Product</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-ink-muted uppercase">Type</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-ink-muted uppercase">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-ink-muted uppercase">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {detailRows.map((row) => (
                        <tr key={`${row.date}-${row.productId}`}>
                          <td className="px-3 py-2 text-ink-muted">{row.date}</td>
                          <td className="px-3 py-2 text-ink">{row.productName}</td>
                          <td className="px-3 py-2 text-ink-muted">{row.isMasale ? 'Masale' : 'Chicken'}</td>
                          <td className="px-3 py-2 text-right text-ink-secondary">
                            {row.qtyKg > 0
                              ? `${row.qtyKg.toFixed(2)} KG`
                              : row.qtyPcs > 0
                                ? `${row.qtyPcs} PCS`
                                : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-ink">₹{row.revenue.toFixed(2)}</td>
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
