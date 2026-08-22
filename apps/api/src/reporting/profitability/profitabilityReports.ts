// @ts-nocheck
import { prisma } from '@azela-pos/db';
import { salesInDateRangeWhere } from '@azela-pos/shared';
import { analyticsService } from '../../services/analyticsService.js';
import { round2, grossProfit, grossMarginPct, contributionPct } from '../shared/metrics.js';

type StoreFilter = string | { in: string[] };

export async function getProductProfitability(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const result = await analyticsService.getProfitMarginTracker(
    typeof storeFilter === 'string' ? storeFilter : storeFilter.in[0]!,
    gte,
    lte,
    typeof storeFilter === 'string' ? storeFilter : null
  );
  return {
    period: result.period,
    summary: result.summary,
    products: result.products,
  };
}

export async function getCategoryProfitability(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const saleItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        storeId: storeFilter,
        status: 'PAID',
        ...salesInDateRangeWhere(gte, lte),
      },
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          categoryId: true,
          unitType: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  });

  const byCategory = new Map<
    string,
    { categoryId: string; categoryName: string; revenue: number; cogs: number }
  >();

  for (const item of saleItems) {
    const catId = item.product?.categoryId ?? 'uncategorized';
    const catName = item.product?.category?.name ?? 'Uncategorized';
    let row = byCategory.get(catId);
    if (!row) {
      row = { categoryId: catId, categoryName: catName, revenue: 0, cogs: 0 };
      byCategory.set(catId, row);
    }
    row.revenue += item.lineTotal ?? 0;
    const avgCost = await analyticsService.calculateAverageCost(item.productId);
    const qty =
      item.product?.unitType === 'PCS'
        ? item.qtyPcs ?? item.qtyKg ?? 0
        : item.qtyKg ?? item.qtyPcs ?? 0;
    if (avgCost > 0) row.cogs += avgCost * qty;
  }

  const categories = [...byCategory.values()].map((c) => ({
    ...c,
    revenue: round2(c.revenue),
    cogs: round2(c.cogs),
    grossProfit: grossProfit(c.revenue, c.cogs),
    grossMarginPct: grossMarginPct(c.revenue, c.cogs),
  }));

  const totalProfit = categories.reduce((s, c) => s + c.grossProfit, 0);

  return {
    categories: categories
      .map((c) => ({
        ...c,
        contributionPct: contributionPct(c.grossProfit, totalProfit),
      }))
      .sort((a, b) => b.revenue - a.revenue),
    totalProfit: round2(totalProfit),
  };
}

export async function getContributionAnalysis(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const productResult = await getProductProfitability(storeFilter, gte, lte);
  const products = productResult.products.filter((p) => p.grossProfit !== null);
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const totalProfit = products.reduce((s, p) => s + (p.grossProfit ?? 0), 0);

  return {
    products: products.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      revenue: p.revenue,
      revenueSharePct: totalRevenue > 0 ? round2((p.revenue / totalRevenue) * 100) : 0,
      grossProfit: p.grossProfit,
      profitSharePct: totalProfit > 0 ? round2(((p.grossProfit ?? 0) / totalProfit) * 100) : 0,
      grossMarginPct: p.grossMarginPct,
    })),
    totalRevenue: round2(totalRevenue),
    totalProfit: round2(totalProfit),
  };
}

export async function getProfitabilityTrend(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const sales = await prisma.sale.findMany({
    where: {
      storeId: storeFilter,
      status: 'PAID',
      ...salesInDateRangeWhere(gte, lte),
    },
    select: { grandTotal: true, businessDate: true, createdAt: true },
  });

  const byDay = new Map<string, number>();
  for (const s of sales) {
    const d = s.businessDate
      ? s.businessDate.toISOString().slice(0, 10)
      : s.createdAt.toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) || 0) + (s.grandTotal || 0));
  }

  return {
    series: [...byDay.entries()]
      .map(([date, revenue]) => ({ date, revenue: round2(revenue) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export async function getGrossProfitSummary(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const storeId = typeof storeFilter === 'string' ? storeFilter : storeFilter.in[0]!;
  const result = await analyticsService.getProfitMarginTracker(storeId, gte, lte);
  return result;
}
