'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HQLayout from '@/components/HQLayout';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { Button, Card } from '@/components/ui';

export default function ProductsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState({
    sku: '',
    plu: '',
    name: '',
    categoryId: '',
    unitType: 'KG' as 'KG' | 'PCS',
    taxRate: 0,
    imageUrl: '',
    pricePerUnit: 0,
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    sortOrder: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

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
      const [productsRes, categoriesRes] = await Promise.all([
        api.get('/api/v1/products'),
        api.get('/api/v1/products/categories'),
      ]);
      setProducts(productsRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (error: any) {
      console.error('Failed to load data:', error);
      alert(error.response?.data?.error || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.sku || !formData.plu || !formData.name || !formData.categoryId) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const productData = {
        sku: formData.sku,
        plu: formData.plu,
        name: formData.name,
        categoryId: formData.categoryId,
        unitType: formData.unitType,
        taxRate: formData.taxRate || 0,
        imageUrl: formData.imageUrl || undefined,
      };

      const product = await api.post('/api/v1/products', productData);

      // If price is provided, set it
      if (formData.pricePerUnit > 0) {
        await api.post(`/api/v1/products/${product.data.id}/price`, {
          pricePerUnit: formData.pricePerUnit,
        });
      }

      setShowModal(false);
      setFormData({
        sku: '',
        plu: '',
        name: '',
        categoryId: '',
        unitType: 'KG',
        taxRate: 0,
        imageUrl: '',
        pricePerUnit: 0,
      });
      await loadData();
      alert('Product created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create product');
    }
  };

  const handleUpdate = async () => {
    if (!editingProduct) return;

    try {
      const updateData: any = {
        name: formData.name,
        categoryId: formData.categoryId,
        unitType: formData.unitType,
        taxRate: formData.taxRate || 0,
      };

      if (formData.sku) updateData.sku = formData.sku;
      if (formData.plu) updateData.plu = formData.plu;
      if (formData.imageUrl) updateData.imageUrl = formData.imageUrl;

      await api.put(`/api/v1/products/${editingProduct.id}`, updateData);

      // Update price if changed
      if (formData.pricePerUnit > 0 && formData.pricePerUnit !== editingProduct.pricePerUnit) {
        await api.post(`/api/v1/products/${editingProduct.id}/price`, {
          pricePerUnit: formData.pricePerUnit,
        });
      }

      setShowModal(false);
      setEditingProduct(null);
      setFormData({
        sku: '',
        plu: '',
        name: '',
        categoryId: '',
        unitType: 'KG',
        taxRate: 0,
        imageUrl: '',
        pricePerUnit: 0,
      });
      await loadData();
      alert('Product updated successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update product');
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to deactivate this product?')) {
      return;
    }

    try {
      await api.delete(`/api/v1/products/${productId}`);
      await loadData();
      alert('Product deactivated successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to deactivate product');
    }
  };

  const handleCreateCategory = async () => {
    if (!categoryForm.name) {
      alert('Please enter category name');
      return;
    }

    try {
      await api.post('/api/v1/products/categories', categoryForm);
      setShowCategoryModal(false);
      setCategoryForm({ name: '', sortOrder: 0 });
      await loadData();
      alert('Category created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create category');
    }
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku || '',
      plu: product.plu || '',
      name: product.name || '',
      categoryId: product.categoryId || '',
      unitType: product.unitType || 'KG',
      taxRate: product.taxRate || 0,
      imageUrl: product.imageUrl || '',
      pricePerUnit: product.pricePerUnit || 0,
    });
    setShowModal(true);
  };

  const filteredProducts = products.filter((p) => {
    if (selectedCategory && p.categoryId !== selectedCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        p.plu.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <HQLayout>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading products...</p>
        </div>
      </HQLayout>
    );
  }

  return (
    <HQLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold dark:text-white">Products</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage products and categories</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowCategoryModal(true)}>
              + Add Category
            </Button>
            <Button variant="primary" onClick={() => {
              setEditingProduct(null);
              setFormData({
                sku: '',
                plu: '',
                name: '',
                categoryId: '',
                unitType: 'KG',
                taxRate: 0,
                imageUrl: '',
                pricePerUnit: 0,
              });
              setShowModal(true);
            }}>
              + Add Product
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-4">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} hasAccent>
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold dark:text-white">{product.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    SKU: {product.sku} | PLU: {product.plu}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Category: {product.categoryName || 'N/A'}
                  </p>
                </div>
                <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                  {product.unitType}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Price</p>
                  <p className="text-lg font-bold dark:text-white">₹{product.pricePerUnit.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tax Rate</p>
                  <p className="text-lg font-bold dark:text-white">{product.taxRate}%</p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditModal(product)}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(product.id)}
                >
                  Deactivate
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No products found</p>
          </div>
        )}

        {/* Create/Edit Product Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold dark:text-white mb-4">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      SKU *
                    </label>
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      disabled={!!editingProduct}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      PLU *
                    </label>
                    <input
                      type="text"
                      value={formData.plu}
                      onChange={(e) => setFormData({ ...formData, plu: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      disabled={!!editingProduct}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category *
                    </label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Unit Type *
                    </label>
                    <select
                      value={formData.unitType}
                      onChange={(e) => setFormData({ ...formData, unitType: e.target.value as 'KG' | 'PCS' })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    >
                      <option value="KG">KG</option>
                      <option value="PCS">PCS</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      value={formData.taxRate}
                      onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Price Per Unit (₹)
                    </label>
                    <input
                      type="number"
                      value={formData.pricePerUnit}
                      onChange={(e) => setFormData({ ...formData, pricePerUnit: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Image URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <div className="flex gap-2 mt-6">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowModal(false);
                      setEditingProduct(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={editingProduct ? handleUpdate : handleCreate}
                  >
                    {editingProduct ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h2 className="text-2xl font-bold dark:text-white mb-4">Add Category</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={categoryForm.sortOrder}
                    onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                    min="0"
                  />
                </div>
                <div className="flex gap-2 mt-6">
                  <Button
                    variant="secondary"
                    onClick={() => setShowCategoryModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleCreateCategory}>
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

