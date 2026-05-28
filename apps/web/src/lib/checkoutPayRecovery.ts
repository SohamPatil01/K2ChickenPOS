/** True when /pay failed because the sale was already paid (double-submit). */
export function isDuplicatePayError(error: unknown): boolean {
  const err = error as { response?: { status?: number; data?: { error?: string } } };
  const status = err?.response?.status;
  const msg = String(err?.response?.data?.error || '').toLowerCase();
  return (
    status === 400 &&
    (msg.includes('exceeds remaining balance') ||
      msg.includes('exceeds bill total') ||
      msg.includes('credit amount exceeds'))
  );
}

/** Credit checkout: backend often already recorded payment before the duplicate /pay fails. */
export function shouldTreatDuplicateCreditPayAsSuccess(
  error: unknown,
  attemptedPayments: Array<{ method: string; amount: number }>
): boolean {
  if (!isDuplicatePayError(error)) return false;
  return attemptedPayments.some((p) => String(p.method).toUpperCase() === 'CREDIT');
}
