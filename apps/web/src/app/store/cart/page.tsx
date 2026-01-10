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
        const customerName = response.data.name || '';
        const customerPhone = response.data.phone || '';
        console.log('[Cart] Customer found by phone:', { id: response.data.id, phone: customerPhone, name: customerName });
        setCustomer(response.data.id, customerPhone, customerName);
        setTempCustomerPhone(customerPhone);
        setTempCustomerName(customerName);
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
    const trimmedPhone = phone ? String(phone).trim() : '';
    const fullName = name ? String(name).trim() : '';
    
    console.log('[Cart] createOrUpdateCustomer called with:', { phone: trimmedPhone, name: fullName, nameLength: fullName.length });
    
    if (!trimmedPhone || trimmedPhone.length < 10) {
      showNotification('Phone number must be at least 10 characters', 'warning');
      return;
    }
    if (!fullName || fullName.length === 0) {
      showNotification('Customer name is required', 'warning');
      return;
    }
    
    try {
      if (customerId) {
        try {
          const response = await api.put(`/api/v1/customers/${customerId}`, {
            phone: trimmedPhone,
            name: fullName,
          });
          if (response.data) {
            console.log('[Cart] Customer updated:', response.data);
            setCustomer(response.data.id, response.data.phone, response.data.name);
            setTempCustomerPhone(response.data.phone);
            setTempCustomerName(response.data.name);
            showNotification('Customer updated successfully', 'success');
          }
        } catch (updateError: any) {
          console.error('Failed to update customer:', updateError);
          const errorMessage = updateError.response?.data?.error || updateError.message || 'Failed to update customer';
          const errorDetails = updateError.response?.data?.details || [];
          
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
        console.log('[Cart] Creating new customer:', { phone: trimmedPhone, name: fullName });
        const response = await api.post('/api/v1/customers', {
          phone: trimmedPhone,
          name: fullName,
        });
        if (response.data) {
          console.log('[Cart] Customer created:', response.data);
          setCustomer(response.data.id, response.data.phone, response.data.name);
          setTempCustomerPhone(response.data.phone);
          setTempCustomerName(response.data.name);
          showNotification('Customer saved successfully', 'success');
        }
      }
    } catch (error: any) {
      console.error('Failed to create/update customer:', error);
      showNotification('Failed to save customer: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  // Debounced auto-save for new customers (only when both phone and name are complete)
  useEffect(() => {
    if (!customerId && tempCustomerPhone && tempCustomerPhone.trim().length >= 10 && tempCustomerName && tempCustomerName.trim().length > 0) {
      const timeoutId = setTimeout(() => {
        // Get the latest values at the time of execution
        const currentState = useCartStore.getState();
        const latestName = (tempCustomerName || currentState.customerName || '').trim();
        const latestPhone = (tempCustomerPhone || currentState.customerPhone || '').trim();
        
        // Only save if both are still valid
        if (latestName.length > 0 && latestPhone.length >= 10) {
          console.log('[Cart] Auto-saving customer:', { phone: latestPhone, name: latestName });
          createOrUpdateCustomer(latestPhone, latestName);
        }
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [tempCustomerPhone, tempCustomerName, customerId]);

  const handleCreateSale = async (paymentMethod: string, amountPaid: number) => {
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
      
      window.dispatchEvent(new CustomEvent('sale-created', { detail: { saleId: sale.id, paymentMethod } }));
      
      if (paymentMethod === 'CREDIT') {
        // For credit payments, show notification and immediately return to POS
        showNotification(`Credit sale #${sale.saleNo} created successfully`, 'success');
        setTimeout(() => {
          router.push('/store/pos');
        }, 500);
      } else {
        // For other payment methods, show success animation
        setCompletedSale({
          saleNo: sale.saleNo || 'N/A',
          grandTotal: roundedSaleGrandTotal,
        });
        setShowSuccessAnimation(true);
        
        if (paymentMethod === 'CASH') {
          window.dispatchEvent(new CustomEvent('cash-sale-completed', { 
            detail: { 
              saleId: sale.id, 
              amount: amountPaid,
              grandTotal: roundedSaleGrandTotal 
            } 
          }));
        }
      }
    } catch (error: any) {
      console.error('[Cart] Failed to process payment:', error);
      
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
    const roundedGrandTotal = Math.round(grandTotal);

    // Quick amount buttons
    const quickAmounts = [
      { label: 'Exact', value: grandTotal },
      { label: 'Round Up', value: Math.ceil(grandTotal) },
      { label: '+100', value: grandTotal + 100 },
      { label: '+500', value: grandTotal + 500 },
    ];

    const paymentMethods = [
      { value: 'CASH', label: 'Cash', icon: '💵', color: 'green' },
      { value: 'CARD', label: 'Card', icon: '💳', color: 'blue' },
      { value: 'UPI', label: 'UPI', icon: '📱', color: 'purple' },
      { value: 'CREDIT', label: 'Credit', icon: '📝', color: 'orange' },
      { value: 'ONLINE', label: 'Online', icon: '🌐', color: 'indigo' },
    ];

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50 animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-brand-500 to-brand-600 dark:from-brand-700 dark:to-brand-800 text-white px-6 py-5 flex items-center justify-between z-10 rounded-t-3xl">
            <div>
              <h2 className="text-2xl font-bold">Payment</h2>
              <p className="text-sm text-brand-100 mt-1">Complete the transaction</p>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="p-2 rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Order Summary Card */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-lg">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">Subtotal</span>
                  <span className="font-semibold text-gray-900 dark:text-white">₹{Math.round(subTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 font-medium">Tax</span>
                  <span className="font-semibold text-gray-900 dark:text-white">₹{Math.round(taxTotal)}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">Discount</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">-₹{Math.round(discountTotal)}</span>
                  </div>
                )}
                <div className="border-t-2 border-gray-300 dark:border-gray-600 pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">Total Amount</span>
                    <span className="text-3xl font-extrabold text-brand-600 dark:text-brand-400">₹{roundedGrandTotal}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                Select Payment Method
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {paymentMethods.map((method) => {
                  const isSelected = paymentMethod === method.value;
                  const colorClasses = {
                    green: isSelected ? 'bg-green-500 text-white border-green-600' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
                    blue: isSelected ? 'bg-blue-500 text-white border-blue-600' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
                    purple: isSelected ? 'bg-purple-500 text-white border-purple-600' : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
                    orange: isSelected ? 'bg-orange-500 text-white border-orange-600' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
                    indigo: isSelected ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
                  };
                  
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(method.value);
                        if (method.value !== 'CREDIT') {
                          setAmountPaid(grandTotal.toString());
                        }
                      }}
                      disabled={isProcessing}
                      className={`p-4 rounded-xl border-2 font-semibold transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                        colorClasses[method.color as keyof typeof colorClasses]
                      } ${isSelected ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-gray-800' : 'hover:shadow-md'}`}
                    >
                      <div className="text-2xl mb-1">{method.icon}</div>
                      <div className="text-xs font-medium">{method.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount Input Section */}
            {paymentMethod !== 'CREDIT' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                    Amount Received
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">₹</span>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 text-2xl font-bold border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-xl focus:outline-none focus:ring-4 focus:ring-brand-500/50 focus:border-brand-500 transition-all"
                      step="1"
                      min="0"
                      placeholder={grandTotal.toString()}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Quick Amount Buttons */}
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Quick Amount</p>
                  <div className="grid grid-cols-4 gap-2">
                    {quickAmounts.map((quick) => (
                      <button
                        key={quick.label}
                        type="button"
                        onClick={() => setAmountPaid(quick.value.toString())}
                        className="px-3 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        {quick.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Change Display */}
                {change >= 0 ? (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-700 rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-semibold text-green-800 dark:text-green-300 block">Change to Return</span>
                        <span className="text-xs text-green-600 dark:text-green-400">Customer receives</span>
                      </div>
                      <span className="text-3xl font-extrabold text-green-600 dark:text-green-400">₹{Math.round(change)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 border-2 border-red-300 dark:border-red-700 rounded-xl p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-semibold text-red-800 dark:text-red-300 block">Insufficient Amount</span>
                        <span className="text-xs text-red-600 dark:text-red-400">Need more</span>
                      </div>
                      <span className="text-3xl font-extrabold text-red-600 dark:text-red-400">₹{Math.round(Math.abs(change))}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Credit Payment Info */}
            {paymentMethod === 'CREDIT' && (
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/30 dark:to-amber-900/30 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📝</span>
                    <span className="text-sm font-bold text-orange-800 dark:text-orange-300">Credit Sale</span>
                  </div>
                  <span className="text-2xl font-extrabold text-orange-600 dark:text-orange-400">₹{roundedGrandTotal}</span>
                </div>
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">Customer will pay later. Order will remain OPEN.</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 px-6 py-4 text-base border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={() => onPay(paymentMethod, paymentMethod === 'CREDIT' ? grandTotal : parseFloat(amountPaid))}
                disabled={(paymentMethod !== 'CREDIT' && change < 0) || isProcessing}
                className="flex-1 px-6 py-4 text-base bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {paymentMethod === 'CREDIT' ? `Credit ₹${roundedGrandTotal}` : `Pay ₹${Math.round(parseFloat(amountPaid) || 0)}`}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/store/pos')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shopping Cart</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{items.length} {items.length === 1 ? 'item' : 'items'}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/store/pos')}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Items</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Customer & Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-50 to-transparent dark:from-brand-900/10 rounded-t-2xl">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Customer Information
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter phone number"
                        value={tempCustomerPhone}
                        readOnly
                        onClick={() => setShowNumPad(true)}
                        className={`w-full px-4 py-3 pl-11 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer transition-all ${
                          tempCustomerPhone && tempCustomerPhone.trim().length > 0 && tempCustomerPhone.trim().length < 10
                            ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                            : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white'
                        }`}
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
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

                  <div className="relative z-50">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Customer Name
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter customer name"
                        value={tempCustomerName || ''}
                        onChange={(e) => {
                          const newName = e.target.value;
                          setTempCustomerName(newName);
                          // Update cart store with the full name (not trimmed) to preserve what user is typing
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
                          if (tempCustomerName && tempCustomerName.length >= 1) {
                            const filtered = allCustomers.filter((c: any) => 
                              c.name.toLowerCase().startsWith(tempCustomerName.toLowerCase())
                            ).slice(0, 5);
                            setCustomerSearchResults(filtered);
                            setShowNameDropdown(filtered.length > 0);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowNameDropdown(false), 200);
                          // Save on blur only if we have complete data
                          setTimeout(() => {
                            const currentName = (tempCustomerName || '').trim();
                            const currentPhone = (tempCustomerPhone || '').trim();
                            if (currentPhone && currentPhone.length >= 10 && currentName && currentName.length > 0) {
                              console.log('[Cart] Saving customer on blur:', { phone: currentPhone, name: currentName });
                              createOrUpdateCustomer(currentPhone, currentName);
                            }
                          }, 300);
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
                      <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                        {customerSearchResults.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              const customerName = customer.name || '';
                              const customerPhone = customer.phone || '';
                              console.log('[Cart] Customer selected from dropdown:', { id: customer.id, phone: customerPhone, name: customerName });
                              setCustomer(customer.id, customerPhone, customerName);
                              setTempCustomerPhone(customerPhone);
                              setTempCustomerName(customerName);
                              setShowNameDropdown(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                          >
                            <div className="font-medium text-sm text-gray-900 dark:text-white">{customer.name || 'Unknown'}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{customer.phone || 'No phone'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {customerName && customerPhone && (
                  <div className="mt-4 p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg">
                    <p className="text-sm text-brand-700 dark:text-brand-300">
                      <span className="font-medium">Billing to:</span> {customerName} ({customerPhone})
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Cart Items */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-50 to-transparent dark:from-brand-900/10">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Cart Items
                  </h2>
                  {items.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to empty the entire cart? This action cannot be undone.')) {
                          clearCart();
                          showNotification('Cart emptied', 'success');
                        }
                      }}
                      className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Empty Cart
                    </button>
                  )}
                </div>
              </div>
              
              <div className="p-6">
                {items.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium text-lg">Your cart is empty</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Add items from POS to get started</p>
                    <button
                      onClick={() => router.push('/store/pos')}
                      className="mt-6 px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium shadow-sm hover:shadow-md transition-all"
                    >
                      Browse Products
                    </button>
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
                          className="group flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md transition-all bg-white dark:bg-gray-800/50"
                        >
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-lg">{displayName}</h3>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300">
                                {qtyDisplay}
                              </span>
                              <span className="text-gray-400">×</span>
                              <span className="text-gray-600 dark:text-gray-400 font-medium">₹{rate.toFixed(2)}</span>
                              {item.taxRate > 0 && (
                                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium">
                                  Tax: {item.taxRate}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="font-bold text-xl text-brand-600 dark:text-brand-400">
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
                              className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
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

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-500 to-brand-600">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Order Summary
                </h2>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                    <span className="font-medium text-gray-900 dark:text-white">₹{Math.round(subTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Tax</span>
                    <span className="font-medium text-gray-900 dark:text-white">₹{Math.round(taxTotal)}</span>
                  </div>
                  
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Discount</label>
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
                  </div>
                  
                  <div className="pt-4 border-t-2 border-gray-300 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">Grand Total</span>
                      <span className="text-3xl font-bold text-brand-600 dark:text-brand-400">₹{grandTotal}</span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowPaymentModal(true)}
                  disabled={items.length === 0}
                  className="w-full py-4 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span>Proceed to Payment</span>
                  <span className="text-brand-200">₹{grandTotal}</span>
                </button>
              </div>
            </div>
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
            setTimeout(() => {
              const currentState = useCartStore.getState();
              const currentName = (currentState.customerName || tempCustomerName || '').trim();
              const currentPhone = tempCustomerPhone.trim();
              if (currentPhone && currentPhone.length >= 10 && currentName && currentName.length > 0) {
                createOrUpdateCustomer(currentPhone, currentName);
              }
            }, 150);
          }}
          onSubmit={() => {
            setShowKeyboard(false);
            setTimeout(() => {
              const currentState = useCartStore.getState();
              const currentName = (currentState.customerName || tempCustomerName || '').trim();
              const currentPhone = tempCustomerPhone.trim();
              if (currentPhone && currentPhone.length >= 10 && currentName && currentName.length > 0) {
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
