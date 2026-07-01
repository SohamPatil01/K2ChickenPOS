'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { ReportMasaleSummary } from '@/components/ReportMasaleSummary';
import { useState, useEffect } from 'react';
import {
  downloadReportTable,
  formatCurrency,
  formatDisplayDate,
  formatReportPeriod,
} from '@/lib/reportExport';
import { todayLocalYmd } from '@/lib/dateRangeParams';
import api from '@/lib/api';

interface BillWiseSummary {
  totalBills: number;
  paidBills: number;
  openBills: number;
  realisedRevenue: number;
  outstandingRevenue: number;
  masaleRevenue: number;
  masaleQtyPcs: number;
}

const emptySummary = (): BillWiseSummary => ({
  totalBills: 0,
  paidBills: 0,
  openBills: 0,
  realisedRevenue: 0,
  outstandingRevenue: 0,
  masaleRevenue: 0,
  masaleQtyPcs: 0,
});

export default function BillWiseSalePage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<BillWiseSummary>(emptySummary);
  const today = todayLocalYmd();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (start?: string, end?: string) => {
    setLoading(true);
    try {
      const effectiveStartDate = start !== undefined ? start : startDate;
      const effectiveEndDate = end !== undefined ? end : endDate;
      const response = await api.get('/api/v1/reports/bill-wise-sale', {
        params: { startDate: effectiveStartDate, endDate: effectiveEndDate },
      });
      const payload = response.data;
      if (Array.isArray(payload)) {
        setRows(payload);
        const paid = payload.filter((r) => r.status === 'PAID');
        const open = payload.filter((r) => r.status === 'OPEN');
        setSummary({
          totalBills: payload.length,
          paidBills: paid.length,
          openBills: open.length,
          realisedRevenue: paid.reduce((s, r) => s + r.grandTotal, 0),
          outstandingRevenue: open.reduce((s, r) => s + r.grandTotal, 0),
          masaleRevenue: payload.reduce((s, r) => s + (r.masaleRevenue || 0), 0),
          masaleQtyPcs: payload.reduce((s, r) => s + (r.masaleQtyPcs || 0), 0),
        });
      } else {
        setRows(payload?.rows || []);
        setSummary(payload?.summary || emptySummary());
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      setRows([]);
      setSummary(emptySummary());
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    loadData(start, end);
  };

  const handleExport = () => {
    downloadReportTable('Bill Wise Sale Report', `bill-wise-sale-${startDate}-to-${endDate}`, {
      period: formatReportPeriod(startDate, endDate),
      summary: [
        { label: 'Total Bills', value: String(summary.totalBills) },
        { label: 'Paid Bills', value: String(summary.paidBills) },
        { label: 'Open / Credit Bills', value: String(summary.openBills) },
        { label: 'Realised Revenue (PAID)', value: formatCurrency(summary.realisedRevenue) },
        { label: 'Outstanding (OPEN)', value: formatCurrency(summary.outstandingRevenue) },
        { label: 'Masale Revenue', value: formatCurrency(summary.masaleRevenue) },
      ],
      headers: ['Sale No', 'Status', 'Date', 'Customer', 'Items', 'Total', 'Payment'],
      columnAlign: ['left', 'left', 'left', 'left', 'right', 'right', 'left'],
      rows: rows.map((item) => ({
        kind: 'data' as const,
        cells: [
          item.saleNo,
          item.status,
          formatDisplayDate(item.date),
          item.customerName,
          item.itemsCount,
          formatCurrency(item.grandTotal),
          item.payments.map((p: any) => p.method).join(', '),
        ],
      })),
    });
  };

  return (
    <Layout>
      <ReportLayout
        title="Bill Wise Sale (Sales Register)"
        dateRange={true}
        defaultRange="today"
        onDateRangeChange={handleDateChange}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading data...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No bills in this period.</div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Bills</div>
                  <div className="text-2xl font-bold dark:text-white">{summary.totalBills}</div>
                  <div className="text-xs text-gray-500">
                    {summary.paidBills} paid · {summary.openBills} open
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Realised (PAID)</div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                    ₹{summary.realisedRevenue.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">Matches dashboard</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Outstanding (OPEN)</div>
                  <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                    ₹{summary.outstandingRevenue.toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500">Credit / unpaid</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Avg Paid Bill</div>
                  <div className="text-2xl font-bold dark:text-white">
                    ₹
                    {summary.paidBills > 0
                      ? (summary.realisedRevenue / summary.paidBills).toFixed(2)
                      : '0.00'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Period</div>
                  <div className="text-sm font-medium dark:text-white mt-1">
                    {formatReportPeriod(startDate, endDate)}
                  </div>
                </div>
              </div>
              <ReportMasaleSummary
                masaleRevenue={summary.masaleRevenue}
                masaleQtyPcs={summary.masaleQtyPcs}
                otherRevenue={Math.max(0, summary.realisedRevenue - summary.masaleRevenue)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Masale</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {rows.map((item) => (
                    <tr
                      key={item.saleId}
                      className={item.status === 'OPEN' ? 'bg-amber-50/60 dark:bg-amber-900/10' : undefined}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{item.saleNo}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={
                            item.status === 'PAID'
                              ? 'text-green-700 dark:text-green-400 font-medium'
                              : 'text-amber-700 dark:text-amber-400 font-medium'
                          }
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.customerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{item.itemsCount}</td>
                      <td className="px-4 py-3 text-sm text-brand-700 font-medium">
                        {(item.masaleRevenue || 0) > 0 ? `₹${item.masaleRevenue.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">₹{item.subTotal.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">₹{item.discount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">₹{item.tax.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        ₹{item.grandTotal.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {item.payments.map((p: any) => `${p.method}`).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </ReportLayout>
    </Layout>
  );
}
