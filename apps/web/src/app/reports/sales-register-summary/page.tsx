'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import StatCardGlass from '@/components/StatCardGlass';
import { ReportMasaleSummary } from '@/components/ReportMasaleSummary';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Wallet, Percent, TrendingUp } from 'lucide-react';
import { fadeInUp, staggerContainer, useMotionSafe } from '@/lib/motion';
import {
  downloadStyledReportBundle,
  formatCurrency,
  formatReportPeriod,
} from '@/lib/reportExport';
import api from '@/lib/api';

export default function SalesRegisterSummaryPage() {
  const motionSafe = useMotionSafe();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const effectiveStartDate = start !== undefined ? start : startDate;
      const effectiveEndDate = end !== undefined ? end : endDate;
      const response = await api.get('/api/v1/reports/sales-register-summary', {
        params: { startDate: effectiveStartDate, endDate: effectiveEndDate },
      });
      setData(response.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    // Use the new dates directly instead of state
    loadData(start, end);
  };

  const handleExport = () => {
    if (!data) return;
    downloadStyledReportBundle({
      title: 'Sales Register Summary',
      filename: `sales-register-summary-${startDate}-to-${endDate}`,
      period: formatReportPeriod(startDate, endDate),
      summary: [
        { label: 'Total Sales', value: String(data.summary.totalSales) },
        { label: 'Net Revenue', value: formatCurrency(data.summary.netRevenue) },
        { label: 'Masale Revenue', value: formatCurrency(data.summary.masaleRevenue || 0) },
        { label: 'Masale Qty (PCS)', value: String(data.summary.masaleQtyPcs || 0) },
      ],
      tables: [
        {
          title: 'Payment Methods',
          headers: ['Payment Method', 'Count', 'Total'],
          columnAlign: ['left', 'right', 'right'],
          rows: data.paymentMethods.map((pm: any) => ({
            kind: 'data' as const,
            cells: [pm.method, pm.count, formatCurrency(pm.total)],
          })),
        },
        {
          title: 'Totals',
          headers: ['Metric', 'Amount'],
          columnAlign: ['left', 'right'],
          rows: [
            { kind: 'data', cells: ['Total Sales', data.summary.totalSales], bold: true },
            { kind: 'data', cells: ['Total Revenue', formatCurrency(data.summary.totalRevenue)] },
            { kind: 'data', cells: ['Total Discount', formatCurrency(data.summary.totalDiscount)] },
            { kind: 'data', cells: ['Total Tax', formatCurrency(data.summary.totalTax)] },
            { kind: 'data', cells: ['Net Revenue', formatCurrency(data.summary.netRevenue)], bold: true },
            { kind: 'data', cells: ['Masale Revenue', formatCurrency(data.summary.masaleRevenue || 0)] },
            { kind: 'data', cells: ['Masale Qty (PCS)', data.summary.masaleQtyPcs || 0] },
            { kind: 'data', cells: ['Chicken / Other Revenue', formatCurrency(data.summary.otherRevenue || 0)] },
          ],
        },
      ],
    });
  };

  return (
    <Layout>
      <ReportLayout
        title="Sales Register Summary"
        dateRange={true}
        onDateRangeChange={handleDateChange}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-ink-muted">Loading data...</div>
        ) : !data ? (
          <div className="text-center py-8 text-ink-muted">No data available.</div>
        ) : (
          <>
            <motion.div
              className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3"
              variants={motionSafe ? staggerContainer(0.05) : undefined}
              initial={motionSafe ? 'hidden' : false}
              animate="show"
            >
              <motion.div variants={motionSafe ? fadeInUp : undefined}>
                <StatCardGlass title="Total Sales" value={data.summary.totalSales} icon={<Receipt className="h-5 w-5" />} tone="brand" />
              </motion.div>
              <motion.div variants={motionSafe ? fadeInUp : undefined}>
                <StatCardGlass title="Total Revenue" value={formatCurrency(data.summary.totalRevenue)} icon={<Wallet className="h-5 w-5" />} tone="blue" />
              </motion.div>
              <motion.div variants={motionSafe ? fadeInUp : undefined}>
                <StatCardGlass title="Total Discount" value={formatCurrency(data.summary.totalDiscount)} icon={<Percent className="h-5 w-5" />} tone="orange" />
              </motion.div>
              <motion.div variants={motionSafe ? fadeInUp : undefined}>
                <StatCardGlass title="Net Revenue" value={formatCurrency(data.summary.netRevenue)} icon={<TrendingUp className="h-5 w-5" />} tone="green" />
              </motion.div>
            </motion.div>
            <div className="mb-6">
              <ReportMasaleSummary
                masaleRevenue={data.summary.masaleRevenue}
                masaleQtyPcs={data.summary.masaleQtyPcs}
                masaleQtyKg={data.summary.masaleQtyKg}
                otherRevenue={data.summary.otherRevenue}
              />
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-bold mb-4 text-ink">Payment Methods</h2>
              <div className="overflow-x-auto glass-panel-strong rounded-2xl">
                <table className="table-glass min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-surface-2">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase">Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase">Count</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-ink-muted uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {data.paymentMethods.map((pm: any) => (
                      <tr key={pm.method}>
                        <td className="px-6 py-4 text-sm font-medium text-ink">{pm.method}</td>
                        <td className="px-6 py-4 text-sm text-ink-muted">{pm.count}</td>
                        <td className="px-6 py-4 text-sm font-medium text-ink">₹{pm.total.toFixed(2)}</td>
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

