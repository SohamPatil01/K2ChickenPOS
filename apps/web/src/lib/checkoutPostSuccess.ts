import type { AxiosInstance } from 'axios';

type PaymentLine = { method: string; amount: number };

/**
 * Non-blocking work after checkout UI is shown — delivery row, loyalty refresh,
 * cart wipe, and window events. Keeps the Pay button from feeling stuck.
 */
export function runPostCheckoutSideEffects(options: {
  api: AxiosInstance;
  saleId: string;
  payments: PaymentLine[];
  checkoutGrandTotal: number;
  loyaltyCustomerId?: string | null;
  customerPhone?: string | null;
  customerName?: string | null;
  /** Pre-order ids loaded into this cart (and/or tagged on line items). */
  preOrderIds?: string[];
  skipCustomer?: boolean;
  isHomeDelivery?: boolean;
  deliveryFee?: number;
  clearCart: () => Promise<void>;
  onLoyaltyBalance?: (balance: number) => void;
  onDeliveryError?: (message: string) => void;
}): void {
  const {
    api,
    saleId,
    payments,
    checkoutGrandTotal,
    loyaltyCustomerId,
    customerPhone,
    customerName,
    preOrderIds,
    skipCustomer,
    isHomeDelivery,
    deliveryFee,
    clearCart,
    onLoyaltyBalance,
    onDeliveryError,
  } = options;

  void (async () => {
    // [checkout-success] Wipe cart FIRST so the next barcode/scan cannot land on
    // the paid bill while the success animation is still on screen.
    try {
      await clearCart();
    } catch (clearErr) {
      console.error('[Checkout] clearCart after payment:', clearErr);
    }

    // Mark matching pre-orders completed when this customer is billed.
    if (!skipCustomer && (loyaltyCustomerId || customerPhone || customerName || (preOrderIds && preOrderIds.length))) {
      try {
        await api.post('/api/v1/pre-orders/fulfill-by-sale', {
          saleId,
          customerId: loyaltyCustomerId || undefined,
          phone: customerPhone || undefined,
          customerName: customerName || undefined,
          preOrderIds: preOrderIds?.length ? preOrderIds : undefined,
        });
      } catch (poErr) {
        console.warn('[Checkout] Pre-order fulfill failed (non-blocking):', poErr);
      }
    }

    if (isHomeDelivery) {
      try {
        await api.post('/api/v1/delivery', {
          saleId,
          type: 'DELIVERY',
          deliveryFee: deliveryFee || 0,
        });
      } catch (delErr: any) {
        const msg = String(delErr?.response?.data?.error || '');
        // Server often already created the row on sale create — treat as success.
        if (
          delErr?.response?.status === 400 &&
          msg.toLowerCase().includes('already has a delivery')
        ) {
          /* ok */
        } else {
          console.error('[Checkout] Create delivery failed:', delErr);
          onDeliveryError?.(
            delErr?.response?.data?.error ||
              'Order paid. Add delivery from Delivery section.'
          );
        }
      }
    }

    if (loyaltyCustomerId && !skipCustomer) {
      try {
        const loyaltyResponse = await api.get(
          `/api/v1/customers/${loyaltyCustomerId}/loyalty`
        );
        const rawBalance =
          loyaltyResponse.data?.customer?.loyaltyPoints ??
          loyaltyResponse.data?.loyaltyPoints ??
          null;
        if (rawBalance != null) {
          const balance = Math.max(0, Math.floor(Number(rawBalance) || 0));
          onLoyaltyBalance?.(balance);
        }
      } catch (loyaltyError) {
        console.error('[Checkout] Failed to refresh loyalty after payment:', loyaltyError);
      }
    }

    window.dispatchEvent(
      new CustomEvent('sale-created', { detail: { saleId, payments } })
    );

    const cashPayment = payments.find((p) => p.method === 'CASH');
    if (cashPayment) {
      window.dispatchEvent(
        new CustomEvent('cash-sale-completed', {
          detail: {
            saleId,
            amount: cashPayment.amount,
            grandTotal: checkoutGrandTotal,
          },
        })
      );
    }
  })();
}
