"use client";

import { useCartStore } from "@/store/cart";
import { useCustomerDisplayStore } from "./controller";
import { getUpiConfig, buildUpiString } from "./upi";
import {
  estimateLoyaltyPoints,
  type BillUpdatePayload,
  type DisplayLineItem,
  type PaymentLineDisplay,
} from "./types";

/**
 * Imperative helpers used by the POS / cart checkout flows to drive the
 * customer display's mode transitions. All are safe no-ops when the display is
 * not active (the controller's publish methods simply do nothing).
 */

/** Build a bill snapshot from current cart state, mirroring getTotal() math. */
export function buildBillPayload(): Omit<BillUpdatePayload, "seq"> {
  const cart = useCartStore.getState();
  const { subTotal, taxTotal, deliveryFee, grandTotal, loyaltyDiscount } =
    cart.getTotal();

  let discount = cart.discountTotal;
  if (cart.discountType === "percentage" && cart.discountPercentage > 0) {
    discount = (subTotal * cart.discountPercentage) / 100;
  }
  discount = Math.round(discount * 100) / 100;

  // Total customer savings = manual discount + loyalty points redeemed (₹).
  const totalSavings =
    Math.round((discount + (loyaltyDiscount || 0)) * 100) / 100;

  const items: DisplayLineItem[] = cart.items.map((it) => ({
    name: it.productName,
    qtyKg: it.qtyKg ?? null,
    qtyPcs: it.qtyPcs ?? null,
    rate: it.rate,
    lineTotal: it.lineTotal,
    taxRate: it.taxRate,
  }));

  return {
    invoiceNo: null,
    customerName: cart.customerName,
    items,
    subTotal,
    discount,
    tax: taxTotal,
    deliveryFee,
    grandTotal,
    loyaltyPointsEst: estimateLoyaltyPoints(grandTotal),
    savings: totalSavings,
  };
}

/** Re-publish the current bill (e.g. after the cashier cancels the payment panel). */
export function publishCurrentBill(): void {
  const store = useCustomerDisplayStore.getState();
  if (!store.active) return;
  try {
    store.publishBill(buildBillPayload());
  } catch {
    // never break billing
  }
}

function isUpiLike(method: string): boolean {
  const m = String(method || "").toUpperCase();
  return m === "UPI" || m === "ONLINE";
}

export type PublishPaymentOptions = {
  /** Single-method or split lines. Omit / empty = show total only, no UPI QR. */
  payments?: Array<{ method: string; amount: number }>;
};

/**
 * Switch the display into payment mode.
 * - Cash / Card / Credit only → no UPI QR
 * - UPI / Online only → QR for that amount
 * - Split → show each line; QR only for the UPI/Online portion
 */
export function publishPaymentMode(
  grandTotal: number,
  invoiceNo: string | null,
  options?: PublishPaymentOptions
): void {
  const store = useCustomerDisplayStore.getState();
  if (!store.active) return;

  const payments: PaymentLineDisplay[] = (options?.payments || [])
    .filter((p) => Number(p.amount) > 0)
    .map((p) => ({
      method: String(p.method || "").toUpperCase(),
      amount: Math.round(Number(p.amount) * 1000) / 1000,
    }));

  const upiAmount =
    Math.round(
      payments.filter((p) => isUpiLike(p.method)).reduce((s, p) => s + p.amount, 0) *
        1000
    ) / 1000;

  const cfg = getUpiConfig();
  const upiQrString =
    upiAmount > 0 && cfg
      ? buildUpiString({
          upiId: cfg.upiId,
          payeeName: cfg.payeeName,
          amount: upiAmount,
          note: invoiceNo || undefined,
        })
      : "";

  store.publishPayment({
    grandTotal,
    invoiceNo,
    upiQrString,
    upiId: cfg?.upiId || "",
    payeeName: cfg?.payeeName || "K2 Chicken",
    payments,
    upiAmount,
  });
}

/** Show the success screen with the real sale number + earned loyalty points. */
export function publishSuccessMode(
  amountPaid: number,
  invoiceNo: string | null,
  saleId: string | null = null
): void {
  const store = useCustomerDisplayStore.getState();
  if (!store.active) return;
  store.publishSuccess({
    amountPaid,
    invoiceNo,
    loyaltyPointsEarned: estimateLoyaltyPoints(amountPaid),
    saleId,
  });
}

/** Reset the display back to the idle / branding state. */
export function publishIdleMode(): void {
  const store = useCustomerDisplayStore.getState();
  if (!store.active) return;
  store.publishIdle();
}
