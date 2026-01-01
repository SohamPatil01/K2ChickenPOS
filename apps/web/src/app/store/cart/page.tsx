'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notification';
import api from '@/lib/api';
import NumPad from '@/components/NumPad';
import VirtualKeyboard from '@/components/VirtualKeyboard';
import { offlineDB } from '@azela-pos/offline';

export default function StoreCartPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  
  // Cart store selectors
  const items = useCartStore((state) => state.items || []);
  const removeItem = useCartStore((state) => state.removeItem);
  const getTotal = useCartStore((state) => state.getTotal);
  const customerId = useCartStore((state) => state.customerId);
  const customerPhone = useCartStore((state) => state.customerPhone);
  const customerName = useCartStore((state) => state.customerName);
  const setCustomer = useCartStore((state) => state.setCustomer);
  const discountTotal = useCartStore((state) => state.discountTotal);
  const setDiscount = useCartStore((state) => state.setDiscount);
  const loadCart = useCartStore((state) => state.loadCart);
  const clearCart = useCartStore((state) => state.clearCart);

  // State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showNumPad, setShowNumPad] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [tempCustomerPhone, setTempCustomerPhone] = useState(customerPhone || '');
  const [tempCustomerName, setTempCustomerName] = useState(customerName || '');
  const [manualItem, setManualItem] = useState({
    sku: '',
    description: '',
    weight: '',
    rate: '',
    total: '',
    unitType: 'KG' as 'KG' | 'PCS',
  });
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadCart();
    loadProducts();
    loadAllCustomers();
  }, [user, router]);

  // Sync cart periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const dbItems = await offlineDB.cart.toArray();
        const currentItems = useCartStore.getState().items;
        if (dbItems.length !== currentItems.length) {
          await loadCart();
        }
      } catch (error) {
        console.error('Error in periodic cart check:', error);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [loadCart]);

  // Sync temp values with cart store
  useEffect(() => {
    setTempCustomerPhone(customerPhone || '');
    setTempCustomerName(customerName || '');
  }, [customerPhone, customerName]);

  const loadAllCustomers = async () => {
    try {
      const response = await api.get('/api/v1/customers');
      setAllCustomers(response.data || []);
    } catch (error: any) {
      console.error('Failed to load customers:', error);
    }
  };

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

  const searchCustomers = async (phone: string) => {
    try {
      const response = await api.get(`/api/v1/customers?phone=${phone}`);
      if (response.data) {
        setCustomer(response.data.id, response.data.phone, response.data.name || null);
        setTempCustomerPhone(response.data.phone);
        setTempCustomerName(response.data.name || '');
        setCustomerSearchResults([]);
      } else {
        const allCustomers = await api.get('/api/v1/customers');
        const filtered = (allCustomers.data || []).filter((c: any) => 
          c.phone.includes(phone) || phone.includes(c.phone)
        ).slice(0, 5);
        setCustomerSearchResults(filtered);
      }
    } catch (error: any) {
      console.error('Failed to search customers:', error);
    }
  };

  const createOrUpdateCustomer = async (phone: string, name: string) => {
    if (!phone || phone.length < 6 || !name || name.trim().length === 0) {
      return;
    }
    try {
      const response = await api.post('/api/v1/customers', {
        phone,
        name: name.trim(),
      });
      if (response.data) {
        setCustomer(response.data.id, response.data.phone, response.data.name);
        setTempCustomerPhone(response.data.phone);
        setTempCustomerName(response.data.name);
      }
    } catch (error: any) {
      console.error('Failed to create/update customer:', error);
    }
  };

  // Create/update customer when both name and phone are provided
  useEffect(() => {
    if (tempCustomerPhone && tempCustomerPhone.length >= 6 && tempCustomerName && tempCustomerName.trim().length > 0) {
      if (!customerId) {
        const timeoutId = setTimeout(() => {
          createOrUpdateCustomer(tempCustomerPhone, tempCustomerName);
        }, 500);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [tempCustomerPhone, tempCustomerName, customerId]);

  const handleManualItemSubmit = () => {
    if (!manualItem.description || !manualItem.description.trim()) {
      showNotification('Please enter item description', 'warning');
      return;
    }

    const weight = parseFloat(manualItem.weight) || 0;
    const qtyPcs = parseFloat(manualItem.weight) || 1;
    
    if (manualItem.unitType === 'KG' && weight <= 0) {
      showNotification('Please enter valid weight', 'warning');
      return;
    }

    if (manualItem.unitType === 'PCS' && qtyPcs <= 0) {
      showNotification('Please enter valid quantity', 'warning');
      return;
    }

    if (!manualItem.rate || parseFloat(manualItem.rate) <= 0) {
      showNotification('Please enter a valid rate', 'warning');
      return;
    }

    const qtyKg = manualItem.unitType === 'KG' ? weight : undefined;
    const qtyPcsFinal = manualItem.unitType === 'PCS' ? qtyPcs : undefined;
    const rate = parseFloat(manualItem.rate);
    const qty = qtyKg || qtyPcsFinal || 1;
    const lineTotal = qty * rate;

    useCartStore.getState().addItem({
      productId: manualItem.sku || 'MANUAL',
      productName: manualItem.description,
      qtyKg,
      qtyPcs: qtyPcsFinal,
      rate,
      lineTotal,
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
    showNotification('Item added to cart', 'success');
  };

  const handleCreateSale = async (paymentMethod: string, amountPaid: number) => {
    try {
      const { items, customerId, customerPhone, customerName, discountTotal } = useCartStore.getState();
      const { subTotal, taxTotal, grandTotal } = getTotal();

      if (items.length === 0) {
        showNotification('Cart is empty', 'warning');
        return;
      }

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

      if (saleResponse.data?.requiresApproval) {
        setShowPaymentModal(false);
        showNotification(
          `Sale created but discount requires manager approval. Sale #${saleResponse.data.sale.saleNo} is pending approval.`,
          'info'
        );
        await clearCart();
        setTimeout(() => router.push('/store/discount-approvals'), 2000);
        return;
      }

      const sale = saleResponse.data;
      if (!sale || !sale.id) {
        throw new Error('Invalid sale response: Sale ID not found');
      }

      const roundedSaleGrandTotal = Math.round(sale.grandTotal);
      const paymentData = {
        payments: [
          {
            method: paymentMethod,
            amount: roundedSaleGrandTotal,
          },
        ],
      };

      await api.post(`/api/v1/sales/${sale.id}/pay`, paymentData);
      await clearCart();
      setShowPaymentModal(false);
      showNotification('Sale completed successfully!', 'success');
      setTimeout(() => router.push('/store/pos'), 1500);
    } catch (error: any) {
      console.error('Failed to process payment:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to process payment';
      showNotification(errorMessage, 'error');
    }
  };

  const { subTotal, taxTotal, grandTotal } = getTotal();

  // Payment Modal
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
    const [amountPaid, setAmountPaid] = useState(grandTotal.toString());
    const change = parseFloat(amountPaid) - grandTotal;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50">
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Payment</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-brand-900/20 dark:to-brand-800/10 border border-brand-200/50 dark:border-brand-800/30 rounded-xl p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="font-medium text-gray-900 dark:text-white">₹{Math.round(subTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Tax</span>
                  <span className="font-medium text-gray-900 dark:text-white">₹{Math.round(taxTotal)}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Discount</span>
                    <span className="font-medium text-red-600 dark:text-red-400">-₹{Math.round(discountTotal)}</span>
                  </div>
                )}
                <div className="border-t border-brand-200 dark:border-brand-800 pt-2 mt-2">
                  <div className="flex justify-between">
                    <span className="text-base font-semibold text-gray-900 dark:text-white">Total</span>
                    <span className="text-xl font-bold text-brand-600 dark:text-brand-400">₹{grandTotal}</span>
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
                  className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
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
                  className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium"
                  step="0.01"
                  min="0"
                  placeholder={grandTotal.toString()}
                />
              </div>
              
              {change >= 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-800 dark:text-green-300">Change</span>
                    <span className="text-lg font-semibold text-green-600 dark:text-green-400">₹{Math.round(change)}</span>
                  </div>
                </div>
              )}
              {change < 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-red-800 dark:text-red-300">Insufficient</span>
                    <span className="text-lg font-semibold text-red-600 dark:text-red-400">₹{Math.round(Math.abs(change))}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onPay(paymentMethod, parseFloat(amountPaid))}
                disabled={change < 0}
                className="flex-1 px-4 py-3 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pay ₹{Math.round(parseFloat(amountPaid) || 0)}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Add Item Modal
  const AddItemModal = ({ item, products, onChange, onClose, onSubmit }: any) => {
    const handleSkuChange = (sku: string) => {
      onChange('sku', sku);
      const product = products.find((p: any) => p.sku === sku || p.plu === sku);
      if (product) {
        onChange('description', product.name);
        onChange('rate', product.pricePerUnit.toString());
        onChange('unitType', product.unitType);
      }
    };

    const weight = parseFloat(item.weight) || 0;
    const qtyPcs = parseFloat(item.weight) || 1;
    const rate = parseFloat(item.rate) || 0;
    const calculatedTotal = item.unitType === 'KG' ? weight * rate : qtyPcs * rate;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50">
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Add Item</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                SKU / Barcode
              </label>
              <input
                type="text"
                value={item.sku}
                onChange={(e) => handleSkuChange(e.target.value)}
                placeholder="Enter SKU or scan barcode"
                className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={item.description}
                onChange={(e) => onChange('description', e.target.value)}
                placeholder="Enter product description"
                className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Unit Type
                </label>
                <select
                  value={item.unitType}
                  onChange={(e) => onChange('unitType', e.target.value)}
                  className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                >
                  <option value="KG">KG</option>
                  <option value="PCS">PCS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {item.unitType === 'KG' ? 'Weight (kg)' : 'Quantity'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={item.weight}
                  onChange={(e) => onChange('weight', e.target.value)}
                  placeholder={item.unitType === 'KG' ? '0.00' : '1'}
                  step={item.unitType === 'KG' ? '0.01' : '1'}
                  min="0"
                  className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rate (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={item.rate}
                  onChange={(e) => onChange('rate', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Total (₹)
                </label>
                <input
                  type="number"
                  value={item.total}
                  onChange={(e) => onChange('total', e.target.value)}
                  placeholder={calculatedTotal.toFixed(2)}
                  step="0.01"
                  min="0"
                  className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all"
                />
              </div>
            </div>

            {(item.weight && item.rate) && (
              <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="text-base font-semibold text-brand-600 dark:text-brand-400">
                    ₹{calculatedTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                className="flex-1 px-4 py-3 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium shadow-sm hover:shadow transition-all"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white">Cart</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/store/pos')}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => setShowAddItemModal(true)}
              className="px-4 py-2 text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2"
            >
              <span className="text-lg">+</span>
              <span>Add Item</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6">
          {/* Customer Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-4 sm:p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Tap to enter phone"
                    value={tempCustomerPhone}
                    readOnly
                    onClick={() => setShowNumPad(true)}
                    className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter customer name"
                    value={tempCustomerName}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setTempCustomerName(newName);
                      setCustomer(customerId, tempCustomerPhone || null, newName || null);
                      if (newName.length >= 1) {
                        const filtered = allCustomers.filter((c: any) => 
                          c.name.toLowerCase().startsWith(newName.toLowerCase())
                        ).slice(0, 5);
                        setCustomerSearchResults(filtered);
                        setShowNameDropdown(filtered.length > 0);
                      } else {
                        setShowNameDropdown(false);
                      }
                    }}
                    onFocus={() => {
                      if (tempCustomerName.length >= 1) {
                        const filtered = allCustomers.filter((c: any) => 
                          c.name.toLowerCase().startsWith(tempCustomerName.toLowerCase())
                        ).slice(0, 5);
                        setCustomerSearchResults(filtered);
                        setShowNameDropdown(filtered.length > 0);
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
                    className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeyboard(true)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </button>
                </div>
                
                {showNameDropdown && customerSearchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {customerSearchResults.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => {
                          setCustomer(customer.id, customer.phone, customer.name);
                          setTempCustomerPhone(customer.phone);
                          setTempCustomerName(customer.name);
                          setShowNameDropdown(false);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="font-medium text-sm text-gray-900 dark:text-white">{customer.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{customer.phone}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {customerName && customerPhone && (
              <div className="mt-4 p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg">
                <p className="text-sm text-brand-700 dark:text-brand-300">
                  <span className="font-medium">Billing to:</span> {customerName} ({customerPhone})
                </p>
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-4 sm:p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Items</h2>
            
            {items.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🛒</div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Cart is empty</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Add items from POS to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item: any, index: number) => {
                  if (!item) return null;
                  
                  const displayName = item.productName || item.productId || 'Unknown Product';
                  const qtyDisplay = item.qtyKg ? `${item.qtyKg} kg` : item.qtyPcs ? `${item.qtyPcs} pcs` : '1 pcs';
                  const rate = item.rate || 0;
                  const lineTotal = item.lineTotal || (rate * (item.qtyKg || item.qtyPcs || 1));
                  
                  return (
                    <div
                      key={item.id || `item-${index}-${item.productId || Date.now()}`}
                      className="flex items-start justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white mb-1">{displayName}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                            {qtyDisplay}
                          </span>
                          <span>×</span>
                          <span>₹{rate.toFixed(2)}</span>
                          {item.taxRate > 0 && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-xs">
                              Tax: {item.taxRate}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-semibold text-lg text-brand-600 dark:text-brand-400">
                            ₹{lineTotal.toFixed(2)}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              if (item.id) {
                                await removeItem(item.id);
                                await loadCart();
                                showNotification('Item removed', 'success');
                              }
                            } catch (error: any) {
                              showNotification('Failed to remove item', 'error');
                            }
                          }}
                          className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer - Totals & Pay Button */}
      <div className="flex-shrink-0 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto w-full p-4 sm:p-6">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-800 dark:to-gray-900/50 rounded-xl p-4 sm:p-6 border border-gray-200/50 dark:border-gray-700/50">
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span className="font-medium text-gray-900 dark:text-white">₹{Math.round(subTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Tax</span>
                <span className="font-medium text-gray-900 dark:text-white">₹{Math.round(taxTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600 dark:text-gray-400">Discount</span>
                <input
                  type="number"
                  value={discountTotal}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                  className="w-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
                  step="0.01"
                  min="0"
                />
              </div>
              <div className="border-t border-gray-300 dark:border-gray-600 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">Grand Total</span>
                  <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">₹{grandTotal}</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowPaymentModal(true)}
              disabled={items.length === 0}
              className="w-full py-4 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>💳</span>
              <span>Pay ₹{grandTotal}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
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

      {showNumPad && (
        <NumPad
          value={tempCustomerPhone}
          onChange={(value) => {
            setTempCustomerPhone(value);
            setCustomer(null, value || null, tempCustomerName || null);
            if (value && value.length >= 6) {
              searchCustomers(value);
            }
          }}
          onClose={() => {
            setShowNumPad(false);
            if (tempCustomerPhone && tempCustomerPhone.length >= 6 && tempCustomerName && tempCustomerName.trim().length > 0) {
              createOrUpdateCustomer(tempCustomerPhone, tempCustomerName);
            }
          }}
          onSubmit={() => {
            setShowNumPad(false);
            if (tempCustomerPhone && tempCustomerPhone.length >= 6 && tempCustomerName && tempCustomerName.trim().length > 0) {
              createOrUpdateCustomer(tempCustomerPhone, tempCustomerName);
            }
          }}
          placeholder="Enter phone number"
          maxLength={15}
        />
      )}

      {showKeyboard && (
        <VirtualKeyboard
          value={tempCustomerName}
          onChange={(value) => {
            setTempCustomerName(value);
            setCustomer(customerId, tempCustomerPhone || null, value || null);
            if (value && value.length >= 1) {
              const filtered = allCustomers.filter((c: any) => 
                c.name.toLowerCase().startsWith(value.toLowerCase())
              ).slice(0, 5);
              setCustomerSearchResults(filtered);
              setShowNameDropdown(filtered.length > 0);
            } else {
              setShowNameDropdown(false);
            }
          }}
          onClose={() => {
            setShowKeyboard(false);
            if (tempCustomerPhone && tempCustomerPhone.length >= 6 && tempCustomerName && tempCustomerName.trim().length > 0) {
              createOrUpdateCustomer(tempCustomerPhone, tempCustomerName);
            }
          }}
          onSubmit={() => {
            setShowKeyboard(false);
            if (tempCustomerPhone && tempCustomerPhone.length >= 6 && tempCustomerName && tempCustomerName.trim().length > 0) {
              createOrUpdateCustomer(tempCustomerPhone, tempCustomerName);
            }
          }}
          placeholder="Enter customer name"
        />
      )}

      {showAddItemModal && (
        <AddItemModal
          item={manualItem}
          products={products}
          onChange={(field: string, value: any) => {
            setManualItem((prev) => {
              const updated = { ...prev, [field]: value };
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
  );
}
