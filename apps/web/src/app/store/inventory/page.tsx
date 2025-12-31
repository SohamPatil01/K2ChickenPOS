'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Link from 'next/link';

interface InventoryItem {
  productId: string;
  productName: string;
  sku: string;
  plu: string;
  unitType: 'KG' | 'PCS';
  currentQtyKg: number;
  currentQtyPcs: number;
  imageUrl?: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default function StoreInventoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    sku: '',
    plu: '',
    categoryId: '',
    unitType: 'KG' as 'KG' | 'PCS',
    taxRate: '0',
    pricePerUnit: '',
    imageUrl: '',
    imageFile: null as File | null,
  });
  const [editLoading, setEditLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    qtyKg: '',
    qtyPcs: '',
    reason: 'ADJUSTMENT',
  });

  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductLoading, setAddProductLoading] = useState(false);
  const [addProductForm, setAddProductForm] = useState({
    name: '',
    sku: '',
    plu: '',
    categoryId: '',
    unitType: 'KG' as 'KG' | 'PCS',
    taxRate: '0',
    pricePerUnit: '',
    imageUrl: '',
    imageFile: null as File | null,
  });
  const [addProductImagePreview, setAddProductImagePreview] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<InventoryItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (user === undefined) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'MANAGER' && user.role !== 'OWNER') {
      router.push('/store');
      return;
    }

    if (user && (user.role === 'MANAGER' || user.role === 'OWNER')) {
      loadInventory();
      loadCategories();
    }
  }, [user, router]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/v1/products/categories');
      if (Array.isArray(response.data)) {
        setCategories(response.data);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('Failed to load categories', error);
      setCategories([]);
    }
  };

  const loadInventory = async () => {
    setLoading(true);
    // Clear inventory state first to force UI update
    setInventory([]);
    try {
      // Force fresh data by adding cache-busting timestamp
      const response = await api.get('/api/v1/inventory/summary', {
        params: { _t: Date.now() },
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      console.log('Inventory API response:', response.data);
      console.log('Inventory loaded:', response.data?.length || 0, 'items');
      
      // Always set to empty array if response is not valid
      if (!response.data || !Array.isArray(response.data)) {
        console.warn('Invalid response format, setting inventory to empty');
        setInventory([]);
        return;
      }
      
      // Set inventory data
      setInventory(response.data);
      
      if (response.data.length === 0) {
        console.log('No products found in inventory');
      }
    } catch (error: any) {
      console.error('Failed to load inventory:', error);
      console.error('Error details:', error.response?.data);
      // Always set to empty on error
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  const generateNextSKUAndPLU = async () => {
    try {
      const response = await api.get('/api/v1/products');
      const products = response.data || [];
      
      const skuNumbers: number[] = [];
      const pluNumbers: number[] = [];
      
      products.forEach((p: any) => {
        const skuMatch = p.sku.match(/\d+/);
        if (skuMatch) {
          skuNumbers.push(parseInt(skuMatch[0], 10));
        }
        
        const pluMatch = p.plu.match(/\d+/);
        if (pluMatch) {
          pluNumbers.push(parseInt(pluMatch[0], 10));
        }
      });
      
      const nextSkuNum = skuNumbers.length > 0 ? Math.max(...skuNumbers) + 1 : 1;
      const nextPluNum = pluNumbers.length > 0 ? Math.max(...pluNumbers) + 1 : 1;
      
      const nextSKU = String(nextSkuNum).padStart(5, '0');
      const nextPLU = String(nextPluNum).padStart(5, '0');
      
      return { sku: nextSKU, plu: nextPLU };
    } catch (error) {
      console.error('Failed to generate SKU/PLU:', error);
      return { sku: '00001', plu: '00001' };
    }
  };

  const handleAdjust = async () => {
    if (!selectedProduct) return;

    const qtyKg = parseFloat(adjustForm.qtyKg) || 0;
    const qtyPcs = parseFloat(adjustForm.qtyPcs) || 0;

    if (selectedProduct.unitType === 'KG' && qtyKg === 0) {
      alert('Please enter quantity');
      return;
    }
    if (selectedProduct.unitType === 'PCS' && qtyPcs === 0) {
      alert('Please enter quantity');
      return;
    }

    try {
      await api.post('/api/v1/inventory/adjust', {
        productId: selectedProduct.productId,
        qtyKg: selectedProduct.unitType === 'KG' ? qtyKg : undefined,
        qtyPcs: selectedProduct.unitType === 'PCS' ? qtyPcs : undefined,
        reason: adjustForm.reason || 'ADJUSTMENT',
      });
      await loadInventory();
      setShowAdjustModal(false);
      setSelectedProduct(null);
      setAdjustForm({ qtyKg: '', qtyPcs: '', reason: 'ADJUSTMENT' });
      alert('Inventory adjusted successfully!');
    } catch (error: any) {
      console.error('Inventory adjustment error:', error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        'Failed to adjust inventory';
      alert(errorMessage);
    }
  };

  const openAdjustModal = (item: InventoryItem) => {
    setSelectedProduct(item);
    setAdjustForm({
      qtyKg: '',
      qtyPcs: '',
      reason: 'ADJUSTMENT',
    });
    setShowAdjustModal(true);
  };

  const openDeleteModal = (item: InventoryItem) => {
    console.log('Opening delete modal for:', item);
    setProductToDelete(item);
    setShowDeleteModal(true);
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    setDeleteLoading(true);
    try {
      console.log('Deleting product:', productToDelete.productId);
      const response = await api.delete(`/api/v1/products/${productToDelete.productId}`);
      console.log('Delete response:', response);
      
      // Check for success (response.data?.success or just status 200)
      if (response.status === 200 || response.status === 204 || response.data?.success) {
        // Refresh inventory list
        await loadInventory();
        setShowDeleteModal(false);
        setProductToDelete(null);
        alert('Product deleted successfully');
      } else {
        throw new Error('Delete operation did not succeed');
      }
    } catch (error: any) {
      console.error('Failed to delete product:', error);
      console.error('Error response:', error?.response);
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.details ||
        error?.response?.data?.message ||
        error.message ||
        'Failed to delete product';
      alert(`Error: ${message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const resetAddProductForm = () => {
    setAddProductForm({
      name: '',
      sku: '',
      plu: '',
      categoryId: '',
      unitType: 'KG',
      taxRate: '0',
      pricePerUnit: '',
      imageUrl: '',
      imageFile: null,
    });
    setAddProductImagePreview(null);
  };

  const handleAddProductImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      setAddProductForm({ ...addProductForm, imageFile: file, imageUrl: '' });
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setAddProductImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openAddProductModal = async () => {
    const { sku, plu } = await generateNextSKUAndPLU();
    setAddProductForm({
      ...addProductForm,
      sku,
      plu,
    });
    setShowAddProductModal(true);
  };

  const handleCreateProduct = async () => {
    if (!addProductForm.name) {
      alert('Please fill in Product Name');
      return;
    }
    if (!addProductForm.sku || !addProductForm.plu) {
      alert('SKU and PLU are required');
      return;
    }
    if (!addProductForm.categoryId) {
      alert('Please select a category');
      return;
    }
    if (!addProductForm.pricePerUnit) {
      alert('Please enter a price');
      return;
    }

    setAddProductLoading(true);
    try {
      const taxRate = parseFloat(addProductForm.taxRate || '0') || 0;
      const pricePerUnit = parseFloat(addProductForm.pricePerUnit);

      let imageUrl = addProductForm.imageUrl;
      if (addProductForm.imageFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(addProductForm.imageFile);
        imageUrl = await base64Promise;
      }

      const createRes = await api.post('/api/v1/products', {
        sku: addProductForm.sku,
        plu: addProductForm.plu,
        name: addProductForm.name,
        categoryId: addProductForm.categoryId,
        unitType: addProductForm.unitType,
        taxRate,
        imageUrl: imageUrl || undefined,
      });

      const productId = createRes.data?.id;
      if (!productId) {
        throw new Error('Product created but no ID returned');
      }

      await api.post(`/api/v1/products/${productId}/price`, {
        pricePerUnit,
      });

      await loadInventory();

      resetAddProductForm();
      setShowAddProductModal(false);
      alert('Product created successfully! You can now adjust its inventory.');
    } catch (error: any) {
      console.error('Failed to create product:', error);
      const message =
        error?.response?.data?.error ||
        error.message ||
        'Failed to create product';
      alert(message);
    } finally {
      setAddProductLoading(false);
    }
  };

  const openEditModal = async (item: InventoryItem) => {
    try {
      const response = await api.get(`/api/v1/products/${item.productId}`);
      const product = response.data;

      setEditingProduct(product);
      setEditForm({
        name: product.name || '',
        sku: product.sku || '',
        plu: product.plu || '',
        categoryId: product.categoryId || '',
        unitType: product.unitType || 'KG',
        taxRate: product.taxRate?.toString() || '0',
        pricePerUnit: product.pricePerUnit?.toString() || '',
        imageUrl: product.imageUrl || '',
        imageFile: null,
      });
      setImagePreview(product.imageUrl || null);
      setShowEditModal(true);
    } catch (error: any) {
      console.error('Failed to load product details:', error);
      alert('Failed to load product details');
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB');
        return;
      }

      setEditForm({ ...editForm, imageFile: file });
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    if (!editForm.name || !editForm.sku || !editForm.plu) {
      alert('Please fill in Name, SKU and PLU');
      return;
    }
    if (!editForm.categoryId) {
      alert('Please select a category');
      return;
    }
    if (!editForm.pricePerUnit) {
      alert('Please enter a price');
      return;
    }

    setEditLoading(true);
    try {
      let imageUrl = editForm.imageUrl;

      if (editForm.imageFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(editForm.imageFile);
        imageUrl = await base64Promise;
      }

      await api.put(`/api/v1/products/${editingProduct.id}`, {
        name: editForm.name,
        sku: editForm.sku,
        plu: editForm.plu,
        categoryId: editForm.categoryId,
        unitType: editForm.unitType,
        taxRate: parseFloat(editForm.taxRate || '0') || 0,
        imageUrl: imageUrl || null,
      });

      const currentPrice = editingProduct.pricePerUnit || 0;
      const newPrice = parseFloat(editForm.pricePerUnit);
      if (currentPrice !== newPrice) {
        await api.post(`/api/v1/products/${editingProduct.id}/price`, {
          pricePerUnit: newPrice,
        });
      }

      await loadInventory();

      setShowEditModal(false);
      setEditingProduct(null);
      setEditForm({
        name: '',
        sku: '',
        plu: '',
        categoryId: '',
        unitType: 'KG',
        taxRate: '0',
        pricePerUnit: '',
        imageUrl: '',
        imageFile: null,
      });
      setImagePreview(null);
      alert('Product updated successfully!');
    } catch (error: any) {
      console.error('Failed to update product:', error);
      const message =
        error?.response?.data?.error ||
        error.message ||
        'Failed to update product';
      alert(message);
    } finally {
      setEditLoading(false);
    }
  };

  if (loading && inventory.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header Section - Stacked on mobile */}
      <div className="flex flex-col gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold dark:text-white mb-1 sm:mb-2">Inventory</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Click "Adjust" on any product to add or subtract inventory
          </p>
        </div>
        {/* Action Buttons - Stacked on mobile, row on desktop */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={openAddProductModal}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 text-sm sm:text-base transition-colors touch-target font-medium"
          >
            Add Product
          </button>
          <button
            onClick={loadInventory}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-md hover:bg-gray-600 dark:hover:bg-gray-700 text-sm sm:text-base transition-colors touch-target font-medium"
          >
            Refresh
          </button>
          <Link
            href="/store/stock-ledger"
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 text-sm sm:text-base transition-colors text-center touch-target font-medium"
          >
            Stock Ledger
          </Link>
        </div>
      </div>
      
      {/* Table Container - Responsive with horizontal scroll on mobile */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Image
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Product
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden sm:table-cell">
                  SKU
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hidden md:table-cell">
                  PLU
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Unit
                </th>
                <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Stock
                </th>
                <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase min-w-[150px]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center">
                    <p className="text-gray-500 dark:text-gray-400">Loading...</p>
                  </td>
                </tr>
              ) : inventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center">
                    <div className="py-8">
                      <p className="text-gray-500 dark:text-gray-400 mb-2">
                        No inventory data found
                      </p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                        Products may not have inventory entries yet.
                      </p>
                      <button
                        onClick={openAddProductModal}
                        className="px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600"
                      >
                        Add First Product
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                inventory.map((item) => (
                  <tr key={item.productId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.productName}
                          className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs">
                          No Image
                        </div>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 font-medium min-w-[120px]">
                      <div className="text-sm sm:text-base lg:text-lg dark:text-white font-semibold">{item.productName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 sm:hidden mt-1">SKU: {item.sku} | PLU: {item.plu}</div>
                    </td>
                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-sm sm:text-base text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                      {item.sku}
                    </td>
                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-sm sm:text-base text-gray-500 dark:text-gray-400 hidden md:table-cell">
                      {item.plu}
                    </td>
                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-sm sm:text-base text-gray-500 dark:text-gray-400">
                      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs sm:text-sm font-medium">
                        {item.unitType}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                      {item.unitType === 'KG' ? (
                        <span
                          className={`font-semibold text-sm sm:text-base lg:text-lg ${
                            item.currentQtyKg < 0
                              ? 'text-red-600 dark:text-red-400'
                              : item.currentQtyKg === 0
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {item.currentQtyKg.toFixed(2)} kg
                        </span>
                      ) : (
                        <span
                          className={`font-semibold text-sm sm:text-base lg:text-lg ${
                            item.currentQtyPcs < 0
                              ? 'text-red-600 dark:text-red-400'
                              : item.currentQtyPcs === 0
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {item.currentQtyPcs} pcs
                        </span>
                      )}
                    </td>
                    <td className="px-2 sm:px-4 lg:px-6 py-3 sm:py-4 text-sm min-w-[140px] sm:min-w-[180px]">
                      <div className="flex flex-col gap-1.5 sm:gap-2">
                        <div className="flex gap-1.5 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-brand-500 text-white rounded hover:bg-brand-600 active:bg-brand-700 transition-colors touch-target whitespace-nowrap"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => openAdjustModal(item)}
                            className="flex-1 sm:flex-none px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium bg-orange-500 text-white rounded hover:bg-orange-600 active:bg-orange-700 transition-colors touch-target whitespace-nowrap"
                          >
                            Adjust
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Delete button clicked for product:', item.productName, item.productId);
                            openDeleteModal(item);
                          }}
                          className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold bg-red-500 text-white rounded hover:bg-red-600 active:bg-red-700 transition-colors touch-target whitespace-nowrap"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Adjust Inventory Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 dark:text-white">Adjust Inventory</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  Product: <strong className="dark:text-white">{selectedProduct.productName}</strong>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  Current Stock:{' '}
                  {selectedProduct.unitType === 'KG'
                    ? `${selectedProduct.currentQtyKg.toFixed(2)} kg`
                    : `${selectedProduct.currentQtyPcs} pcs`}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {selectedProduct.unitType === 'KG' ? 'Quantity (kg)' : 'Quantity (pcs)'} *
                </label>
                <input
                  type="number"
                  value={
                    selectedProduct.unitType === 'KG'
                      ? adjustForm.qtyKg
                      : adjustForm.qtyPcs
                  }
                  onChange={(e) => {
                    if (selectedProduct.unitType === 'KG') {
                      setAdjustForm({ ...adjustForm, qtyKg: e.target.value });
                    } else {
                      setAdjustForm({ ...adjustForm, qtyPcs: e.target.value });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder={selectedProduct.unitType === 'KG' ? '0.00' : '0'}
                  step={selectedProduct.unitType === 'KG' ? '0.01' : '1'}
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter positive value to add, negative to subtract
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const current =
                        selectedProduct.unitType === 'KG'
                          ? parseFloat(adjustForm.qtyKg) || 0
                          : parseFloat(adjustForm.qtyPcs) || 0;
                      const add = selectedProduct.unitType === 'KG' ? 1 : 10;
                      if (selectedProduct.unitType === 'KG') {
                        setAdjustForm({
                          ...adjustForm,
                          qtyKg: (current + add).toString(),
                        });
                      } else {
                        setAdjustForm({
                          ...adjustForm,
                          qtyPcs: (current + add).toString(),
                        });
                      }
                    }}
                    className="px-3 py-1 text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors"
                  >
                    +{selectedProduct.unitType === 'KG' ? '1 kg' : '10 pcs'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const current =
                        selectedProduct.unitType === 'KG'
                          ? parseFloat(adjustForm.qtyKg) || 0
                          : parseFloat(adjustForm.qtyPcs) || 0;
                      const add = selectedProduct.unitType === 'KG' ? 5 : 50;
                      if (selectedProduct.unitType === 'KG') {
                        setAdjustForm({
                          ...adjustForm,
                          qtyKg: (current + add).toString(),
                        });
                      } else {
                        setAdjustForm({
                          ...adjustForm,
                          qtyPcs: (current + add).toString(),
                        });
                      }
                    }}
                    className="px-3 py-1 text-xs bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded hover:bg-brand-200 dark:hover:bg-brand-900/50 transition-colors"
                  >
                    +{selectedProduct.unitType === 'KG' ? '5 kg' : '50 pcs'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const current =
                        selectedProduct.unitType === 'KG'
                          ? parseFloat(adjustForm.qtyKg) || 0
                          : parseFloat(adjustForm.qtyPcs) || 0;
                      const subtract = selectedProduct.unitType === 'KG' ? 1 : 10;
                      if (selectedProduct.unitType === 'KG') {
                        setAdjustForm({
                          ...adjustForm,
                          qtyKg: Math.max(0, current - subtract).toString(),
                        });
                      } else {
                        setAdjustForm({
                          ...adjustForm,
                          qtyPcs: Math.max(0, current - subtract).toString(),
                        });
                      }
                    }}
                    className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    -{selectedProduct.unitType === 'KG' ? '1 kg' : '10 pcs'}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason
                </label>
                <select
                  value={adjustForm.reason}
                  onChange={(e) =>
                    setAdjustForm({ ...adjustForm, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ADJUSTMENT">Manual Adjustment</option>
                  <option value="CORRECTION">Correction</option>
                  <option value="DAMAGE">Damage</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowAdjustModal(false);
                    setSelectedProduct(null);
                    setAdjustForm({
                      qtyKg: '',
                      qtyPcs: '',
                      reason: 'ADJUSTMENT',
                    });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdjust}
                  className="flex-1 px-4 py-2 bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors"
                >
                  Adjust Inventory
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 dark:text-white">Add New Product</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={addProductForm.name}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Example: Whole Chicken"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category *
                </label>
                <select
                  value={addProductForm.categoryId}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      categoryId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SKU * (Auto-generated)
                </label>
                <input
                  type="text"
                  value={addProductForm.sku}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      sku: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Auto-generated"
                  readOnly
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Auto-generated, but can be edited if needed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  PLU * (Auto-generated)
                </label>
                <input
                  type="text"
                  value={addProductForm.plu}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      plu: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Auto-generated"
                  readOnly
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Auto-generated, but can be edited if needed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit Type *
                </label>
                <select
                  value={addProductForm.unitType}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      unitType: e.target.value as 'KG' | 'PCS',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="KG">KG</option>
                  <option value="PCS">PCS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={addProductForm.taxRate}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      taxRate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price per unit *
                </label>
                <input
                  type="number"
                  value={addProductForm.pricePerUnit}
                  onChange={(e) =>
                    setAddProductForm({
                      ...addProductForm,
                      pricePerUnit: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product Image
                </label>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Upload from local machine:
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAddProductImageFileChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">OR</div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Enter image URL:
                    </label>
                    <input
                      type="url"
                      value={addProductForm.imageUrl}
                      onChange={(e) => {
                        setAddProductForm({
                          ...addProductForm,
                          imageUrl: e.target.value,
                          imageFile: null,
                        });
                        setAddProductImagePreview(e.target.value || null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  {addProductImagePreview && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Preview:</p>
                      <img
                        src={addProductImagePreview}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded border border-gray-300 dark:border-gray-600"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
              After creating the product, you can use the "Adjust" button in the
              inventory table to add opening stock.
            </p>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowAddProductModal(false);
                  resetAddProductForm();
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white transition-colors"
                disabled={addProductLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProduct}
                className="flex-1 px-4 py-2 bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-60 transition-colors"
                disabled={addProductLoading}
              >
                {addProductLoading ? 'Creating...' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 dark:text-white">Edit Product</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category *
                </label>
                <select
                  value={editForm.categoryId}
                  onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SKU *
                </label>
                <input
                  type="text"
                  value={editForm.sku}
                  onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Unique code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  PLU *
                </label>
                <input
                  type="text"
                  value={editForm.plu}
                  onChange={(e) => setEditForm({ ...editForm, plu: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Price look-up code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Unit Type *
                </label>
                <select
                  value={editForm.unitType}
                  onChange={(e) => setEditForm({ ...editForm, unitType: e.target.value as 'KG' | 'PCS' })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="KG">KG</option>
                  <option value="PCS">PCS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  value={editForm.taxRate}
                  onChange={(e) => setEditForm({ ...editForm, taxRate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Price per unit *
                </label>
                <input
                  type="number"
                  value={editForm.pricePerUnit}
                  onChange={(e) => setEditForm({ ...editForm, pricePerUnit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product Image
                </label>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Upload from local machine:
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFileChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">OR</div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Enter image URL:
                    </label>
                    <input
                      type="url"
                      value={editForm.imageUrl}
                      onChange={(e) => {
                        setEditForm({ ...editForm, imageUrl: e.target.value, imageFile: null });
                        setImagePreview(e.target.value || null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                  {imagePreview && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Preview:</p>
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-32 h-32 object-cover rounded border border-gray-300 dark:border-gray-600"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                  setEditForm({
                    name: '',
                    sku: '',
                    plu: '',
                    categoryId: '',
                    unitType: 'KG',
                    taxRate: '0',
                    pricePerUnit: '',
                    imageUrl: '',
                    imageFile: null,
                  });
                  setImagePreview(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white transition-colors"
                disabled={editLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProduct}
                className="flex-1 px-4 py-2 bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-60 transition-colors"
                disabled={editLoading}
              >
                {editLoading ? 'Updating...' : 'Update Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4 safe-top safe-bottom">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 dark:text-white text-red-600 dark:text-red-400">
              Delete Product
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                  Are you sure you want to delete this product? This action cannot be undone.
                </p>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mt-3">
                  <p className="font-semibold text-base dark:text-white mb-1">
                    {productToDelete.productName}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    SKU: {productToDelete.sku} | PLU: {productToDelete.plu}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setProductToDelete(null);
                  }}
                  className="flex-1 px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white transition-colors touch-target"
                  disabled={deleteLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProduct}
                  className="flex-1 px-4 py-3 text-base bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-60 transition-colors touch-target font-semibold"
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Deleting...' : 'Delete Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
