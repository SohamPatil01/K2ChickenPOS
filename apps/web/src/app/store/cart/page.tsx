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

      if (!sale || !sale.id) {
        throw new Error('Invalid sale response: Sale ID not found');
      }

      // Step 2: Pay the sale
      // Use the sale's grandTotal to ensure exact match (backend validates payment amount must match sale.grandTotal)
      // If amountPaid is less, use grandTotal. If more, still use grandTotal to avoid mismatch error.
      const paymentAmount = sale.grandTotal;
      
      const paymentData = {
        payments: [
          {
            method: paymentMethod,
            amount: paymentAmount,
          },
        ],
      };

      console.log('Paying sale:', {
        saleId: sale.id,
        saleGrandTotal: sale.grandTotal,
        paymentAmount: paymentAmount,
        amountPaid: amountPaid,
        change: amountPaid - sale.grandTotal,
      });

      const payResponse = await api.post(`/api/v1/sales/${sale.id}/pay`, paymentData);

      await clearCart();
      setShowPaymentModal(false);
      setNotification({ message: 'Sale completed successfully!', type: 'success' });
      setTimeout(() => router.push('/store/pos'), 1500);
    } catch (error: any) {
      console.error('Failed to process payment:', error);
      console.error('Error details:', {
        response: error.response?.data,
        status: error.response?.status,
        message: error.message,
        stack: error.stack,
      });
      
      let errorMessage = 'Failed to process payment';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.details) {
        errorMessage = error.response.data.details;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setNotification({ 
        message: errorMessage, 
        type: 'error',
        duration: 5000 
      });
      
      // Keep modal open on error so user can see the error and retry if needed
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 safe-top safe-bottom animate-fade-in">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl p-5 sm:p-7 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] border border-gray-200/50 dark:border-gray-700/50 animate-fade-in-up">
          <h2 className="text-2xl sm:text-3xl font-bold mb-5 sm:mb-7 dark:text-white text-gray-900 bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
            Payment Details
          </h2>
          
          {/* Payment Summary */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-lg p-4 sm:p-5 mb-4 sm:mb-5 border-2 border-gray-200 dark:border-gray-600">
            <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 uppercase tracking-wide">Payment Summary</h3>
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
                className="w-full px-4 py-3 text-base border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all touch-target"
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
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-semibold touch-target"
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

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-6">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 font-semibold transition-all touch-target text-base"
            >
              Cancel
            </button>
            <button
              onClick={() => onPay(paymentMethod, parseFloat(amountPaid))}
              disabled={change < 0}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-lg hover:from-brand-600 hover:to-brand-700 font-semibold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed touch-target text-base"
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 safe-top safe-bottom animate-fade-in">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-2xl p-5 sm:p-7 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] border border-gray-200/50 dark:border-gray-700/50 animate-fade-in-up">
          <h2 className="text-2xl sm:text-3xl font-bold mb-5 sm:mb-6 dark:text-white bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
            Add Manual Item
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SKU (Optional)
              </label>
              <input
                type="text"
                value={item.sku}
                onChange={(e) => onChange('sku', e.target.value)}
                className="w-full px-4 py-3 text-base border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white rounded-xl dark:placeholder-gray-400 focus:ring-4 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-300 touch-target"
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
                className="w-full px-4 py-3 text-base border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white rounded-xl dark:placeholder-gray-400 focus:ring-4 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-300 touch-target"
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
                className="w-full px-4 py-3 text-base border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white rounded-xl dark:placeholder-gray-400 focus:ring-4 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-300 touch-target"
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
                className="w-full px-4 py-3 text-base border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white rounded-xl dark:placeholder-gray-400 focus:ring-4 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-300 touch-target"
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
                className="w-full px-4 py-3 text-base border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white rounded-xl dark:placeholder-gray-400 focus:ring-4 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-300 touch-target"
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
                className="w-full px-4 py-3 text-base border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white rounded-xl dark:placeholder-gray-400 focus:ring-4 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-300 touch-target"
                placeholder="Auto-calculated"
                step="0.01"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-base border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700/50 text-gray-700 dark:text-white rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-300 touch-target font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                className="flex-1 px-4 py-3 text-base bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl hover:from-brand-600 hover:to-brand-700 transition-all duration-300 touch-target font-semibold shadow-lg hover:shadow-xl active:scale-95"
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
      <div className="w-full max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 pb-4 border-b border-gray-200/60 dark:border-gray-700/60 gap-3 sm:gap-0 animate-fade-in">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-1.5 bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
              Shopping Cart
            </h1>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Review items and proceed to payment</p>
          </div>
          <button
            onClick={() => router.push('/store/pos')}
            className="w-full sm:w-auto px-4 sm:px-5 py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm sm:text-base font-medium hover:bg-gray-100/80 dark:hover:bg-gray-700/80 rounded-xl transition-all duration-300 touch-target flex-shrink-0 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50"
          >
            ← Back to POS
          </button>
        </div>

        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-lg dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] p-4 sm:p-6 lg:p-8 border border-gray-200/50 dark:border-gray-700/50 animate-fade-in-up">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 pb-4 border-b border-gray-200/60 dark:border-gray-700/60 gap-3 sm:gap-0">
            <h2 className="font-bold text-xl sm:text-2xl lg:text-3xl dark:text-white text-gray-900">Cart Items</h2>
            <button
              onClick={() => setShowAddItemModal(true)}
              className="w-full sm:w-auto px-5 sm:px-6 py-3 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl hover:from-brand-600 hover:to-brand-700 font-semibold shadow-lg hover:shadow-xl transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 touch-target text-sm sm:text-base"
            >
              <span className="text-xl font-bold animate-pulse">+</span>
              <span>Add Item</span>
            </button>
          </div>

        {/* Customer */}
        <div className="mb-6 bg-gradient-to-br from-gray-50/50 to-transparent dark:from-gray-700/30 dark:to-transparent rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50">
          <label className="block text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Customer Phone
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Enter phone number"
              value={customerPhone || ''}
              className="w-full px-4 py-3 text-base border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white rounded-xl dark:placeholder-gray-400 focus:ring-4 focus:ring-brand-500/30 focus:border-brand-500 touch-target transition-all duration-300 shadow-sm hover:shadow-md"
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
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
          </div>
          {customerName && (
            <p className="mt-2 text-sm text-brand-700 dark:text-brand-400 font-medium animate-fade-in">
              Billing to: <span className="font-semibold">{customerName}</span>
            </p>
          )}
          {!customerName && customerPhone && customerPhone.length >= 6 && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 animate-fade-in">
              New customer – will be saved by phone.
            </p>
          )}
        </div>

        {/* Cart Items */}
        <div className="mb-6 max-h-[450px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="text-center py-12 animate-fade-in">
              <div className="text-6xl mb-4">🛒</div>
              <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Cart is empty</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Add items from POS to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={item.id || index}
                  className="border border-gray-200/60 dark:border-gray-700/60 rounded-xl p-4 sm:p-5 hover:bg-gradient-to-r hover:from-brand-50/30 hover:to-transparent dark:hover:from-brand-900/10 dark:hover:to-transparent hover:border-brand-300 dark:hover:border-brand-600 hover:shadow-lg transition-all duration-300 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base sm:text-lg mb-2 dark:text-white text-gray-900">
                        {item.productName}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-xs font-medium">
                          {item.qtyKg ? `${item.qtyKg} kg` : `${item.qtyPcs} pcs`}
                        </span>
                        <span>×</span>
                        <span className="font-medium">₹{item.rate.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {item.taxRate > 0 && (
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md text-xs font-medium">
                            Tax: {item.taxRate}%
                          </span>
                        )}
                        {item.metaJson?.isPriceLocked && (
                          <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-md text-xs font-medium flex items-center gap-1">
                            <span>🔒</span>
                            <span>Price Locked</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <div className="font-bold text-lg sm:text-xl dark:text-white text-brand-600 dark:text-brand-400">
                        ₹{item.lineTotal.toFixed(2)}
                      </div>
                      <button
                        onClick={() => removeItem(item.id || index)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition-all duration-300 active:scale-95"
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
        <div className="border-t-2 border-gray-200/60 dark:border-gray-700/60 pt-6 space-y-4 bg-gradient-to-br from-gray-50/50 to-transparent dark:from-gray-700/20 dark:to-transparent rounded-xl p-5 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between text-base sm:text-lg dark:text-white font-medium">
            <span className="text-gray-700 dark:text-gray-300">Subtotal:</span>
            <span className="text-gray-900 dark:text-white">₹{subTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base sm:text-lg dark:text-white font-medium">
            <span className="text-gray-700 dark:text-gray-300">Tax:</span>
            <span className="text-gray-900 dark:text-white">₹{taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-base sm:text-lg">
            <span className="dark:text-white text-gray-700 dark:text-gray-300 font-medium">Discount:</span>
            <input
              type="number"
              value={discountTotal}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className="w-28 sm:w-36 px-3 py-2 text-base border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700/50 dark:text-white rounded-xl text-right touch-target focus:ring-4 focus:ring-brand-500/30 focus:border-brand-500 transition-all duration-300 font-semibold"
              step="0.01"
              min="0"
            />
          </div>
          <div className="flex justify-between font-bold text-xl sm:text-2xl border-t-2 border-gray-300 dark:border-gray-600 pt-4 dark:text-white">
            <span className="text-gray-900 dark:text-white">Grand Total:</span>
            <span className="text-brand-600 dark:text-brand-400">₹{grandTotal.toFixed(2)}</span>
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={items.length === 0}
            className="w-full bg-gradient-to-r from-brand-500 to-brand-600 text-white py-4 sm:py-5 rounded-xl hover:from-brand-600 hover:to-brand-700 disabled:opacity-50 disabled:cursor-not-allowed mt-6 text-lg sm:text-xl font-bold shadow-xl hover:shadow-2xl transition-all duration-300 active:scale-95 disabled:active:scale-100 touch-target flex items-center justify-center gap-2"
          >
            <span>💳</span>
            <span>Pay ₹{grandTotal.toFixed(2)}</span>
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
