'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notification';
import api from '@/lib/api';
import NumPad from '@/components/NumPad';
import VirtualKeyboard from '@/components/VirtualKeyboard';
import BillSuccessAnimation from '@/components/BillSuccessAnimation';
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
  const discountType = useCartStore((state) => state.discountType);
  const discountPercentage = useCartStore((state) => state.discountPercentage);
  const setDiscount = useCartStore((state) => state.setDiscount);
  const setDiscountType = useCartStore((state) => state.setDiscountType);
  const setDiscountPercentage = useCartStore((state) => state.setDiscountPercentage);
  const loadCart = useCartStore((state) => state.loadCart);
  const clearCart = useCartStore((state) => state.clearCart);

  // State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNumPad, setShowNumPad] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [tempCustomerPhone, setTempCustomerPhone] = useState(customerPhone || '');
  const [tempCustomerName, setTempCustomerName] = useState(customerName || '');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [completedSale, setCompletedSale] = useState<{ saleNo: string; grandTotal: number } | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadCart();
    loadAllCustomers();
    
    // Initialize speech recognition
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript.trim();
          setTempCustomerName(transcript);
          setCustomer(customerId, tempCustomerPhone || null, transcript || null);
          setIsListening(false);
          showNotification('Name captured: ' + transcript, 'success');
          
          // Trigger customer search - will be handled by the onChange effect
        };
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            showNotification('Microphone permission denied. Please enable it in browser settings.', 'error');
          } else if (event.error === 'no-speech') {
            showNotification('No speech detected. Please try again.', 'warning');
          }
        };
        
        recognition.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current = recognition;
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
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
    // Validate phone number - must be at least 10 characters to match backend schema
    // Keep spaces/formatting as schema accepts any characters with min length 10
    const trimmedPhone = phone ? phone.trim() : '';
    const fullName = name ? name.trim() : '';
    
    if (!trimmedPhone || trimmedPhone.length < 10) {
      showNotification('Phone number must be at least 10 characters', 'warning');
      return;
    }
    if (!fullName || fullName.length === 0) {
      showNotification('Customer name is required', 'warning');
      return;
    }
    
    try {
      console.log('Saving customer - Name:', fullName, 'Length:', fullName.length, 'Phone:', trimmedPhone, 'Phone Length:', trimmedPhone.length);
      
      // If customer already exists, update it
      if (customerId) {
        try {
          console.log('Updating customer:', customerId, 'with name:', fullName, 'phone:', trimmedPhone, 'name length:', fullName.length, 'phone length:', trimmedPhone.length);
          const response = await api.put(`/api/v1/customers/${customerId}`, {
            phone: trimmedPhone,
            name: fullName,
          });
          if (response.data) {
            console.log('Customer updated successfully - Name:', response.data.name, 'Length:', response.data.name?.length);
            setCustomer(response.data.id, response.data.phone, response.data.name);
            setTempCustomerPhone(response.data.phone);
            setTempCustomerName(response.data.name);
            showNotification('Customer updated successfully', 'success');
          }
        } catch (updateError: any) {
          console.error('Failed to update customer:', updateError);
          const errorMessage = updateError.response?.data?.error || updateError.message || 'Failed to update customer';
          const errorDetails = updateError.response?.data?.details || [];
          console.error('Error details:', {
            status: updateError.response?.status,
            data: updateError.response?.data,
            message: errorMessage,
            validationErrors: errorDetails,
          });
          
          // Show detailed validation errors if available
          if (errorDetails && Array.isArray(errorDetails) && errorDetails.length > 0) {
            const validationMsg = errorDetails.map((err: any) => 
              `${err.path?.join('.') || 'field'}: ${err.message}`
            ).join(', ');
            showNotification(`Validation error: ${validationMsg}`, 'error');
          } else {
            showNotification('Failed to update customer: ' + errorMessage, 'error');
          }
        }
      } else {
        // Create new customer
        const response = await api.post('/api/v1/customers', {
          phone: trimmedPhone,
          name: fullName,
        });
        if (response.data) {
          console.log('Customer created - Name:', response.data.name, 'Length:', response.data.name?.length);
          setCustomer(response.data.id, response.data.phone, response.data.name);
          setTempCustomerPhone(response.data.phone);
          setTempCustomerName(response.data.name);
        }
      }
    } catch (error: any) {
      console.error('Failed to create/update customer:', error);
      showNotification('Failed to save customer: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  // Create/update customer when both name and phone are provided
  // Use a longer debounce to ensure full name is captured
  // Only save when user stops typing for 2 seconds
  useEffect(() => {
    if (tempCustomerPhone && tempCustomerPhone.trim().length >= 10 && tempCustomerName && tempCustomerName.trim().length > 0) {
      if (!customerId) {
        const timeoutId = setTimeout(() => {
          // Get the latest values directly from state to ensure we save the complete name
          const currentState = useCartStore.getState();
          const latestName = (currentState.customerName || tempCustomerName).trim();
          const latestPhone = tempCustomerPhone.trim();
          if (latestName.length > 0 && latestPhone.length >= 10) {
            console.log('Debounced save - Name:', latestName, 'Length:', latestName.length);
            createOrUpdateCustomer(latestPhone, latestName);
          }
        }, 2000); // Increased debounce to 2 seconds to ensure full name is captured
        return () => clearTimeout(timeoutId);
      }
    }
  }, [tempCustomerPhone, tempCustomerName, customerId]);

  const handleCreateSale = async (paymentMethod: string, amountPaid: number) => {
    // Prevent duplicate submissions
    if (isProcessingPayment) {
      console.log('[Cart] Payment already processing, ignoring duplicate call');
      return;
    }

    setIsProcessingPayment(true);
    
    try {
      const { items, customerId, customerPhone, customerName, discountTotal } = useCartStore.getState();
      const { subTotal, taxTotal, grandTotal } = getTotal();

      if (items.length === 0) {
        showNotification('Cart is empty', 'warning');
        setIsProcessingPayment(false);
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

      console.log('[Cart] Creating sale with data:', saleData);
      const saleResponse = await api.post('/api/v1/sales', saleData);
      console.log('[Cart] Sale response:', saleResponse.data);

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
        console.error('[Cart] Invalid sale response:', sale);
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
      
      // Show success animation
      setCompletedSale({
        saleNo: sale.saleNo || 'N/A',
        grandTotal: roundedSaleGrandTotal,
      });
      setShowSuccessAnimation(true);
      
      // Trigger a custom event to notify other pages to refresh
      window.dispatchEvent(new CustomEvent('sale-created', { detail: { saleId: sale.id } }));
    } catch (error: any) {
      console.error('[Cart] Failed to process payment:', error);
      console.error('[Cart] Error response:', error.response?.data);
      console.error('[Cart] Error status:', error.response?.status);
      
      let errorMessage = 'Failed to process payment';
      
      if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
        setTimeout(() => router.push('/login'), 2000);
      } else if (error.response?.status === 400) {
        errorMessage = error.response?.data?.error || 'Invalid request. Please check your cart items.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showNotification(errorMessage, 'error', 5000);
      // Don't clear processing state on error so user can retry
    } finally {
      setIsProcessingPayment(false);
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
    isProcessing = false,
  }: {
    grandTotal: number;
    subTotal: number;
    taxTotal: number;
    discountTotal: number;
    onClose: () => void;
    onPay: (method: string, amount: number) => void;
    isProcessing?: boolean;
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
              disabled={isProcessing}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <option value="CREDIT">📝 Credit</option>
                <option value="ONLINE">🌐 Online</option>
              </select>
            </div>
              
            {paymentMethod !== 'CREDIT' && (
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
            )}
            
            {paymentMethod === 'CREDIT' ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Credit Amount</span>
                  <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">₹{Math.round(grandTotal)}</span>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Customer will pay later</p>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => onPay(paymentMethod, paymentMethod === 'CREDIT' ? grandTotal : parseFloat(amountPaid))}
                disabled={(paymentMethod !== 'CREDIT' && change < 0) || isProcessing}
                className="flex-1 px-4 py-3 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : paymentMethod === 'CREDIT' ? `Credit ₹${grandTotal}` : `Pay ₹${Math.round(parseFloat(amountPaid) || 0)}`}
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
              onClick={() => router.push('/store/pos')}
              className="px-4 py-2 text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-2"
          >
            <span className="text-lg">+</span>
            <span>Add Item</span>
          </button>
          </div>
        </div>
        </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 space-y-6">
          {/* Customer Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-4 sm:p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Customer Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number <span className="text-xs text-gray-500">(min 10 digits)</span>
          </label>
                <div className="relative">
          <input
            type="text"
                    placeholder="Tap to enter phone (10+ digits)"
                    value={tempCustomerPhone}
                    readOnly
                    onClick={() => setShowNumPad(true)}
                    className={`w-full px-4 py-3 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer ${
                      tempCustomerPhone && tempCustomerPhone.trim().length > 0 && tempCustomerPhone.trim().length < 10
                        ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                        : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
                    }`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                </div>
                {tempCustomerPhone && tempCustomerPhone.trim().length > 0 && tempCustomerPhone.trim().length < 10 && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    Phone number must be at least 10 digits
            </p>
          )}
        </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter customer name or use voice input"
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
                    onBlur={() => {
                      setTimeout(() => setShowNameDropdown(false), 200);
                      // Save customer when user finishes typing (on blur) - use a small delay to ensure value is updated
                      setTimeout(() => {
                        const currentName = tempCustomerName.trim();
                        const currentPhone = tempCustomerPhone.trim();
                        if (currentPhone && currentPhone.length >= 10 && currentName && currentName.length > 0) {
                          if (!customerId) {
                            console.log('onBlur save - Name:', currentName, 'Length:', currentName.length);
                            createOrUpdateCustomer(currentPhone, currentName);
                          }
                        }
                      }, 100);
                    }}
                    className="w-full px-4 py-3 pr-24 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (recognitionRef.current) {
                            if (isListening) {
                              recognitionRef.current.stop();
                              setIsListening(false);
                            } else {
                              try {
                                recognitionRef.current.start();
                                setIsListening(true);
                                showNotification('Listening... Speak the customer name', 'info');
                              } catch (error: any) {
                                console.error('Failed to start recognition:', error);
                                showNotification('Failed to start voice input. Please try again.', 'error');
                                setIsListening(false);
                              }
                            }
                          }
                        }}
                        className={`p-2 rounded-lg transition-colors ${
                          isListening 
                            ? 'bg-red-500 text-white animate-pulse' 
                            : 'text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        title={isListening ? 'Stop listening' : 'Start voice input'}
                      >
                        {isListening ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setShowKeyboard(true)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="Open keyboard"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </div>
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
      <div className="sticky bottom-0 z-10 flex-shrink-0 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg">
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
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Discount</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDiscountType('amount')}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        discountType === 'amount'
                          ? 'bg-brand-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      ₹
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                        discountType === 'percentage'
                          ? 'bg-brand-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      %
                    </button>
                  </div>
                </div>
                {discountType === 'amount' ? (
                  <input
                    type="number"
                    value={discountTotal || ''}
                    onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={discountPercentage || ''}
                      onChange={(e) => {
                        const percentage = parseFloat(e.target.value) || 0;
                        setDiscountPercentage(Math.min(100, Math.max(0, percentage)));
                      }}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
                    {discountPercentage > 0 && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        = ₹{Math.round((subTotal * discountPercentage) / 100)}
                      </span>
                    )}
                  </div>
                )}
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
          onClose={() => {
            if (!isProcessingPayment) {
              setShowPaymentModal(false);
            }
          }}
          onPay={handleCreateSale}
          isProcessing={isProcessingPayment}
        />
      )}

      {/* Bill Success Animation */}
      {showSuccessAnimation && completedSale && (
        <BillSuccessAnimation
          saleNo={completedSale.saleNo}
          grandTotal={completedSale.grandTotal}
          onComplete={() => {
            setShowSuccessAnimation(false);
            setCompletedSale(null);
            router.push('/store/pos');
          }}
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
            if (tempCustomerPhone && tempCustomerPhone.trim().length >= 10 && tempCustomerName && tempCustomerName.trim().length > 0) {
              createOrUpdateCustomer(tempCustomerPhone, tempCustomerName);
            }
          }}
          onSubmit={() => {
            setShowNumPad(false);
            if (tempCustomerPhone && tempCustomerPhone.trim().length >= 10 && tempCustomerName && tempCustomerName.trim().length > 0) {
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
            // Use a small delay to ensure state is updated with the latest value from VirtualKeyboard
            setTimeout(() => {
              // Get the latest value from the cart store to ensure we have the complete name
              const currentState = useCartStore.getState();
              const currentName = (currentState.customerName || tempCustomerName || '').trim();
              const currentPhone = tempCustomerPhone.trim();
              if (currentPhone && currentPhone.length >= 10 && currentName && currentName.length > 0) {
                console.log('VirtualKeyboard onClose save - Name:', currentName, 'Length:', currentName.length);
                createOrUpdateCustomer(currentPhone, currentName);
              }
            }, 150);
          }}
          onSubmit={() => {
            setShowKeyboard(false);
            // Use a small delay to ensure state is updated with the latest value from VirtualKeyboard
            setTimeout(() => {
              // Get the latest value from the cart store to ensure we have the complete name
              const currentState = useCartStore.getState();
              const currentName = (currentState.customerName || tempCustomerName || '').trim();
              const currentPhone = tempCustomerPhone.trim();
              if (currentPhone && currentPhone.length >= 10 && currentName && currentName.length > 0) {
                console.log('VirtualKeyboard onSubmit save - Name:', currentName, 'Length:', currentName.length);
                createOrUpdateCustomer(currentPhone, currentName);
              }
            }, 150);
          }}
          placeholder="Enter customer name"
        />
      )}

      </div>
  );
}
