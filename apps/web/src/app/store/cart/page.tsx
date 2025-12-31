'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Link from 'next/link';
import Notification from '@/components/Notification';
import NumPad from '@/components/NumPad';
import VirtualKeyboard from '@/components/VirtualKeyboard';

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
  const [showNumPad, setShowNumPad] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [tempCustomerPhone, setTempCustomerPhone] = useState(customerPhone || '');
  const [tempCustomerName, setTempCustomerName] = useState(customerName || '');
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [nameSearchQuery, setNameSearchQuery] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadCart();
    loadProducts();
    loadAllCustomers();
  }, [user, router]);

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
        // If exact match found, set it
        setCustomer(response.data.id, response.data.phone, response.data.name || null);
        setTempCustomerPhone(response.data.phone);
        setTempCustomerName(response.data.name || '');
        setShowCustomerSearch(false);
        setCustomerSearchResults([]);
      } else {
        // Search for similar phone numbers
        const allCustomers = await api.get('/api/v1/customers');
        const filtered = (allCustomers.data || []).filter((c: any) => 
          c.phone.includes(phone) || phone.includes(c.phone)
        ).slice(0, 5);
        setCustomerSearchResults(filtered);
        setShowCustomerSearch(filtered.length > 0);
      }
    } catch (error: any) {
      console.error('Failed to search customers:', error);
      setShowCustomerSearch(false);
      setCustomerSearchResults([]);
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

  const searchCustomersByName = async (name: string) => {
    try {
      const filtered = allCustomers.filter((c: any) => 
        c.name.toLowerCase().includes(name.toLowerCase())
      ).slice(0, 5);
      setCustomerSearchResults(filtered);
      setShowCustomerSearch(filtered.length > 0);
    } catch (error: any) {
      console.error('Failed to search customers by name:', error);
      setShowCustomerSearch(false);
      setCustomerSearchResults([]);
    }
  };

  // Sync temp values with cart store
  useEffect(() => {
    setTempCustomerPhone(customerPhone || '');
    setTempCustomerName(customerName || '');
  }, [customerPhone, customerName]);

  // Create/update customer when both name and phone are provided
  useEffect(() => {
    if (tempCustomerPhone && tempCustomerPhone.length >= 6 && tempCustomerName && tempCustomerName.trim().length > 0) {
      // Only create if we don't have a customer ID (new customer)
      if (!customerId) {
        const timeoutId = setTimeout(() => {
          createOrUpdateCustomer(tempCustomerPhone, tempCustomerName);
        }, 500); // Debounce to avoid too many API calls
        return () => clearTimeout(timeoutId);
      }
    }
  }, [tempCustomerPhone, tempCustomerName, customerId]);

  const handleManualItemSubmit = () => {
    // Validation - standardized with POS page
    if (!manualItem.description || !manualItem.description.trim()) {
      setNotification({ message: 'Please enter item description', type: 'warning' });
      return;
    }

    const weight = parseFloat(manualItem.weight) || 0;
    const qtyPcs = parseFloat(manualItem.weight) || 1;
    
    if (manualItem.unitType === 'KG' && weight <= 0) {
      setNotification({ message: 'Please enter valid weight', type: 'warning' });
      return;
    }

    if (manualItem.unitType === 'PCS' && qtyPcs <= 0) {
      setNotification({ message: 'Please enter valid quantity', type: 'warning' });
      return;
    }

    if (!manualItem.rate || parseFloat(manualItem.rate) <= 0) {
      setNotification({ message: 'Please enter a valid rate', type: 'warning' });
      return;
    }

    const qtyKg = manualItem.unitType === 'KG' ? weight : undefined;
    const qtyPcsFinal = manualItem.unitType === 'PCS' ? qtyPcs : undefined;
    const rate = parseFloat(manualItem.rate);
    
    // Calculate base line total (qty * rate) - matching backend logic
    const qty = qtyKg || qtyPcsFinal || 1;
    const lineTotal = qty * rate; // Base amount without tax

    useCartStore.getState().addItem({
      productId: manualItem.sku || 'MANUAL',
      productName: manualItem.description,
      qtyKg,
      qtyPcs: qtyPcsFinal,
      rate,
      lineTotal, // Store base amount, tax calculated separately
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
        type: 'error'
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
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-3 md:p-4 safe-top safe-bottom">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg dark:shadow-xl w-full max-w-md max-h-[95vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50">
          {/* Header */}
          <div className="sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100">
              Payment Details
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-4 sm:p-6">
          
          {/* Payment Summary */}
          <div className="bg-brand-50/50 dark:bg-brand-900/10 border border-brand-200/40 dark:border-brand-800/30 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
            <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-3 uppercase tracking-wide">Payment Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Subtotal:</span>
                <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">₹{subTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Tax:</span>
                <span className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white">₹{taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Discount:</span>
                <span className={`text-xs sm:text-sm font-semibold ${discountTotal > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                  {discountTotal > 0 ? '-' : ''}₹{discountTotal.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-gray-300/60 dark:border-gray-600/60 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">Grand Total:</span>
                  <span className="text-base sm:text-lg font-semibold text-brand-600 dark:text-brand-400">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:bg-gray-700/40 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
              >
                <option value="CASH">💵 Cash</option>
                <option value="CARD">💳 Card</option>
                <option value="UPI">📱 UPI</option>
                <option value="ONLINE">🌐 Online</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Amount Paid
              </label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full px-3 sm:px-4 py-2.5 text-sm sm:text-base border border-gray-300/60 dark:border-gray-600/60 dark:bg-gray-700/40 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 font-medium touch-target bg-white/80 dark:bg-gray-800/40"
                step="0.01"
                min="0"
                placeholder={grandTotal.toFixed(2)}
              />
            </div>
            
            {/* Change Display */}
            {change >= 0 && (
              <div className="bg-green-50/50 dark:bg-green-900/10 border border-green-200/40 dark:border-green-800/30 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm font-medium text-green-800 dark:text-green-300">Change:</span>
                  <span className="text-sm sm:text-base font-semibold text-green-600 dark:text-green-400">₹{change.toFixed(2)}</span>
                </div>
              </div>
            )}
            {change < 0 && (
              <div className="bg-red-50/50 dark:bg-red-900/10 border border-red-200/40 dark:border-red-800/30 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs sm:text-sm font-medium text-red-800 dark:text-red-300">Insufficient Amount:</span>
                  <span className="text-sm sm:text-base font-semibold text-red-600 dark:text-red-400">₹{Math.abs(change).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-white touch-target font-medium transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onPay(paymentMethod, parseFloat(amountPaid))}
              disabled={change < 0}
              className="flex-1 px-4 py-2.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg touch-target font-medium shadow-sm hover:shadow transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pay ₹{parseFloat(amountPaid).toFixed(2)}
            </button>
          </div>
          </div>
        </div>
      </div>
    );
  };

  // Add Item Modal Component - Using same design as POS page
  const AddItemModal = ({ item, products, onChange, onClose, onSubmit }: any) => {
    const handleSkuChange = (sku: string) => {
      onChange('sku', sku);
      // Auto-fill product details if found
      const product = products.find((p: any) => p.sku === sku || p.plu === sku);
      if (product) {
        onChange('description', product.name);
        onChange('rate', product.pricePerUnit.toString());
        onChange('unitType', product.unitType);
      }
    };

    // Calculate totals for display
    const weight = parseFloat(item.weight) || 0;
    const qtyPcs = parseFloat(item.weight) || 1;
    const rate = parseFloat(item.rate) || 0;
    const calculatedTotal = item.unitType === 'KG' ? weight * rate : qtyPcs * rate;
    const showAutoCalc = (item.weight && item.rate && !item.total) || (item.total && Math.abs(parseFloat(item.total) - calculatedTotal) < 0.01);

    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-3 md:p-4 safe-top safe-bottom">
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-lg dark:shadow-xl w-full max-w-lg max-h-[95vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50">
          {/* Header */}
          <div className="sticky top-0 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100">Add Item to Cart</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            {/* SKU / Barcode */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                SKU / Barcode
              </label>
              <input
                type="text"
                value={item.sku}
                onChange={(e) => handleSkuChange(e.target.value)}
                placeholder="Enter SKU or scan barcode"
                className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:bg-gray-700/40 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
                autoFocus
              />
              {products.length > 0 && (
                <select
                  value={item.sku}
                  onChange={(e) => handleSkuChange(e.target.value)}
                  className="w-full mt-2 px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:bg-gray-700/40 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
                >
                  <option value="">Or select from products...</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.sku}>
                      {p.sku} - {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={item.description}
                onChange={(e) => onChange('description', e.target.value)}
                placeholder="Enter product description"
                className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:bg-gray-700/40 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
                required
              />
            </div>

            {/* Unit Type and Quantity */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Unit Type
                </label>
                <select
                  value={item.unitType}
                  onChange={(e) => onChange('unitType', e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:bg-gray-700/40 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
                >
                  <option value="KG">KG</option>
                  <option value="PCS">PCS</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {item.unitType === 'KG' ? 'Weight (kg)' : 'Quantity'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={item.weight}
                  onChange={(e) => onChange('weight', e.target.value)}
                  placeholder={item.unitType === 'KG' ? '0.00' : '1'}
                  step={item.unitType === 'KG' ? '0.01' : '1'}
                  min="0"
                  className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:bg-gray-700/40 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
                  required
                />
              </div>
            </div>

            {/* Rate and Total */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Rate (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={item.rate}
                  onChange={(e) => onChange('rate', e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:bg-gray-700/40 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Total (₹)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={item.total}
                    onChange={(e) => onChange('total', e.target.value)}
                    placeholder={showAutoCalc ? calculatedTotal.toFixed(2) : '0.00'}
                    step="0.01"
                    min="0"
                    className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:bg-gray-700/40 dark:text-white rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
                  />
                  {showAutoCalc && !item.total && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">
                      Auto: ₹{calculatedTotal.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Card */}
            {(item.weight && item.rate) && (
              <div className="bg-brand-50/50 dark:bg-brand-900/10 border border-brand-200/40 dark:border-brand-800/30 rounded-lg p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Subtotal:</span>
                  <span className="text-sm sm:text-base font-semibold text-brand-600 dark:text-brand-400">
                    ₹{calculatedTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 dark:text-white touch-target font-medium transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                className="flex-1 px-4 py-2.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg touch-target font-medium shadow-sm hover:shadow transition-all duration-200"
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
    <>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          duration={notification.type === 'success' ? 2000 : notification.type === 'error' ? 5000 : 4000}
          onClose={() => setNotification(null)}
        />
      )}
      <div className="w-full max-w-7xl mx-auto h-full min-h-0 overflow-hidden flex flex-col">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-gray-200/40 dark:border-gray-700/40 gap-2 sm:gap-3 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-0.5 sm:mb-1 leading-tight tracking-tight truncate">
              Shopping Cart
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">Review items and proceed to payment</p>
          </div>
          <button
            onClick={() => router.push('/store/pos')}
            className="w-full sm:w-auto px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-100/50 dark:hover:bg-gray-700/50 rounded-lg sm:rounded-xl transition-all duration-200 touch-target flex-shrink-0 backdrop-blur-sm border border-gray-200/40 dark:border-gray-700/40"
          >
            ← Back to POS
          </button>
        </div>

        <div className="flex-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-sm dark:shadow-md p-3 sm:p-4 md:p-6 lg:p-8 border border-gray-200/40 dark:border-gray-700/40 min-h-0 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-gray-200/40 dark:border-gray-700/40 gap-2 sm:gap-3">
            <h2 className="font-semibold text-lg sm:text-xl lg:text-2xl dark:text-white text-gray-800">Cart Items</h2>
            <button
              onClick={() => setShowAddItemModal(true)}
              className="w-full sm:w-auto px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg sm:rounded-xl active:scale-[0.98] font-medium flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm hover:shadow-md transition-all duration-200 touch-target text-xs sm:text-sm"
            >
              <span className="text-base sm:text-lg">+</span>
              <span>Add Item</span>
            </button>
          </div>

        {/* Customer */}
        <div className="mb-3 sm:mb-4 bg-gray-50/30 dark:bg-gray-700/15 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-200/40 dark:border-gray-700/40">
          <div className="space-y-3">
            {/* Customer Phone */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Customer Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tap to enter phone number"
                  value={tempCustomerPhone}
                  readOnly
                  onClick={() => setShowNumPad(true)}
                  className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:bg-gray-700/40 dark:text-white rounded-lg dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40 cursor-pointer"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Customer Name */}
            <div className="relative">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Customer Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Type name or tap for keyboard"
                  value={tempCustomerName}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setTempCustomerName(newName);
                    setNameSearchQuery(newName);
                    setCustomer(customerId, tempCustomerPhone || null, newName || null);
                    
                    // Show dropdown if there's a query
                    if (newName.length >= 1) {
                      const filtered = allCustomers.filter((c: any) => 
                        c.name.toLowerCase().startsWith(newName.toLowerCase())
                      ).slice(0, 5);
                      setCustomerSearchResults(filtered);
                      setShowNameDropdown(filtered.length > 0);
                    } else {
                      setShowNameDropdown(false);
                      setCustomerSearchResults([]);
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
                  onBlur={() => {
                    // Delay to allow click on dropdown item
                    setTimeout(() => {
                      setShowNameDropdown(false);
                    }, 200);
                  }}
                  className="w-full px-3 sm:px-4 py-2.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:bg-gray-700/40 dark:text-white rounded-lg dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 touch-target bg-white/80 dark:bg-gray-800/40"
                />
                <button
                  type="button"
                  onClick={() => setShowKeyboard(true)}
                  className="absolute right-10 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Open keyboard"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>
                {customerId && (
                  <button
                    type="button"
                    onClick={() => {
                      // Allow editing
                      setTempCustomerName('');
                      setCustomer(null, tempCustomerPhone || null, null);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="Edit customer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Name Dropdown */}
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
                        setCustomerSearchResults([]);
                        setNameSearchQuery('');
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white">{customer.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{customer.phone}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Info Display */}
            {customerName && customerPhone && (
              <div className="mt-2 p-2 bg-brand-50/50 dark:bg-brand-900/10 border border-brand-200/40 dark:border-brand-800/30 rounded-lg">
                <p className="text-xs sm:text-sm text-brand-600 dark:text-brand-400 font-medium">
                  Billing to: <span className="font-semibold">{customerName}</span> ({customerPhone})
                </p>
              </div>
            )}
            {!customerName && tempCustomerPhone && tempCustomerPhone.length >= 6 && (
              <p className="mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                New customer – will be saved by phone.
              </p>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 mb-3 sm:mb-4 overflow-y-auto min-h-0">
          {items.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">🛒</div>
              <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base font-medium">Cart is empty</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Add items from POS to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.id || index}
                  className="border border-gray-200/40 dark:border-gray-700/40 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:bg-gray-50/30 dark:hover:bg-gray-700/30 hover:border-brand-300/50 dark:hover:border-brand-600/50 hover:shadow-md transition-all duration-200 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm sm:text-base mb-1 dark:text-white text-gray-900 line-clamp-2">
                        {item.productName}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 bg-gray-100/50 dark:bg-gray-700/30 rounded text-[10px] font-normal whitespace-nowrap">
                          {item.qtyKg ? `${item.qtyKg} kg` : `${item.qtyPcs} pcs`}
                        </span>
                        <span>×</span>
                        <span className="font-medium">₹{item.rate.toFixed(2)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.taxRate > 0 && (
                          <span className="px-1.5 py-0.5 bg-blue-100/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-[10px] font-normal whitespace-nowrap">
                            Tax: {item.taxRate}%
                          </span>
                        )}
                        {item.metaJson?.isPriceLocked && (
                          <span className="px-1.5 py-0.5 bg-yellow-100/50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded text-[10px] font-normal flex items-center gap-1 whitespace-nowrap">
                            <span>🔒</span>
                            <span>Price Locked</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 flex-shrink-0">
                      <div className="font-semibold text-base sm:text-lg dark:text-white text-brand-600 dark:text-brand-400 whitespace-nowrap">
                        ₹{item.lineTotal.toFixed(2)}
                      </div>
                      <button
                        onClick={() => removeItem(item.id || index)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-medium hover:bg-red-50/50 dark:hover:bg-red-900/20 px-2 py-1 rounded-lg transition-all duration-200 active:scale-95 touch-target whitespace-nowrap"
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
        <div className="border-t border-gray-200/40 dark:border-gray-700/40 pt-3 sm:pt-4 space-y-2 sm:space-y-3 bg-gray-50/30 dark:bg-gray-700/15 rounded-lg sm:rounded-xl p-3 sm:p-4 -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 px-3 sm:px-4 md:px-6 lg:px-8 flex-shrink-0 mt-auto">
          <div className="flex justify-between text-sm sm:text-base dark:text-white font-medium">
            <span className="text-gray-700 dark:text-gray-300">Subtotal:</span>
            <span className="text-gray-900 dark:text-white truncate ml-2">₹{subTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm sm:text-base dark:text-white font-medium">
            <span className="text-gray-700 dark:text-gray-300">Tax:</span>
            <span className="text-gray-900 dark:text-white truncate ml-2">₹{taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm sm:text-base gap-2">
            <span className="dark:text-white text-gray-700 dark:text-gray-300 font-medium flex-shrink-0">Discount:</span>
            <input
              type="number"
              value={discountTotal}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className="w-24 sm:w-28 md:w-36 px-2 sm:px-3 py-1.5 text-sm border border-gray-300/60 dark:border-gray-600/60 dark:bg-gray-700/40 dark:text-white rounded-lg text-right touch-target focus:outline-none focus:ring-1 focus:ring-brand-400 focus:border-brand-400/60 transition-all duration-200 font-medium min-w-0 bg-white/80 dark:bg-gray-800/40"
              step="0.01"
              min="0"
            />
          </div>
          <div className="flex justify-between font-semibold text-base sm:text-lg md:text-xl border-t border-gray-300/60 dark:border-gray-600/60 pt-2 sm:pt-3 dark:text-white">
            <span className="text-gray-900 dark:text-white">Grand Total:</span>
            <span className="text-brand-600 dark:text-brand-400 truncate ml-2">₹{grandTotal.toFixed(2)}</span>
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            disabled={items.length === 0}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white py-2.5 sm:py-3 md:py-4 rounded-lg sm:rounded-xl disabled:opacity-50 disabled:cursor-not-allowed mt-3 sm:mt-4 text-sm sm:text-base md:text-lg font-medium shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] disabled:active:scale-100 touch-target flex items-center justify-center gap-2"
          >
            <span>💳</span>
            <span className="truncate">Pay ₹{grandTotal.toFixed(2)}</span>
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

      {/* Num Pad Modal */}
      {showNumPad && (
        <NumPad
          value={tempCustomerPhone}
          onChange={(value) => {
            setTempCustomerPhone(value);
            setCustomer(null, value || null, tempCustomerName || null);
            if (value && value.length >= 6) {
              searchCustomers(value);
            } else {
              setShowCustomerSearch(false);
              setCustomerSearchResults([]);
            }
          }}
          onClose={() => {
            setShowNumPad(false);
            setCustomer(null, tempCustomerPhone || null, tempCustomerName || null);
            // Create/update customer if both name and phone are provided
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

      {/* Virtual Keyboard Modal */}
      {showKeyboard && (
        <VirtualKeyboard
          value={tempCustomerName}
          onChange={(value) => {
            setTempCustomerName(value);
            setNameSearchQuery(value);
            setCustomer(customerId, tempCustomerPhone || null, value || null);
            if (value && value.length >= 1) {
              const filtered = allCustomers.filter((c: any) => 
                c.name.toLowerCase().startsWith(value.toLowerCase())
              ).slice(0, 5);
              setCustomerSearchResults(filtered);
              setShowNameDropdown(filtered.length > 0);
            } else {
              setShowNameDropdown(false);
              setCustomerSearchResults([]);
            }
          }}
          onClose={() => {
            setShowKeyboard(false);
            setCustomer(customerId, tempCustomerPhone || null, tempCustomerName || null);
            // Create/update customer if both name and phone are provided
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
