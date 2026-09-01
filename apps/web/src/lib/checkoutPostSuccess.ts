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
    skipCustomer,
    isHomeDelivery,
    deliveryFee,
    clearCart,
    onLoyaltyBalance,
    onDeliveryError,
  } = options;

  void (async () => {
    if (isHomeDelivery) {
      try {
        await api.post('/api/v1/delivery', {
          saleId,
          type: 'DELIVERY',
          deliveryFee: deliveryFee || 0,
        });
      } catch (delErr: any) {
        console.error('[Checkout] Create delivery failed:', delErr);
        onDeliveryError?.(
          delErr?.response?.data?.error ||
            'Order paid. Add delivery from Delivery section.'
        );
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

    try {
      await clearCart();
    } catch (clearErr) {
      console.error('[Checkout] clearCart after payment:', clearErr);
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
