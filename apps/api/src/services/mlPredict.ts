/**
 * In-process predictive helpers for Advanced Analytics.
 * shortcut: seasonal+trend heuristics (not Prophet/LightGBM), upgrade when ANALYTICS_FORECAST_PROVIDER=ml is wired.
 */

export type SeriesPoint = { date: string; actual: number; ma7: number; ma30: number };

export type ForecastPoint = {
  date: string;
  predicted: number;
  predictedLow: number;
  predictedHigh: number;
  confidence: 'high' | 'medium' | 'low';
};

export type ProductForecast = {
  productId: string;
  productName: string;
  recentAvgDaily: number;
  predictedNext7: number;
  trend: 'up' | 'down' | 'stable';
  changePct: number | null;
};

export type Anomaly = {
  date: string;
  actual: number;
  expected: number;
  zScore: number;
  direction: 'spike' | 'drop';
};

export type PredictiveInsight = {
  severity: 'low' | 'medium' | 'high';
  title: string;
  detail: string;
  action?: string;
};

function movingAverage(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) result.push(data[i] ?? 0);
    else {
      const slice = data.slice(i - period + 1, i + 1);
      result.push(slice.reduce((a, b) => a + b, 0) / period);
    }
  }
  return result;
}

function linearRegression(data: number[]): { slope: number; intercept: number } {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] ?? 0 };
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const y = data[i] ?? 0;
    sumX += i;
    sumY += y;
    sumXY += i * y;
    sumXX += i * i;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function dowFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function round2(n: number) {
  return Math.round((n || 0) * 100) / 100;
}

/** Seasonal (DoW) + linear trend blend with residual bands. */
export function forecastRevenueSeries(
  dates: string[],
  values: number[],
  forecastDays: number
): {
  historical: SeriesPoint[];
  forecast: ForecastPoint[];
  trend: 'upward' | 'downward' | 'stable';
  avgDailySales: number;
  modelMapePct: number | null;
  daysWithPositiveSales: number;
} {
  const ma7 = movingAverage(values, 7);
  const ma30 = movingAverage(values, 30);
  const { slope } = linearRegression(values);
  const trend: 'upward' | 'downward' | 'stable' =
    slope > 0.1 ? 'upward' : slope < -0.1 ? 'downward' : 'stable';

  const avgValue = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const lastMa7 = ma7.length ? ma7[ma7.length - 1]! : avgValue;
  const baseline = Number.isFinite(lastMa7) ? lastMa7 : avgValue;

  const dowSum = Array(7).fill(0) as number[];
  const dowCount = Array(7).fill(0) as number[];
  for (let i = 0; i < dates.length; i++) {
    const dow = dowFromYmd(dates[i]!);
    dowSum[dow]! += values[i] ?? 0;
    dowCount[dow]! += 1;
  }
  const dowAvg = dowSum.map((s, d) => (dowCount[d]! > 0 ? s / dowCount[d]! : avgValue));

  // Hold-out MAPE: last 7 days vs one-step seasonal+trend prediction
  let mapeSum = 0;
  let mapeN = 0;
  const holdFrom = Math.max(7, values.length - 7);
  for (let t = holdFrom; t < values.length; t++) {
    const act = values[t] ?? 0;
    const hist = values.slice(0, t);
    const { slope: s } = linearRegression(hist);
    const ma = movingAverage(hist, 7);
    const base = ma.length ? ma[ma.length - 1]! : avgValue;
    const dAvg = Array(7).fill(0) as number[];
    const dCnt = Array(7).fill(0) as number[];
    for (let i = 0; i < t; i++) {
      const dow = dowFromYmd(dates[i]!);
      dAvg[dow]! += values[i] ?? 0;
      dCnt[dow]! += 1;
    }
    const seasonal = dCnt.map((c, d) => (c > 0 ? dAvg[d]! / c : avgValue));
    const fdow = dowFromYmd(dates[t]!);
    const pred = Math.max(0, 0.5 * (base + s) + 0.5 * (seasonal[fdow] ?? avgValue));
    mapeSum += Math.abs(act - pred) / Math.max(act, 1);
    mapeN += 1;
  }
  const modelMapePct = mapeN > 0 ? round2((mapeSum / mapeN) * 100) : null;

  const residuals: number[] = [];
  for (let t = 1; t < values.length; t++) {
    residuals.push(Math.abs((values[t] ?? 0) - (values[t - 1] ?? 0)));
  }
  const tail = residuals.slice(-14);
  const meanRes = tail.length ? tail.reduce((a, b) => a + b, 0) / tail.length : 0;
  const varRes =
    tail.length > 1
      ? tail.reduce((s, r) => s + (r - meanRes) ** 2, 0) / (tail.length - 1)
      : 0;
  const band = 1.96 * Math.sqrt(Math.max(0, varRes));

  const lastDate = dates.length ? dates[dates.length - 1]! : new Date().toISOString().slice(0, 10);
  const forecast: ForecastPoint[] = [];
  for (let i = 1; i <= forecastDays; i++) {
    const futureDate = addDaysYmd(lastDate, i);
    const trendPart = baseline + (Number.isFinite(slope) ? slope * i : 0);
    const seasonalPart = dowAvg[dowFromYmd(futureDate)] ?? avgValue;
    const predicted = Math.max(0, 0.5 * trendPart + 0.5 * seasonalPart);
    forecast.push({
      date: futureDate,
      predicted: round2(predicted),
      predictedLow: round2(Math.max(0, predicted - band)),
      predictedHigh: round2(predicted + band),
      confidence: i <= 2 ? 'high' : i <= 5 ? 'medium' : 'low',
    });
  }

  return {
    historical: dates.map((date, i) => ({
      date,
      actual: values[i] ?? 0,
      ma7: round2(ma7[i] ?? 0),
      ma30: round2(ma30[i] ?? 0),
    })),
    forecast,
    trend,
    avgDailySales: round2(avgValue),
    modelMapePct,
    daysWithPositiveSales: values.filter((v) => v > 0).length,
  };
}

