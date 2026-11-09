import type { PrismaClient } from '@azela-pos/db';
import { computeLoyaltyEarnPoints } from '@azela-pos/shared';
import { maybeAwardReferralBonus } from './referral.js';

type Db = PrismaClient;

export type AwardLoyaltyArgs = {
  saleId: string;
  saleNo: string;
  customerId: string;
  storeId: string;
  grandTotal: number;
  userId?: string | null;
  /** Also run first-purchase referral bonus (default true). */
  awardReferral?: boolean;
};

/**
 * Idempotent earn on first actual settlement of a sale.
 * Safe to call from /pay, settle-pending, and offline sync.
 *
 * Must be awaited — fire-and-forget drops earns on serverless freeze.
 * Uses a transaction + unique (saleId where type=EARN) so concurrent pays
 * cannot double-credit.
 */
export async function awardSaleLoyaltyEarn(
  db: Db,
  args: AwardLoyaltyArgs
): Promise<{ pointsEarned: number }> {
  const {
    saleId,
    saleNo,
    customerId,
    storeId,
    grandTotal,
    userId,
    awardReferral = true,
  } = args;

  let pointsEarned = 0;

  try {
    pointsEarned = await db.$transaction(async (tx) => {
      const alreadyEarned = await tx.loyaltyTransaction.findFirst({
        where: { saleId, type: 'EARN' },
        select: { id: true },
      });
      if (alreadyEarned) return 0;

      const pts = computeLoyaltyEarnPoints(grandTotal);
      if (pts <= 0) return 0;

      const customer = await tx.customer.findFirst({
        where: { id: customerId },
        select: { loyaltyPoints: true, totalSpent: true },
      });
      if (!customer) return 0;

      const newBalance = (customer.loyaltyPoints || 0) + pts;
      const newTotalSpent = (customer.totalSpent || 0) + Number(grandTotal);

      await tx.customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints: newBalance,
          totalSpent: newTotalSpent,
        },
      });

      try {
        await tx.loyaltyTransaction.create({
          data: {
            customerId,
            storeId,
            type: 'EARN',
            points: pts,
            balance: newBalance,
            description: `Earned ${pts} points from purchase ${saleNo}`,
            saleId,
            createdBy: userId || null,
          },
        });
      } catch (createErr: any) {
        // Unique index race: another request already wrote EARN for this sale.
        if (createErr?.code === 'P2002') {
          // Roll back the customer bump we just applied in this txn by aborting.
          throw Object.assign(new Error('LOYALTY_EARN_RACE'), { code: 'LOYALTY_EARN_RACE' });
        }
        throw createErr;
      }

      return pts;
    });
  } catch (err: any) {
    if (err?.code === 'LOYALTY_EARN_RACE' || err?.message === 'LOYALTY_EARN_RACE') {
      return { pointsEarned: 0 };
    }
    // Unique violation bubbling from Prisma outside our wrapper
    if (err?.code === 'P2002') {
      return { pointsEarned: 0 };
    }
    console.warn('[loyalty] awardSaleLoyaltyEarn failed:', err);
  }

  if (awardReferral) {
    try {
      await maybeAwardReferralBonus(db, {
        customerId,
        storeId,
        saleId,
        userId: userId || undefined,
      });
    } catch (refErr) {
      console.warn('[loyalty] Could not process referral bonus:', refErr);
    }
  }

  return { pointsEarned };
}

/**
 * Credit any PAID (non-void) sale that never got an EARN row.
 * Idempotent via awardSaleLoyaltyEarn. Use after fixing fire-and-forget pays.
 */
export async function repairMissingSaleLoyaltyEarns(
  db: Db,
  opts: { userId?: string | null; limit?: number } = {}
): Promise<{ scanned: number; repaired: number; pointsAdded: number }> {
  const limit = Math.max(1, Math.min(opts.limit || 2000, 5000));

  const missing = await db.$queryRaw<
    Array<{
      id: string;
      saleNo: string;
      customerId: string;
      storeId: string;
      grandTotal: number;
    }>
  >`
    SELECT s.id, s."saleNo", s."customerId", s."storeId", s."grandTotal"
    FROM "Sale" s
    WHERE s."customerId" IS NOT NULL
      AND s.status = 'PAID'
      AND NOT EXISTS (
        SELECT 1 FROM "LoyaltyTransaction" lt
        WHERE lt."saleId" = s.id AND lt.type = 'EARN'
      )
    ORDER BY s."createdAt" ASC
    LIMIT ${limit}
  `;

  let repaired = 0;
  let pointsAdded = 0;
  for (const sale of missing) {
    const { pointsEarned } = await awardSaleLoyaltyEarn(db, {
      saleId: sale.id,
      saleNo: sale.saleNo,
      customerId: sale.customerId,
      storeId: sale.storeId,
      grandTotal: Number(sale.grandTotal) || 0,
      userId: opts.userId,
      // Referral already may have fired from another path; keep on for first settle.
      awardReferral: true,
    });
    if (pointsEarned > 0) {
      repaired += 1;
      pointsAdded += pointsEarned;
    }
  }

  return { scanned: missing.length, repaired, pointsAdded };
}

/**
 * On void of a paid sale: claw back any EARN points (and totalSpent) for that sale.
 * Idempotent — skips if a negative ADJUST for earn reversal already exists.
 */
export async function reverseSaleLoyaltyEarn(
  db: Db,
  args: {
    saleId: string;
    saleNo: string;
    customerId: string;
    storeId: string;
    userId?: string | null;
  }
): Promise<{ pointsReversed: number }> {
  const { saleId, saleNo, customerId, storeId, userId } = args;
  let pointsReversed = 0;

  try {
    const earnTxn = await db.loyaltyTransaction.findFirst({
      where: { saleId, type: 'EARN' },
    });
    if (!earnTxn || !(earnTxn.points > 0)) {
      return { pointsReversed: 0 };
    }

    const alreadyReversed = await db.loyaltyTransaction.findFirst({
      where: {
        saleId,
        type: 'ADJUST',
        points: { lt: 0 },
        description: { contains: 'voided' },
      },
      select: { id: true },
    });
    if (alreadyReversed) {
      return { pointsReversed: 0 };
    }

    const points = Math.abs(earnTxn.points || 0);
    const cust = await db.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyPoints: true, totalSpent: true },
    });
    if (!cust) return { pointsReversed: 0 };

    const newBalance = Math.max(0, (cust.loyaltyPoints || 0) - points);
    const sale = await db.sale.findUnique({
      where: { id: saleId },
      select: { grandTotal: true },
    });
    const spend = Number(sale?.grandTotal || 0);
    const newTotalSpent = Math.max(0, (cust.totalSpent || 0) - spend);

    await db.customer.update({
      where: { id: customerId },
      data: {
        loyaltyPoints: newBalance,
        totalSpent: newTotalSpent,
      },
    });

    await db.loyaltyTransaction.create({
      data: {
        customerId,
        storeId,
        type: 'ADJUST',
        points: -points,
        balance: newBalance,
        description: `Reversed ${points} earned points from voided ${saleNo}`,
        saleId,
        createdBy: userId || null,
      },
    });
    pointsReversed = points;
  } catch (err) {
    console.warn('[loyalty] reverseSaleLoyaltyEarn failed:', err);
  }

  return { pointsReversed };
}
