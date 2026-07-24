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
    const alreadyEarned = await db.loyaltyTransaction.findFirst({
      where: { saleId, type: 'EARN' },
      select: { id: true },
    });
    if (!alreadyEarned) {
      pointsEarned = computeLoyaltyEarnPoints(grandTotal);
      if (pointsEarned > 0) {
        const customer = await db.customer.findFirst({
          where: { id: customerId },
          select: { loyaltyPoints: true, totalSpent: true },
        });
        if (customer) {
          const newBalance = (customer.loyaltyPoints || 0) + pointsEarned;
          const newTotalSpent = (customer.totalSpent || 0) + Number(grandTotal);
          await db.customer.update({
            where: { id: customerId },
            data: {
              loyaltyPoints: newBalance,
              totalSpent: newTotalSpent,
            },
          });
          try {
            await db.loyaltyTransaction.create({
              data: {
                customerId,
                storeId,
                type: 'EARN',
                points: pointsEarned,
                balance: newBalance,
                description: `Earned ${pointsEarned} points from purchase ${saleNo}`,
                saleId,
                createdBy: userId || null,
              },
            });
          } catch (loyaltyErr) {
            console.warn('[loyalty] Could not create EARN transaction:', loyaltyErr);
          }
        }
      }
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
  } catch (err) {
    console.warn('[loyalty] awardSaleLoyaltyEarn failed:', err);
  }

  return { pointsEarned };
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
    // totalSpent was increased by sale grandTotal at earn time — reduce by same points' sale
    // We don't store grandTotal on the txn; use description or leave totalSpent as-is?
    // Better: read sale grandTotal from earn context — pass grandTotal optional.
    // For now reverse points only; also try to reduce totalSpent by looking up sale.
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
