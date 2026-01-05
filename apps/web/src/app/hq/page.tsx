'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Link from 'next/link';

interface HQDashboard {
  summary: {
    totalFranchises: number;
    totalSales: number;
    totalRevenue: number;
    totalProductSales?: number; // Sum of lineTotal (before discounts/taxes)
    totalCustomers: number;
    avgRevenuePerFranchise: number;
  };
  franchiseBreakdown: Array<{
    franchiseId: string;
    franchiseName: string;
    sales: number;
    revenue: number;
    customers: number;
    avgBillValue: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

export default function HQPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState<HQDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'franchises' | 'sales' | 'inventory' | 'compliance' | 'payments' | 'marketing' | 'analytics'>('overview');
  const [franchises, setFranchises] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState<any | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    // Wait for user to load from localStorage
    if (user === undefined) {
      return; // Still loading
    }

    // If no user, redirect to login
    if (!user) {
      console.log('[HQ Page] No user found, redirecting to login');
      router.push('/login');
      return;
    }

    // Check user role
    console.log('[HQ Page] User role:', user.role, 'User:', user);
    
    if (user.role !== 'OWNER') {
      console.log('[HQ Page] User is not OWNER, redirecting to console');
      router.push('/console');
      return;
    }

    // User is OWNER, load dashboard
    console.log('[HQ Page] User is OWNER, loading dashboard');
    loadDashboard();
    if (activeTab === 'franchises') {
      loadFranchises();
    }
  }, [user, router, dateRange, activeTab]);

  const loadFranchises = async () => {
    try {
      const response = await api.get('/api/v1/stores/franchises/summary');
      setFranchises(response.data || []);
    } catch (error: any) {
      console.error('Failed to load franchises:', error);
    }
  };

  const handleAddFranchise = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a franchise name');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/v1/stores/franchises', { name: formData.name.trim() });
      setShowAddModal(false);
      setFormData({ name: '' });
      await loadFranchises();
      await loadDashboard(); // Refresh dashboard
    } catch (error: any) {
      console.error('Failed to create franchise:', error);
      alert(error.response?.data?.error || 'Failed to create franchise');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditFranchise = async () => {
    if (!editingFranchise || !formData.name.trim()) {
      alert('Please enter a franchise name');
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/api/v1/stores/franchises/${editingFranchise.id}`, { name: formData.name.trim() });
      setShowEditModal(false);
      setEditingFranchise(null);
      setFormData({ name: '' });
      await loadFranchises();
      await loadDashboard(); // Refresh dashboard
    } catch (error: any) {
      console.error('Failed to update franchise:', error);
      alert(error.response?.data?.error || 'Failed to update franchise');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFranchise = async (franchise: any) => {
    if (!confirm(`Are you sure you want to delete "${franchise.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/api/v1/stores/franchises/${franchise.id}`);
      await loadFranchises();
      await loadDashboard(); // Refresh dashboard
    } catch (error: any) {
      console.error('Failed to delete franchise:', error);
      alert(error.response?.data?.error || 'Failed to delete franchise');
    }
  };

  const openEditModal = (franchise: any) => {
    setEditingFranchise(franchise);
    setFormData({ name: franchise.name });
    setShowEditModal(true);
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/v1/hq/dashboard', {
        params: dateRange,
      });
      setDashboard(response.data);
    } catch (error: any) {
      console.error('Failed to load HQ dashboard:', error);
      console.error('Error response:', error.response);
      console.error('Error details:', error.response?.data);
      
      let errorMessage = 'Failed to load HQ dashboard';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
        if (error.response.data.details) {
          errorMessage += `: ${error.response.data.details}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Network error: Cannot connect to API. Please check if the API is running.';
      }
      
      setError(errorMessage);
      console.error('[HQ Page] Dashboard load error:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon }: { title: string; value: string | number; subtitle?: string; icon: string }) => (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className="text-4xl text-primary-600">{icon}</div>
      </div>
    </div>
  );

  // Show loading state while checking user or loading dashboard
  if (user === undefined || loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">
            {user === undefined ? 'Checking authentication...' : 'Loading HQ Dashboard...'}
          </p>
        </div>
      </Layout>
    );
  }

  // If no user or not OWNER, show nothing (will redirect)
  if (!user || user.role !== 'OWNER') {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto py-12">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800">
              {!user ? 'No user found. Redirecting to login...' : `Access denied. Your role is ${user.role}. Only OWNER can access HQ dashboard. Redirecting...`}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Franchise HQ Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and monitor all franchise outlets</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-800 font-medium">Error loading dashboard</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={() => {
                  setError(null);
                  loadDashboard();
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Show message if dashboard is null and not loading */}
        {!loading && !error && !dashboard && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center mb-6">
            <p className="text-yellow-800">No dashboard data available. Click retry to reload.</p>
            <button
              onClick={loadDashboard}
              className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Only show dashboard content if we have data */}
        {dashboard && (
          <>

        {/* Date Range Filter */}
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

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'franchises', label: 'Franchises', icon: '🏪' },
              { id: 'sales', label: 'Sales Monitoring', icon: '💰' },
              { id: 'inventory', label: 'Inventory', icon: '📦' },
              { id: 'compliance', label: 'Compliance', icon: '✅' },
              { id: 'payments', label: 'Payments & Commissions', icon: '💳' },
              { id: 'marketing', label: 'Marketing', icon: '📢' },
              { id: 'analytics', label: 'Analytics', icon: '📈' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && dashboard && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <StatCard
                title="Total Franchises"
                value={dashboard.summary.totalFranchises}
                icon="🏪"
              />
              <StatCard
                title="Total Sales"
                value={dashboard.summary.totalSales}
                subtitle={`${dashboard.summary.totalCustomers} customers`}
                icon="💰"
              />
              <StatCard
                title="Total Product Sales"
                value={`₹${(dashboard.summary.totalProductSales || dashboard.summary.totalRevenue).toFixed(2)}`}
                subtitle="Sum of all product line totals"
                icon="🛒"
              />
              <StatCard
                title="Total Revenue"
                value={`₹${dashboard.summary.totalRevenue.toFixed(2)}`}
                subtitle={`After discounts & taxes | Avg: ₹${dashboard.summary.avgRevenuePerFranchise.toFixed(2)} per franchise`}
                icon="📈"
              />
            </div>
            
            {/* Show difference explanation */}
            {dashboard.summary.totalProductSales && Math.abs(dashboard.summary.totalProductSales - dashboard.summary.totalRevenue) > 0.01 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Product Sales (₹{dashboard.summary.totalProductSales.toFixed(2)}) is the sum of all product line totals before discounts and taxes. 
                  Total Revenue (₹{dashboard.summary.totalRevenue.toFixed(2)}) is the final amount after discounts and taxes.
                  Difference: ₹{Math.abs(dashboard.summary.totalProductSales - dashboard.summary.totalRevenue).toFixed(2)}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <StatCard
                title="Total Customers"
                value={dashboard.summary.totalCustomers}
                icon="👥"
              />
            </div>

            {/* Franchise Performance Table */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Franchise Performance</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Franchise
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sales
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customers
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Avg Bill
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {dashboard.franchiseBreakdown.map((franchise) => (
                      <tr key={franchise.franchiseId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {franchise.franchiseName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {franchise.sales}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ₹{franchise.revenue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {franchise.customers}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ₹{franchise.avgBillValue.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/franchises/${franchise.franchiseId}`}
                            className="text-primary-600 hover:text-primary-800"
                          >
                            View Details →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Franchises Management Tab */}
        {activeTab === 'franchises' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Franchise Management</h2>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  + Add New Franchise
                </button>
              </div>

              {franchises.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🏪</div>
                  <h3 className="text-lg font-semibold mb-2">No Franchises Yet</h3>
                  <p className="text-gray-500 mb-6">Get started by creating your first franchise location.</p>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                  >
                    Create First Franchise
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {franchises.map((franchise) => (
                    <div key={franchise.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold">{franchise.name}</h3>
                          <p className="text-xs text-gray-500 mt-1">
                            Created: {new Date(franchise.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(franchise)}
                            className="px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteFranchise(franchise)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs text-gray-600">Users</p>
                          <p className="text-lg font-semibold">{franchise._count.users}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs text-gray-600">Sales</p>
                          <p className="text-lg font-semibold">{franchise._count.sales}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs text-gray-600">Customers</p>
                          <p className="text-lg font-semibold">{franchise._count.customers}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded">
                          <p className="text-xs text-gray-600">Revenue (30d)</p>
                          <p className="text-lg font-semibold">₹{(franchise.recentRevenue || 0).toFixed(0)}</p>
                        </div>
                      </div>

                      <Link
                        href={`/franchises/${franchise.id}`}
                        className="block w-full text-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                      >
                        View Details →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sales Monitoring Tab */}
        {activeTab === 'sales' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Sales Monitoring</h2>
            <p className="text-gray-500">Real-time sales monitoring across all franchises</p>
            <Link
              href="/analytics"
              className="mt-4 inline-block px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              View Detailed Analytics
            </Link>
          </div>
        )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Inventory Monitoring</h2>
            <p className="text-gray-500">Monitor inventory levels across all franchises</p>
            <Link
              href="/inventory"
              className="mt-4 inline-block px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              View Inventory Management
            </Link>
          </div>
        )}

        {/* Compliance Tab */}
        {activeTab === 'compliance' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Compliance Status</h2>
            <p className="text-gray-500">Track compliance status across all franchises</p>
            <div className="mt-4">
              <ComplianceView />
            </div>
          </div>
        )}

        {/* Payments & Commissions Tab */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Payments & Commissions</h2>
            <p className="text-gray-500">Manage payments, commissions, and royalties</p>
            <div className="mt-4">
              <PaymentsView dateRange={dateRange} />
            </div>
          </div>
        )}

        {/* Marketing Tab */}
        {activeTab === 'marketing' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Marketing Tools</h2>
            <p className="text-gray-500">Marketing campaigns and promotions for franchises</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="p-4 bg-primary-50 rounded-lg">
                <h3 className="font-semibold mb-2">Promotions</h3>
                <p className="text-sm text-gray-600">Create and manage promotional campaigns</p>
              </div>
              <div className="p-4 bg-primary-50 rounded-lg">
                <h3 className="font-semibold mb-2">Customer Communications</h3>
                <p className="text-sm text-gray-600">Send notifications and updates</p>
              </div>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Advanced Analytics</h2>
            <p className="text-gray-500">Comprehensive analytics and franchise comparison</p>
            <Link
              href="/analytics"
              className="mt-4 inline-block px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              View Full Analytics Dashboard
            </Link>
          </div>
        )}

        {/* Add Franchise Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Add New Franchise</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Franchise Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Downtown Branch"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({ name: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddFranchise}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Franchise'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Franchise Modal */}
        {showEditModal && editingFranchise && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold mb-4">Edit Franchise</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Franchise Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Downtown Branch"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingFranchise(null);
                    setFormData({ name: '' });
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditFranchise}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                  disabled={submitting}
                >
                  {submitting ? 'Updating...' : 'Update Franchise'}
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </Layout>
  );
}

