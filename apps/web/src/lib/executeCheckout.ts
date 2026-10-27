import type { AxiosInstance } from 'axios';
import { useCartStore } from '@/store/cart';
import {
  completeNewSaleCheckout,
  checkoutPaymentMismatch,
  type PendingSettlementLine,
} from '@/lib/pendingCreditCheckout';
import {
  queueOfflineCheckout,
  isOfflineForCheckout,
  isCheckoutNetworkError,
  type OfflineCreateSalePayload,
} from '@/lib/offlineCheckout';
import { runPostCheckoutSideEffects } from '@/lib/checkoutPostSuccess';
import { checkCartAgainstStockSnapshot } from '@/lib/stockSnapshot';

export type CheckoutPayment = { method: string; amount: number };

export type ExecuteCheckoutOptions = {
  api: AxiosInstance;
  payments: CheckoutPayment[];
  /** Walk-in / skip customer on cart. POS passes false. */
  skipCustomer?: boolean;
  clearCart: () => Promise<void>;
  onSuccess: (result: {
    saleNo: string;
    saleId: string | null;
    checkoutGrandTotal: number;
    loyaltyPointsRedeemed: number;
    offline: boolean;
  }) => void;
  onDiscountApproval: (saleNo: string) => void | Promise<void>;
  onNotify: (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info',
    duration?: number
  ) => void;
  onLoyaltyBalance?: (balance: number) => void;
  /** Close payment UI before success / approval. */
  onClosePaymentUi?: () => void;
  /** Restore customer display bill on hard failure. */
  onPaymentFailedUi?: () => void;
};

function newClientSaleId(prefix: string) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function buildSalePayload(
  clientSaleId: string,
  skipCustomer: boolean
): OfflineCreateSalePayload & {
  clientSaleId: string;
  discountSource?: 'profile_reward';
  profileRewardApplied?: boolean;
} {
  const state = useCartStore.getState();
  const {
    items,
    customerId,
    customerPhone,
    customerName,
    customerArea,
    discountTotal,
    discountSource,
    fulfillmentType: ft,
    deliveryFee: fee,
  } = state;
  const attachCustomer = !skipCustomer && !!customerId;
  const profileRewardApplied = attachCustomer && discountSource === 'profile_reward';
  const loyaltyPointsRedeemed = attachCustomer ? state.getTotal().loyaltyPointsApplied : 0;

  return {
    clientSaleId,
    items: items.map((item) => ({
      productId: item.productId,
      qtyKg: item.qtyKg || undefined,
      qtyPcs: item.qtyPcs || undefined,
      rate: item.rate,
      taxRate: item.taxRate,
      metaJson: item.metaJson || undefined,
    })),
    customerId: attachCustomer ? customerId! : undefined,
    customerPhone: !skipCustomer && customerPhone ? customerPhone : undefined,
    customerName: !skipCustomer && customerName ? customerName : undefined,
    customerArea: !skipCustomer && customerArea ? customerArea : undefined,
    discountTotal: discountTotal || 0,
    discountSource: profileRewardApplied ? ('profile_reward' as const) : undefined,
    profileRewardApplied: profileRewardApplied || undefined,
    deliveryFee: ft === 'DELIVERY' ? fee || 0 : 0,
    loyaltyPointsRedeemed,
    storeCreditToApply: attachCustomer
      ? state.getTotal().storeCreditApplied
      : 0,
    referredByPhone:
      !skipCustomer && state.referredByPhone ? state.referredByPhone : undefined,
    referredByCode:
      !skipCustomer && state.referredByCode ? state.referredByCode : undefined,
    couponCode: state.couponCode || undefined,
  };
}

function needsDiscountApproval(payload: any): boolean {
  return (
    payload?.requiresApproval === true ||
    payload?.override?.status === 'PENDING' ||
    (payload?.sale?.id && payload?.override && !payload?.id)
  );
}

