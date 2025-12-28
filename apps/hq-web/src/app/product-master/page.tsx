'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Button, Card } from '@/components/ui';

export default function ProductMasterPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [productMasters, setProductMasters] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    productType: 'WHOLE_CHICKEN',
    expectedYieldPercent: 100,
    wastageTolerancePercent: 5,
    taxCategory: '',
    hqLockedPrice: 0,
    isHQLocked: false,
  });

  useEffect(() => {
    if (!user || user.role !== 'OWNER') {
      router.push('/login');
      return;
    }
    loadData();
  }, [user, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mastersRes, productsRes] = await Promise.all([
        api.get('/api/v1/hq/product-masters'),
        api.get('/api/v1/products'),
      ]);
      setProductMasters(mastersRes.data);
      setProducts(productsRes.data.filter((p: any) => !mastersRes.data.some((m: any) => m.productId === p.id)));
    } catch (error: any) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.productId) {
      alert('Please select a product');
      return;
    }
    try {
      await api.post('/api/v1/hq/product-masters', formData);
      setShowModal(false);
      setFormData({
        productId: '',
        productType: 'WHOLE_CHICKEN',
        expectedYieldPercent: 100,
        wastageTolerancePercent: 5,
        taxCategory: '',
        hqLockedPrice: 0,
        isHQLocked: false,
      });
      await loadData();
      alert('Product Master created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create product master');
    }
  };

  const handleUpdate = async (id: string, updates: any) => {
    try {
      await api.put(`/api/v1/hq/product-masters/${id}`, updates);
      await loadData();
      alert('Product Master updated successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update product master');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product master?')) return;
    try {
      await api.delete(`/api/v1/hq/product-masters/${id}`);
      await loadData();
      alert('Product Master deleted successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete product master');
    }
  };

  const productTypes = [
    'WHOLE_CHICKEN',
    'BREAST',
    'LEG',
    'WINGS',
    'LIVER',
    'GIZZARD',
    'SKIN',
    'MINCE',
    'CUSTOM_CUT',
  ];

  if (loading) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold dark:text-white">Product Master</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage chicken-specific product configurations</p>
          </div>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            + Add Product Master
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {productMasters.map((master) => (
            <Card key={master.id} hasAccent>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold dark:text-white">{master.product.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">SKU: {master.product.sku} | PLU: {master.product.plu}</p>
                </div>
                <div className="flex gap-2">
                  {master.isHQLocked && (
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                      HQ Locked
                    </span>
                  )}
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                    {master.productType.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Expected Yield</p>
                  <p className="font-semibold dark:text-white">{master.expectedYieldPercent}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Wastage Tolerance</p>
                  <p className="font-semibold dark:text-white">{master.wastageTolerancePercent}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">HQ Locked Price</p>
                  <p className="font-semibold dark:text-white">
                    {master.hqLockedPrice ? `₹${master.hqLockedPrice}` : 'Not Set'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Tax Category</p>
                  <p className="font-semibold dark:text-white">{master.taxCategory || 'N/A'}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const newPrice = prompt('Enter new HQ locked price:');
                    if (newPrice) {
                      handleUpdate(master.id, { hqLockedPrice: parseFloat(newPrice) });
                    }
                  }}
                >
                  Update Price
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUpdate(master.id, { isHQLocked: !master.isHQLocked })}
                >
                  {master.isHQLocked ? 'Unlock' : 'Lock'} Price
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(master.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
              <h2 className="text-2xl font-bold mb-4 dark:text-white">Add Product Master</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product *</label>
                  <select
                    value={formData.productId}
                    onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    required
                  >
                    <option value="">Select product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Type *</label>
                  <select
                    value={formData.productType}
                    onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  >
                    {productTypes.map((type) => (
                      <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Yield %</label>
                  <input
                    type="number"
                    value={formData.expectedYieldPercent}
                    onChange={(e) => setFormData({ ...formData, expectedYieldPercent: parseFloat(e.target.value) || 100 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Wastage Tolerance %</label>
                  <input
                    type="number"
                    value={formData.wastageTolerancePercent}
                    onChange={(e) => setFormData({ ...formData, wastageTolerancePercent: parseFloat(e.target.value) || 5 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">HQ Locked Price</label>
                  <input
                    type="number"
                    value={formData.hqLockedPrice || ''}
                    onChange={(e) => setFormData({ ...formData, hqLockedPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    step="0.01"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Category</label>
                  <input
                    type="text"
                    value={formData.taxCategory}
                    onChange={(e) => setFormData({ ...formData, taxCategory: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    placeholder="e.g., GST_5, GST_12"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.isHQLocked}
                    onChange={(e) => setFormData({ ...formData, isHQLocked: e.target.checked })}
                    className="mr-2"
                  />
                  <label className="text-sm text-gray-700 dark:text-gray-300">Lock price at HQ level</label>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setShowModal(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCreate} className="flex-1">
                    Create
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </HQLayout>
  );
}

