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
  /** Online/offline shared idempotency key when present. */
  clientSaleId?: string;
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
  /** Optional referrer loyalty code for loyalty referral at counter. */
  referredByCode?: string;
  discountSource?: string;
  profileRewardApplied?: boolean;
  couponCode?: string;
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
  fulfillmentType: 'PICKUP' | 'DELIVERY' = 'PICKUP',
  /** Prefer the same key as online `clientSaleId` so retries don't double-bill. */
  clientSaleId?: string
): Promise<void> {
  const fromPayload =
    clientSaleId ||
    createSale.clientSaleId ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const idempotencyKey = String(fromPayload).trim().slice(0, 64);

  const paymentsQueued = normalizePaymentsForSale(payments, grandTotal);

  await queueEvent('OFFLINE_CHECKOUT_COMPLETE', {
    idempotencyKey,
    createSale: {
      ...createSale,
      clientSaleId: idempotencyKey,
    },
    payments: paymentsQueued,
    fulfillmentType,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pos-pending-sync-changed'));
  }
}
