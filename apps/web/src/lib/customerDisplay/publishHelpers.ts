"use client";

import { useCartStore } from "@/store/cart";
import { useCustomerDisplayStore } from "./controller";
import { getUpiConfig, buildUpiString } from "./upi";
import {
  estimateLoyaltyPoints,
  type BillUpdatePayload,
  type DisplayLineItem,
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

/** Switch the display into payment mode with a dynamic UPI QR for `grandTotal`. */
export function publishPaymentMode(
  grandTotal: number,
  invoiceNo: string | null
): void {
  const store = useCustomerDisplayStore.getState();
  if (!store.active) return;

  const cfg = getUpiConfig();
  const upiQrString = cfg
    ? buildUpiString({
        upiId: cfg.upiId,
        payeeName: cfg.payeeName,
        amount: grandTotal,
        note: invoiceNo || undefined,
      })
    : "";

  store.publishPayment({
    grandTotal,
    invoiceNo,
    upiQrString,
    upiId: cfg?.upiId || "",
    payeeName: cfg?.payeeName || "K2 Chicken",
  });
}

/** Show the success screen with the real sale number + earned loyalty points. */
export function publishSuccessMode(
  amountPaid: number,
  invoiceNo: string | null
): void {
  const store = useCustomerDisplayStore.getState();
  if (!store.active) return;
  store.publishSuccess({
    amountPaid,
    invoiceNo,
    loyaltyPointsEarned: estimateLoyaltyPoints(amountPaid),
  });
}

/** Reset the display back to the idle / branding state. */
export function publishIdleMode(): void {
  const store = useCustomerDisplayStore.getState();
  if (!store.active) return;
  store.publishIdle();
}
