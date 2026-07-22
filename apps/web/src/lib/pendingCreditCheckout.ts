import { normalizePaymentsForSale } from '@azela-pos/shared';
import { shouldTreatDuplicateCreditPayAsSuccess } from '@/lib/checkoutPayRecovery';

export type PendingOpenOrder = {
  id: string;
  saleNo: string;
  pending: number;
  remainingBalance?: number;
  createdAt: string;
  grandTotal?: number;
};

export type PendingSettlementLine = {
  saleId: string;
  saleNo: string;
  maxPending: number;
  amount: number;
  selected: boolean;
  createdAt?: string;
};

export function openOrdersToSettlementLines(orders: PendingOpenOrder[]): PendingSettlementLine[] {
  // Single outstanding bill: auto-include in checkout (common cashier flow).
  const autoSelect = orders.length === 1;
  return orders.map((o) => {
    const maxPending = Math.round(Number(o.pending ?? o.remainingBalance ?? 0));
    return {
      saleId: o.id,
      saleNo: o.saleNo,
      maxPending,
      amount: maxPending,
      selected: autoSelect,
      createdAt: o.createdAt,
    };
  });
}

export function sumSelectedPendingSettlements(lines: PendingSettlementLine[]): number {
  return lines
    .filter((l) => l.selected && l.amount > 0)
    .reduce((s, l) => s + Math.round(l.amount), 0);
}

export function getSelectedPendingSettlements(lines: PendingSettlementLine[]): PendingSettlementLine[] {
  return lines.filter((l) => l.selected && l.amount > 0);
}

/** Take up to `targetAmount` from the payment pool (FIFO by line order). */
export function allocatePaymentsFromPool(
  payments: Array<{ method: string; amount: number }>,
  targetAmount: number
): {
  allocated: Array<{ method: string; amount: number }>;
  remaining: Array<{ method: string; amount: number }>;
} {
  const target = Math.round(Number(targetAmount));
  const remaining = payments.map((p) => ({
    method: p.method,
    amount: Math.round(Number(p.amount)),
  }));
  const allocatedMap = new Map<string, number>();
  let left = Math.max(0, target);

  for (const p of remaining) {
    if (left <= 0) break;
    if (p.amount <= 0) continue;
    const take = Math.min(p.amount, left);
    allocatedMap.set(p.method, (allocatedMap.get(p.method) || 0) + take);
    p.amount -= take;
    left -= take;
  }

  const allocated = [...allocatedMap.entries()].map(([method, amount]) => ({ method, amount }));
  return {
    allocated,
    remaining: remaining.filter((p) => p.amount > 0),
  };
}

export async function paySaleWithRecovery(
  api: { post: (url: string, data: unknown) => Promise<unknown> },
  saleId: string,
  payments: Array<{ method: string; amount: number }>,
  expectedTotal: number
): Promise<void> {
  const normalized = normalizePaymentsForSale(payments, expectedTotal);
  if (!normalized.length || normalized.every((p) => p.amount <= 0)) return;

  try {
    await api.post(`/api/v1/sales/${saleId}/pay`, { payments: normalized });
  } catch (err) {
    if (!shouldTreatDuplicateCreditPayAsSuccess(err, normalized)) {
      throw err;
    }
  }
}

/** Apply allocated payments to each selected old credit bill (original sale records). */
export async function settlePendingSalesAfterCheckout(
  api: { post: (url: string, data: unknown) => Promise<unknown> },
  lines: PendingSettlementLine[],
  paymentPool: Array<{ method: string; amount: number }>
): Promise<{ remainingPool: Array<{ method: string; amount: number }>; settledSaleNos: string[] }> {
  let pool = paymentPool.map((p) => ({ ...p }));
  const settledSaleNos: string[] = [];
  const selected = getSelectedPendingSettlements(lines);

  for (const line of selected) {
    const amount = Math.round(line.amount);
    const { allocated, remaining } = allocatePaymentsFromPool(pool, amount);
    pool = remaining;
    const allocatedTotal = allocated.reduce((s, p) => s + Math.round(Number(p.amount)), 0);

    if (allocatedTotal <= 0) {
      throw new Error(
        `Could not pay previous credit bill #${line.saleNo}. Payment amount must cover today's items plus the selected credit.`
      );
    }

    // Pay only what we actually allocated (never inflate via normalize to the full line amount).
    await paySaleWithRecovery(api, line.saleId, allocated, allocatedTotal);
    if (allocatedTotal >= amount - 1) {
      settledSaleNos.push(line.saleNo);
    } else {
      throw new Error(
        `Only ₹${allocatedTotal} of ₹${amount} could be applied to #${line.saleNo}. Increase the payment amount.`
      );
    }
  }

  return { remainingPool: pool, settledSaleNos };
}

/**
 * Pay the new sale (cart items only), then settle selected old credit bills.
 * When no pending lines are selected, behaves like a normal single-sale checkout.
 */
export async function completeNewSaleCheckout(
  api: { post: (url: string, data: unknown) => Promise<unknown> },
  sale: { id: string; grandTotal: number },
  allPayments: Array<{ method: string; amount: number }>,
  pendingLines: PendingSettlementLine[]
): Promise<{ settledSaleNos: string[] }> {
  const pendingTotal = sumSelectedPendingSettlements(pendingLines);
  const roundedSaleGrandTotal = Math.round(Number(sale.grandTotal));
  let pool = allPayments.map((p) => ({ method: p.method, amount: Math.round(Number(p.amount)) }));

  const { allocated: cartPayments, remaining } = allocatePaymentsFromPool(pool, roundedSaleGrandTotal);
  pool = remaining;

  await paySaleWithRecovery(api, sale.id, cartPayments, roundedSaleGrandTotal);

  if (pendingTotal <= 0) {
    return { settledSaleNos: [] };
  }

  const { settledSaleNos } = await settlePendingSalesAfterCheckout(api, pendingLines, pool);
  return { settledSaleNos };
}

export function checkoutPaymentMismatch(
  payments: Array<{ method: string; amount: number }>,
  checkoutGrandTotal: number
): boolean {
  const paid = payments.reduce((s, p) => s + Math.round(Number(p.amount)), 0);
  return Math.abs(paid - Math.round(checkoutGrandTotal)) > 1;
}
