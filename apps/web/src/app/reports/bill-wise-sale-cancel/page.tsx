'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { useState, useEffect } from 'react';
import {
  downloadReportTable,
  formatCurrency,
  formatDisplayDate,
  formatReportPeriod,
} from '@/lib/reportExport';
import api from '@/lib/api';

export default function BillWiseSaleCancelPage() {
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
      const response = await api.get('/api/v1/reports/bill-wise-sale-cancel', {
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

  const totalCancelled = data.reduce((sum, item) => sum + item.originalTotal, 0);

  const handleExport = () => {
    downloadReportTable(
      'Bill Wise Sale Cancel',
      `bill-wise-sale-cancel-${startDate}-to-${endDate}`,
      {
        period: formatReportPeriod(startDate, endDate),
        summary: [
          { label: 'Cancelled Bills', value: String(data.length) },
          { label: 'Total Cancelled Value', value: formatCurrency(totalCancelled) },
        ],
        headers: ['Sale No', 'Date', 'Customer', 'Original Total', 'Items', 'Cancelled By'],
        columnAlign: ['left', 'left', 'left', 'right', 'right', 'left'],
        rows: data.map((item) => ({
          kind: 'data' as const,
          cells: [
            item.saleNo,
            formatDisplayDate(item.date),
            item.customerName,
            formatCurrency(item.originalTotal),
            item.itemsCount,
            item.cancelledBy,
          ],
        })),
      }
    );
  };

  return (
    <Layout>
      <ReportLayout
        title="Bill Wise Sale Cancel"
        dateRange={true}
        onDateRangeChange={handleDateChange}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading data...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No cancelled sales found.</div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-red-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Total Cancelled Bills</div>
                  <div className="text-2xl font-bold text-red-600">{data.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Cancelled Amount</div>
                  <div className="text-2xl font-bold text-red-600">₹{totalCancelled.toFixed(2)}</div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Original Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cancelled By</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((item) => (
                    <tr key={item.saleId} className="bg-red-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.saleNo}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.customerName}</td>
                      <td className="px-6 py-4 text-sm font-medium text-red-600">₹{item.originalTotal.toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.itemsCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.cancelledBy}</td>
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

