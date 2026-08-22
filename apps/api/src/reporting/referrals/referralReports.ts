// @ts-nocheck
import { prisma } from '@azela-pos/db';
import { salesInDateRangeWhere } from '@azela-pos/shared';
import { round2, referralConversion } from '../shared/metrics.js';

type StoreFilter = string | { in: string[] };

export async function getReferralPerformance(
  storeFilter: StoreFilter,
  gte: Date,
  lte: Date
) {
  const referred = await prisma.customer.findMany({
    where: {
      storeId: storeFilter,
      referredByCustomerId: { not: null },
      createdAt: { gte, lte },
    },
    select: {
      id: true,
      name: true,
      referredByCustomerId: true,
      referralBonusAwardedAt: true,
      createdAt: true,
    },
  });

  const referredIds = referred.map((c) => c.id);
  let converted = 0;
  let referralRevenue = 0;

  if (referredIds.length > 0) {
    const sales = await prisma.sale.groupBy({
      by: ['customerId'],
      where: {
        storeId: storeFilter,
        status: 'PAID',
        customerId: { in: referredIds },
      },
      _sum: { grandTotal: true },
      _count: true,
    });
    converted = sales.filter((s) => s._count > 0).length;
    referralRevenue = sales.reduce((s, x) => s + (x._sum.grandTotal ?? 0), 0);
  }

  const bonusesAwarded = referred.filter((c) => c.referralBonusAwardedAt).length;

  return {
    referralsCount: referred.length,
    convertedCount: converted,
    conversionRate: referralConversion(converted, referred.length),
    referralRevenue: round2(referralRevenue),
    bonusesAwarded,
  };
}

export async function getTopReferrers(
  storeFilter: StoreFilter,
  limit = 20
) {
  const referrers = await prisma.customer.findMany({
    where: {
      storeId: storeFilter,
      referralCode: { not: null },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      referralCode: true,
    },
  });

  const results = await Promise.all(
    referrers.map(async (r) => {
      const referred = await prisma.customer.findMany({
        where: { storeId: storeFilter, referredByCustomerId: r.id },
        select: { id: true },
      });
      const referredIds = referred.map((c) => c.id);
      let revenue = 0;
      if (referredIds.length > 0) {
        const agg = await prisma.sale.aggregate({
          where: {
            storeId: storeFilter,
            status: 'PAID',
            customerId: { in: referredIds },
          },
          _sum: { grandTotal: true },
        });
        revenue = agg._sum.grandTotal ?? 0;
      }
      return {
        customerId: r.id,
        name: r.name,
        phone: r.phone,
        referralCode: r.referralCode,
        referralCount: referred.length,
        referralRevenue: round2(revenue),
      };
    })
  );

  return {
    referrers: results
      .filter((r) => r.referralCount > 0)
      .sort((a, b) => b.referralCount - a.referralCount)
      .slice(0, limit),
  };
}
