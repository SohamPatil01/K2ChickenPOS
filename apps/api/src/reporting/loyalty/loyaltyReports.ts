// @ts-nocheck
import { prisma } from '@azela-pos/db';
import { round2, redemptionRate } from '../shared/metrics.js';

type StoreFilter = string | { in: string[] };

export async function getLoyaltyPointsSummary(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const txns = await prisma.loyaltyTransaction.findMany({
    where: { storeId: storeFilter, createdAt: { gte, lte } },
    include: { customer: { select: { id: true, name: true, phone: true } } },
  });

  let earned = 0;
  let redeemed = 0;
  let adjusted = 0;
  const byType: Record<string, number> = {};

  for (const t of txns) {
    byType[t.type] = (byType[t.type] || 0) + Math.abs(t.points);
    if (t.type === 'EARN') earned += t.points;
    else if (t.type === 'REDEEM') redeemed += Math.abs(t.points);
    else adjusted += t.points;
  }

  const activeMembers = new Set(txns.map((t) => t.customerId)).size;

  const totalPointsBalance = await prisma.customer.aggregate({
    where: { storeId: storeFilter },
    _sum: { loyaltyPoints: true },
  });

  return {
    earned: round2(earned),
    redeemed: round2(redeemed),
    adjusted: round2(adjusted),
    redemptionRate: redemptionRate(redeemed, earned),
    activeMembers,
    totalPointsBalance: round2(totalPointsBalance._sum.loyaltyPoints ?? 0),
    transactionCount: txns.length,
    byType,
  };
}

export async function getLoyaltyRedemption(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const redemptions = await prisma.loyaltyTransaction.findMany({
    where: {
      storeId: storeFilter,
      type: 'REDEEM',
      createdAt: { gte, lte },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      sale: { select: { id: true, saleNo: true, grandTotal: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    count: redemptions.length,
    totalPoints: round2(redemptions.reduce((s, r) => s + Math.abs(r.points), 0)),
    items: redemptions.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      customerName: r.customer.name,
      points: Math.abs(r.points),
      saleNo: r.sale?.saleNo ?? null,
      saleTotal: r.sale?.grandTotal ?? null,
      date: r.createdAt.toISOString().slice(0, 10),
      description: r.description,
    })),
  };
}
