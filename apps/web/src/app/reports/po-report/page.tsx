'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function POReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/reports/po-report', {
        params: { startDate, endDate },
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
    loadData();
  };

  const handleExport = () => {
    const csv = [
      ['PO No', 'Date', 'Franchise Store', 'Owner Store', 'Status', 'Items', 'Has Dispatch', 'Has GRN'],
      ...data.map((item) => [
        item.poNo,
        new Date(item.date).toLocaleDateString(),
        item.franchiseStore,
        item.ownerStore,
        item.status,
        item.itemsCount,
        item.hasDispatch ? 'Yes' : 'No',
        item.hasGRN ? 'Yes' : 'No',
      ]),
    ].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `po-report-${startDate}-to-${endDate}.csv`;
    a.click();
  };

  return (
    <Layout>
      <ReportLayout
        title="PO Report"
        dateRange={true}
        onDateRangeChange={handleDateChange}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading data...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No purchase orders found.</div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Total Purchase Orders</div>
              <div className="text-2xl font-bold">{data.length}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO No</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner Store</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispatch</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">GRN</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((item) => (
                    <tr key={item.poId}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.poNo}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(item.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.franchiseStore}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.ownerStore}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs ${
                          item.status === 'RECEIVED' ? 'bg-primary-100 text-primary-800' :
                          item.status === 'DISPATCHED' ? 'bg-primary-200 text-primary-800' :
                          item.status === 'APPROVED' ? 'bg-primary-50 text-primary-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.itemsCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.hasDispatch ? '✓' : '✗'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.hasGRN ? '✓' : '✗'}</td>
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

