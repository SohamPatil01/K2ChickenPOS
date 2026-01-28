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
  const [showCustomerSection, setShowCustomerSection] = useState(true); // Show by default
  const [skipCustomer, setSkipCustomer] = useState(false);

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
      if (customerId) {
        try {
          const response = await api.put(`/api/v1/customers/${customerId}`, {
            phone: trimmedPhone,
            name: fullName,
          });
          if (response.data) {
            setCustomer(response.data.id, response.data.phone, response.data.name);
            setTempCustomerPhone(response.data.phone);
            setTempCustomerName(response.data.name);
            showNotification('Customer updated successfully', 'success');
            setShowCustomerSection(false); // Auto-collapse after success
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
        const response = await api.post('/api/v1/customers', {
          phone: trimmedPhone,
          name: fullName,
        });
        if (response.data) {
          setCustomer(response.data.id, response.data.phone, response.data.name);
          setTempCustomerPhone(response.data.phone);
          setTempCustomerName(response.data.name);
          showNotification('Customer added successfully', 'success');
          setShowCustomerSection(false); // Auto-collapse after success
        }
      }
    } catch (error: any) {
      console.error('Failed to create/update customer:', error);
      showNotification('Failed to save customer: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  useEffect(() => {
    if (tempCustomerPhone && tempCustomerPhone.trim().length >= 10 && tempCustomerName && tempCustomerName.trim().length > 0) {
      if (!customerId) {
        const timeoutId = setTimeout(() => {
          const currentState = useCartStore.getState();
          const latestName = (currentState.customerName || tempCustomerName).trim();
          const latestPhone = tempCustomerPhone.trim();
          if (latestName.length > 0 && latestPhone.length >= 10) {
            createOrUpdateCustomer(latestPhone, latestName);
          }
        }, 10000); // Increased from 2000ms to 10000ms (10 seconds)
        return () => clearTimeout(timeoutId);
      }
    }
  }, [tempCustomerPhone, tempCustomerName, customerId]);

  // Keyboard shortcuts for quick actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // Ctrl+Enter or Cmd+Enter for Quick Pay
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (items.length > 0 && !isProcessingPayment && !showPaymentModal) {
          const { grandTotal } = getTotal();
          handleCreateSale([{ method: 'CASH', amount: grandTotal }]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length, isProcessingPayment, showPaymentModal]);

  const handleCreateSale = async (payments: Array<{ method: string; amount: number }>) => {
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

      // Skip customer validation if user explicitly skipped customer section
      const saleData = {
        items: items.map((item) => ({
          productId: item.productId,
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
          rate: item.rate,
          taxRate: item.taxRate,
          metaJson: item.metaJson || undefined,
        })),
        customerId: (!skipCustomer && customerId) ? customerId : undefined,
        customerPhone: (!skipCustomer && customerPhone) ? customerPhone : undefined,
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
      
      // Process payments (support split payments)
      const paymentData = {
        payments: payments.map(p => ({
          method: p.method,
          amount: Math.round(p.amount),
        })),
      };

      await api.post(`/api/v1/sales/${sale.id}/pay`, paymentData);
      await clearCart();
      setShowPaymentModal(false);
      
      setCompletedSale({
        saleNo: sale.saleNo || 'N/A',
        grandTotal: roundedSaleGrandTotal,
      });
      setShowSuccessAnimation(true);
      
      window.dispatchEvent(new CustomEvent('sale-created', { detail: { saleId: sale.id, payments } }));
      
      // If there's any cash payment, dispatch cash event
      const cashPayment = payments.find(p => p.method === 'CASH');
      if (cashPayment) {
        window.dispatchEvent(new CustomEvent('cash-sale-completed', { 
          detail: { 
            saleId: sale.id, 
            amount: cashPayment.amount,
            grandTotal: roundedSaleGrandTotal 
          } 
        }));
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

  // Enhanced Payment Modal with Split Payment & Quick Actions
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
    onPay: (payments: Array<{ method: string; amount: number }>) => void;
    isProcessing?: boolean;
  }) => {
    const [selectedMethod, setSelectedMethod] = useState('CASH');
    const [amountPaid, setAmountPaid] = useState(grandTotal.toString());
    const [isSplitPayment, setIsSplitPayment] = useState(false);
    const [splitPayments, setSplitPayments] = useState<Array<{ method: string; amount: number }>>([]);
    const amountInputRef = useRef<HTMLInputElement>(null);

    const change = parseFloat(amountPaid) - grandTotal;
    const splitTotal = splitPayments.reduce((sum, p) => sum + p.amount, 0);
    const splitRemaining = Math.max(0, grandTotal - splitTotal);

    // Keyboard shortcuts
    useEffect(() => {
      const handleKeyPress = (e: KeyboardEvent) => {
        // Don't trigger shortcuts if typing in input
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        
        if (e.key === 'Escape') {
          if (!isProcessing) onClose();
        } else if (e.key === 'Enter') {
          if (!isProcessing) handlePayment();
        } else if (e.key >= '1' && e.key <= '5') {
          const methods = ['CASH', 'CARD', 'UPI', 'CREDIT', 'ONLINE'];
          setSelectedMethod(methods[parseInt(e.key) - 1]);
        }
      };

      window.addEventListener('keydown', handleKeyPress);
      return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isProcessing, selectedMethod, amountPaid, isSplitPayment, splitPayments]);

    const paymentMethods = [
      { value: 'CASH', label: 'Cash', icon: '💵', key: '1' },
      { value: 'CARD', label: 'Card', icon: '💳', key: '2' },
      { value: 'UPI', label: 'UPI', icon: '📱', key: '3' },
      { value: 'CREDIT', label: 'Credit', icon: '📝', key: '4' },
      { value: 'ONLINE', label: 'Online', icon: '🌐', key: '5' },
    ];

    const quickAmounts = [
      { label: 'Exact', value: grandTotal },
      { label: `₹${Math.ceil(grandTotal / 100) * 100}`, value: Math.ceil(grandTotal / 100) * 100 },
      { label: '₹100', value: 100 },
      { label: '₹500', value: 500 },
      { label: '₹1000', value: 1000 },
      { label: '₹2000', value: 2000 },
    ];

    const handleQuickAmount = (amount: number) => {
      setAmountPaid(amount.toString());
      amountInputRef.current?.focus();
    };

    const addSplitPayment = () => {
      if (splitRemaining > 0 && selectedMethod) {
        const amount = Math.min(parseFloat(amountPaid) || splitRemaining, splitRemaining);
        setSplitPayments([...splitPayments, { method: selectedMethod, amount }]);
        setAmountPaid(splitRemaining > amount ? (splitRemaining - amount).toString() : '');
      }
    };

    const removeSplitPayment = (index: number) => {
      setSplitPayments(splitPayments.filter((_, i) => i !== index));
    };

    const handlePayment = () => {
      if (isSplitPayment) {
        if (Math.abs(splitTotal - grandTotal) > 0.01) {
          return; // Don't process if split total doesn't match
        }
        onPay(splitPayments);
      } else {
        onPay([{ method: selectedMethod, amount: selectedMethod === 'CREDIT' ? grandTotal : parseFloat(amountPaid) || grandTotal }]);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50 animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between z-10">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Payment</h2>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Press 1-5 for method • Enter to confirm</p>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="p-4 space-y-3">
            {/* Total Summary - Compact */}
            <div className="bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-brand-900/20 dark:to-brand-800/10 border border-brand-200/50 dark:border-brand-800/30 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">₹{grandTotal}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <div className="text-center p-1.5 bg-white/50 dark:bg-gray-800/50 rounded">
                  <div className="text-gray-500 dark:text-gray-400">Sub</div>
                  <div className="font-semibold text-xs">₹{Math.round(subTotal)}</div>
                </div>
                <div className="text-center p-1.5 bg-white/50 dark:bg-gray-800/50 rounded">
                  <div className="text-gray-500 dark:text-gray-400">Tax</div>
                  <div className="font-semibold text-xs">₹{Math.round(taxTotal)}</div>
                </div>
                <div className="text-center p-1.5 bg-white/50 dark:bg-gray-800/50 rounded">
                  <div className="text-gray-500 dark:text-gray-400">Disc</div>
                  <div className="font-semibold text-xs text-red-600">-₹{Math.round(discountTotal)}</div>
                </div>
              </div>
            </div>

            {/* Split Payment Toggle - Compact */}
            <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Split Payment</span>
              <button
                onClick={() => {
                  setIsSplitPayment(!isSplitPayment);
                  setSplitPayments([]);
                }}
                disabled={isProcessing}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isSplitPayment ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  isSplitPayment ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Payment Method Selection - Compact Buttons */}
            {!isSplitPayment && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Payment Method
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.value}
                      onClick={() => setSelectedMethod(method.value)}
                      disabled={isProcessing}
                      className={`relative p-2 rounded-lg border-2 transition-all hover:scale-105 active:scale-95 ${
                        selectedMethod === method.value
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-md'
                          : 'border-gray-200 dark:border-gray-600 hover:border-brand-300 dark:hover:border-brand-700'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl">{method.icon}</span>
                        <span className="font-semibold text-[10px] text-gray-900 dark:text-white leading-tight">{method.label}</span>
                        <span className="absolute top-0.5 right-0.5 text-[8px] font-mono bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">
                          {method.key}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Split Payment Section - Compact */}
            {isSplitPayment && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Add Payment
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={selectedMethod}
                      onChange={(e) => setSelectedMethod(e.target.value)}
                      className="flex-1 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                    >
                      {paymentMethods.map((m) => (
                        <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      placeholder={`₹${splitRemaining}`}
                      className="w-24 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-right font-semibold"
                    />
                    <button
                      onClick={addSplitPayment}
                      disabled={splitRemaining <= 0 || !amountPaid}
                      className="px-3 py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Split Payments List - Compact */}
                {splitPayments.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 space-y-1.5 max-h-32 overflow-y-auto">
                    {splitPayments.map((payment, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{paymentMethods.find(m => m.value === payment.method)?.icon}</span>
                          <div>
                            <div className="font-semibold text-xs text-gray-900 dark:text-white">{payment.method}</div>
                            <div className="text-[10px] text-gray-500">₹{payment.amount}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeSplitPayment(index)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-200 dark:border-gray-600">
                      <span className="text-xs font-semibold">Remaining:</span>
                      <span className={`text-base font-bold ${splitRemaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        ₹{splitRemaining}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Amount Input & Quick Buttons (Single Payment) - Compact */}
            {!isSplitPayment && selectedMethod !== 'CREDIT' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Amount Paid
                  </label>
                  <input
                    ref={amountInputRef}
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full px-3 py-2.5 text-xl font-bold border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-right"
                    step="0.01"
                    min="0"
                    placeholder={grandTotal.toString()}
                    autoFocus
                  />
                </div>

                {/* Quick Amount Buttons - Compact */}
                <div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {quickAmounts.map((quick, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickAmount(quick.value)}
                        className="px-2 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded text-[10px] font-semibold transition-colors"
                      >
                        {quick.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Change/Balance Display - Compact */}
                {selectedMethod !== 'CREDIT' && (
                  <>
                    {change >= 0 ? (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-green-800 dark:text-green-300">Change</span>
                          <span className="text-lg font-bold text-green-600 dark:text-green-400">₹{Math.round(change)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-red-800 dark:text-red-300">Short</span>
                          <span className="text-lg font-bold text-red-600 dark:text-red-400">₹{Math.round(Math.abs(change))}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Credit Payment Info - Compact */}
            {!isSplitPayment && selectedMethod === 'CREDIT' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Credit</span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">₹{Math.round(grandTotal)}</span>
                </div>
                <p className="text-[10px] text-blue-600 dark:text-blue-400">Customer will pay later</p>
              </div>
            )}

            {/* Action Buttons - Compact */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="flex-1 px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white font-semibold transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePayment}
                disabled={
                  isProcessing ||
                  (isSplitPayment && Math.abs(splitTotal - grandTotal) > 0.01) ||
                  (!isSplitPayment && selectedMethod !== 'CREDIT' && change < 0)
                }
                className="flex-2 px-6 py-2.5 text-sm bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-lg font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <span>Processing...</span>
                ) : isSplitPayment ? (
                  <span>Pay ₹{Math.round(splitTotal)}</span>
                ) : selectedMethod === 'CREDIT' ? (
                  <span>Credit ₹{grandTotal}</span>
                ) : (
                  <span>Pay ₹{Math.round(parseFloat(amountPaid) || grandTotal)}</span>
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
            {/* Customer Section - Collapsible & Optional */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-50 to-transparent dark:from-brand-900/10 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Customer Information
                    <span className="text-xs font-normal text-gray-500 dark:text-gray-400">(Optional)</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    {!showCustomerSection && !customerName && (
                      <button
                        onClick={() => {
                          setShowCustomerSection(true);
                          setSkipCustomer(false);
                        }}
                        className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        + Add Customer
                      </button>
                    )}
                    {!showCustomerSection && !customerName && (
                      <button
                        onClick={() => {
                          setSkipCustomer(true);
                          setCustomer(null, null, null);
                        }}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                      >
                        Skip
                      </button>
                    )}
                    {(showCustomerSection || customerName) && (
                      <button
                        onClick={() => {
                          setShowCustomerSection(!showCustomerSection);
                        }}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <svg className={`w-5 h-5 transition-transform ${showCustomerSection ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {skipCustomer && !customerName && (
                  <div className="mt-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400">
                    Walk-in customer • No customer info will be saved
                  </div>
                )}
                {customerName && customerPhone && !showCustomerSection && (
                  <div className="mt-2 flex items-center justify-between px-3 py-2 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg text-sm">
                    <span className="font-medium text-brand-700 dark:text-brand-300">
                      {customerName} • {customerPhone}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowCustomerSection(true)}
                        className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setCustomer(null, null, null);
                          setTempCustomerPhone('');
                          setTempCustomerName('');
                          setShowCustomerSection(true);
                          setSkipCustomer(false);
                        }}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {showCustomerSection && !skipCustomer && (
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
                          setTimeout(() => {
                            const currentName = tempCustomerName.trim();
                            const currentPhone = tempCustomerPhone.trim();
                            if (currentPhone && currentPhone.length >= 10 && currentName && currentName.length > 0) {
                              if (!customerId) {
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
                      <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
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

                {customerName && customerPhone && showCustomerSection && (
                  <div className="mt-4 p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg">
                    <p className="text-sm text-brand-700 dark:text-brand-300">
                      <span className="font-medium">Billing to:</span> {customerName} ({customerPhone})
                    </p>
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Cart Items */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-50 to-transparent dark:from-brand-900/10">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Cart Items
                </h2>
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
                  
                  {/* Quick Discount Buttons */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Quick Discount</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDiscountType('amount')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              discountType === 'amount'
                                ? 'bg-brand-500 text-white shadow-sm'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            ₹ Amount
                          </button>
                          <button
                            type="button"
                            onClick={() => setDiscountType('percentage')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                              discountType === 'percentage'
                                ? 'bg-brand-500 text-white shadow-sm'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            }`}
                          >
                            % Percent
                          </button>
                        </div>
                      </div>
                      
                      {/* Quick Discount Buttons */}
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {[5, 10, 15, 20].map((percent) => (
                          <button
                            key={percent}
                            onClick={() => {
                              setDiscountType('percentage');
                              setDiscountPercentage(percent);
                            }}
                            className="px-2 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded-lg text-xs font-semibold transition-colors"
                          >
                            {percent}%
                          </button>
                        ))}
                      </div>
                      
                      {discountType === 'amount' ? (
                        <input
                          type="number"
                          value={discountTotal || ''}
                          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                          className="w-full px-4 py-3 text-base font-semibold border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                        />
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="number"
                            value={discountPercentage || ''}
                            onChange={(e) => {
                              const percentage = parseFloat(e.target.value) || 0;
                              setDiscountPercentage(Math.min(100, Math.max(0, percentage)));
                            }}
                            className="w-full px-4 py-3 text-base font-semibold border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="0"
                          />
                          {discountPercentage > 0 && (
                            <div className="text-sm text-center text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 py-2 rounded-lg">
                              Discount: <span className="font-semibold">₹{Math.round((subTotal * discountPercentage) / 100)}</span>
                            </div>
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
                
                {/* Enhanced Checkout Button */}
                <button
                  onClick={() => setShowPaymentModal(true)}
                  disabled={items.length === 0}
                  className="w-full py-5 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-500 hover:from-brand-600 hover:via-brand-700 hover:to-brand-600 text-white rounded-2xl font-bold text-xl shadow-2xl hover:shadow-3xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-[1.03] active:scale-[0.97] min-h-[72px] bg-[length:200%_100%] hover:bg-[position:100%_0] animation-shimmer"
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <div className="flex flex-col">
                    <span>Checkout Now</span>
                    <span className="text-brand-100 text-sm font-semibold">₹{grandTotal}</span>
                  </div>
                </button>

                {/* Quick Pay Button */}
                <button
                  onClick={() => {
                    // Quick pay with Cash, exact amount
                    handleCreateSale([{ method: 'CASH', amount: grandTotal }]);
                  }}
                  disabled={items.length === 0 || isProcessingPayment}
                  className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="text-2xl">⚡</span>
                  <div className="flex flex-col items-start">
                    <span>Quick Pay (Cash)</span>
                    <span className="text-green-100 text-sm font-semibold">₹{grandTotal} exact</span>
                  </div>
                </button>

                {/* Quick Actions */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      if (window.confirm('Clear all items from cart?')) {
                        clearCart();
                      }
                    }}
                    disabled={items.length === 0}
                    className="flex-1 py-3 border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-xl font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  >
                    Clear Cart
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Sticky Checkout Bar */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-700 p-4 z-30 shadow-2xl">
              <div className="max-w-7xl mx-auto">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1">
                    <div className="text-xs text-gray-500 dark:text-gray-400">Total Amount</div>
                    <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">₹{grandTotal}</div>
                  </div>
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    disabled={items.length === 0}
                    className="px-6 py-4 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-xl font-bold text-base shadow-lg active:scale-95 transition-all disabled:opacity-50"
                  >
                    Pay Now
                  </button>
                </div>
                <button
                  onClick={() => {
                    handleCreateSale([{ method: 'CASH', amount: grandTotal }]);
                  }}
                  disabled={items.length === 0 || isProcessingPayment}
                  className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-sm shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>⚡</span>
                  <span>Quick Pay (Cash ₹{grandTotal})</span>
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
