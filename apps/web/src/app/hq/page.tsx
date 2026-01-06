'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Link from 'next/link';

export default function HQPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'franchises' | 'sales' | 'inventory' | 'compliance' | 'payments' | 'marketing' | 'analytics'>('franchises');
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

  const loadFranchises = useCallback(async () => {
    try {
      const timestamp = Date.now();
      const response = await api.get('/api/v1/stores/franchises/summary', {
        params: { _t: timestamp },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      setFranchises(response.data || []);
    } catch (error: any) {
      console.error('Failed to load franchises:', error);
    }
  }, []);


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

    // User is OWNER, load franchises if on franchises tab
    console.log('[HQ Page] User is OWNER');
    if (activeTab === 'franchises') {
      loadFranchises();
    }
  }, [user?.role, router, activeTab, loadFranchises]);

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

  // Show loading state while checking user
  if (user === undefined) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Checking authentication...</p>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Franchise HQ</h1>
              <p className="text-sm text-gray-500 mt-1">Manage and monitor all franchise outlets</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/hq/dashboard"
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors flex items-center gap-2"
              >
                <span>📊</span>
                <span>View Dashboard</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {[
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
                    ? 'border-primary-500 text-primary-600 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

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
          <InventoryView />
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
      </div>
    </Layout>
  );
}

// Compliance View Component
function ComplianceView() {
  const [compliance, setCompliance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCompliance = useCallback(async () => {
    setLoading(true);
    try {
      const timestamp = Date.now();
      const response = await api.get('/api/v1/hq/compliance', {
        params: { _t: timestamp },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      setCompliance(response.data || []);
    } catch (error: any) {
      console.error('Failed to load compliance:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompliance();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadCompliance();
    }, 30000);

    // Refresh when window gains focus
    const handleFocus = () => {
      loadCompliance();
    };
    window.addEventListener('focus', handleFocus);

    // Refresh when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadCompliance();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadCompliance]);

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

// Inventory View Component
function InventoryView() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFranchise, setSelectedFranchise] = useState<string>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const loadingRef = useRef(false);
  const lastLoadTimeRef = useRef(0);

  const loadInventory = useCallback(async (force = false) => {
    // Prevent multiple simultaneous loads
    const now = Date.now();
    if (loadingRef.current && !force) {
      return;
    }
    
    // Debounce: don't load if last load was less than 1 second ago (unless forced)
    if (!force && now - lastLoadTimeRef.current < 1000) {
      return;
    }

    loadingRef.current = true;
    lastLoadTimeRef.current = now;
    setLoading(true);
    
    try {
      const timestamp = Date.now();
      const response = await api.get('/api/v1/hq/inventory-monitoring', {
        params: { 
          franchiseId: selectedFranchise,
          _t: timestamp, // Cache busting
        },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      setInventory(response.data || []);
      setLastRefresh(new Date());
    } catch (error: any) {
      console.error('Failed to load inventory:', error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [selectedFranchise]);

  useEffect(() => {
    loadInventory(true); // Force initial load
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadInventory();
    }, 30000);

    // Refresh when window gains focus (user switches back to tab)
    // Only trigger if focus was lost for more than 2 seconds
    let focusLostTime = 0;
    const handleFocus = () => {
      const now = Date.now();
      if (now - focusLostTime > 2000) {
        loadInventory();
      }
    };
    
    const handleBlur = () => {
      focusLostTime = Date.now();
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    // Refresh when page becomes visible (user switches tabs)
    // Only trigger if page was hidden for more than 2 seconds
    let hiddenTime = 0;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenTime = Date.now();
      } else {
        const now = Date.now();
        if (now - hiddenTime > 2000) {
          loadInventory();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadInventory]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">Loading inventory data...</p>
      </div>
    );
  }

  if (!inventory || inventory.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Inventory Monitoring</h2>
        <p className="text-gray-500">No inventory data available</p>
      </div>
    );
  }

  // Calculate totals across all franchises
  const allProducts = new Map<string, { name: string; sku: string; category: string; totalKg: number; totalPcs: number; unitType: string }>();
  
  inventory.forEach((storeData: any) => {
    storeData.inventory?.forEach((item: any) => {
      const key = item.productId;
      if (!allProducts.has(key)) {
        allProducts.set(key, {
          name: item.productName,
          sku: item.sku,
          category: item.category,
          totalKg: 0,
          totalPcs: 0,
          unitType: item.unitType || 'KG',
        });
      }
      const product = allProducts.get(key)!;
      product.totalKg += item.currentQtyKg || 0;
      product.totalPcs += item.currentQtyPcs || 0;
    });
  });

  const productList = Array.from(allProducts.values());

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Inventory Monitoring</h2>
          <p className="text-xs text-gray-500 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()} | Auto-refreshes every 30 seconds
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => loadInventory(true)}
            disabled={loading}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            <span>🔄</span>
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <select
            value={selectedFranchise}
            onChange={(e) => setSelectedFranchise(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md"
          >
            <option value="all">All Franchises</option>
            {inventory.map((store: any) => (
              <option key={store.storeId} value={store.storeId}>
                {store.storeName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Products</p>
          <p className="text-2xl font-bold">{productList.length}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Quantity (Kg)</p>
          <p className="text-2xl font-bold">
            {Math.round(productList.reduce((sum, p) => sum + p.totalKg, 0) * 100) / 100} kg
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Quantity (Pcs)</p>
          <p className="text-2xl font-bold">
            {productList.reduce((sum, p) => sum + p.totalPcs, 0)} pcs
          </p>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                SKU
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity (Kg)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity (Pcs)
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {productList.map((product, idx) => (
              <tr key={idx}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {product.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.sku}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {Math.round(product.totalKg * 100) / 100} kg
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {product.totalPcs} pcs
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Franchise Breakdown */}
      {selectedFranchise === 'all' && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Franchise Breakdown</h3>
          {inventory.map((storeData: any) => (
            <div key={storeData.storeId} className="mb-4 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold mb-2">{storeData.storeName}</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Kg: </span>
                  <span className="font-medium">
                    {Math.round((storeData.inventory?.reduce((sum: number, item: any) => sum + (item.currentQtyKg || 0), 0) || 0) * 100) / 100} kg
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Total Pcs: </span>
                  <span className="font-medium">
                    {storeData.inventory?.reduce((sum: number, item: any) => sum + (item.currentQtyPcs || 0), 0) || 0} pcs
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Payments View Component
function PaymentsView({ dateRange }: { dateRange: { startDate: string; endDate: string } }) {
  const [payments, setPayments] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const timestamp = Date.now();
      const response = await api.get('/api/v1/hq/payments-commissions', {
        params: {
          ...dateRange,
          _t: timestamp, // Cache busting
        },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      setPayments(response.data);
    } catch (error: any) {
      console.error('Failed to load payments:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    loadPayments();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      loadPayments();
    }, 30000);

    // Refresh when window gains focus
    const handleFocus = () => {
      loadPayments();
    };
    window.addEventListener('focus', handleFocus);

    // Refresh when page becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadPayments();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadPayments]);

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