// Compliance View Component
function ComplianceView() {
  const [compliance, setCompliance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompliance();
  }, []);

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
    return <p className="text-gray-500">Loading compliance data...</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Checks</th>
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
                <div className="flex gap-2">
                  {item.checks.hasUsers && <span className="text-accent-600">✓ Users</span>}
                  {item.checks.hasManager && <span className="text-accent-600">✓ Manager</span>}
                  {item.checks.hasCashier && <span className="text-accent-600">✓ Cashier</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Payments View Component
function PaymentsView({ dateRange }: { dateRange: { startDate: string; endDate: string } }) {
  const [payments, setPayments] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, [dateRange]);

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
    return <p className="text-gray-500">Loading payments data...</p>;
  }

  if (!payments) {
    return <p className="text-gray-500">No payment data available</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-primary-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-2xl font-bold">₹{payments.summary.totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Commission ({payments.summary.commissionRate}%)</p>
          <p className="text-2xl font-bold">₹{payments.summary.totalCommission.toFixed(2)}</p>
        </div>
        <div className="bg-accent-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Net Payment</p>
          <p className="text-2xl font-bold">₹{payments.summary.totalNetPayment.toFixed(2)}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Franchise</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Net Payment</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.franchisePayments.map((item: any) => (
              <tr key={item.franchiseId}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{item.franchiseName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">₹{item.totalRevenue.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">₹{item.commission.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">₹{item.netPayment.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

