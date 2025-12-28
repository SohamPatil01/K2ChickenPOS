'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

export default function PaymentsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [payments, setPayments] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    loadPayments();
  }, [user, router, dateRange]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/hq/payments-commissions', {
        params: dateRange,
      });
      setPayments(response.data);
    } catch (error: any) {
      console.error('Failed to load payments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading payments data...</p>
        </div>
      </HQLayout>
    );
  }

  if (!payments) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">No payment data available</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Payments & Commissions</h1>
          <p className="text-sm text-gray-500">Manage payments, commissions, and royalties</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-primary-50 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold">₹{payments.summary.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Total Commission ({payments.summary.commissionRate}%)</p>
            <p className="text-2xl font-bold">₹{payments.summary.totalCommission.toFixed(2)}</p>
          </div>
          <div className="bg-accent-50 rounded-lg shadow p-6">
            <p className="text-sm text-gray-600">Net Payment</p>
            <p className="text-2xl font-bold">₹{payments.summary.totalNetPayment.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Franchise Payments</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Count</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payments.franchisePayments.map((item: any) => (
                  <tr key={item.franchiseId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.franchiseName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">₹{item.totalRevenue.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">₹{item.commission.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">₹{item.netPayment.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{item.salesCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </HQLayout>
  );
}

