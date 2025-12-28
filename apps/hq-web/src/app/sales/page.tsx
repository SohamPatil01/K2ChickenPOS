'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

interface Franchise {
  id: string;
  name: string;
}

export default function SalesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('all');
  const [salesData, setSalesData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSales, setLoadingSales] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    loadFranchises();
  }, [user, router]);

  useEffect(() => {
    if (franchises.length > 0) {
      loadSalesData();
    }
  }, [selectedFranchiseId, dateRange]);

  const loadFranchises = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/stores/franchises');
      setFranchises(response.data || []);
    } catch (error: any) {
      console.error('Failed to load franchises:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesData = async () => {
    setLoadingSales(true);
    try {
      const params: any = { ...dateRange };
      if (selectedFranchiseId && selectedFranchiseId !== 'all') {
        params.franchiseId = selectedFranchiseId;
      }
      const response = await api.get('/api/v1/hq/sales-monitoring', { params });
      setSalesData(response.data);
    } catch (error: any) {
      console.error('Failed to load sales data:', error);
    } finally {
      setLoadingSales(false);
    }
  };

  if (loading) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading franchises...</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Sales Monitoring</h1>
          <p className="text-sm text-gray-500">Real-time sales monitoring across franchises</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Franchise</label>
              <select
                value={selectedFranchiseId}
                onChange={(e) => setSelectedFranchiseId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="all">All Franchises</option>
                {franchises.map((franchise) => (
                  <option key={franchise.id} value={franchise.id}>
                    {franchise.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {loadingSales ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">Loading sales data...</p>
          </div>
        ) : salesData ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold">{salesData?.totalSales || 0}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600">Recent Sales (Last 100)</p>
                <p className="text-2xl font-bold">{salesData?.recentSales?.length || 0}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-sm text-gray-600">Active Franchises</p>
                <p className="text-2xl font-bold">
                  {new Set(salesData?.recentSales?.map((s: any) => s.store?.id) || []).size}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Sales</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale No</th>
                      {selectedFranchiseId === 'all' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {salesData?.recentSales?.slice(0, 50).map((sale: any) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{sale.saleNo}</td>
                        {selectedFranchiseId === 'all' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{sale.store?.name || 'N/A'}</td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{sale.customer?.name || 'Walk-in'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{sale.items?.length || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">₹{sale.grandTotal.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(sale.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(!salesData?.recentSales || salesData.recentSales.length === 0) && (
                <p className="text-gray-500 text-center py-8">No sales data available</p>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">No sales data available</p>
          </div>
        )}
      </div>
    </HQLayout>
  );
}

