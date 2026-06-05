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
import api from '@/lib/api';

export default function BillWiseSalePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
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
      const response = await api.get('/api/v1/reports/bill-wise-sale', {
        params: { startDate: effectiveStartDate, endDate: effectiveEndDate },
      });
      setData(response.data || []);
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

  const totalRevenue = data.reduce((sum, item) => sum + item.grandTotal, 0);
  const masaleRevenue = data.reduce((sum, item) => sum + (item.masaleRevenue || 0), 0);
  const masaleQtyPcs = data.reduce((sum, item) => sum + (item.masaleQtyPcs || 0), 0);

  const handleExport = () => {
    downloadReportTable('Bill Wise Sale Report', `bill-wise-sale-${startDate}-to-${endDate}`, {
      period: formatReportPeriod(startDate, endDate),
      summary: [
        { label: 'Total Bills', value: String(data.length) },
        { label: 'Total Revenue', value: formatCurrency(totalRevenue) },
        { label: 'Masale Revenue', value: formatCurrency(masaleRevenue) },
        { label: 'Masale Qty (PCS)', value: String(masaleQtyPcs) },
      ],
      headers: ['Sale No', 'Date', 'Customer', 'Items', 'Masale Rev.', 'Subtotal', 'Discount', 'Tax', 'Total', 'Payment'],
      columnAlign: ['left', 'left', 'left', 'right', 'right', 'right', 'right', 'right', 'right', 'left'],
      rows: data.map((item) => ({
        kind: 'data' as const,
        cells: [
          item.saleNo,
          formatDisplayDate(item.date),
          item.customerName,
          item.itemsCount,
          formatCurrency(item.masaleRevenue || 0),
          formatCurrency(item.subTotal),
          formatCurrency(item.discount),
          formatCurrency(item.tax),
          formatCurrency(item.grandTotal),
          item.payments.map((p: any) => p.method).join(', '),
        ],
      })),
    });
  };

  return (
    <Layout>
      <ReportLayout
        title="Bill Wise Sale Report"
        dateRange={true}
        onDateRangeChange={handleDateChange}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading data...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No sales data available.</div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Total Bills</div>
                  <div className="text-2xl font-bold">{data.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Revenue</div>
                  <div className="text-2xl font-bold">₹{totalRevenue.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Avg Bill Value</div>
                  <div className="text-2xl font-bold">₹{(totalRevenue / data.length).toFixed(2)}</div>
                </div>
              </div>
              <ReportMasaleSummary
                masaleRevenue={masaleRevenue}
                masaleQtyPcs={masaleQtyPcs}
                otherRevenue={Math.max(0, totalRevenue - masaleRevenue)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Masale</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tax</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((item) => (
                    <tr key={item.saleId}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.saleNo}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.customerName}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.itemsCount}</td>
                      <td className="px-6 py-4 text-sm text-brand-700 font-medium">
                        {(item.masaleRevenue || 0) > 0 ? `₹${item.masaleRevenue.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">₹{item.subTotal.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">₹{item.discount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">₹{item.tax.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">₹{item.grandTotal.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.payments.map((p: any) => `${p.method}`).join(', ')}
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

