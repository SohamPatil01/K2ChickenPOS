'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { useNotificationStore } from '@/store/notification';
import Link from 'next/link';

interface Sale {
  id: string;
  saleNo: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
  status: string;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  createdAt: string;
  createdBy: {
    id?: string;
    name: string;
    email?: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    product: {
      id: string;
      name: string;
      sku: string;
      unitType: 'KG' | 'PCS';
    };
    qtyKg?: number;
    qtyPcs?: number;
    rate: number;
    lineTotal: number;
    taxRate: number;
    taxAmount: number;
  }>;
  payments: Array<{
    id: string;
    method: string;
    amount: number;
    txnRef?: string;
  }>;
}

export default function CashierConsolePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [editForm, setEditForm] = useState({
    discountTotal: '0',
    items: [] as Array<{
      id: string;
      productId: string;
      productName: string;
      qtyKg?: number;
      qtyPcs?: number;
      rate: number;
      taxRate: number;
    }>,
  });
  const [products, setProducts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({
    todayRevenue: 0,
    todayCount: 0,
    todayAvg: 0,
  });

  useEffect(() => {
    if (user === undefined) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'CASHIER') {
      router.push('/store/pos');
      return;
    }

    loadSales();
    loadProducts();
    loadStats();
    
    // Listen for sale events to auto-refresh
    const handleSaleCreated = () => {
      console.log('[Cashier Console] Sale created event received, refreshing...');
      loadSales();
      loadStats();
    };
    
    const handleSaleUpdated = () => {
      console.log('[Cashier Console] Sale updated event received, refreshing...');
      loadSales();
      loadStats();
    };
    
    const handleSaleDeleted = () => {
      console.log('[Cashier Console] Sale deleted event received, refreshing...');
      loadSales();
      loadStats();
    };
    
    window.addEventListener('sale-created', handleSaleCreated);
    window.addEventListener('sale-updated', handleSaleUpdated);
    window.addEventListener('sale-deleted', handleSaleDeleted);
    
    // Periodic refresh as fallback (every 30 seconds)
    const refreshInterval = setInterval(() => {
      loadSales();
      loadStats();
    }, 30000);
    
    return () => {
      window.removeEventListener('sale-created', handleSaleCreated);
      window.removeEventListener('sale-updated', handleSaleUpdated);
      window.removeEventListener('sale-deleted', handleSaleDeleted);
      clearInterval(refreshInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  const loadSales = async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await api.get('/api/v1/sales', {
        params: {
          startDate: today.toISOString(),
          endDate: tomorrow.toISOString(),
        },
      });
      const allSales = response.data || [];
      // Filter to show only sales created by this cashier
      // Match by userId (preferred) or name/email/phone as fallback
      const cashierSales = allSales.filter((sale: any) => {
        const createdBy = sale.createdBy || {};
        // First try to match by userId if available
        if (createdBy.id && user?.id) {
          return createdBy.id === user.id;
        }
        // Fallback to name/email/phone matching
        const createdByName = createdBy.name || '';
        return createdByName === user?.name || createdByName === user?.email || createdByName === user?.phone;
      });
      console.log('[Cashier Console] Total sales:', allSales.length, 'Cashier sales:', cashierSales.length);
      setSales(cashierSales);
    } catch (error: any) {
      console.error('Failed to load sales:', error);
      showNotification('Failed to load sales', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await api.get('/api/v1/products');
      setProducts(response.data || []);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const loadStats = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await api.get('/api/v1/sales', {
        params: {
          startDate: today.toISOString(),
          endDate: tomorrow.toISOString(),
        },
      });
      const allSales = response.data || [];
      const cashierSales = allSales.filter((sale: any) => {
        const createdBy = sale.createdBy || {};
        // First try to match by userId if available
        if (createdBy.id && user?.id) {
          return createdBy.id === user.id;
        }
        // Fallback to name/email/phone matching
        const createdByName = createdBy.name || '';
        return createdByName === user?.name || createdByName === user?.email || createdByName === user?.phone;
      });
      const paidSales = cashierSales.filter((s: Sale) => s.status === 'PAID');
      const revenue = paidSales.reduce((sum, s) => sum + s.grandTotal, 0);
      const count = paidSales.length;
      const avg = count > 0 ? revenue / count : 0;

      setStats({
        todayRevenue: revenue,
        todayCount: count,
        todayAvg: avg,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const openEditModal = (sale: Sale) => {
    setEditingSale(sale);
    setEditForm({
      discountTotal: sale.discountTotal.toString(),
      items: sale.items.map((item) => ({
        id: item.id,
        productId: item.product.id,
        productName: item.product.name,
        qtyKg: item.qtyKg,
        qtyPcs: item.qtyPcs,
        rate: item.rate,
        taxRate: item.taxRate,
      })),
    });
    setShowEditModal(true);
  };

  const handleAddItem = () => {
    setEditForm({
      ...editForm,
      items: [
        ...editForm.items,
        {
          id: '',
          productId: '',
          productName: '',
          qtyKg: undefined,
          qtyPcs: undefined,
          rate: 0,
          taxRate: 0,
        },
      ],
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditForm({
      ...editForm,
      items: editForm.items.filter((_, i) => i !== index),
    });
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...editForm.items];
    if (field === 'productId') {
      const product = products.find((p) => p.id === value);
      newItems[index] = {
        ...newItems[index],
        productId: value,
        productName: product?.name || '',
        rate: product?.pricePerUnit || 0,
        taxRate: product?.taxRate || 0,
      };
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
    }
    setEditForm({ ...editForm, items: newItems });
  };

  const calculateTotals = () => {
    let subTotal = 0;
    let taxTotal = 0;

    editForm.items.forEach((item) => {
      const qty = item.qtyKg || item.qtyPcs || 0;
      const lineTotal = qty * item.rate;
      subTotal += lineTotal;
      taxTotal += lineTotal * (item.taxRate / 100);
    });

    subTotal = Math.round(subTotal * 100) / 100;
    taxTotal = Math.round(taxTotal * 100) / 100;

    const discountTotal = parseFloat(editForm.discountTotal) || 0;
    const grandTotal = Math.round((subTotal + taxTotal - discountTotal) * 100) / 100;
    const roundedGrandTotal = Math.round(grandTotal);

    return { subTotal, taxTotal, discountTotal, grandTotal: roundedGrandTotal };
  };

  const handleSave = async () => {
    if (!editingSale) return;

    if (editForm.items.length === 0) {
      showNotification('Please add at least one item', 'error');
      return;
    }

    const invalidItems = editForm.items.filter(
      (item) => !item.productId || (!item.qtyKg && !item.qtyPcs) || item.rate <= 0
    );

    if (invalidItems.length > 0) {
      showNotification('Please fill in all item details correctly', 'error');
      return;
    }

    setSaving(true);
    try {
      const { subTotal, taxTotal, discountTotal, grandTotal } = calculateTotals();

      await api.put(`/api/v1/sales/${editingSale.id}`, {
        items: editForm.items.map((item) => ({
          productId: item.productId,
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
          rate: item.rate,
          taxRate: item.taxRate,
        })),
        discountTotal,
        subTotal,
        taxTotal,
        grandTotal,
      });

      showNotification('Bill updated successfully', 'success');
      setShowEditModal(false);
      setEditingSale(null);
      loadSales();
      loadStats();
      
      // Notify other consoles about the update
      window.dispatchEvent(new CustomEvent('sale-updated', { detail: { saleId: editingSale.id } }));
    } catch (error: any) {
      console.error('Failed to update sale:', error);
      showNotification(
        error.response?.data?.error || 'Failed to update bill',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  const { subTotal, taxTotal, discountTotal, grandTotal } = calculateTotals();

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold dark:text-white">Cashier Console</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your bills and sales</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              loadSales();
              loadStats();
            }}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-sm sm:text-base"
          >
            🔄 Refresh
          </button>
          <Link
            href="/store/pos"
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium text-sm sm:text-base"
          >
            New Sale →
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Today's Revenue</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ₹{stats.todayRevenue.toFixed(2)}
              </p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Today's Sales</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {stats.todayCount}
              </p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Average Bill</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                ₹{stats.todayAvg.toFixed(2)}
              </p>
            </div>
            <div className="text-3xl">📈</div>
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold dark:text-white">Your Bills Today</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {sales.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">No sales today</p>
                <Link
                  href="/store/pos"
                  className="mt-4 inline-block px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  Create First Sale
                </Link>
              </div>
            ) : (
              sales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {sale.saleNo}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {sale.customer?.name || 'Walk-in'} • {new Date(sale.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            sale.status === 'PAID'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : sale.status === 'OPEN'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {sale.status}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          {sale.items.length} items
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          ₹{sale.grandTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(sale)}
                        className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
                      >
                        Edit Bill
                      </button>
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold dark:text-white">Edit Bill - {editingSale.saleNo}</h3>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingSale(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Items
                  </label>
                  <div className="space-y-3">
                    {editForm.items.map((item, index) => (
                      <div
                        key={index}
                        className="flex flex-col sm:flex-row gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                      >
                        <select
                          value={item.productId}
                          onChange={(e) => handleUpdateItem(index, 'productId', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="">Select Product</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        {products.find((p) => p.id === item.productId)?.unitType === 'KG' ? (
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Qty (Kg)"
                            value={item.qtyKg || ''}
                            onChange={(e) => handleUpdateItem(index, 'qtyKg', parseFloat(e.target.value) || 0)}
                            className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        ) : (
                          <input
                            type="number"
                            placeholder="Qty (Pcs)"
                            value={item.qtyPcs || ''}
                            onChange={(e) => handleUpdateItem(index, 'qtyPcs', parseInt(e.target.value) || 0)}
                            className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                          />
                        )}
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Rate"
                          value={item.rate}
                          onChange={(e) => handleUpdateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={handleAddItem}
                      className="w-full px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-brand-500 dark:hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Discount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.discountTotal}
                    onChange={(e) => setEditForm({ ...editForm, discountTotal: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                    <span className="font-medium dark:text-white">₹{subTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Tax:</span>
                    <span className="font-medium dark:text-white">₹{taxTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Discount:</span>
                    <span className="font-medium dark:text-white">₹{discountTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-300 dark:border-gray-600">
                    <span className="dark:text-white">Total:</span>
                    <span className="dark:text-white">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSale(null);
                }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold dark:text-white">Bill Details - {selectedSale.saleNo}</h3>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Customer</p>
                <p className="font-medium dark:text-white">{selectedSale.customer?.name || 'Walk-in'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Items</p>
                <div className="space-y-2">
                  {selectedSale.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <div>
                        <p className="font-medium dark:text-white">{item.product.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {item.qtyKg ? `${item.qtyKg} kg` : `${item.qtyPcs} pcs`} × ₹{item.rate}
                        </p>
                      </div>
                      <p className="font-medium dark:text-white">₹{item.lineTotal.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                  <span className="font-medium dark:text-white">₹{selectedSale.subTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Tax:</span>
                  <span className="font-medium dark:text-white">₹{selectedSale.taxTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Discount:</span>
                  <span className="font-medium dark:text-white">₹{selectedSale.discountTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="dark:text-white">Total:</span>
                  <span className="dark:text-white">₹{selectedSale.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setSelectedSale(null)}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