/**
 * Shared counter checkout for POS Quick Pay and Cart Pay.
 * Owns clientSaleId, offline queue (with same key), discount-approval redirect,
 * pending-credit settlement, and post-success side effects.
 */
export async function executeCheckout(options: ExecuteCheckoutOptions): Promise<void> {
  const {
    api,
    payments,
    skipCustomer = false,
    clearCart,
    onSuccess,
    onDiscountApproval,
    onNotify,
    onLoyaltyBalance,
    onClosePaymentUi,
    onPaymentFailedUi,
  } = options;

  const state0 = useCartStore.getState();
  if (state0.items.length === 0) {
    onNotify('Cart is empty', 'warning');
    return;
  }

  if (payments.some((p) => p.method === 'CREDIT')) {
    if (skipCustomer || !state0.customerId) {
      onNotify(
        'Credit bills need a customer. Turn off walk-in and add phone & name first.',
        'warning'
      );
      return;
    }
  }

  const clientSaleId = newClientSaleId(skipCustomer ? 'cart' : 'pos');
  const saleData = buildSalePayload(clientSaleId, skipCustomer);

  const finishOffline = async (message: string) => {
    const { grandTotal } = useCartStore.getState().getTotal();
    await queueOfflineCheckout(
      saleData,
      payments,
      grandTotal,
      useCartStore.getState().fulfillmentType,
      clientSaleId
    );
    // [checkout-success] Empty cart before success UI — next scan is a new bill.
    try {
      await clearCart();
    } catch (clearErr) {
      console.error('[Checkout] clearCart after offline:', clearErr);
    }
    onClosePaymentUi?.();
    onSuccess({
      saleNo: 'Queued (offline)',
      saleId: null,
      checkoutGrandTotal: Math.round(grandTotal),
      loyaltyPointsRedeemed: Number(saleData.loyaltyPointsRedeemed || 0),
      offline: true,
    });
    onNotify(message, 'success', 6500);
  };

  if (isOfflineForCheckout()) {
    if (useCartStore.getState().getPendingSettlementTotal() > 0) {
      onNotify(
        'Settling old credit needs internet. Uncheck previous credit or go online.',
        'warning',
        6000
      );
      return;
    }
    await finishOffline(
      'Bill saved offline. It will sync automatically when internet is back.'
    );
    return;
  }

  const pendingLines: PendingSettlementLine[] =
    useCartStore.getState().getSelectedPendingSettlements();
  const checkoutGrandTotal = useCartStore.getState().getCheckoutTotal();

  if (checkoutPaymentMismatch(payments, checkoutGrandTotal)) {
    onNotify(`Payment total must match checkout amount ₹${checkoutGrandTotal}`, 'error');
    return;
  }

  // Soft stock gate from POS-prefetched summary — zero network on Pay.
  const stockGate = checkCartAgainstStockSnapshot(useCartStore.getState().items);
  if (!stockGate.ok) {
    onNotify(stockGate.message, 'error', 5000);
    return;
  }

  try {
    const fulfillmentType = useCartStore.getState().fulfillmentType;
    const couponCode = useCartStore.getState().couponCode;
    const inlinePayments = pendingLines.length === 0;
    const saleResponse = await api.post('/api/v1/sales', {
      ...saleData,
      fulfillmentType,
      ...(couponCode ? { couponCode } : {}),
      ...(inlinePayments ? { payments } : {}),
    });
    const payload = saleResponse.data;

    if (needsDiscountApproval(payload)) {
      const saleNo = payload?.sale?.saleNo || payload?.saleNo || 'pending';
      onClosePaymentUi?.();
      await onDiscountApproval(saleNo);
      return;
    }

    const sale = payload?.sale?.id ? payload.sale : payload;
    if (!sale?.id) {
      throw new Error('Invalid sale response: Sale ID not found');
    }

    const cartOnlyTotal = useCartStore.getState().getTotal().grandTotal;
    const salePaymentsTotal = Math.round(
      (Array.isArray(sale.payments) ? sale.payments : []).reduce(
        (s: number, p: { amount?: number }) => s + (Number(p.amount) || 0),
        0
      )
    );
    const saleAlreadySettled =
      sale.status === 'PAID' ||
      salePaymentsTotal >= Math.round(Number(sale.grandTotal) || cartOnlyTotal) - 1;

    // Only hit /pay again when payments were deferred (pending credit) or create left the sale unpaid.
    if (!inlinePayments || !saleAlreadySettled || pendingLines.length > 0) {
      try {
        const { settledSaleNos } = await completeNewSaleCheckout(
          api,
          sale,
          payments,
          pendingLines,
          cartOnlyTotal,
          { fulfillmentType: useCartStore.getState().fulfillmentType }
        );
        if (settledSaleNos.length > 0) {
          onNotify(
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
          onClosePaymentUi?.();
          await onDiscountApproval(sale.saleNo || sale.id);
          return;
        }
        throw payErr;
      }
    }

    const cartSnap = useCartStore.getState();
    const fulfillType = cartSnap.fulfillmentType;
    const isHomeDelivery = fulfillType === 'DELIVERY' && !!sale.customerId;
    const loyaltyCustomerId = cartSnap.customerId;
    const loyaltyPointsRedeemed = Number(saleData.loyaltyPointsRedeemed || 0);
    const fromMeta = (cartSnap.items || [])
      .map((it: any) => it?.metaJson?.preOrderId)
      .filter(Boolean)
      .map(String);
    const preOrderIds = [
      ...new Set([...(cartSnap.linkedPreOrderIds || []), ...fromMeta]),
    ];

    // [checkout-success] Clear the paid cart BEFORE the success UI so the next
    // barcode/scan cannot merge into the previous bill.
    try {
      await clearCart();
    } catch (clearErr) {
      console.error('[Checkout] clearCart before success UI:', clearErr);
    }

    onClosePaymentUi?.();
    onSuccess({
      saleNo: sale.saleNo || 'N/A',
      saleId: sale.id || null,
      checkoutGrandTotal,
      loyaltyPointsRedeemed,
      offline: false,
    });

    runPostCheckoutSideEffects({
      api,
      saleId: sale.id,
      payments,
      checkoutGrandTotal,
      loyaltyCustomerId,
      customerPhone: cartSnap.customerPhone,
      customerName: cartSnap.customerName,
      preOrderIds,
      skipCustomer,
      isHomeDelivery,
      deliveryFee: 0,
      clearCart: async () => {
        /* already cleared above — keep cart empty for the next bill */
      },
      onLoyaltyBalance,
      onDeliveryError: (message) => onNotify(message, 'info', 4000),
    });
  } catch (error: any) {
    const errData = error?.response?.data;
    if (
      errData?.requiresApproval ||
      errData?.override?.status === 'PENDING' ||
      (errData?.sale?.id && errData?.override)
    ) {
      onClosePaymentUi?.();
      await onDiscountApproval(errData?.sale?.saleNo || 'pending');
      return;
    }

    if (isCheckoutNetworkError(error) && useCartStore.getState().items.length > 0) {
      try {
        await finishOffline(
          'No connection — bill saved offline and will sync when you are back online.'
        );
        return;
      } catch (queueErr) {
        console.error('[Checkout] Offline queue fallback failed:', queueErr);
      }
    }

    if (error?.response?.data?.code === 'DAY_IN_REQUIRED') {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('pos-day-in-required'));
      }
      onNotify('Day In required before billing', 'error', 5000);
      onPaymentFailedUi?.();
      return;
    }

    let errorMessage = 'Failed to process payment';
    if (error?.response?.status === 401) {
      errorMessage = 'Authentication failed. Please log in again.';
    } else if (error?.response?.status === 400) {
      errorMessage =
        error.response?.data?.error || 'Invalid request. Please check your cart items.';
    } else if (error?.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    onClosePaymentUi?.();
    onPaymentFailedUi?.();
    onNotify(errorMessage, 'error', 5000);
    throw error;
  }
}
