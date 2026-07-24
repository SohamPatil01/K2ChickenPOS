/**
 * Event contract shared between the cashier publisher and the customer display.
 * Everything flows over a single Ably channel `store:{storeId}:display`.
 */

export const DISPLAY_EVENTS = {
  BILL_UPDATE: "bill.update",
  MODE_PAYMENT: "mode.payment",
  MODE_SUCCESS: "mode.success",
  MODE_IDLE: "mode.idle",
} as const;

export type DisplayEventName =
  (typeof DISPLAY_EVENTS)[keyof typeof DISPLAY_EVENTS];

export interface DisplayLineItem {
  name: string;
  qtyKg: number | null;
  qtyPcs: number | null;
  rate: number;
  lineTotal: number;
  taxRate: number;
}

export interface BillUpdatePayload {
  seq: number;
  invoiceNo: string | null;
  customerName: string | null;
  items: DisplayLineItem[];
  subTotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  grandTotal: number;
  loyaltyPointsEst: number;
  savings: number;
}

export interface PaymentLineDisplay {
  method: string;
  amount: number;
}

export interface PaymentModePayload {
  seq: number;
  grandTotal: number;
  invoiceNo: string | null;
  upiQrString: string;
  upiId: string;
  payeeName: string;
  /** Cashier-selected lines (single method or split). Empty = total only, no QR yet. */
  payments: PaymentLineDisplay[];
  /** Amount encoded in the UPI QR. 0 = hide QR (cash/card/credit only). */
  upiAmount: number;
}

export interface SuccessModePayload {
  seq: number;
  amountPaid: number;
  invoiceNo: string | null;
  loyaltyPointsEarned: number;
  /** Sale id used to build the scannable digital-bill link (/bill/<id>). */
  saleId: string | null;
}

export interface IdleModePayload {
  seq: number;
  /** When true, display must honor idle even during the post-bill ignore window. */
  force?: boolean;
}

export type DisplayMode =
  | "idle"
  | "billing"
  | "payment"
  | "success"
  | "review";

export const DISPLAY_CHANNEL_PREFIX = "store:";

export function displayChannelName(storeId: string): string {
  return `${DISPLAY_CHANNEL_PREFIX}${storeId}:display`;
}

/** Loyalty rule mirrored from the server: 1.25% of the purchase total. */
export function estimateLoyaltyPoints(grandTotal: number): number {
  return Math.floor(Math.max(0, grandTotal) * 0.0125);
}

const PAIR_STORAGE_KEY = "k2-customer-display-session";

export function loadDisplaySession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PAIR_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveDisplaySession(token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAIR_STORAGE_KEY, token);
  } catch {
    // ignore storage failures (private mode etc.)
  }
}

export function clearDisplaySession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(PAIR_STORAGE_KEY);
  } catch {
    // ignore
  }
}
