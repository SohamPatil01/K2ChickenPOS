'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

export default function CompliancePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [compliance, setCompliance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    loadCompliance();
  }, [user, router]);

  const loadCompliance = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/hq/compliance');
      setCompliance(response.data || []);
    } catch (error: any) {
      console.error('Failed to load compliance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading compliance data...</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Compliance Status</h1>
          <p className="text-sm text-gray-500">Track compliance status across all franchises</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Checks</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {compliance.map((item) => (
                  <tr key={item.franchiseId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.franchiseName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{item.complianceScore}%</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          item.status === 'COMPLIANT'
                            ? 'bg-accent-100 text-accent-800'
                            : item.status === 'WARNING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2 flex-wrap">
                        {item.checks.hasUsers && <span className="text-accent-600">✓ Users</span>}
                        {item.checks.hasManager && <span className="text-accent-600">✓ Manager</span>}
                        {item.checks.hasCashier && <span className="text-accent-600">✓ Cashier</span>}
                        {item.checks.hasSales && <span className="text-accent-600">✓ Sales</span>}
                        {item.checks.hasCustomers && <span className="text-accent-600">✓ Customers</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{item.userCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {compliance.length === 0 && (
            <p className="text-gray-500 text-center py-8">No compliance data available</p>
          )}
        </div>
      </div>
    </HQLayout>
  );
}

