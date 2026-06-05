'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { useState, useEffect } from 'react';
import {
  downloadStyledReport,
  formatCurrency,
  formatReportPeriod,
} from '@/lib/reportExport';
import api from '@/lib/api';

export default function SalesRegisterSummaryPage() {
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
    downloadStyledReport({
      title: 'Sales Register Summary',
      filename: `sales-register-summary-${startDate}-to-${endDate}`,
      period: formatReportPeriod(startDate, endDate),
      summary: [
        { label: 'Total Sales', value: String(data.summary.totalSales) },
        { label: 'Net Revenue', value: formatCurrency(data.summary.netRevenue) },
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
          <div className="text-center py-8 text-gray-500">Loading data...</div>
        ) : !data ? (
          <div className="text-center py-8 text-gray-500">No data available.</div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-4 gap-4">
              <div className="p-4 bg-primary-50 rounded-lg">
                <div className="text-sm text-gray-600">Total Sales</div>
                <div className="text-2xl font-bold">{data.summary.totalSales}</div>
              </div>
              <div className="p-4 bg-primary-100 rounded-lg">
                <div className="text-sm text-gray-600">Total Revenue</div>
                <div className="text-2xl font-bold">₹{data.summary.totalRevenue.toFixed(2)}</div>
              </div>
              <div className="p-4 bg-primary-50 rounded-lg">
                <div className="text-sm text-gray-600">Total Discount</div>
                <div className="text-2xl font-bold">₹{data.summary.totalDiscount.toFixed(2)}</div>
              </div>
              <div className="p-4 bg-primary-100 rounded-lg">
                <div className="text-sm text-gray-600">Net Revenue</div>
                <div className="text-2xl font-bold">₹{data.summary.netRevenue.toFixed(2)}</div>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-bold mb-4">Payment Methods</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Count</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.paymentMethods.map((pm: any) => (
                      <tr key={pm.method}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{pm.method}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{pm.count}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">₹{pm.total.toFixed(2)}</td>
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