/** Per-SKU next-7 demand from recent daily qty series. */
export function forecastProductDemand(
  products: Array<{
    productId: string;
    productName: string;
    dailyQty: number[];
  }>
): ProductForecast[] {
  return products
    .map((p) => {
      const vals = p.dailyQty;
      const n = vals.length;
      const recent = vals.slice(-14);
      const prior = vals.slice(-28, -14);
      const recentAvg =
        recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      const priorAvg =
        prior.length > 0 ? prior.reduce((a, b) => a + b, 0) / prior.length : recentAvg;
      const { slope } = linearRegression(vals.slice(-30));
      const predictedNext7 = Math.max(0, (recentAvg + slope * 3.5) * 7);
      const changePct =
        priorAvg > 0.01 ? round2(((recentAvg - priorAvg) / priorAvg) * 100) : null;
      const trend: 'up' | 'down' | 'stable' =
        changePct == null
          ? 'stable'
          : changePct > 12
            ? 'up'
            : changePct < -12
              ? 'down'
              : 'stable';
      return {
        productId: p.productId,
        productName: p.productName,
        recentAvgDaily: round2(recentAvg),
        predictedNext7: round2(predictedNext7),
        trend,
        changePct,
        _revProxy: recentAvg * n,
      };
    })
    .sort((a, b) => b.predictedNext7 - a.predictedNext7)
    .map(({ _revProxy: _, ...rest }) => rest);
}

/** Flag unusual revenue days (z-score vs rolling mean). */
export function detectRevenueAnomalies(
  dates: string[],
  values: number[],
  zThreshold = 2.2
): Anomaly[] {
  const out: Anomaly[] = [];
  const window = 14;
  for (let i = window; i < values.length; i++) {
    const hist = values.slice(i - window, i);
    const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
    const variance =
      hist.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, hist.length - 1);
    // Floor std so flat baselines still flag large absolute spikes/drops
    const std = Math.max(Math.sqrt(Math.max(0, variance)), mean * 0.05, 1);
    const actual = values[i] ?? 0;
    const z = (actual - mean) / std;
    if (Math.abs(z) >= zThreshold) {
      out.push({
        date: dates[i]!,
        actual: round2(actual),
        expected: round2(mean),
        zScore: round2(z),
        direction: z > 0 ? 'spike' : 'drop',
      });
    }
  }
  return out.slice(-8);
}

