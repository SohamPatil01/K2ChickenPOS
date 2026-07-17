export interface PaymentTotals {
  cash: number;
  upi: number;
  card: number;
  online: number;
  credit: number;
  other: number;
  total: number;
}

export interface PaymentRow {
  method?: string;
  amount?: number;
}

export interface SaleWithPayments {
  grandTotal?: number | null;
  payments?: PaymentRow[] | null;
}

function roundMoney(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Return payment rows with CREDIT reduced to the amount still outstanding.
 *
 * CREDIT records the unpaid part of a bill, not money received. Settlement
 * appends CASH/UPI/CARD rows while retaining CREDIT for audit/idempotency, so
 * summing the raw rows double-counts a settled bill.
 */
export function effectivePaymentRowsForSale(
  sale: SaleWithPayments
): Array<{ method: string; amount: number }> {
  const actualRows: Array<{ method: string; amount: number }> = [];
  let actualTotal = 0;
  let declaredCredit = 0;

  for (const payment of sale.payments || []) {
    const method = String(payment.method || '').toUpperCase();
    const amount = Number(payment.amount) || 0;
    if (!method || amount <= 0) continue;

    if (method === 'CREDIT') {
      declaredCredit += amount;
    } else {
      actualRows.push({ method, amount });
      actualTotal += amount;
    }
  }

  if (declaredCredit <= 0) return actualRows;

  const billTotal = Number(sale.grandTotal);
  const outstandingCredit =
    Number.isFinite(billTotal) && billTotal >= 0
      ? Math.min(declaredCredit, Math.max(0, billTotal - actualTotal))
      : declaredCredit;

  if (outstandingCredit > 0) {
    actualRows.push({ method: 'CREDIT', amount: roundMoney(outstandingCredit) });
  }

  return actualRows;
}

/**
 * Sum payment rows from PAID sales. ONLINE is included in `upi` (digital payments)
 * so UPI bank/app totals match what staff see in daily closing & dashboard.
 */
export function tallyPaymentsFromSales(
  sales: SaleWithPayments[]
): PaymentTotals {
  const totals: PaymentTotals = {
    cash: 0,
    upi: 0,
    card: 0,
    online: 0,
    credit: 0,
    other: 0,
    total: 0,
  };

  for (const sale of sales) {
    for (const p of effectivePaymentRowsForSale(sale)) {
      const method = String(p.method || '').toUpperCase();
      const amount = Number(p.amount) || 0;
      if (amount <= 0) continue;
      totals.total += amount;
      switch (method) {
        case 'CASH':
          totals.cash += amount;
          break;
        case 'UPI':
          totals.upi += amount;
          break;
        case 'ONLINE':
          totals.online += amount;
          totals.upi += amount;
          break;
        case 'CARD':
        case 'CREDIT_CARD':
        case 'DEBIT_CARD':
          totals.card += amount;
          break;
        case 'CREDIT':
          totals.credit += amount;
          break;
        default:
          totals.other += amount;
          break;
      }
    }
  }

  totals.cash = roundMoney(totals.cash);
  totals.upi = roundMoney(totals.upi);
  totals.card = roundMoney(totals.card);
  totals.online = roundMoney(totals.online);
  totals.credit = roundMoney(totals.credit);
  totals.other = roundMoney(totals.other);
  totals.total = roundMoney(totals.total);
  return totals;
}

/** Legacy field names used by daily closing records. */
export function tallyToClosingFields(totals: PaymentTotals) {
  return {
    cashSales: totals.cash,
    cardSales: totals.card,
    upiSales: totals.upi,
  };
}

/** Chart / analytics rows with ONLINE rolled into UPI. */
export function paymentMixChartRows(
  sales: SaleWithPayments[]
): Array<{ name: string; total: number }> {
  const t = tallyPaymentsFromSales(sales);
  const rows: Array<{ name: string; total: number }> = [
    { name: 'CASH', total: t.cash },
    { name: 'UPI', total: t.upi },
    { name: 'CARD', total: t.card },
  ];
  if (t.credit > 0) rows.push({ name: 'CREDIT', total: t.credit });
  if (t.other > 0) rows.push({ name: 'OTHER', total: t.other });
  return rows.filter((r) => r.total > 0);
}

/** Dashboard-style buckets from tallied payments. */
export function paymentBreakdownBuckets(totals: PaymentTotals) {
  return {
    cash: totals.cash,
    upi: totals.upi,
    card: totals.card,
    other: totals.other + totals.credit,
    total: totals.total,
  };
}
