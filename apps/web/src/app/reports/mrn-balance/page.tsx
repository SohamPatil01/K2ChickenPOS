'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { useState, useEffect } from 'react';
import {
  downloadStyledReportBundle,
  formatCurrency,
  formatDisplayDate,
} from '@/lib/reportExport';
import api from '@/lib/api';

export default function MRNBalancePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/reports/mrn-balance');
      setData(response.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalBalanceValue = data?.balanceConfirmation.reduce((sum: number, item: any) => sum + item.value, 0) || 0;

  const handleExport = () => {
    if (!data) return;
    downloadStyledReportBundle({
      title: 'MRN & Balance Confirmation',
      filename: `mrn-balance-${new Date().toISOString().split('T')[0]}`,
      summary: [
        { label: 'Total MRNs', value: String(data.mrnList.length) },
        { label: 'Total Balance Value', value: formatCurrency(totalBalanceValue) },
      ],
      tables: [
        {
          title: 'MRN List',
          headers: ['Dispatch No', 'PO No', 'Received At', 'Received By', 'Status'],
          columnAlign: ['left', 'left', 'left', 'left', 'left'],
          rows: data.mrnList.map((mrn: any) => ({
            kind: 'data' as const,
            cells: [
              mrn.dispatchNo,
              mrn.poNo,
              formatDisplayDate(mrn.receivedAt),
              mrn.receivedBy,
              mrn.status,
            ],
          })),
        },
        {
          title: 'Balance Confirmation',
          headers: ['SKU', 'Product Name', 'Balance', 'Unit', 'Price', 'Value'],
          columnAlign: ['left', 'left', 'right', 'left', 'right', 'right'],
          rows: data.balanceConfirmation.map((item: any) => ({
            kind: 'data' as const,
            cells: [
              item.sku,
              item.name,
              item.balance,
              item.unitType,
              formatCurrency(item.price),
              formatCurrency(item.value),
            ],
          })),
        },
      ],
    });
  };

  return (
    <Layout>
      <ReportLayout
        title="MRN & Balance Confirmation"
        dateRange={false}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading data...</div>
        ) : !data ? (
          <div className="text-center py-8 text-gray-500">No data available.</div>
        ) : (
          <div className="space-y-6">
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Total MRNs</div>
                  <div className="text-2xl font-bold">{data.mrnList.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Balance Value</div>
                  <div className="text-2xl font-bold">₹{totalBalanceValue.toFixed(2)}</div>
                </div>
              </div>
            </div>

            {data.mrnList.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-4">MRN List</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispatch No</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO No</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received At</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Received By</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.mrnList.map((mrn: any) => (
                        <tr key={mrn.grnId}>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{mrn.dispatchNo}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{mrn.poNo}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(mrn.receivedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{mrn.receivedBy}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{mrn.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-lg font-bold mb-4">Balance Confirmation</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Balance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.balanceConfirmation.map((item: any) => (
                      <tr key={item.productId}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.sku}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{item.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">{item.balance.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{item.unitType}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">₹{item.price.toFixed(2)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">₹{item.value.toFixed(2)}</td>
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

