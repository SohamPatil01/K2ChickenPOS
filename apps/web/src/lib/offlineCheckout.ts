import { queueEvent } from '@azela-pos/offline';
import { normalizePaymentsForSale } from '@azela-pos/shared';

export type OfflineCreateSalePayload = {
  items: Array<{
    productId: string;
    qtyKg?: number;
    qtyPcs?: number;
    rate: number;
    taxRate: number;
    metaJson?: Record<string, unknown>;
  }>;
  customerId?: string;
  customerPhone?: string;
  customerName?: string;
  customerArea?: string;
  discountTotal: number;
  deliveryFee?: number;
  /** Loyalty points redeemed at checkout (1 point = ₹1). */
  loyaltyPointsRedeemed?: number;
  /** Optional referrer phone for loyalty referral at counter. */
  referredByPhone?: string;
};

/** True when the browser reports no connectivity. */
export function isOfflineForCheckout(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/** Axios/fetch failures where we should queue the bill instead of blocking checkout. */
export function isCheckoutNetworkError(error: unknown): boolean {
  const err = error as {
    code?: string;
    message?: string;
    response?: unknown;
  };
  if (err.response != null) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === 'ERR_NETWORK' ||
    msg === 'network error' ||
    msg.includes('failed to fetch') ||
    msg.includes('network')
  );
}

/**
 * Save a completed bill locally; POST /api/v1/sync/events replays it when online.
 */
export async function queueOfflineCheckout(
  createSale: OfflineCreateSalePayload,
  payments: Array<{ method: string; amount: number }>,
  grandTotal: number,
  fulfillmentType: 'PICKUP' | 'DELIVERY' = 'PICKUP'
): Promise<void> {
  const idempotencyKey =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const paymentsQueued = normalizePaymentsForSale(payments, grandTotal);

  await queueEvent('OFFLINE_CHECKOUT_COMPLETE', {
    idempotencyKey,
    createSale,
    payments: paymentsQueued,
    fulfillmentType,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pos-pending-sync-changed'));
  }
}
