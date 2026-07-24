'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart';
import { useAuthStore } from '@/store/auth';
import { useNotificationStore } from '@/store/notification';
import api from '@/lib/api';
import { parseCustomerListResponse } from '@/lib/customers';
import NumPad from '@/components/NumPad';
import VirtualKeyboard from '@/components/VirtualKeyboard';
import BillSuccessAnimation from '@/components/BillSuccessAnimation';
import {
  isCheckoutNetworkError,
  isOfflineForCheckout,
  queueOfflineCheckout,
} from '@/lib/offlineCheckout';
import { printReceipt, generateReceiptData } from '@/lib/printReceipt';
import CartPaymentModal from '@/components/CartPaymentModal';
import PendingCreditSettlement from '@/components/PendingCreditSettlement';
import {
  completeNewSaleCheckout,
  checkoutPaymentMismatch,
} from '@/lib/pendingCreditCheckout';
import { LOYALTY_POINT_VALUE } from '@azela-pos/shared';
import CustomerDisplayButton from '@/components/customerDisplay/CustomerDisplayButton';
import {
  publishPaymentMode,
  publishSuccessMode,
  publishIdleMode,
  publishCurrentBill,
  releaseDisplaySuccessLatch,
} from '@/lib/customerDisplay/publishHelpers';

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
  const customerArea = useCartStore((state) => state.customerArea);
  const setCustomer = useCartStore((state) => state.setCustomer);
  const referredByPhone = useCartStore((state) => state.referredByPhone);
  const setReferredByPhone = useCartStore((state) => state.setReferredByPhone);
  const referredByCode = useCartStore((state) => state.referredByCode);
  const setReferredByCode = useCartStore((state) => state.setReferredByCode);
  const discountTotal = useCartStore((state) => state.discountTotal);
  const discountType = useCartStore((state) => state.discountType);
  const discountPercentage = useCartStore((state) => state.discountPercentage);
  const setDiscount = useCartStore((state) => state.setDiscount);
  const setDiscountType = useCartStore((state) => state.setDiscountType);
  const setDiscountPercentage = useCartStore((state) => state.setDiscountPercentage);
  const fulfillmentType = useCartStore((state) => state.fulfillmentType);
  const setFulfillmentType = useCartStore((state) => state.setFulfillmentType);
  const deliveryFee = useCartStore((state) => state.deliveryFee);
  const setDeliveryFee = useCartStore((state) => state.setDeliveryFee);
  const loadCart = useCartStore((state) => state.loadCart);
  const clearCart = useCartStore((state) => state.clearCart);
  const loyaltyRedeemPoints = useCartStore((state) => state.loyaltyRedeemPoints);
  const setLoyaltyRedeemPoints = useCartStore((state) => state.setLoyaltyRedeemPoints);
  const pendingSettlements = useCartStore((state) => state.pendingSettlements);
  const getCheckoutTotal = useCartStore((state) => state.getCheckoutTotal);
  const getPendingSettlementTotal = useCartStore((state) => state.getPendingSettlementTotal);
  const getSelectedPendingSettlements = useCartStore((state) => state.getSelectedPendingSettlements);

  // State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNumPad, setShowNumPad] = useState(false);
  /** Which phone field the numpad is editing. */
  const [numPadTarget, setNumPadTarget] = useState<'customer' | 'referrer'>('customer');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  /** Phone prefix matches (tap to select) after 4+ digits. */
  const [phoneMatches, setPhoneMatches] = useState<any[]>([]);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  /** Collapsed by default; opens if a referral is already set. */
  const [showReferral, setShowReferral] = useState(
    () => Boolean(referredByPhone || referredByCode)
  );
  const [tempCustomerPhone, setTempCustomerPhone] = useState(customerPhone || '');
  const [tempCustomerName, setTempCustomerName] = useState(customerName || '');
  const [tempCustomerArea, setTempCustomerArea] = useState(customerArea || '');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const phoneSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const paymentInFlightRef = useRef(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [completedSale, setCompletedSale] = useState<{ saleNo: string; grandTotal: number } | null>(null);
  const [showCustomerSection, setShowCustomerSection] = useState(true); // Show by default
  const [skipCustomer, setSkipCustomer] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  // Live loyalty balance for the attached customer (for redeem-at-checkout).
  const [customerPoints, setCustomerPoints] = useState<number | null>(null);

  // Fetch the attached customer's loyalty balance so the cashier can redeem it.
  useEffect(() => {
    let cancelled = false;
    if (!customerId || skipCustomer) {
      setCustomerPoints(null);
      return;
    }
    (async () => {
      try {
        const res = await api.get(`/api/v1/customers/${customerId}/loyalty`);
        const pts = Math.floor(res.data?.customer?.loyaltyPoints ?? 0);
        if (!cancelled) setCustomerPoints(pts);
      } catch (err) {
        console.error('[Cart] Failed to load loyalty balance:', err);
        if (!cancelled) setCustomerPoints((prev) => (prev === null ? 0 : prev));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId, skipCustomer]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadCart();
    
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
          setCustomer(customerId, tempCustomerPhone || null, transcript || null, tempCustomerArea || null);
          setIsListening(false);
          showNotification('Name captured: ' + transcript, 'success');
          focusAreaField();
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
    setTempCustomerArea(customerArea || '');
  }, [customerPhone, customerName, customerArea]);

  const searchCustomers = async (phone: string) => {
    try {
      const response = await api.get(`/api/v1/customers?phone=${phone}`);
      if (response.data) {
        pickExistingCustomer(response.data);
      } else {
        const searchRes = await api.get('/api/v1/customers', { params: { q: phone } });
        const { customers } = parseCustomerListResponse<{ id: string; name: string; phone: string }>(
          searchRes.data
        );
        setPhoneMatches(customers.slice(0, 8));
        setShowPhoneDropdown(customers.length > 0);
      }
    } catch (error: any) {
      console.error('Failed to search customers:', error);
    }
  };

  /** Server typeahead after 4 digits — avoids loading the full customer roster. */
  const matchCustomersByPhonePrefix = useCallback((phone: string) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (phoneSearchTimerRef.current) clearTimeout(phoneSearchTimerRef.current);
    if (digits.length < 4) {
      setPhoneMatches([]);
      setShowPhoneDropdown(false);
      return;
    }
    phoneSearchTimerRef.current = setTimeout(async () => {
      try {
        const searchRes = await api.get('/api/v1/customers', { params: { q: digits } });
        const { customers } = parseCustomerListResponse<{
          id: string;
          name: string;
          phone: string;
          area?: string;
        }>(searchRes.data);
        setPhoneMatches(customers.slice(0, 8));
        setShowPhoneDropdown(customers.length > 0);
      } catch (error) {
        console.error('Failed to match customers by phone:', error);
      }
    }, 250);
  }, []);

  const searchCustomersByName = useCallback((name: string) => {
    const term = String(name || '').trim();
    if (nameSearchTimerRef.current) clearTimeout(nameSearchTimerRef.current);
    if (term.length < 1) {
      setCustomerSearchResults([]);
      setShowNameDropdown(false);
      return;
    }
    nameSearchTimerRef.current = setTimeout(async () => {
      try {
        const searchRes = await api.get('/api/v1/customers', { params: { q: term } });
        const { customers } = parseCustomerListResponse<{
          id: string;
          name: string;
          phone: string;
          area?: string;
        }>(searchRes.data);
        const filtered = customers
          .filter((c) => String(c.name || '').toLowerCase().startsWith(term.toLowerCase()))
          .slice(0, 5);
        setCustomerSearchResults(filtered);
        setShowNameDropdown(filtered.length > 0);
      } catch (error) {
        console.error('Failed to search customers by name:', error);
      }
    }, 250);
  }, []);

  /** Single referral box: digits → phone, letters → code. */
  const applyReferralInput = (raw: string) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
      setReferredByPhone(null);
      setReferredByCode(null);
      return;
    }
    const hasLetter = /[A-Za-z]/.test(trimmed);
    if (!hasLetter) {
      const digits = trimmed.replace(/\D/g, '').slice(0, 12);
      setReferredByPhone(digits || null);
      setReferredByCode(null);
    } else {
      const code = trimmed
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 12);
      setReferredByCode(code || null);
      setReferredByPhone(null);
    }
  };

  const referralInputValue = referredByPhone || referredByCode || '';

  /** Common localities for one-tap area (edit list anytime). */
  const QUICK_AREAS = [
    'Vishal Nagar',
    'Baner',
    'Aundh',
    'Wakad',
    'Hinjewadi',
    'Pimple Saudagar',
    'Shivaji Nagar',
    'Deccan',

  ];

  const pickExistingCustomer = (customer: {
    id: string;
    phone: string;
    name?: string | null;
    area?: string | null;
  }) => {
    setCustomer(customer.id, customer.phone, customer.name || null, customer.area || null);
    setTempCustomerPhone(customer.phone);
    setTempCustomerName(customer.name || '');
    setTempCustomerArea(customer.area || '');
    setPhoneMatches([]);
    setShowPhoneDropdown(false);
    setCustomerSearchResults([]);
    setShowNameDropdown(false);
    setShowNumPad(false);
    setShowKeyboard(false);
    setShowCustomerSection(false);
    setSkipCustomer(false);
    showNotification(
      customer.area
        ? `${customer.name || 'Customer'} · ${customer.area}`
        : `${customer.name || 'Customer'} selected`,
      'success'
    );
  };

  const focusNameField = () => {
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const focusAreaField = () => {
    setTimeout(() => {
      areaInputRef.current?.focus();
      areaInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const createOrUpdateCustomer = async (phone: string, name: string, area?: string) => {
    const trimmedPhone = phone ? phone.trim() : '';
    const fullName = name ? name.trim() : '';
    const fullArea = (area ?? useCartStore.getState().customerArea ?? '').trim();
    
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
            area: fullArea || undefined,
          });
          if (response.data) {
            setCustomer(response.data.id, response.data.phone, response.data.name, response.data.area || null);
            setTempCustomerPhone(response.data.phone);
            setTempCustomerName(response.data.name);
            setTempCustomerArea(response.data.area || '');
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
          area: fullArea || undefined,
        });
        if (response.data) {
          setCustomer(response.data.id, response.data.phone, response.data.name, response.data.area || null);
          setTempCustomerPhone(response.data.phone);
          setTempCustomerName(response.data.name);
          setTempCustomerArea(response.data.area || '');
          showNotification('Customer added successfully', 'success');
          setShowCustomerSection(false); // Auto-collapse after success
        }
      }
    } catch (error: any) {
      console.error('Failed to create/update customer:', error);
      showNotification('Failed to save customer: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  // Customer save is deferred until Area blur (see Area field) so locality can be entered first.
  const ensureCustomerSaved = async () => {
    if (skipCustomer) return;
    const phone = tempCustomerPhone.trim();
    const name = tempCustomerName.trim();
    if (phone.length >= 10 && name.length > 0) {
      await createOrUpdateCustomer(phone, name, tempCustomerArea);
    }
  };

  const handleCreateSale = useCallback(async (payments: Array<{ method: string; amount: number }>) => {
    if (paymentInFlightRef.current || isProcessingPayment) {
      console.log('[Cart] Payment already processing, ignoring duplicate call');
      return;
    }

    const cartState = useCartStore.getState();
    if (payments.some((p) => p.method === 'CREDIT')) {
      if (skipCustomer || !cartState.customerId) {
        showNotification(
          'Credit bills need a customer. Turn off walk-in and add phone & name first.',
          'warning'
        );
        return;
      }
    }

    paymentInFlightRef.current = true;
    setIsProcessingPayment(true);

    const buildSaleData = () => {
      const state = useCartStore.getState();
      const {
        items,
        customerId,
        customerPhone,
        customerName,
        customerArea,
        discountTotal,
        fulfillmentType: ft,
        deliveryFee: fee,
      } = state;
      // Loyalty redemption only applies to an attached (non-walk-in) customer.
      const loyaltyPointsRedeemed =
        !skipCustomer && customerId ? state.getTotal().loyaltyPointsApplied : 0;
      return {
        items: items.map((item) => ({
          productId: item.productId,
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
          rate: item.rate,
          taxRate: item.taxRate,
          metaJson: item.metaJson || undefined,
        })),
        customerId: !skipCustomer && customerId ? customerId : undefined,
        customerPhone: !skipCustomer && customerPhone ? customerPhone : undefined,
        customerName: !skipCustomer && customerName ? customerName : undefined,
        customerArea: !skipCustomer && customerArea ? customerArea : undefined,
        discountTotal: discountTotal || 0,
        deliveryFee: ft === 'DELIVERY' ? fee || 0 : 0,
        loyaltyPointsRedeemed,
        referredByPhone:
          !skipCustomer && state.referredByPhone ? state.referredByPhone : undefined,
        referredByCode:
          !skipCustomer && state.referredByCode ? state.referredByCode : undefined,
      };
    };

    const finishOfflineCheckout = async (message: string) => {
      const saleData = buildSaleData();
      const { grandTotal } = getTotal();
      await queueOfflineCheckout(
        saleData,
        payments,
        grandTotal,
        useCartStore.getState().fulfillmentType
      );
      setShowPaymentModal(false);
      try {
        await clearCart();
      } catch (clearErr) {
        console.error('[Cart] clearCart after offline checkout:', clearErr);
      }
      setCompletedSale({
        saleNo: 'Queued (offline)',
        grandTotal: Math.round(grandTotal),
      });
      setShowSuccessAnimation(true);
      showNotification(message, 'success', 6500);
    };
    
    try {
      if (useCartStore.getState().items.length === 0) {
        showNotification('Cart is empty', 'warning');
        return;
      }

      const saleData = buildSaleData();
      const { grandTotal } = getTotal();

      if (isOfflineForCheckout()) {
        if (getPendingSettlementTotal() > 0) {
          showNotification(
            'Settling old credit needs internet. Uncheck previous credit or go online.',
            'warning',
            6000
          );
          return;
        }
        await finishOfflineCheckout(
          'Bill saved offline. It will sync automatically when internet is back.'
        );
        return;
      }

      console.log('[Cart] Creating sale with data:', saleData);
      const saleResponse = await api.post('/api/v1/sales', saleData);
      console.log('[Cart] Sale response:', saleResponse.data);

      const payload = saleResponse.data;
      // Discount over limit: sale is OPEN + pending override (HTTP 202 body is nested).
      const needsDiscountApproval =
        payload?.requiresApproval === true ||
        payload?.override?.status === 'PENDING' ||
        (payload?.sale?.id && payload?.override && !payload?.id);

      const finishPendingDiscountApproval = async (saleNo: string) => {
        setShowPaymentModal(false);
        publishIdleMode();
        showNotification(
          `Sale #${saleNo} created. Discount needs manager approval before payment.`,
          'info',
          6000
        );
        try {
          await clearCart();
        } catch (clearErr) {
          console.error('[Cart] clearCart after discount approval request:', clearErr);
        }
        setTimeout(() => router.push('/store/discount-approvals'), 1500);
      };

      if (needsDiscountApproval) {
        const saleNo = payload?.sale?.saleNo || payload?.saleNo || 'pending';
        await finishPendingDiscountApproval(saleNo);
        return;
      }

      const sale = payload?.sale?.id ? payload.sale : payload;
      if (!sale || !sale.id) {
        console.error('[Cart] Invalid sale response:', sale);
        throw new Error('Invalid sale response: Sale ID not found');
      }

      const checkoutGrandTotal = getCheckoutTotal();
      if (checkoutPaymentMismatch(payments, checkoutGrandTotal)) {
        showNotification(
          `Payment total must match checkout amount ₹${checkoutGrandTotal}`,
          'error'
        );
        return;
      }

      const pendingLines = getSelectedPendingSettlements();
      const cartOnlyTotal = getTotal().grandTotal;

      try {
        const { settledSaleNos } = await completeNewSaleCheckout(
          api,
          sale,
          payments,
          pendingLines,
          cartOnlyTotal
        );
        if (settledSaleNos.length > 0) {
          showNotification(
            `Settled previous credit: ${settledSaleNos.map((n) => `#${n}`).join(', ')}`,
            'success',
            5000
          );
        }
      } catch (payErr: any) {
        const payData = payErr?.response?.data;
        if (
          payData?.requiresApproval ||
          String(payData?.error || '').toLowerCase().includes('pending approval')
        ) {
          await finishPendingDiscountApproval(sale.saleNo || sale.id);
          return;
        }
        throw payErr;
      }

      const fulfillType = useCartStore.getState().fulfillmentType;
      // Only create a delivery row for home delivery (customer + delivery). Pickup / walk-in stays out of Delivery section.
      const isHomeDelivery = fulfillType === 'DELIVERY' && sale.customerId;
      if (isHomeDelivery) {
        try {
          await api.post('/api/v1/delivery', {
            saleId: sale.id,
            type: 'DELIVERY',
            deliveryFee: useCartStore.getState().getTotal().deliveryFee,
          });
        } catch (delErr: any) {
          console.error('[Cart] Create delivery failed:', delErr);
          showNotification(delErr.response?.data?.error || 'Order paid. Add delivery from Delivery section.', 'info', 4000);
        }
      }
      setShowPaymentModal(false);
      
      setCompletedSale({
        saleNo: sale.saleNo || 'N/A',
        grandTotal: checkoutGrandTotal,
      });
      setShowSuccessAnimation(true);

      // Publish success BEFORE clearing the cart so the display sync does not
      // emit idle and skip the review screen.
      publishSuccessMode(checkoutGrandTotal, sale.saleNo || null, sale.id || null);

      try {
        await clearCart();
      } catch (clearErr) {
        console.error('[Cart] clearCart after payment:', clearErr);
      }

      window.dispatchEvent(new CustomEvent('sale-created', { detail: { saleId: sale.id, payments } }));
      
      // If there's any cash payment, dispatch cash event
      const cashPayment = payments.find(p => p.method === 'CASH');
      if (cashPayment) {
        window.dispatchEvent(new CustomEvent('cash-sale-completed', { 
          detail: { 
            saleId: sale.id, 
            amount: cashPayment.amount,
            grandTotal: checkoutGrandTotal 
          } 
        }));
      }
    } catch (error: any) {
      console.error('[Cart] Failed to process payment:', error);

      const errData = error?.response?.data;
      // Some proxies surface HTTP 202 discount-approval as an error; sale already exists.
      if (
        errData?.requiresApproval ||
        errData?.override?.status === 'PENDING' ||
        (errData?.sale?.id && errData?.override)
      ) {
        setShowPaymentModal(false);
        publishIdleMode();
        const saleNo = errData?.sale?.saleNo || 'pending';
        showNotification(
          `Sale #${saleNo} created. Discount needs manager approval before payment.`,
          'info',
          6000
        );
        try {
          await clearCart();
        } catch (clearErr) {
          console.error('[Cart] clearCart after discount approval error path:', clearErr);
        }
        setTimeout(() => router.push('/store/discount-approvals'), 1500);
        return;
      }

      if (isCheckoutNetworkError(error) && useCartStore.getState().items.length > 0) {
        try {
          await finishOfflineCheckout(
            'No connection — bill saved offline and will sync when you are back online.'
          );
          return;
        } catch (queueErr) {
          console.error('[Cart] Offline queue fallback failed:', queueErr);
        }
      }
      
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
      
      // Unstick payment UI + customer display on any failure.
      setShowPaymentModal(false);
      publishCurrentBill();
      showNotification(errorMessage, 'error', 5000);
    } finally {
      paymentInFlightRef.current = false;
      setIsProcessingPayment(false);
    }
  }, [isProcessingPayment, router, showNotification, clearCart, getTotal, skipCustomer]);

  // Keyboard shortcuts for quick actions (after handleCreateSale — avoids TDZ)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (items.length > 0 && !isProcessingPayment && !showPaymentModal) {
          void (async () => {
            await ensureCustomerSaved();
            const total = useCartStore.getState().getCheckoutTotal();
            publishPaymentMode(total, null, {
              payments: [{ method: 'CASH', amount: total }],
            });
            handleCreateSale([{ method: 'CASH', amount: total }]);
          })();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items.length, isProcessingPayment, showPaymentModal, handleCreateSale, getTotal]);

  const { subTotal, taxTotal, deliveryFee: effectiveDeliveryFee, grandTotal: cartGrandTotal, loyaltyDiscount } = getTotal();
  const pendingSettlementTotal = getPendingSettlementTotal();
  const checkoutGrandTotal = getCheckoutTotal();
  // Loyalty redeem caps (1 point = ₹LOYALTY_POINT_VALUE). The bill before redemption
  // is the net grand total plus whatever is currently being redeemed.
  const billBeforeRedeem = cartGrandTotal + loyaltyDiscount;
  const maxRedeemablePoints = Math.max(
    0,
    Math.min(
      Math.floor(customerPoints || 0),
      Math.floor(billBeforeRedeem / LOYALTY_POINT_VALUE)
    )
  );
  // Show the redeem section whenever a real (non-walk-in) customer is attached,
  // even with a zero balance, so cashiers can always see the option.
  const canRedeemLoyalty = !!customerId && !skipCustomer;
  const hasRedeemablePoints = maxRedeemablePoints > 0;

  const handleRemoveItem = async (item: any) => {
    if (!item?.id) return;
    setRemovingId(item.id);
    await new Promise((r) => setTimeout(r, 280));
    try {
      await removeItem(item.id);
      await loadCart();
      showNotification('Item removed', 'success');
    } catch (error: any) {
      showNotification('Failed to remove item', 'error');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header - animated entrance */}
      <div className="sticky top-0 z-40 glass-panel-strong border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/store/pos')}
                className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 active:scale-95"
              >
                <svg className="w-5 h-5 text-ink-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-ink tracking-tight">Shopping Cart</h1>
                <p className="text-sm text-ink-muted mt-0.5">
                  <span className="inline-flex items-center gap-1 font-medium text-brand-600 dark:text-brand-400">{items.length}</span>
                  {items.length === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CustomerDisplayButton />
              <button
                onClick={() => router.push('/store/pos')}
                className="px-5 py-2.5 bg-gradient-brand hover:brightness-105 shadow-glow-brand text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 active:scale-[0.98]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Items</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Customer & Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Section - Collapsible & Optional */}
            <div className="glass-panel rounded-2xl">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-50 to-transparent dark:from-brand-900/10 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Customer Information
                    <span className="text-xs font-normal text-ink-muted">(Optional)</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    {!showCustomerSection && !customerName && (
                      <button
                        onClick={() => {
                          setShowCustomerSection(true);
                          setSkipCustomer(false);
                        }}
                        className="px-4 py-2 bg-gradient-brand hover:brightness-105 shadow-glow-brand text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        + Add Customer
                      </button>
                    )}
                    {!showCustomerSection && !customerName && (
                      <button
                        onClick={() => {
                          setSkipCustomer(true);
                          setCustomer(null, null, null, null);
                        }}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-ink-secondary rounded-lg text-sm font-medium transition-colors"
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
                  <div className="mt-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-ink-secondary">
                    Walk-in customer • No customer info will be saved
                  </div>
                )}
                    {customerName && customerPhone && !showCustomerSection && (
                  <div className="mt-2 flex items-center justify-between px-3 py-2 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg text-sm">
                    <span className="font-medium text-brand-700 dark:text-brand-300">
                      {customerName} • {customerPhone}
                      {customerArea ? ` • ${customerArea}` : ''}
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
                          setCustomer(null, null, null, null);
                          setTempCustomerPhone('');
                          setTempCustomerName('');
                          setTempCustomerArea('');
                          applyReferralInput('');
                          setShowReferral(false);
                          setPhoneMatches([]);
                          setShowPhoneDropdown(false);
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
                <p className="text-xs text-ink-muted">
                  Fast path: type phone → tap match if known, or Name → Area chip / Done.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 items-start">
                  <div className="relative z-40">
                    <label className="block text-sm font-medium text-ink-secondary mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter phone number"
                        value={tempCustomerPhone}
                        readOnly
                        onClick={() => {
                          setNumPadTarget('customer');
                          setShowNumPad(true);
                          matchCustomersByPhonePrefix(tempCustomerPhone);
                        }}
                        className={`w-full px-4 py-3 pl-11 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer transition-all ${ tempCustomerPhone && tempCustomerPhone.trim().length > 0 && tempCustomerPhone.trim().length < 10 ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white' }`}
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
                    {showPhoneDropdown && phoneMatches.length > 0 && (
                      <div className="absolute z-[100] w-full mt-1 glass-panel-strong rounded-2xl max-h-48 overflow-y-auto">
                        {phoneMatches.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              pickExistingCustomer(customer);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-brand-100/30 dark:hover:bg-brand-900/10 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                          >
                            <div className="font-medium text-sm text-ink">{customer.name || 'No name'}</div>
                            <div className="text-xs text-ink-muted">
                              {customer.phone}
                              {customer.area ? ` • ${customer.area}` : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative z-50">
                    <label className="block text-sm font-medium text-ink-secondary mb-2">
                      Customer Name
                    </label>
                    <div className="relative">
                      <input
                        ref={nameInputRef}
                        type="text"
                        inputMode="text"
                        autoComplete="name"
                        enterKeyHint="next"
                        placeholder="Enter customer name"
                        value={tempCustomerName}
                        onChange={(e) => {
                          const newName = e.target.value;
                          setTempCustomerName(newName);
                          setCustomer(customerId, tempCustomerPhone || null, newName || null, tempCustomerArea || null);
                          searchCustomersByName(newName);
                        }}
                        onFocus={() => {
                          if (tempCustomerName.length >= 1) {
                            searchCustomersByName(tempCustomerName);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            focusAreaField();
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowNameDropdown(false), 200);
                          // Wait for Area — do not create/update yet
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
                            className={`p-2 rounded-lg transition-colors ${ isListening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-700' }`}
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
                          title="On-screen keyboard (device keyboard also works)"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    {showNameDropdown && customerSearchResults.length > 0 && (
                      <div className="absolute z-[100] w-full mt-1 glass-panel-strong rounded-2xl max-h-48 overflow-y-auto">
                        {customerSearchResults.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => {
                              pickExistingCustomer(customer);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-brand-100/30 dark:hover:bg-brand-900/10 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                          >
                            <div className="font-medium text-sm text-ink">{customer.name}</div>
                            <div className="text-xs text-ink-muted">
                              {customer.phone}
                              {customer.area ? ` • ${customer.area}` : ''}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-ink-secondary mb-2">
                      Area / Locality
                    </label>
                    <input
                      ref={areaInputRef}
                      type="text"
                      placeholder="e.g. Kothrud, Baner"
                      value={tempCustomerArea}
                      onChange={(e) => {
                        const newArea = e.target.value;
                        setTempCustomerArea(newArea);
                        setCustomer(customerId, tempCustomerPhone || null, tempCustomerName || null, newArea || null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const currentPhone = tempCustomerPhone.trim();
                          const currentName = tempCustomerName.trim();
                          if (currentPhone.length >= 10 && currentName.length > 0) {
                            void createOrUpdateCustomer(currentPhone, currentName, tempCustomerArea);
                          }
                        }
                      }}
                      onBlur={() => {
                        // Save only after Area (last customer field) so cashiers can finish locality first
                        const currentPhone = tempCustomerPhone.trim();
                        const currentName = tempCustomerName.trim();
                        if (currentPhone.length >= 10 && currentName.length > 0) {
                          createOrUpdateCustomer(currentPhone, currentName, tempCustomerArea);
                        }
                      }}
                      className="w-full px-4 py-3 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {QUICK_AREAS.map((area) => (
                        <button
                          key={area}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setTempCustomerArea(area);
                            setCustomer(
                              customerId,
                              tempCustomerPhone || null,
                              tempCustomerName || null,
                              area
                            );
                            const currentPhone = tempCustomerPhone.trim();
                            const currentName = tempCustomerName.trim();
                            if (currentPhone.length >= 10 && currentName.length > 0) {
                              void createOrUpdateCustomer(currentPhone, currentName, area);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            tempCustomerArea === area
                              ? 'bg-brand-500 text-white border-brand-500'
                              : 'bg-surface text-ink-secondary border-gray-200 dark:border-gray-600 hover:border-brand-400'
                          }`}
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const currentPhone = tempCustomerPhone.trim();
                          const currentName = tempCustomerName.trim();
                          if (currentPhone.length >= 10 && currentName.length > 0) {
                            void createOrUpdateCustomer(currentPhone, currentName, tempCustomerArea);
                          } else {
                            showNotification('Enter phone and name first', 'warning');
                          }
                        }}
                        className="px-4 py-2.5 rounded-xl bg-gradient-brand text-white text-sm font-semibold shadow-glow-brand"
                      >
                        Done — save customer
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const currentPhone = tempCustomerPhone.trim();
                          const currentName = tempCustomerName.trim();
                          if (currentPhone.length >= 10 && currentName.length > 0) {
                            setTempCustomerArea('');
                            void createOrUpdateCustomer(currentPhone, currentName, '');
                          } else {
                            showNotification('Enter phone and name first', 'warning');
                          }
                        }}
                        className="px-4 py-2.5 rounded-xl glass-panel text-ink-secondary text-sm font-medium"
                      >
                        Skip area
                      </button>
                    </div>
                  </div>
                </div>

                {!showReferral ? (
                  <button
                    type="button"
                    onClick={() => setShowReferral(true)}
                    className="w-full sm:w-auto text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    + Add referral
                  </button>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-600 bg-gray-50/60 dark:bg-gray-800/40 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-ink-secondary">
                        Referral <span className="font-normal text-ink-muted">(phone or code)</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          applyReferralInput('');
                          setShowReferral(false);
                        }}
                        className="text-xs text-ink-muted hover:text-ink-secondary"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="text"
                        autoCapitalize="characters"
                        placeholder="Friend's phone or code e.g. B42W8K"
                        value={referralInputValue}
                        onChange={(e) => applyReferralInput(e.target.value)}
                        className="w-full px-4 py-3 pr-12 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase tracking-wider"
                      />
                      <button
                        type="button"
                        title="Open numpad"
                        onClick={() => {
                          setNumPadTarget('referrer');
                          setShowNumPad(true);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-brand-600 rounded-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-ink-muted">
                      Digits = phone · letters = code. Both get 50 pts after first paid bill.
                    </p>
                  </div>
                )}

                {customerName && customerPhone && showCustomerSection && (
                  <div className="p-4 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg">
                    <p className="text-sm text-brand-700 dark:text-brand-300">
                      <span className="font-medium">Billing to:</span> {customerName} ({customerPhone})
                      {customerArea ? ` — ${customerArea}` : ''}
                    </p>
                  </div>
                )}

              </div>
              )}
            </div>

            {/* Cart Items */}
            <div className="glass-panel-strong rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-brand-50 to-transparent dark:from-brand-900/10">
                <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Cart Items
                </h2>
              </div>
              
              <div className="p-6">
                {items.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 mb-6 animate-bounce-in">
                      <svg className="w-12 h-12 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 font-semibold text-xl">Your cart is empty</p>
                    <p className="text-sm text-ink-muted mt-2">Add items from POS to get started</p>
                    <button
                      onClick={() => router.push('/store/pos')}
                      className="mt-8 px-8 py-4 bg-gradient-brand hover:brightness-105 shadow-glow-brand text-white rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98]"
                    >
                      Browse Products
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((item: any, index: number) => {
                      if (!item) return null;
                      const isRemoving = removingId === item.id;
                      const displayName = item.productName || item.productId || 'Unknown Product';
                      const qtyDisplay = item.qtyKg ? `${item.qtyKg} kg` : item.qtyPcs ? `${item.qtyPcs} pcs` : '1 pcs';
                      const rate = item.rate || 0;
                      const lineTotal = item.lineTotal || (rate * (item.qtyKg || item.qtyPcs || 1));
                      return (
                        <div
                          key={item.id || `item-${index}-${item.productId || Date.now()}`}
                          className={`group flex items-center gap-4 p-4 rounded-2xl hover:border-brand-300 dark:hover:border-brand-700 hover: transition-all duration-200 glass-panel/50 ${ isRemoving ? 'animate-slide-out-left' : '' }`}
                        >
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-ink mb-2 text-lg">{displayName}</h3>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium text-ink-secondary">
                                {qtyDisplay}
                              </span>
                              <span className="text-gray-400">×</span>
                              <span className="text-ink-secondary font-medium">₹{rate.toFixed(2)}</span>
                              {item.taxRate > 0 && (
                                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium">
                                  Tax: {item.taxRate}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="font-bold text-xl text-brand-600 dark:text-brand-400">
                                ₹{lineTotal.toFixed(2)}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item)}
                              disabled={!!removingId}
                              className="p-2.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 opacity-80 hover:opacity-100 active:scale-90 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
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
            <div className="sticky top-24 glass-panel-strong rounded-2xl overflow-hidden">
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
                    <span className="text-ink-secondary">Subtotal</span>
                    <span className="font-medium text-ink">₹{Math.round(subTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-secondary">Tax</span>
                    <span className="font-medium text-ink">₹{Math.round(taxTotal)}</span>
                  </div>
                  
                  {/* Quick Discount Buttons */}
                  <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-ink-secondary">Quick Discount</label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDiscountType('amount')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${ discountType === 'amount' ? 'bg-brand-500 text-white shadow-sm' : 'bg-gray-200 dark:bg-gray-700 text-ink-secondary hover:bg-gray-300 dark:hover:bg-gray-600' }`}
                          >
                            ₹ Amount
                          </button>
                          <button
                            type="button"
                            onClick={() => setDiscountType('percentage')}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${ discountType === 'percentage' ? 'bg-brand-500 text-white shadow-sm' : 'bg-gray-200 dark:bg-gray-700 text-ink-secondary hover:bg-gray-300 dark:hover:bg-gray-600' }`}
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
                            <div className="text-sm text-center text-ink-secondary bg-gray-50 dark:bg-gray-700/50 py-2 rounded-lg">
                              Discount: <span className="font-semibold">₹{Math.round((subTotal * discountPercentage) / 100)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Redeem loyalty points at checkout (1 point = ₹1) */}
                  {canRedeemLoyalty && (
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-ink-secondary flex items-center gap-1.5">
                          <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          Redeem Loyalty Points
                        </label>
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                          {customerPoints === null
                            ? 'Loading…'
                            : `${customerPoints} pts available`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={maxRedeemablePoints}
                          value={loyaltyRedeemPoints || ''}
                          disabled={!hasRedeemablePoints}
                          onChange={(e) => {
                            const v = Math.floor(parseFloat(e.target.value) || 0);
                            setLoyaltyRedeemPoints(Math.max(0, Math.min(v, maxRedeemablePoints)));
                          }}
                          className="flex-1 px-4 py-3 text-base font-semibold border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          placeholder="0"
                        />
                        <button
                          type="button"
                          disabled={!hasRedeemablePoints}
                          onClick={() => setLoyaltyRedeemPoints(maxRedeemablePoints)}
                          className="px-4 py-3 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Max
                        </button>
                        {loyaltyRedeemPoints > 0 && (
                          <button
                            type="button"
                            onClick={() => setLoyaltyRedeemPoints(0)}
                            className="px-4 py-3 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-gray-700 text-ink-secondary hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {loyaltyDiscount > 0 ? (
                        <div className="mt-2 text-sm text-center text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 py-2 rounded-lg">
                          Redeeming <span className="font-semibold">{loyaltyDiscount} pts</span> = <span className="font-semibold">−₹{loyaltyDiscount}</span> off this bill
                        </div>
                      ) : customerPoints === 0 ? (
                        <p className="mt-1 text-[10px] text-ink-muted">
                          No points to redeem yet — points are earned on each paid bill.
                        </p>
                      ) : (
                        <p className="mt-1 text-[10px] text-ink-muted">
                          1 point = ₹{LOYALTY_POINT_VALUE}. Points are deducted when the bill is paid.
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Settle previous customer credit with this checkout */}
                  <PendingCreditSettlement customerId={customerId} hidden={skipCustomer} />

                  {fulfillmentType === 'DELIVERY' && customerId && (
                    <div className="pt-3">
                      <label className="block text-sm font-semibold text-ink-secondary mb-1">
                        Delivery fee (₹)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={deliveryFee || ''}
                        onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                        className="w-full px-4 py-3 text-base font-semibold border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="0"
                      />
                    </div>
                  )}

                  <div className="pt-4 border-t-2 border-gray-300 dark:border-gray-600 space-y-1">
                    {effectiveDeliveryFee > 0 && (
                      <div className="flex justify-between items-center text-sm text-ink-secondary">
                        <span>Delivery fee</span>
                        <span>₹{effectiveDeliveryFee}</span>
                      </div>
                    )}
                    {loyaltyDiscount > 0 && (
                      <div className="flex justify-between items-center text-sm text-green-700 dark:text-green-400">
                        <span>Loyalty redeemed</span>
                        <span>−₹{loyaltyDiscount}</span>
                      </div>
                    )}
                    {pendingSettlements
                      .filter((l) => l.selected && l.amount > 0)
                      .map((l) => (
                        <div
                          key={l.saleId}
                          className="flex justify-between items-center text-sm text-amber-800 dark:text-amber-300"
                        >
                          <span>Credit bill #{l.saleNo}</span>
                          <span className="font-semibold">₹{Math.round(l.amount)}</span>
                        </div>
                      ))}
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-ink">
                        {pendingSettlementTotal > 0 ? 'Total to pay' : 'Grand Total'}
                      </span>
                      <span className="text-3xl font-bold text-brand-600 dark:text-brand-400">₹{checkoutGrandTotal}</span>
                    </div>
                    {pendingSettlementTotal > 0 && (
                      <p className="text-[10px] text-ink-muted text-right">
                        Includes ₹{cartGrandTotal} today + ₹{pendingSettlementTotal} previous credit
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Enhanced Checkout Button */}
                <button
                  onClick={async () => {
                    await ensureCustomerSaved();
                    publishPaymentMode(checkoutGrandTotal, null);
                    setShowPaymentModal(true);
                  }}
                  disabled={items.length === 0}
                  className={`w-full py-5 bg-gradient-to-r from-brand-500 via-brand-600 to-brand-500 hover:from-brand-600 hover:via-brand-700 hover:to-brand-600 text-white rounded-2xl font-bold text-xl shadow-2xl hover:shadow-orangeGlow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98] min-h-[72px] ${ items.length > 0 ? 'animate-soft-pulse' : '' }`}
                >
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <div className="flex flex-col items-start">
                    <span>Checkout Now</span>
                    <span className="text-white/90 text-sm font-semibold">₹{checkoutGrandTotal}</span>
                  </div>
                </button>

                {/* Quick Pay Button */}
                <button
                  onClick={async () => {
                    await ensureCustomerSaved();
                    publishPaymentMode(checkoutGrandTotal, null, {
                      payments: [{ method: 'CASH', amount: checkoutGrandTotal }],
                    });
                    handleCreateSale([{ method: 'CASH', amount: checkoutGrandTotal }]);
                  }}
                  disabled={items.length === 0 || isProcessingPayment}
                  className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="text-2xl">⚡</span>
                  <div className="flex flex-col items-start">
                    <span>Quick Pay (Cash)</span>
                    <span className="text-green-100 text-sm font-semibold">₹{checkoutGrandTotal} exact</span>
                  </div>
                </button>

                {/* Quick Actions */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      if (window.confirm('Clear all items from cart?')) {
                        void clearCart().then(() => {
                          publishIdleMode();
                        });
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
            <div className="lg:hidden fixed bottom-0 left-0 right-0 glass-panel-strong border-t border-gray-200 dark:border-gray-700 p-4 z-30 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
              <div className="max-w-7xl mx-auto space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-ink-muted">Total</div>
                    <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">₹{checkoutGrandTotal}</div>
                  </div>
                  <button
                    onClick={async () => {
                      await ensureCustomerSaved();
                      publishPaymentMode(checkoutGrandTotal, null);
                      setShowPaymentModal(true);
                    }}
                    disabled={items.length === 0}
                    className="px-6 py-4 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-2xl font-bold text-base shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50"
                  >
                    Pay Now
                  </button>
                </div>
                <button
                  onClick={async () => {
                    await ensureCustomerSaved();
                    publishPaymentMode(checkoutGrandTotal, null, {
                      payments: [{ method: 'CASH', amount: checkoutGrandTotal }],
                    });
                    handleCreateSale([{ method: 'CASH', amount: checkoutGrandTotal }]);
                  }}
                  disabled={items.length === 0 || isProcessingPayment}
                  className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold text-sm shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span>⚡</span>
                  <span>Quick Pay (Cash ₹{checkoutGrandTotal})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showPaymentModal && (
        <CartPaymentModal
          grandTotal={checkoutGrandTotal}
          cartGrandTotal={cartGrandTotal}
          pendingSettlementLines={pendingSettlements}
          subTotal={subTotal}
          taxTotal={taxTotal}
          discountTotal={discountTotal}
          deliveryFee={effectiveDeliveryFee}
          setDeliveryFee={setDeliveryFee}
          fulfillmentType={fulfillmentType}
          setFulfillmentType={setFulfillmentType}
          customerId={customerId}
          onClose={() => {
            if (!isProcessingPayment) {
              setShowPaymentModal(false);
              // Cashier backed out of payment — return display to the bill.
              publishCurrentBill();
            }
          }}
          onPay={handleCreateSale}
          isProcessing={isProcessingPayment}
        />
      )}

      {showSuccessAnimation && completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-panel rounded-2xl p-6 max-w-md w-full mx-4">
            <BillSuccessAnimation
              saleNo={completedSale.saleNo}
              grandTotal={completedSale.grandTotal}
              subtitle={
                completedSale.saleNo.includes('offline')
                  ? 'Saved offline — will sync when internet is back.'
                  : 'Redirecting to POS...'
              }
              onComplete={() => {
                setShowSuccessAnimation(false);
                setCompletedSale(null);
                // Soft-reset publisher mode only — do not Ably-idle the display
                // while it is still running success → review.
                releaseDisplaySuccessLatch();
                void clearCart().finally(() => {
                  router.push('/store/pos');
                });
              }}
            />
            <div className="mt-4 flex gap-3 justify-center">
              <button
                onClick={() => {
                  const receiptData = generateReceiptData(completedSale, user?.store);
                  printReceipt(receiptData);
                }}
                className="px-4 py-2 bg-gradient-brand hover:brightness-105 shadow-glow-brand text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <span>🖨️</span>
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => {
                  setShowSuccessAnimation(false);
                  setCompletedSale(null);
                  // Soft-reset publisher only — keep customer display on review.
                  releaseDisplaySuccessLatch();
                  void clearCart().finally(() => {
                    router.push('/store/pos');
                  });
                }}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-ink-secondary rounded-lg transition-colors"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {showNumPad && (
        <NumPad
          value={numPadTarget === 'referrer' ? referredByPhone || '' : tempCustomerPhone}
          onChange={(value) => {
            if (numPadTarget === 'referrer') {
              applyReferralInput(value);
              return;
            }
            setTempCustomerPhone(value);
            setCustomer(null, value || null, tempCustomerName || null, tempCustomerArea || null);
            matchCustomersByPhonePrefix(value);
            // Exact full number: try resolve once at 10+ digits
            if (value && value.replace(/\D/g, '').length >= 10) {
              void searchCustomers(value);
            }
          }}
          onClose={() => {
            setShowNumPad(false);
            if (
              numPadTarget === 'customer' &&
              tempCustomerPhone.replace(/\D/g, '').length >= 10 &&
              !(tempCustomerName || '').trim()
            ) {
              // Prefer device keyboard on the name field; use + for on-screen keys
              focusNameField();
            } else if (
              numPadTarget === 'customer' &&
              tempCustomerPhone.replace(/\D/g, '').length >= 10 &&
              (tempCustomerName || '').trim()
            ) {
              focusAreaField();
            }
          }}
          onSubmit={() => {
            setShowNumPad(false);
            setShowPhoneDropdown(false);
            if (numPadTarget !== 'customer') return;
            if (tempCustomerPhone.replace(/\D/g, '').length < 10) return;
            if (!(tempCustomerName || '').trim()) {
              focusNameField();
            } else {
              focusAreaField();
            }
          }}
          placeholder={
            numPadTarget === 'referrer'
              ? 'Referrer phone number'
              : 'Enter phone number'
          }
          maxLength={15}
        />
      )}

      {showKeyboard && (
        <VirtualKeyboard
          value={tempCustomerName}
          onChange={(value) => {
            setTempCustomerName(value);
            setCustomer(customerId, tempCustomerPhone || null, value || null, tempCustomerArea || null);
            searchCustomersByName(value);
          }}
          onClose={() => {
            setShowKeyboard(false);
            if ((tempCustomerName || '').trim()) {
              focusAreaField();
            }
          }}
          onSubmit={() => {
            setShowKeyboard(false);
            if ((tempCustomerName || '').trim()) {
              focusAreaField();
            }
          }}
          placeholder="Enter customer name"
        />
      )}
    </div>
  );
}
