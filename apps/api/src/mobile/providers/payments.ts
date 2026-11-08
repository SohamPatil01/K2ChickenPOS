/**
 * Payment methods for app orders.
 *
 * The POS has no online payment gateway: payments are recorded by cashiers (CASH / CARD / UPI QR /
 * CREDIT / ONLINE reference) when a sale is billed. App orders are therefore placed as POS
 * pre-orders and paid at pickup or on delivery, at the real weighed amount, through the existing
 * billing screen. No card data touches the app or this API.
 *
 * An online gateway (e.g. Razorpay/PhonePe/Cashfree) is a business + credential decision; when chosen,
 * implement OnlinePaymentGateway (create intent → client SDK → signed webhook verification →
 * mark paid) and register it here. Until then no online method is offered.
 */
export type PaymentMethodId = 'PAY_AT_PICKUP' | 'PAY_ON_DELIVERY';

export type PaymentMethodInfo = {
  id: PaymentMethodId;
  label: string;
  description: string;
  fulfillment: 'PICKUP' | 'DELIVERY';
};

export const PAYMENT_METHODS: PaymentMethodInfo[] = [
  {
    id: 'PAY_AT_PICKUP',
    label: 'Pay at store',
    description: 'Pay by UPI, cash or card when you collect. You pay for the actual weight cut.',
    fulfillment: 'PICKUP',
  },
  {
    id: 'PAY_ON_DELIVERY',
    label: 'Pay on delivery',
    description: 'Pay the delivery partner by UPI or cash for the actual weight delivered.',
    fulfillment: 'DELIVERY',
  },
];

export interface OnlinePaymentGateway {
  readonly name: string;
  createIntent(args: { orderId: string; amountPaise: number; idempotencyKey: string }): Promise<{ intentId: string; clientPayload: unknown }>;
  verifyWebhook(rawBody: string, signatureHeader: string): boolean;
}

export function methodsFor(fulfillment: 'PICKUP' | 'DELIVERY'): PaymentMethodInfo[] {
  return PAYMENT_METHODS.filter((m) => m.fulfillment === fulfillment);
}

export const WEIGHT_PRICING_DISCLOSURE =
  'Chicken is cut and weighed fresh. Your bill is calculated at the store at the same per-kg price for the actual weight, so it can differ slightly from this estimate. You pay only after weighing.';
