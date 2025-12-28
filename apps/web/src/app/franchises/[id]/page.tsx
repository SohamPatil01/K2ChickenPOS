'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Link from 'next/link';

interface FranchiseDetail {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  _count: {
    users: number;
    sales: number;
    customers: number;
    deliveryOrders: number;
    inventoryLedgers: number;
  };
  users: Array<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    role: string;
    isActive: boolean;
  }>;
}

interface FranchiseStats {
  sales: number;
  revenue: number;
  customers: number;
  period: {
    startDate: string;
    endDate: string;
  };
}

export default function FranchiseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const [franchise, setFranchise] = useState<FranchiseDetail | null>(null);
  const [stats, setStats] = useState<FranchiseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'OWNER') {
      router.push('/console');
      return;
    }

    if (params.id) {
      loadFranchise();
      loadStats();
    }
  }, [user, router, params.id, dateRange]);

  const loadFranchise = async () => {
    try {
      const response = await api.get(`/api/v1/stores/franchises/${params.id}`);
      setFranchise(response.data);
    } catch (error: any) {
      console.error('Failed to load franchise:', error);
      alert(error.response?.data?.error || 'Failed to load franchise details');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get(`/api/v1/stores/franchises/${params.id}/stats`, {
        params: dateRange,
      });
      setStats(response.data);
    } catch (error: any) {
      console.error('Failed to load franchise stats:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading franchise details...</p>
        </div>
      </Layout>
    );
  }

  if (!franchise) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Franchise not found</p>
          <Link href="/franchises" className="text-primary-600 hover:underline">
            Back to Franchises
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/franchises"
            className="text-primary-600 hover:underline mb-2 inline-block"
          >
            ← Back to Franchises
          </Link>
          <h1 className="text-3xl font-bold">{franchise.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Created: {new Date(franchise.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Total Sales</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{franchise._count.sales}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Total Customers</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{franchise._count.customers}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Users</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{franchise._count.users}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Revenue (Period)</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              ₹{stats?.revenue.toFixed(2) || '0.00'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {stats?.sales || 0} sales
            </p>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Statistics Period</h2>
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, startDate: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) =>
                  setDateRange({ ...dateRange, endDate: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Users</h2>
            <span className="text-sm text-gray-500">{franchise.users.length} total</span>
          </div>
          {franchise.users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {franchise.users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {user.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.role}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.isActive
                              ? 'bg-accent-100 text-accent-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No users found</p>
          )}
        </div>
      </div>
    </Layout>
  );
}

