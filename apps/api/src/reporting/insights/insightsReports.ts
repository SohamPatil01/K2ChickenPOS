// @ts-nocheck
import { analyticsService } from '../../services/analyticsService.js';
import { priorPeriodRange } from '../shared/dateRange.js';
import { deltaPct, round2 } from '../shared/metrics.js';
import { getWastageReport } from '../inventory/inventoryReports.js';
import { getRetentionSegments } from '../customers/customerReports.js';
import { getReferralPerformance } from '../referrals/referralReports.js';
import { getFinancialSummary } from '../financial/financialReports.js';

type StoreFilter = string | { in: string[] };

export interface Insight {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metric: string;
  value: number;
  previousValue: number | null;
  deltaPct: number | null;
  reportPath: string;
}

export async function getReportingInsights(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date,
  storeId: string
) {
  const insights: Insight[] = [];
  const prior = priorPeriodRange(gte, lte);

  const [currentFinancial, priorFinancial, baseInsights] = await Promise.all([
    getFinancialSummary(storeFilter, gte, lte),
    getFinancialSummary(storeFilter, prior.gte, prior.lte),
    analyticsService.getInsights(storeId, gte, lte),
  ]);

  const revDelta = deltaPct(
    currentFinancial.revenue.netSales,
    priorFinancial.revenue.netSales
  );
  if (revDelta !== null && Math.abs(revDelta) >= 10) {
    insights.push({
      id: 'revenue-delta',
      type: 'revenue',
      severity: revDelta < -15 ? 'critical' : revDelta < 0 ? 'warning' : 'info',
      title: revDelta >= 0 ? 'Revenue up vs prior period' : 'Revenue down vs prior period',
      message: `Net sales changed ${revDelta}% compared to the prior period.`,
      metric: 'netSales',
      value: currentFinancial.revenue.netSales,
      previousValue: priorFinancial.revenue.netSales,
      deltaPct: revDelta,
      reportPath: '/store/business-reports/view/financial-summary',
    });
  }

  const wastage = await getWastageReport(storeFilter, gte, lte);
  const priorWastage = await getWastageReport(storeFilter, prior.gte, prior.lte);
  const wastageDelta = deltaPct(wastage.totalWastageKg, priorWastage.totalWastageKg);
  if (wastageDelta !== null && wastageDelta > 20) {
    insights.push({
      id: 'wastage-spike',
      type: 'wastage',
      severity: 'warning',
      title: 'Wastage spike detected',
      message: `Wastage increased ${wastageDelta}% vs prior period.`,
      metric: 'wastageKg',
      value: wastage.totalWastageKg,
      previousValue: priorWastage.totalWastageKg,
      deltaPct: wastageDelta,
      reportPath: '/store/business-reports/view/wastage',
    });
  }

  const retention = await getRetentionSegments(storeFilter, gte, lte);
  if (retention.atRiskCustomers > 0) {
    insights.push({
      id: 'at-risk-customers',
      type: 'customers',
      severity: retention.atRiskCustomers > 10 ? 'warning' : 'info',
      title: 'At-risk customers',
      message: `${retention.atRiskCustomers} customers have not purchased in ${retention.atRiskDays}+ days.`,
      metric: 'atRiskCustomers',
      value: retention.atRiskCustomers,
      previousValue: null,
      deltaPct: null,
      reportPath: '/store/business-reports/view/customer-overview',
    });
  }

  const referral = await getReferralPerformance(storeFilter, gte, lte);
  if (referral.referralsCount > 0) {
    insights.push({
      id: 'referral-performance',
      type: 'referral',
      severity: 'info',
      title: 'Referral activity',
      message: `${referral.referralsCount} new referrals; ${referral.conversionRate}% converted.`,
      metric: 'referralRevenue',
      value: referral.referralRevenue,
      previousValue: null,
      deltaPct: null,
      reportPath: '/store/business-reports/view/referral-performance',
    });
  }

  for (const bi of baseInsights?.insights ?? []) {
    insights.push({
      id: `analytics-${String(bi.title).replace(/\s+/g, '-').toLowerCase()}`,
      type: 'analytics',
      severity: bi.severity === 'high' ? 'critical' : bi.severity === 'medium' ? 'warning' : 'info',
      title: bi.title,
      message: bi.detail ?? bi.message ?? '',
      metric: 'analytics',
      value: 0,
      previousValue: null,
      deltaPct: null,
      reportPath: '/store/business-reports/view/insights',
    });
  }

  return { insights, generatedAt: new Date().toISOString() };
}

export async function getBusinessOverview(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const financial = await getFinancialSummary(storeFilter, gte, lte);
  return {
    netSales: financial.revenue.netSales,
    orderCount: financial.revenue.orderCount,
    aov: financial.revenue.aov,
    totalExpenses: financial.expenses.total,
    netProfit: financial.netProfit,
    profitMarginPct: financial.profitMarginPct,
    totalPurchases: financial.totalPurchases,
  };
}
