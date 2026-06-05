'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { ReportMasaleSummary } from '@/components/ReportMasaleSummary';
import { useState, useEffect } from 'react';
import {
  downloadReportTable,
  downloadStyledReport,
  formatCurrency,
  formatReportPeriod,
} from '@/lib/reportExport';
import api from '@/lib/api';

export default function SummaryReportPage() {
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
      
      // Log dates for debugging
      console.log('Loading report data with dates:', { effectiveStartDate, effectiveEndDate });
      
      const response = await api.get('/api/v1/reports/summary-report', {
        params: { startDate: effectiveStartDate, endDate: effectiveEndDate },
      });
      
      console.log('Report data received:', response.data);
      setData(response.data);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      console.error('Error details:', error.response?.data);
      // Set empty data on error to show "no data" message
      setData(null);
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
      title: 'Summary Report',
      filename: `summary-report-${startDate}-to-${endDate}`,
      period: formatReportPeriod(startDate, endDate),
      summary: [
        { label: 'Total Sales', value: String(data.sales.totalSales) },
        { label: 'Total Revenue', value: formatCurrency(data.sales.totalRevenue) },
        { label: 'Masale Revenue', value: formatCurrency(data.sales.masaleRevenue || 0) },
        { label: 'Masale Qty (PCS)', value: String(data.sales.masaleQtyPcs || 0) },
      ],
      tables: [
        {
          title: 'Inventory & Customers',
          headers: ['Metric', 'Value'],
          rows: [
            { kind: 'data', cells: ['Total Products', data.inventory.totalProducts] },
            { kind: 'data', cells: ['Inventory Movements', data.inventory.totalMovements] },
            { kind: 'data', cells: ['Total Customers', data.customers.totalCustomers] },
            { kind: 'data', cells: ['Masale Revenue', formatCurrency(data.sales.masaleRevenue || 0)] },
            { kind: 'data', cells: ['Masale Qty (PCS)', data.sales.masaleQtyPcs || 0] },
            { kind: 'data', cells: ['Chicken / Other Revenue', formatCurrency(data.sales.otherRevenue || 0)] },
          ],
        },
        {
          title: 'Payment Methods',
          headers: ['Method', 'Amount'],
          columnAlign: ['left', 'right'],
          rows: Object.entries(data.payments).map(([method, amount]: [string, any]) => ({
            kind: 'data' as const,
            cells: [method, formatCurrency(amount)],
          })),
        },
      ],
    });
  };

  return (
    <Layout>
      <ReportLayout
        title="Summary Report"
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
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-primary-50 rounded-lg">
                <div className="text-sm text-gray-600">Total Sales</div>
                <div className="text-2xl font-bold">{data.sales.totalSales}</div>
              </div>
              <div className="p-4 bg-primary-100 rounded-lg">
                <div className="text-sm text-gray-600">Total Revenue</div>
                <div className="text-2xl font-bold">₹{data.sales.totalRevenue.toFixed(2)}</div>
              </div>
              <div className="p-4 bg-primary-50 rounded-lg">
                <div className="text-sm text-gray-600">Items Sold</div>
                <div className="text-2xl font-bold">{data.sales.totalItemsSold}</div>
              </div>
              <div className="p-4 bg-primary-100 rounded-lg">
                <div className="text-sm text-gray-600">Avg Bill</div>
                <div className="text-2xl font-bold">₹{data.sales.avgBillValue.toFixed(2)}</div>
              </div>
            </div>

            <div className="p-4 bg-brand-50/50 rounded-lg">
              <ReportMasaleSummary
                masaleRevenue={data.sales.masaleRevenue}
                masaleQtyPcs={data.sales.masaleQtyPcs}
                masaleQtyKg={data.sales.masaleQtyKg}
                masaleLineCount={data.sales.masaleLineCount}
                otherRevenue={data.sales.otherRevenue}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Total Products</div>
                <div className="text-2xl font-bold">{data.inventory.totalProducts}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Inventory Movements</div>
                <div className="text-2xl font-bold">{data.inventory.totalMovements}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">Total Customers</div>
                <div className="text-2xl font-bold">{data.customers.totalCustomers}</div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Payment Methods</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(data.payments).map(([method, amount]: [string, any]) => (
                      <tr key={method}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{method}</td>
                        <td className="px-6 py-4 text-sm text-gray-900">₹{amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </ReportLayout>
    </Layout>
  );
}

