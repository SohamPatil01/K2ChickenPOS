import { describe, it, expect } from 'vitest';
import {
  buildPredictiveInsights,
  detectRevenueAnomalies,
  forecastProductDemand,
  forecastRevenueSeries,
} from './mlPredict.js';

function ymdSeries(n: number, start = '2025-01-01'): string[] {
  const out: string[] = [];
  const [y, m, d] = start.split('-').map(Number);
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(y!, m! - 1, d! + i));
    out.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
    );
  }
  return out;
}

describe('mlPredict', () => {
  it('forecastRevenueSeries returns forecastDays points and non-negative predictions', () => {
    const dates = ymdSeries(60);
    const values = dates.map((_, i) => 1000 + (i % 7) * 200 + i * 2);
    const result = forecastRevenueSeries(dates, values, 7);
    expect(result.forecast).toHaveLength(7);
    expect(result.historical).toHaveLength(60);
    expect(result.forecast.every((f) => f.predicted >= 0)).toBe(true);
    expect(result.daysWithPositiveSales).toBeGreaterThan(0);
  });

  it('detectRevenueAnomalies flags a clear spike', () => {
    const dates = ymdSeries(30);
    const values = dates.map(() => 1000);
    values[25] = 5000;
    const anomalies = detectRevenueAnomalies(dates, values, 2.0);
    expect(anomalies.some((a) => a.date === dates[25] && a.direction === 'spike')).toBe(true);
  });

  it('forecastProductDemand marks rising SKUs', () => {
    const dailyQty = [
      ...Array(14).fill(2),
      ...Array(14).fill(8),
    ];
    const [row] = forecastProductDemand([
      { productId: 'p1', productName: 'Breast', dailyQty },
    ]);
    expect(row?.trend).toBe('up');
    expect(row!.predictedNext7).toBeGreaterThan(0);
  });

  it('buildPredictiveInsights includes next-week outlook', () => {
    const dates = ymdSeries(30);
    const values = dates.map((_, i) => 800 + i);
    const rev = forecastRevenueSeries(dates, values, 7);
    const insights = buildPredictiveInsights({
      trend: rev.trend,
      forecast: rev.forecast,
      avgDailySales: rev.avgDailySales,
      modelMapePct: rev.modelMapePct,
      productForecasts: [],
      anomalies: [],
    });
    expect(insights.some((i) => i.title.includes('Next 7 days'))).toBe(true);
  });
});
