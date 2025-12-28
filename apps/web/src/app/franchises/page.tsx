'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Link from 'next/link';

interface Franchise {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  _count: {
    users: number;
    sales: number;
    customers: number;
    deliveryOrders: number;
  };
  recentRevenue?: number;
}

export default function FranchisesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFranchise, setEditingFranchise] = useState<Franchise | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'OWNER') {
      router.push('/console');
      return;
    }

    loadFranchises();
  }, [user, router]);

  const loadFranchises = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/v1/stores/franchises/summary');
      setFranchises(response.data || []);
    } catch (error: any) {
      console.error('Failed to load franchises:', error);
      alert(error.response?.data?.error || 'Failed to load franchises');
    } finally {
      setLoading(false);
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

  const handleDeleteFranchise = async (franchise: Franchise) => {
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

  const openEditModal = (franchise: Franchise) => {
    setEditingFranchise(franchise);
    setFormData({ name: franchise.name });
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Loading franchises...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Franchise Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage all your franchise locations</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
          >
            + Add New Franchise
          </button>
        </div>

        {/* Franchises Grid */}
        {franchises.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-4xl mb-4">🏪</div>
            <h2 className="text-xl font-semibold mb-2">No Franchises Yet</h2>
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
              <div key={franchise.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{franchise.name}</h3>
                    <p className="text-xs text-gray-500">
                      Created: {new Date(franchise.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(franchise)}
                      className="px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteFranchise(franchise)}
                      className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
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
                    <p className="text-lg font-semibold">₹{(franchise.recentRevenue || 0).toFixed(2)}</p>
                  </div>
                </div>

                <Link
                  href={`/franchises/${franchise.id}`}
                  className="block w-full text-center px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  View Details
                </Link>
              </div>
            ))}
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