export function buildPredictiveInsights(input: {
  trend: 'upward' | 'downward' | 'stable';
  forecast: ForecastPoint[];
  avgDailySales: number;
  modelMapePct: number | null;
  productForecasts: ProductForecast[];
  anomalies: Anomaly[];
  paymentMixRecent?: { method: string; sharePct: number }[];
  paymentMixPrior?: { method: string; sharePct: number }[];
}): PredictiveInsight[] {
  const insights: PredictiveInsight[] = [];
  const next7 = input.forecast.slice(0, 7);
  const next7Total = next7.reduce((s, f) => s + f.predicted, 0);
  const best = next7.reduce(
    (a, b) => (b.predicted > a.predicted ? b : a),
    next7[0] || { date: '', predicted: 0, predictedLow: 0, predictedHigh: 0, confidence: 'low' as const }
  );
  const worst = next7.reduce(
    (a, b) => (b.predicted < a.predicted ? b : a),
    next7[0] || { date: '', predicted: 0, predictedLow: 0, predictedHigh: 0, confidence: 'low' as const }
  );

  if (next7.length) {
    insights.push({
      severity: 'low',
      title: 'Next 7 days revenue outlook',
      detail: `Model expects ~₹${Math.round(next7Total).toLocaleString('en-IN')} over the next week (avg ₹${Math.round(next7Total / 7).toLocaleString('en-IN')}/day). Trend: ${input.trend}.`,
      action: 'Match stock and staff to the stronger days below.',
    });
  }

  if (best?.date && worst?.date && best.date !== worst.date) {
    insights.push({
      severity: 'medium',
      title: 'Strongest vs softest day ahead',
      detail: `${best.date} looks strongest (~₹${Math.round(best.predicted).toLocaleString('en-IN')}); ${worst.date} softest (~₹${Math.round(worst.predicted).toLocaleString('en-IN')}).`,
      action: 'Prep extra top SKUs before the strong day; push promos on the soft day.',
    });
  }

  const rising = input.productForecasts.filter((p) => p.trend === 'up').slice(0, 3);
  const falling = input.productForecasts.filter((p) => p.trend === 'down').slice(0, 3);
  if (rising.length) {
    insights.push({
      severity: 'medium',
      title: 'Rising demand SKUs',
      detail: rising
        .map(
          (p) =>
            `${p.productName} (+${p.changePct ?? 0}%, ~${Math.round(p.predictedNext7)} units next 7d)`
        )
        .join('; '),
      action: 'Increase prep / PO qty for these items.',
    });
  }
  if (falling.length) {
    insights.push({
      severity: 'medium',
      title: 'Cooling demand SKUs',
      detail: falling
        .map(
          (p) =>
            `${p.productName} (${p.changePct ?? 0}%, ~${Math.round(p.predictedNext7)} units next 7d)`
        )
        .join('; '),
      action: 'Avoid overstock; consider bundle deals.',
    });
  }

  const recentDrop = [...input.anomalies].reverse().find((a) => a.direction === 'drop');
  const recentSpike = [...input.anomalies].reverse().find((a) => a.direction === 'spike');
  if (recentDrop) {
    insights.push({
      severity: 'high',
      title: 'Recent unusual drop',
      detail: `${recentDrop.date}: ₹${Math.round(recentDrop.actual).toLocaleString('en-IN')} vs expected ~₹${Math.round(recentDrop.expected).toLocaleString('en-IN')} (z=${recentDrop.zScore}).`,
      action: 'Check stockouts, holidays, or staffing that day.',
    });
  }
  if (recentSpike) {
    insights.push({
      severity: 'low',
      title: 'Recent unusual spike',
      detail: `${recentSpike.date}: ₹${Math.round(recentSpike.actual).toLocaleString('en-IN')} vs expected ~₹${Math.round(recentSpike.expected).toLocaleString('en-IN')}.`,
      action: 'Note what drove it — repeat if controllable.',
    });
  }

  if (input.modelMapePct != null && input.modelMapePct > 35) {
    insights.push({
      severity: 'medium',
      title: 'Forecast uncertainty is high',
      detail: `Hold-out MAPE ≈ ${input.modelMapePct}%. Predictions are directionally useful but bands are wide.`,
      action: 'Prefer the range (low–high) over the single point estimate.',
    });
  }

  if (input.paymentMixRecent?.length && input.paymentMixPrior?.length) {
    for (const recent of input.paymentMixRecent) {
      const prior = input.paymentMixPrior.find((p) => p.method === recent.method);
      if (!prior) continue;
      const delta = recent.sharePct - prior.sharePct;
      if (Math.abs(delta) >= 8) {
        insights.push({
          severity: delta > 0 ? 'low' : 'medium',
          title: `${recent.method} share ${delta > 0 ? 'rising' : 'falling'}`,
          detail: `${recent.method} went from ${prior.sharePct}% → ${recent.sharePct}% of tender vs prior window.`,
          action:
            recent.method === 'CASH' && delta < 0
              ? 'Plan for less cash float; more digital settlement.'
              : undefined,
        });
      }
    }
  }

  const severityRank = { high: 0, medium: 1, low: 2 };
  insights.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  return insights;
}
