// @ts-nocheck
/** Single source of truth for reporting formulas — see docs/reporting-metrics.md */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return round2((part / whole) * 100);
}

export function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return round2(((current - previous) / previous) * 100);
}

export function grossProfit(revenue: number, cogs: number): number {
  return round2(revenue - cogs);
}

export function grossMarginPct(revenue: number, cogs: number): number {
  return pct(revenue - cogs, revenue);
}

export function netProfit(revenue: number, purchases: number, expenses: number): number {
  return round2(revenue - purchases - expenses);
}

export function budgetVariancePct(actual: number, budget: number): number {
  if (budget <= 0) return 0;
  return round2(((actual - budget) / budget) * 100);
}

export function weightedAvgCost(
  entries: { rate: number; qty: number }[]
): number {
  let totalCost = 0;
  let totalQty = 0;
  for (const e of entries) {
    if (e.qty <= 0 || e.rate <= 0) continue;
    totalCost += e.rate * e.qty;
    totalQty += e.qty;
  }
  return totalQty > 0 ? round2(totalCost / totalQty) : 0;
}

export function inventoryTurnover(cogs: number, avgInventory: number): number | null {
  if (avgInventory <= 0 || cogs <= 0) return null;
  return round2(cogs / avgInventory);
}

export function wastagePct(wastageQty: number, salesQty: number): number {
  const denom = salesQty + wastageQty;
  return denom > 0 ? pct(wastageQty, denom) : 0;
}

export function ltv(totalSpent: number): number {
  return round2(totalSpent);
}

export function retentionRate(returning: number, priorActive: number): number {
  return pct(returning, priorActive);
}

export function redemptionRate(redeemed: number, earned: number): number {
  return pct(redeemed, earned);
}

export function referralConversion(converted: number, referred: number): number {
  return pct(converted, referred);
}

export function contributionPct(productProfit: number, totalProfit: number): number {
  return pct(productProfit, totalProfit);
}

export function aov(revenue: number, orderCount: number): number {
  return orderCount > 0 ? round2(revenue / orderCount) : 0;
}
