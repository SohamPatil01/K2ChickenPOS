import { STORE_TIMEZONE } from '@azela-pos/shared';

/** Dashboard alert thresholds. The UI only renders what the API returns. */
export const DASHBOARD_ALERT_RULES = {
  /** Today ≥ this × same time yesterday → "Great Day". */
  greatDayRatio: 1.5,
  /** Today < this × same time yesterday → "Revenue Alert". */
  revenueDropRatio: 0.7,
  /** Skip the comparison when yesterday had fewer sales than this (too little data). */
  minSalesForCompare: 5,
  /** Cash share of today's payments that triggers "Cash Heavy". */
  cashHeavyShare: 0.8,
  cashHeavyMinTotal: 1000,
  /** "No Sales" only after this hour of the store day (IST). */
  noSalesAfterHour: 12,
} as const;

export type DashboardAlertSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface DashboardAlert {
  key: string;
  severity: DashboardAlertSeverity;
  title: string;
  message: string;
}

export interface DashboardAlertInput {
  today: { revenue: number; count: number };
  /** Yesterday's PAID sales created up to the same clock time as now. */
  sameTimeYesterday: { revenue: number; count: number };
  payments: { cash: number; total: number };
  stock: { negativeProducts: number };
  /** Current hour in the store timezone (0–23). */
  hourIst: number;
}

export function buildDashboardAlerts(input: DashboardAlertInput): DashboardAlert[] {
  const { today, sameTimeYesterday: y, payments, stock, hourIst } = input;
  const rules = DASHBOARD_ALERT_RULES;
  const alerts: DashboardAlert[] = [];

  if (stock.negativeProducts > 0) {
    const n = stock.negativeProducts;
    alerts.push({
      key: 'stock-mismatch',
      severity: 'warning',
      title: 'Stock Check',
      message: `${n} product${n === 1 ? '' : 's'} sold more than received. Stock counts may be off, check receiving.`,
    });
  }

  if (today.count === 0 && hourIst > rules.noSalesAfterHour) {
    alerts.push({
      key: 'no-sales',
      severity: 'critical',
      title: 'No Sales',
      message: 'No sales recorded today yet. Check system status.',
    });
  }

  if (today.revenue > 0 && y.count >= rules.minSalesForCompare && y.revenue > 0) {
    const ratio = today.revenue / y.revenue;
    if (ratio > rules.greatDayRatio) {
      alerts.push({
        key: 'great-day',
        severity: 'success',
        title: 'Great Day',
        message: `Revenue is ${Math.round((ratio - 1) * 100)}% higher than this time yesterday! Keep it up!`,
      });
    } else if (ratio < rules.revenueDropRatio) {
      alerts.push({
        key: 'revenue-drop',
        severity: 'warning',
        title: 'Revenue Alert',
        message: `Revenue is ${Math.round((1 - ratio) * 100)}% lower than this time yesterday.`,
      });
    }
  }

  if (payments.total > rules.cashHeavyMinTotal && payments.cash > payments.total * rules.cashHeavyShare) {
    alerts.push({
      key: 'cash-heavy',
      severity: 'info',
      title: 'Cash Heavy',
      message: `Over ${Math.round(rules.cashHeavyShare * 100)}% of today's sales are in cash. Consider daily closing soon.`,
    });
  }

  return alerts;
}

/** Current hour (0–23) in the store timezone. Server clocks run in UTC. */
export function storeHourNow(at: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: STORE_TIMEZONE, hour: '2-digit', hourCycle: 'h23' }).format(at)
  );
}
