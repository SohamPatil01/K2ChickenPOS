/**
 * Align payment amounts with the server's sale.grandTotal so /pay validation
 * does not fail after a successful POST /sales (client vs server rounding).
 */
export function normalizePaymentsForSale(
  payments: Array<{ method: string; amount: number }>,
  serverGrandTotal: number
): Array<{ method: string; amount: number }> {
  const target = Math.round(Number(serverGrandTotal));
  if (!payments.length) return payments;

  if (payments.length === 1) {
    return [{ method: payments[0].method, amount: target }];
  }

  const rounded = payments.map((p) => ({
    method: p.method,
    amount: Math.round(Number(p.amount)),
  }));
  const sum = rounded.reduce((s, p) => s + p.amount, 0);
  const diff = target - sum;
  if (diff !== 0 && rounded.length > 0) {
    const last = rounded[rounded.length - 1];
    rounded[rounded.length - 1] = { ...last, amount: last.amount + diff };
  }
  return rounded;
}
