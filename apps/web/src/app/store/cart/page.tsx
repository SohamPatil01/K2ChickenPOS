'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Link from 'next/link';
import Notification from '@/components/Notification';

export default function StoreCartPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    items,
    removeItem,
    updateItem,
    clearCart,
    getTotal,
    customerId,
    customerPhone,
    customerName,
    setCustomer,
    discountTotal,
    setDiscount,
    loadCart,
  } = useCartStore();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [manualItem, setManualItem] = useState({
    sku: '',
    description: '',
    weight: '',
    rate: '',
    total: '',
    unitType: 'KG' as 'KG' | 'PCS',
  });
  const [products, setProducts] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadCart();
    loadProducts();
  }, [user, router]);

  const loadProducts = async () => {
    try {
      const response = await api.get('/api/v1/products');
      if (response.data && Array.isArray(response.data)) {
        setProducts(response.data);
      }
    } catch (error: any) {
      console.error('Failed to load products:', error);
    }
  };

  const handleManualItemSubmit = () => {
      if (!manualItem.description) {
        setNotification({ message: 'Please enter item description', type: 'warning' });
        return;
      }
      if (!manualItem.rate || parseFloat(manualItem.rate) <= 0) {
        setNotification({ message: 'Please enter a valid rate', type: 'warning' });
        return;
      }

    const qtyKg = manualItem.unitType === 'KG' ? parseFloat(manualItem.weight) || 0 : undefined;
    const qtyPcs = manualItem.unitType === 'PCS' ? parseFloat(manualItem.weight) || 0 : undefined;
    const rate = parseFloat(manualItem.rate);
    const total = parseFloat(manualItem.total) || (qtyKg ? qtyKg * rate : (qtyPcs || 1) * rate);

    useCartStore.getState().addItem({
      productId: manualItem.sku || 'MANUAL',
      productName: manualItem.description,
      sku: manualItem.sku || 'MANUAL',
      qtyKg,
      qtyPcs,
      rate,
      lineTotal: total,
      taxRate: 0,
    });

    setShowAddItemModal(false);
    setManualItem({
      sku: '',
      description: '',
      weight: '',
      rate: '',
      total: '',
      unitType: 'KG',
    });
  };

  const handleCreateSale = async (paymentMethod: string, amountPaid: number) => {
    try {
      const { items, customerId, customerPhone, customerName, discountTotal } = useCartStore.getState();
      const { subTotal, taxTotal, grandTotal } = getTotal();

      if (items.length === 0) {
        setNotification({ message: 'Cart is empty', type: 'warning' });
        return;
      }

      // Step 1: Create the sale
      const saleData = {
        items: items.map((item) => ({
          productId: item.productId,
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
          rate: item.rate,
          taxRate: item.taxRate,
          metaJson: item.metaJson || undefined,
        })),
        customerId: customerId || undefined,
        customerPhone: customerPhone || undefined,
        discountTotal: discountTotal || 0,
      };

      const saleResponse = await api.post('/api/v1/sales', saleData);

      // Check if discount override approval is required
      if (saleResponse.data?.requiresApproval) {
        setShowPaymentModal(false);
        setNotification({
          message: `Sale created but discount requires manager approval. ${saleResponse.data.message} Sale #${saleResponse.data.sale.saleNo} is pending approval.`,
          type: 'info',
        });
        await clearCart();
        setTimeout(() => router.push('/store/discount-approvals'), 2000);
        return;
      }

      const sale = saleResponse.data;

      // Step 2: Pay the sale
      const paymentData = {
        payments: [
          {
            method: paymentMethod,
            amount: amountPaid,
          },
        ],
      };

      const payResponse = await api.post(`/api/v1/sales/${sale.id}/pay`, paymentData);

      await clearCart();
      setShowPaymentModal(false);
      setNotification({ message: 'Sale completed successfully!', type: 'success' });
      setTimeout(() => router.push('/store/pos'), 1500);
    } catch (error: any) {
      console.error('Failed to process payment:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Failed to process payment';
      setNotification({ message: errorMessage, type: 'error' });
    }
  };

  const { subTotal, taxTotal, grandTotal } = getTotal();

  // Payment Modal Component
  const PaymentModal = ({
    grandTotal,
    subTotal,
    taxTotal,
    discountTotal,
    onClose,
    onPay,
  }: {
    grandTotal: number;
    subTotal: number;
    taxTotal: number;
    discountTotal: number;
    onClose: () => void;
    onPay: (method: string, amount: number) => void;
  }) => {
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [amountPaid, setAmountPaid] = useState(grandTotal.toFixed(2));
    const change = parseFloat(amountPaid) - grandTotal;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
          <h2 className="text-2xl font-bold mb-6 dark:text-white text-gray-900">Payment Details</h2>
          
          {/* Payment Summary */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-lg p-5 mb-5 border-2 border-gray-200 dark:border-gray-600">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Subtotal:</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">₹{subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tax:</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">₹{taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Discount:</span>
                <span className={`text-sm font-semibold ${discountTotal > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {discountTotal > 0 ? '-' : ''}₹{discountTotal.toFixed(2)}
                </span>
              </div>
              <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-gray-900 dark:text-white">Grand Total:</span>
                  <span className="text-xl font-bold text-brand-600 dark:text-brand-400">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
              >
                <option value="CASH">💵 Cash</option>
                <option value="CARD">💳 Card</option>
                <option value="UPI">📱 UPI</option>
                <option value="ONLINE">🌐 Online</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount Paid
              </label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all text-lg font-semibold"
                step="0.01"
                min="0"
                placeholder={grandTotal.toFixed(2)}
              />
            </div>
            
            {/* Change Display */}
            {change >= 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-800 dark:text-green-300">Change:</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">₹{change.toFixed(2)}</span>
                </div>
              </div>
            )}
            {change < 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-red-800 dark:text-red-300">Insufficient Amount:</span>
                  <span className="text-lg font-bold text-red-600 dark:text-red-400">₹{Math.abs(change).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 font-semibold transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => onPay(paymentMethod, parseFloat(amountPaid))}
              disabled={change < 0}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-lg hover:from-brand-600 hover:to-brand-700 font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pay ₹{parseFloat(amountPaid).toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Add Item Modal Component
  const AddItemModal = ({ item, products, onChange, onClose, onSubmit }: any) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
          <h2 className="text-xl sm:text-2xl font-bold mb-4 dark:text-white">Add Manual Item</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SKU (Optional)
              </label>
              <input
                type="text"
                value={item.sku}
                onChange={(e) => onChange('sku', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
                placeholder="Enter SKU"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description *
              </label>
              <input
                type="text"
                value={item.description}
                onChange={(e) => onChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
                placeholder="Enter item description"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Unit Type
              </label>
              <select
                value={item.unitType}
                onChange={(e) => onChange('unitType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
              >
                <option value="KG">KG</option>
                <option value="PCS">PCS</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {item.unitType === 'KG' ? 'Weight (kg)' : 'Quantity (pcs)'} *
              </label>
              <input
                type="number"
                value={item.weight}
                onChange={(e) => onChange('weight', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
                placeholder={item.unitType === 'KG' ? 'Enter weight' : 'Enter quantity'}
                step={item.unitType === 'KG' ? '0.01' : '1'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rate (₹) *
              </label>
              <input
                type="number"
                value={item.rate}
                onChange={(e) => onChange('rate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
                placeholder="Enter rate"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Total (₹)
              </label>
              <input
                type="number"
                value={item.total}
                onChange={(e) => onChange('total', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:placeholder-gray-400"
                placeholder="Auto-calculated"
                step="0.01"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-md hover:bg-brand-600"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          duration={notification.type === 'success' ? 2000 : 4000}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Shopping Cart</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Review items and proceed to payment</p>
        </div>
        <button
          onClick={() => router.push('/store/pos')}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
        >
          ← Back to POS
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-bold text-2xl dark:text-white text-gray-900">Cart Items</h2>
          <button
            onClick={() => setShowAddItemModal(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-lg hover:from-brand-600 hover:to-brand-700 font-semibold shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            <span>Add Item</span>
          </button>
        </div>

        {/* Customer */}
        <div className="mb-4">
          <label className="block text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Customer phone
          </label>
          <input
            type="text"
            placeholder="Enter phone number"
            value={customerPhone || ''}
            onChange={(e) => {
              const phone = e.target.value;
              setCustomer(null, phone || null, null);
              if (phone && phone.length >= 6) {
                api
                  .get(`/api/v1/customers?phone=${phone}`)
                  .then((res) => {
                    if (res.data) {
                      setCustomer(res.data.id, phone, res.data.name || null);
                    }
                  })
                  .catch(() => {
                    // ignore lookup errors
                  });
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md text-sm sm:text-base"
          />
          {customerName && (
            <p className="mt-1 text-xs sm:text-sm text-brand-700 dark:text-brand-400">
              Billing to: <span className="font-semibold">{customerName}</span>
            </p>
          )}
          {!customerName && customerPhone && customerPhone.length >= 6 && (
            <p className="mt-1 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              New customer – will be saved by phone.
            </p>
          )}
        </div>

        {/* Cart Items */}
        <div className="mb-4 max-h-[400px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">Cart is empty</p>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.id || index}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-sm sm:text-base mb-1 dark:text-white">
                        {item.productName}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {item.qtyKg ? `${item.qtyKg} kg` : `${item.qtyPcs} pcs`} × ₹{item.rate.toFixed(2)}
                      </div>
                      {item.taxRate > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">Tax: {item.taxRate}%</div>
                      )}
                      {item.metaJson?.isPriceLocked && (
                        <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">🔒 Price Locked by HQ</div>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-semibold text-sm sm:text-base mb-2 dark:text-white">
                        ₹{item.lineTotal.toFixed(2)}
                      </div>
                      <button
                        onClick={() => removeItem(item.id || index)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs sm:text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
          <div className="flex justify-between text-sm sm:text-base dark:text-white">
            <span>Subtotal:</span>
            <span>₹{subTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm sm:text-base dark:text-white">
            <span>Tax:</span>
            <span>₹{taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm sm:text-base">
            <span className="dark:text-white">Discount:</span>
            <input
              type="number"
              value={discountTotal}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className="w-24 sm:w-32 px-2 py-1 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-right text-sm sm:text-base"
              step="0.01"
              min="0"
            />
          </div>
          <div className="flex justify-between font-bold text-lg sm:text-xl border-t border-gray-200 dark:border-gray-700 pt-2 dark:text-white">
            <span>Total:</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={items.length === 0}
            className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white py-3.5 rounded-xl hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-base font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:active:scale-100"
          >
            Pay ₹{grandTotal.toFixed(2)}
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          grandTotal={grandTotal}
          subTotal={subTotal}
          taxTotal={taxTotal}
          discountTotal={discountTotal}
          onClose={() => setShowPaymentModal(false)}
          onPay={handleCreateSale}
        />
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <AddItemModal
          item={manualItem}
          products={products}
          onChange={(field: string, value: any) => {
            setManualItem((prev) => {
              const updated = { ...prev, [field]: value };
              // Auto-calculate total if weight/rate changed
              if (field === 'weight' || field === 'rate') {
                const weight = parseFloat(updated.weight) || 0;
                const rate = parseFloat(updated.rate) || 0;
                const qtyPcs = parseFloat(updated.weight) || 1;
                if (updated.unitType === 'KG' && weight > 0 && rate > 0) {
                  updated.total = (weight * rate).toFixed(2);
                } else if (updated.unitType === 'PCS' && qtyPcs > 0 && rate > 0) {
                  updated.total = (qtyPcs * rate).toFixed(2);
                }
              }
              // Auto-calculate rate if total/weight changed
              if (field === 'total' || field === 'weight') {
                const total = parseFloat(updated.total) || 0;
                const weight = parseFloat(updated.weight) || 0;
                const qtyPcs = parseFloat(updated.weight) || 1;
                if (updated.unitType === 'KG' && weight > 0 && total > 0 && !updated.rate) {
                  updated.rate = (total / weight).toFixed(2);
                } else if (updated.unitType === 'PCS' && qtyPcs > 0 && total > 0 && !updated.rate) {
                  updated.rate = (total / qtyPcs).toFixed(2);
                }
              }
              return updated;
            });
          }}
          onClose={() => {
            setShowAddItemModal(false);
            setManualItem({
              sku: '',
              description: '',
              weight: '',
              rate: '',
              total: '',
              unitType: 'KG',
            });
          }}
          onSubmit={handleManualItemSubmit}
        />
      )}
      </div>
    </>
  );
}
