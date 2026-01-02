'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { useNotificationStore } from '@/store/notification';

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
    name: string;
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

export default function OrdersPage() {
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
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [products, setProducts] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingSale, setCancellingSale] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (user === undefined) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'OWNER') {
      router.push('/store');
      return;
    }

    loadSales();
    loadProducts();
  }, [user, router, dateFilter]);

  const loadSales = async () => {
    setLoading(true);
    try {
      const startDate = new Date(dateFilter.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateFilter.endDate);
      endDate.setHours(23, 59, 59, 999);

      const response = await api.get('/api/v1/sales', {
        params: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      });
      setSales(response.data || []);
    } catch (error: any) {
      console.error('Failed to load sales:', error);
      showNotification('Failed to load orders', 'error');
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

    const discountTotal = parseFloat(editForm.discountTotal) || 0;
    const grandTotal = subTotal + taxTotal - discountTotal;

    return { subTotal, taxTotal, discountTotal, grandTotal };
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

      showNotification('Order updated successfully', 'success');
      setShowEditModal(false);
      setEditingSale(null);
      loadSales();
    } catch (error: any) {
      console.error('Failed to update sale:', error);
      showNotification(
        error.response?.data?.error || 'Failed to update order',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancelBill = (sale: Sale) => {
    if (sale.status === 'VOID') {
      showNotification('This bill is already cancelled', 'warning');
      return;
    }
    if (sale.status !== 'PAID') {
      showNotification('Only paid bills can be cancelled', 'warning');
      return;
    }
    setCancellingSale(sale);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const confirmCancel = async () => {
    if (!cancellingSale) return;

    setCancelling(true);
    try {
      await api.post(`/api/v1/sales/${cancellingSale.id}/void`, {
        reason: cancelReason || 'Cancelled by owner',
      });

      showNotification('Bill cancelled successfully', 'success');
      setShowCancelModal(false);
      setCancellingSale(null);
      setCancelReason('');
      loadSales();
    } catch (error: any) {
      console.error('Failed to cancel bill:', error);
      showNotification(
        error.response?.data?.error || 'Failed to cancel bill',
        'error'
      );
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col">
      {/* Header */}
      <div className="mb-3 sm:mb-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold dark:text-white mb-1 sm:mb-2">
          Past Orders
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          View and edit all past orders
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 mb-3 sm:mb-4 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] flex-shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, startDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={(e) =>
                setDateFilter({ ...dateFilter, endDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
            />
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
        <div className="flex-1 overflow-y-auto min-h-0">
          {sales.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No orders found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {sales.map((sale) => {
                return (
                  <div
                    key={sale.id}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      selectedSale?.id === sale.id
                        ? 'bg-brand-50 dark:bg-brand-900/20'
                        : ''
                    }`}
                    onClick={() => setSelectedSale(sale)}
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-base sm:text-lg dark:text-white">
                            {sale.saleNo}
                          </h3>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              sale.status === 'PAID'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                : sale.status === 'OPEN'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                : sale.status === 'VOID'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {sale.status === 'VOID' ? 'CANCELLED' : sale.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <p>
                            Customer:{' '}
                            {sale.customer
                              ? `${sale.customer.name} (${sale.customer.phone})`
                              : 'Walk-in'}
                          </p>
                          <p>
                            Created by: {sale.createdBy.name} •{' '}
                            {new Date(sale.createdAt).toLocaleString()}
                          </p>
                          <p className="text-xs">
                            {sale.items.length} item(s) • Total: ₹
                            {sale.grandTotal.toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(sale);
                          }}
                          className="px-3 sm:px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-md hover:bg-gray-600 dark:hover:bg-gray-700 text-sm transition-colors touch-target font-medium"
                        >
                          View Details
                        </button>
                        {sale.status === 'PAID' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(sale);
                            }}
                            className="px-3 sm:px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600 text-sm transition-colors touch-target font-medium"
                          >
                            Edit
                          </button>
                        )}
                        {sale.status === 'PAID' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelBill(sale);
                            }}
                            className="px-3 sm:px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm transition-colors touch-target font-medium"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* View Details Modal */}
      {selectedSale && !showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 sticky top-0">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100">
                Order Details - {selectedSale.saleNo}
              </h2>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Customer Info */}
              <div className="mb-4 sm:mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Customer Information
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
                  <p className="text-sm dark:text-white">
                    <span className="font-medium">Name:</span>{' '}
                    {selectedSale.customer?.name || 'Walk-in'}
                  </p>
                  {selectedSale.customer && (
                    <p className="text-sm dark:text-white mt-1">
                      <span className="font-medium">Phone:</span>{' '}
                      {selectedSale.customer.phone}
                    </p>
                  )}
                  <p className="text-sm dark:text-white mt-1">
                    <span className="font-medium">Created by:</span>{' '}
                    {selectedSale.createdBy.name}
                  </p>
                  <p className="text-sm dark:text-white mt-1">
                    <span className="font-medium">Date:</span>{' '}
                    {new Date(selectedSale.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Items */}
              <div className="mb-4 sm:mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Items ({selectedSale.items.length})
                </h3>
                <div className="space-y-2">
                  {selectedSale.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4 flex justify-between items-start"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base dark:text-white">
                          {item.product.name}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
                          SKU: {item.product.sku} • {item.product.unitType}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                          {item.qtyKg
                            ? `${item.qtyKg.toFixed(2)} kg`
                            : `${item.qtyPcs} pcs`}{' '}
                          × ₹{item.rate.toFixed(2)} = ₹{item.lineTotal.toFixed(2)}
                        </p>
                        {item.taxRate > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            Tax ({item.taxRate}%): ₹{item.taxAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="mb-4 sm:mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Price Breakdown
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4 space-y-2">
                  <div className="flex justify-between text-sm dark:text-white">
                    <span>Subtotal:</span>
                    <span>₹{selectedSale.subTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm dark:text-white">
                    <span>Tax:</span>
                    <span>₹{selectedSale.taxTotal.toFixed(2)}</span>
                  </div>
                  {selectedSale.discountTotal > 0 && (
                    <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                      <span>Discount:</span>
                      <span>-₹{selectedSale.discountTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">
                    <div className="flex justify-between text-base sm:text-lg font-semibold dark:text-white">
                      <span>Grand Total:</span>
                      <span>₹{selectedSale.grandTotal.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payments */}
              {selectedSale.payments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Payments ({selectedSale.payments.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedSale.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-medium text-sm sm:text-base dark:text-white">
                            {payment.method}
                          </p>
                          {payment.txnRef && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                              Ref: {payment.txnRef}
                            </p>
                          )}
                        </div>
                        <p className="font-semibold text-sm sm:text-base dark:text-white">
                          ₹{payment.amount.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex gap-2 sm:gap-3 sticky bottom-0">
              <button
                onClick={() => {
                  setSelectedSale(null);
                  openEditModal(selectedSale);
                }}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-brand-500 text-white rounded-lg font-semibold hover:bg-brand-600 transition-all touch-target"
              >
                Edit Order
              </button>
              <button
                onClick={() => setSelectedSale(null)}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all touch-target"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 sticky top-0">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100">
                Edit Order - {editingSale.saleNo}
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSale(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Items */}
              <div className="mb-4 sm:mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Items
                  </h3>
                  <button
                    onClick={handleAddItem}
                    className="px-3 py-1.5 bg-brand-500 text-white rounded-md hover:bg-brand-600 text-sm transition-colors touch-target font-medium"
                  >
                    + Add Item
                  </button>
                </div>
                <div className="space-y-3">
                  {editForm.items.map((item, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Product *
                          </label>
                          <select
                            value={item.productId}
                            onChange={(e) =>
                              handleUpdateItem(index, 'productId', e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
                          >
                            <option value="">Select product</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku}) - ₹{p.pricePerUnit?.toFixed(2) || '0.00'}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {products.find((p) => p.id === item.productId)?.unitType === 'KG'
                              ? 'Quantity (Kg)'
                              : 'Quantity (Pcs)'}{' '}
                            *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={
                              products.find((p) => p.id === item.productId)?.unitType === 'KG'
                                ? item.qtyKg || ''
                                : item.qtyPcs || ''
                            }
                            onChange={(e) => {
                              const value = parseFloat(e.target.value) || 0;
                              if (
                                products.find((p) => p.id === item.productId)?.unitType === 'KG'
                              ) {
                                handleUpdateItem(index, 'qtyKg', value);
                              } else {
                                handleUpdateItem(index, 'qtyPcs', value);
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Rate (₹) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.rate || ''}
                            onChange={(e) =>
                              handleUpdateItem(
                                index,
                                'rate',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          Line Total: ₹
                          {(
                            (item.qtyKg || item.qtyPcs || 0) * item.rate
                          ).toFixed(2)}
                        </div>
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm transition-colors touch-target font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Discount */}
              <div className="mb-4 sm:mb-6">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Discount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.discountTotal}
                  onChange={(e) =>
                    setEditForm({ ...editForm, discountTotal: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md"
                  placeholder="0.00"
                />
              </div>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Order Summary
                </h3>
                {(() => {
                  const totals = calculateTotals();
                  return (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm dark:text-white">
                        <span>Subtotal:</span>
                        <span>₹{totals.subTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm dark:text-white">
                        <span>Tax:</span>
                        <span>₹{totals.taxTotal.toFixed(2)}</span>
                      </div>
                      {totals.discountTotal > 0 && (
                        <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                          <span>Discount:</span>
                          <span>-₹{totals.discountTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">
                        <div className="flex justify-between text-base sm:text-lg font-semibold dark:text-white">
                          <span>Grand Total:</span>
                          <span>₹{totals.grandTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex gap-2 sm:gap-3 sticky bottom-0">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSale(null);
                }}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all touch-target"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2.5 sm:py-3 bg-brand-500 text-white rounded-lg font-semibold hover:bg-brand-600 transition-all touch-target"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Bill Modal */}
      {showCancelModal && cancellingSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up border border-gray-200/50 dark:border-gray-700/50">
            <div className="p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Cancel Bill - {cancellingSale.saleNo}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Are you sure you want to cancel this bill? This action cannot be undone.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason (Optional)
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter reason for cancellation..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancellingSale(null);
                    setCancelReason('');
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                  disabled={cancelling}
                >
                  No, Keep Bill
                </button>
                <button
                  onClick={confirmCancel}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling...' : 'Yes, Cancel Bill'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

