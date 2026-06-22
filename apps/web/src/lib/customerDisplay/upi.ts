/**
 * Dynamic UPI deep-link builder. Produces a standard `upi://pay` string that
 * any UPI app (GPay, PhonePe, Paytm, BHIM…) can scan to pre-fill a payment.
 *
 * Configure via env (no DB / no migration):
 *   NEXT_PUBLIC_UPI_ID    e.g. "k2chicken@okhdfcbank"
 *   NEXT_PUBLIC_UPI_PAYEE e.g. "K2 Chicken"
 */

export interface UpiConfig {
  upiId: string;
  payeeName: string;
}

export function getUpiConfig(): UpiConfig | null {
  const upiId = (process.env.NEXT_PUBLIC_UPI_ID || "").trim();
  const payeeName = (process.env.NEXT_PUBLIC_UPI_PAYEE || "K2 Chicken").trim();
  if (!upiId) return null;
  return { upiId, payeeName };
}

export interface BuildUpiArgs {
  upiId: string;
  payeeName: string;
  amount: number;
  /** Shown to the customer in their UPI app; usually the invoice/bill no. */
  note?: string | null;
}

/**
 * Build the UPI payment URI. Amount is fixed (the payable grand total) so the
 * customer can't edit it. Returns empty string if essentials are missing.
 */
export function buildUpiString({
  upiId,
  payeeName,
  amount,
  note,
}: BuildUpiArgs): string {
  if (!upiId || !(amount > 0)) return "";
  const params = new URLSearchParams();
  params.set("pa", upiId);
  params.set("pn", payeeName || "K2 Chicken");
  params.set("am", amount.toFixed(2));
  params.set("cu", "INR");
  if (note) params.set("tn", String(note).slice(0, 50));
  return `upi://pay?${params.toString()}`;
}
