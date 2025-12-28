'use client';

import Layout from '@/components/Layout';
import ReportLayout from '@/components/ReportLayout';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

export default function PendingReportPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/reports/pending');
      setData(response.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!data) return;
    const csv = [
      ['Pending Items Report'],
      ['', ''],
      ['Pending Purchase Orders'],
      ['PO No', 'Status', 'Items Count', 'Created At'],
      ...data.pendingPurchaseOrders.map((po: any) => [
        po.poNo,
        po.status,
        po.itemsCount,
        new Date(po.createdAt).toLocaleDateString(),
      ]),
      ['', ''],
      ['Pending Deliveries'],
      ['Sale No', 'Status', 'Amount', 'Created At'],
      ...data.pendingDeliveries.map((d: any) => [
        d.saleNo,
        d.status,
        d.amount,
        new Date(d.createdAt).toLocaleDateString(),
      ]),
      ['', ''],
      ['Open Sales'],
      ['Sale No', 'Customer', 'Total', 'Items', 'Created At'],
      ...data.openSales.map((s: any) => [
        s.saleNo,
        s.customer,
        s.total,
        s.itemsCount,
        new Date(s.createdAt).toLocaleDateString(),
      ]),
    ].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pending-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <Layout>
      <ReportLayout
        title="Pending Report"
        dateRange={false}
        exportable={true}
        onExport={handleExport}
      >
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading data...</div>
        ) : !data ? (
          <div className="text-center py-8 text-gray-500">No pending items.</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-primary-50 rounded-lg">
                <div className="text-sm text-gray-600">Pending POs</div>
                <div className="text-2xl font-bold">{data.pendingPurchaseOrders.length}</div>
              </div>
              <div className="p-4 bg-primary-100 rounded-lg">
                <div className="text-sm text-gray-600">Pending Deliveries</div>
                <div className="text-2xl font-bold">{data.pendingDeliveries.length}</div>
              </div>
              <div className="p-4 bg-primary-50 rounded-lg">
                <div className="text-sm text-gray-600">Open Sales</div>
                <div className="text-2xl font-bold">{data.openSales.length}</div>
              </div>
            </div>

            {data.pendingPurchaseOrders.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-4">Pending Purchase Orders</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO No</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.pendingPurchaseOrders.map((po: any) => (
                        <tr key={po.poNo}>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{po.poNo}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{po.status}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{po.itemsCount}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(po.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.pendingDeliveries.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-4">Pending Deliveries</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale No</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.pendingDeliveries.map((d: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{d.saleNo}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{d.status}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">₹{d.amount.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(d.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.openSales.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-4">Open Sales</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale No</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.openSales.map((s: any) => (
                        <tr key={s.saleNo}>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.saleNo}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{s.customer}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">₹{s.total.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{s.itemsCount}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(s.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {data.pendingPurchaseOrders.length === 0 &&
              data.pendingDeliveries.length === 0 &&
              data.openSales.length === 0 && (
                <div className="text-center py-8 text-gray-500">No pending items.</div>
              )}
          </div>
        )}
      </ReportLayout>
    </Layout>
  );
}

