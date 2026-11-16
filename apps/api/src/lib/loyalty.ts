import type { PrismaClient } from '@azela-pos/db';
import { computeTierEarnPoints, formatEarnRate, loyaltyTier, promoteTier } from '@azela-pos/shared';
import { maybeAwardReferralBonus } from './referral.js';

type Db = PrismaClient;
type Tx = Pick<PrismaClient, '$queryRaw'>;

/**
 * Where the K2 Family tier rates apply.
 *  - 'app' (default, the mobile-first rollout): only bills for orders placed in the mobile app earn
 *    at the customer's tier rate. Counter bills earn the base 1.25% exactly as before, and the stored
 *    Customer.loyaltyTier (used by POS, staff screens and the points website) is never touched.
 *  - 'all' (the later POS move): every paid bill earns at the tier rate and the stored tier is
 *    promoted by visits. Switch with the env var LOYALTY_TIERS_SCOPE=all, then run
 *    POST /customers/loyalty/tiers/place once.
 */
export type LoyaltyTiersScope = 'app' | 'all';
export function loyaltyTiersScope(): LoyaltyTiersScope {
  return process.env.LOYALTY_TIERS_SCOPE === 'all' ? 'all' : 'app';
}

/**
 * K2 Family "visits": distinct IST calendar days with at least one PAID bill for this customer
 * (counter or app). `includeSaleId` always counts that sale's day even if its status write hasn't
 * landed yet; `excludeSaleId` leaves one sale out (the tier held BEFORE a bill). Bill size never matters.
 */
export async function countCustomerVisits(db: Tx, customerId: string, includeSaleId?: string, excludeSaleId?: string): Promise<number> {
  const rows = await db.$queryRaw<Array<{ visits: bigint | number }>>`
    SELECT COUNT(DISTINCT ((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date) AS visits
    FROM "Sale" s
    WHERE s."customerId" = ${customerId}
      AND (s.status = 'PAID' OR s.id = ${includeSaleId ?? ''})
      AND s.id <> ${excludeSaleId ?? ''}
  `;
  return Number(rows[0]?.visits ?? 0);
}

/**
 * True when this sale settles an order placed in the mobile app. At pay time the pre-order is not
 * linked to the sale yet, but the cashier's cart items carry its id in their metaJson, so we match
 * either link (the PreOrder.saleId link covers repairs that run later).
 */
export async function isAppOrderSale(db: Tx, saleId: string): Promise<boolean> {
  // Starts from this sale (indexed on saleId) and only then looks up the app order, so the cost
  // does not grow with the number of app orders.
  const rows = await db.$queryRaw<Array<{ one: number }>>`
    SELECT 1 AS one FROM "PreOrder" po
      JOIN "MobileOrder" mo ON mo."preOrderId" = po.id
      WHERE po."saleId" = ${saleId}
    UNION ALL
    SELECT 1 AS one FROM "SaleItem" si
      JOIN "MobileOrder" mo ON mo."preOrderId" = si."metaJson"->>'preOrderId'
      WHERE si."saleId" = ${saleId}
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Fail-safe wrapper used when earning points: if the check cannot run for any reason (for example
 * the app tables are not in this database), treat the bill as a counter bill and earn the base rate.
 * Points at the counter must never depend on the app's tables. Runs outside the earn transaction
 * on purpose, because a failed query would otherwise abort that whole transaction.
 */
async function isAppOrderSaleSafe(db: Tx, saleId: string): Promise<boolean> {
  try {
    return await isAppOrderSale(db, saleId);
  } catch (err) {
    console.warn('[loyalty] app-order check failed, earning at the base rate:', err);
    return false;
  }
}

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

  // Decided before the transaction (see isAppOrderSaleSafe).
  const scope = loyaltyTiersScope();
  const tierBill = scope === 'all' || (await isAppOrderSaleSafe(db, saleId));

  try {
    pointsEarned = await db.$transaction(async (tx) => {
      const alreadyEarned = await tx.loyaltyTransaction.findFirst({
        where: { saleId, type: 'EARN' },
        select: { id: true },
      });
      if (alreadyEarned) return 0;

      const customer = await tx.customer.findFirst({
        where: { id: customerId },
        select: { loyaltyPoints: true, totalSpent: true, loyaltyTier: true },
      });
      if (!customer) return 0;

      // K2 Family: in 'app' scope only app-order bills get the tier rate; counter bills stay at the
      // base rate and the stored tier is left alone. A bill earns at the tier held BEFORE it
      // (visits excluding this bill), so an upgrade applies from the next bill.
      const visitsBefore = tierBill ? await countCustomerVisits(tx, customerId, undefined, saleId) : 0;
      const tierAtBill = tierBill ? promoteTier(scope === 'all' ? customer.loyaltyTier : null, visitsBefore) : loyaltyTier('BRONZE');
      const pts = computeTierEarnPoints(grandTotal, tierAtBill.key);

      // Stored tier (POS / staff / points site) only moves once tiers apply everywhere.
      let tierUpdate: { loyaltyTier?: string } = {};
      if (scope === 'all') {
        const visitsAfter = await countCustomerVisits(tx, customerId, saleId);
        const promoted = promoteTier(customer.loyaltyTier, visitsAfter);
        if (promoted.key !== (customer.loyaltyTier || 'BRONZE')) tierUpdate = { loyaltyTier: promoted.key };
      }

      if (pts <= 0) {
        // A bill that earns 0 points is still a visit, so the tier can move.
        if (tierUpdate.loyaltyTier) await tx.customer.update({ where: { id: customerId }, data: tierUpdate });
        return 0;
      }

      const newBalance = (customer.loyaltyPoints || 0) + pts;
      const newTotalSpent = (customer.totalSpent || 0) + Number(grandTotal);

      await tx.customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints: newBalance,
          totalSpent: newTotalSpent,
          ...tierUpdate,
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
            // Counter bills keep the original wording; tier bills say which tier paid the rate.
            description: tierBill
              ? `Earned ${pts} points from purchase ${saleNo} (${tierAtBill.name}, ${formatEarnRate(tierAtBill.earnRate)})`
              : `Earned ${pts} points from purchase ${saleNo}`,
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
