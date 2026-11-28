import { describe, expect, it } from 'vitest';
import { buildDashboardAlerts, DASHBOARD_ALERT_RULES } from './dashboardAlerts.js';

const quiet = {
  today: { revenue: 1000, count: 10 },
  sameTimeYesterday: { revenue: 1000, count: 10 },
  payments: { cash: 100, total: 1000 },
  stock: { negativeProducts: 0 },
  hourIst: 14,
};

describe('buildDashboardAlerts', () => {
  it('returns no alerts for a normal day', () => {
    expect(buildDashboardAlerts(quiet)).toEqual([]);
  });

  it('shows Great Day with the computed percentage, not a fixed 50%', () => {
    const alerts = buildDashboardAlerts({
      ...quiet,
      today: { revenue: 7000, count: 40 },
      sameTimeYesterday: { revenue: 1000, count: 10 },
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].key).toBe('great-day');
    expect(alerts[0].message).toContain('600% higher');
  });

  it('shows Revenue Alert when well below same time yesterday', () => {
    const alerts = buildDashboardAlerts({
      ...quiet,
      today: { revenue: 400, count: 4 },
      sameTimeYesterday: { revenue: 1000, count: 10 },
    });
    expect(alerts.map((a) => a.key)).toEqual(['revenue-drop']);
    expect(alerts[0].message).toContain('60% lower');
  });

  it('skips the comparison when yesterday has too few sales', () => {
    const alerts = buildDashboardAlerts({
      ...quiet,
      today: { revenue: 9000, count: 9 },
      sameTimeYesterday: { revenue: 1000, count: DASHBOARD_ALERT_RULES.minSalesForCompare - 1 },
    });
    expect(alerts).toEqual([]);
  });

  it('flags negative-stock products', () => {
    const alerts = buildDashboardAlerts({ ...quiet, stock: { negativeProducts: 1 } });
    expect(alerts[0].key).toBe('stock-mismatch');
    expect(alerts[0].message).toContain('1 product sold');
  });

  it('shows No Sales only after the cutoff hour', () => {
    const noSales = { ...quiet, today: { revenue: 0, count: 0 }, sameTimeYesterday: { revenue: 0, count: 0 } };
    expect(buildDashboardAlerts({ ...noSales, hourIst: 9 })).toEqual([]);
    expect(buildDashboardAlerts({ ...noSales, hourIst: 15 }).map((a) => a.key)).toEqual(['no-sales']);
  });

  it('flags cash-heavy days over the threshold', () => {
    const alerts = buildDashboardAlerts({ ...quiet, payments: { cash: 1400, total: 1500 } });
    expect(alerts.map((a) => a.key)).toEqual(['cash-heavy']);
  });
});
