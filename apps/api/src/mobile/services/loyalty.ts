import { prisma, Prisma } from '@azela-pos/db';
import { LOYALTY_TIERS, formatEarnRate, loyaltyProgress } from '@azela-pos/shared';
import { countCustomerVisits } from '../../lib/loyalty.js';
import { getRewardsConfig, milestoneProgress } from '../domain/rewards.js';
import type { IdentityContext } from './identity.js';

type Tx = Prisma.TransactionClient;

/**
 * Points live on the POS Customer row (Customer.loyaltyPoints + LoyaltyTransaction ledger).
 * The app adds only "holds": points a customer chose to redeem on an app order that the
 * cashier has not billed yet. available = balance − active holds, so the same points can
 * never be promised to two open orders.
 */
export async function heldPoints(db: Tx | typeof prisma, customerId: string): Promise<number> {
  const agg = await db.mobileOrder.aggregate({
    where: { customerId, loyaltyHoldStatus: 'HELD' },
    _sum: { loyaltyPointsHeld: true },
  });
  return agg._sum.loyaltyPointsHeld ?? 0;
}

export async function availablePoints(customerId: string): Promise<{ balance: number; held: number; available: number; tier: string }> {
  const c = await prisma.customer.findUnique({ where: { id: customerId }, select: { loyaltyPoints: true, loyaltyTier: true } });
  const balance = Math.floor(c?.loyaltyPoints || 0);
  const held = await heldPoints(prisma, customerId);
  return { balance, held, available: Math.max(0, balance - held), tier: c?.loyaltyTier || 'BRONZE' };
}

/** Row-locks the customer so concurrent checkouts cannot over-commit points. Call inside a transaction. */
export async function lockAndCheckAvailable(tx: Tx, customerId: string): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ loyaltyPoints: number }>>`
    SELECT "loyaltyPoints" FROM "Customer" WHERE id = ${customerId} FOR UPDATE`;
  const balance = Math.floor(rows[0]?.loyaltyPoints || 0);
  return Math.max(0, balance - (await heldPoints(tx, customerId)));
}

export async function getWallet(ctx: IdentityContext) {
  const cfg = getRewardsConfig();
  const customer = await prisma.customer.findUnique({
    where: { id: ctx.primaryCustomerId },
    select: { loyaltyPoints: true, loyaltyTier: true, referralCode: true },
  });
  const { balance, held, available } = await availablePoints(ctx.primaryCustomerId);
  const otherRows = await prisma.customer.findMany({
    where: { id: { in: ctx.customerIds.filter((id) => id !== ctx.primaryCustomerId) }, loyaltyPoints: { gt: 0 } },
    select: { id: true, loyaltyPoints: true, store: { select: { name: true } } },
  });
  const transactions = await prisma.loyaltyTransaction.findMany({
    where: { customerId: { in: ctx.customerIds } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, type: true, points: true, balance: true, description: true, createdAt: true, saleId: true },
  });
  const paidSales = await prisma.sale.count({ where: { customerId: { in: ctx.customerIds }, status: 'PAID' } });
  // K2 Family: tier progress by visits on the primary customer (the row whose tier is promoted).
  const visits = await countCustomerVisits(prisma, ctx.primaryCustomerId);
  const progress = loyaltyProgress(customer?.loyaltyTier, visits);
  return {
    balance,
    heldPoints: held,
    availablePoints: available,
    pointValuePaise: cfg.pointValuePaise,
    tier: progress.tier.key,
    // Deprecated: spend is no longer shown to customers (K2 Family rewards visits). Always 0.
    lifetimeSpendPaise: 0,
    loyalty: {
      tierName: progress.tier.name,
      earnRate: progress.tier.earnRate,
      visits: progress.visits,
      nextTierName: progress.next?.name ?? null,
      nextTierEarnRate: progress.next?.earnRate ?? null,
      nextTierVisits: progress.next?.minVisits ?? null,
      visitsToNext: progress.visitsToNext,
      progress: progress.progress,
      tiers: LOYALTY_TIERS.map((t) => ({ key: t.key, name: t.name, minVisits: t.minVisits, earnRate: t.earnRate })),
    },
    otherStoreBalances: otherRows.map((r) => ({ storeName: r.store?.name ?? 'Store', points: Math.floor(r.loyaltyPoints) })),
    milestone: milestoneProgress(paidSales, cfg),
    rules: {
      earnDescription: `As a ${progress.tier.name} you earn ${formatEarnRate(progress.tier.earnRate)} of every paid bill as points, at the counter or in the app.`,
      earnRatePerRupee: progress.tier.earnRate,
      redeemDescription: `Use points on app orders: up to ${cfg.maxRedeemPercent}% of the item value, minimum ${cfg.minPointsToRedeem} points. 1 point = ₹${cfg.pointValuePaise / 100}.`,
      maxRedeemPercent: cfg.maxRedeemPercent,
      minPointsToRedeem: cfg.minPointsToRedeem,
      expiry: 'Points do not currently expire. K2 Chicken will notify you before any expiry policy is introduced.',
      policyVersion: cfg.policyVersion,
      provisional: true,
    },
    history: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      points: Math.round(t.points),
      description: t.description,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

/** Settle holds once the POS has decided the order's fate. Idempotent. */
export async function reconcileLoyaltyHolds(limit = 200): Promise<{ applied: number; released: number }> {
  const held = await prisma.mobileOrder.findMany({ where: { loyaltyHoldStatus: 'HELD' }, take: limit, orderBy: { createdAt: 'asc' } });
  let applied = 0;
  let released = 0;
  for (const mo of held) {
    const po = await prisma.preOrder.findUnique({ where: { id: mo.preOrderId }, select: { status: true, saleId: true } });
    if (!po) {
      await prisma.mobileOrder.update({ where: { id: mo.id }, data: { loyaltyHoldStatus: 'RELEASED' } });
      released++;
      continue;
    }
    if (po.status === 'CANCELLED' || po.status === 'NO_SHOW') {
      await prisma.mobileOrder.updateMany({ where: { id: mo.id, loyaltyHoldStatus: 'HELD' }, data: { loyaltyHoldStatus: 'RELEASED' } });
      released++;
    } else if (po.status === 'FULFILLED' && po.saleId) {
      const redeem = await prisma.loyaltyTransaction.findFirst({ where: { saleId: po.saleId, type: 'REDEEM' }, select: { id: true } });
      await prisma.mobileOrder.updateMany({
        where: { id: mo.id, loyaltyHoldStatus: 'HELD' },
        data: { loyaltyHoldStatus: redeem ? 'APPLIED' : 'RELEASED' },
      });
      if (redeem) applied++;
      else released++;
    } else if (po.status === 'FULFILLED' && !po.saleId && mo.updatedAt.getTime() < Date.now() - 48 * 3600_000) {
      // Marked fulfilled without a linked bill: we cannot prove redemption, so free the points.
      await prisma.mobileOrder.updateMany({ where: { id: mo.id, loyaltyHoldStatus: 'HELD' }, data: { loyaltyHoldStatus: 'RELEASED' } });
      released++;
    }
  }
  return { applied, released };
}
