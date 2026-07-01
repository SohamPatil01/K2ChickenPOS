export interface PaymentTotals {
  cash: number;
  upi: number;
  card: number;
  online: number;
  credit: number;
  other: number;
  total: number;
}

function roundMoney(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Sum payment rows from PAID sales. ONLINE is included in `upi` (digital payments)
 * so UPI bank/app totals match what staff see in daily closing & dashboard.
 */
export function tallyPaymentsFromSales(
  sales: Array<{ payments?: Array<{ method?: string; amount?: number }> | null }>
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
    for (const p of sale.payments || []) {
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
