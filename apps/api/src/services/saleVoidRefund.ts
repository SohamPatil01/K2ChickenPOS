// @ts-nocheck
import { prisma, PaymentMethod, Prisma } from '@azela-pos/db';
import { reverseSaleLoyaltyEarn } from '../lib/loyalty.js';

/** Net-restore inventory for a sale using ledger (same rules as void). Idempotent via lock. */
export async function restoreInventoryNetForSale(
  tx: Prisma.TransactionClient,
  saleId: string,
  storeId: string
): Promise<number> {
  const saleLedgers = await tx.inventoryLedger.findMany({
    where: { refId: saleId, storeId },
  });

  const netByProduct = new Map<string, { kg: number; pcs: number }>();
  for (const ledger of saleLedgers) {
    const sign = ledger.type === 'OUT' ? -1 : 1;
    const cur = netByProduct.get(ledger.productId) || { kg: 0, pcs: 0 };
    cur.kg = Math.round((cur.kg + sign * (ledger.qtyKg || 0)) * 1000) / 1000;
    cur.pcs += sign * (ledger.qtyPcs || 0);
    netByProduct.set(ledger.productId, cur);
  }

  let restoredCount = 0;
  for (const [productId, net] of netByProduct) {
    const restoreKg = net.kg < -0.001 ? Math.round(Math.abs(net.kg) * 1000) / 1000 : null;
    const restorePcs = net.pcs < 0 ? Math.abs(Math.round(net.pcs)) : null;
    if ((restoreKg && restoreKg > 0) || (restorePcs && restorePcs > 0)) {
      await tx.inventoryLedger.create({
        data: {
          storeId,
          productId,
          type: 'IN',
          qtyKg: restoreKg && restoreKg > 0 ? restoreKg : null,
          qtyPcs: restorePcs && restorePcs > 0 ? restorePcs : null,
          reason: 'ADJUSTMENT',
          refId: saleId,
        },
      });
      restoredCount += 1;
    }
  }
  return restoredCount;
}

async function restoreRedeemedLoyalty(
  tx: Prisma.TransactionClient,
  sale: { id: string; saleNo: string; storeId: string; customerId: string | null },
  userId: string
): Promise<number> {
  if (!sale.customerId) return 0;
  const redeemTxns = await tx.loyaltyTransaction.findMany({
    where: { saleId: sale.id, type: 'REDEEM' },
  });
  const redeemedPoints = redeemTxns.reduce((sum, t) => sum + Math.abs(t.points || 0), 0);
  if (redeemedPoints <= 0) return 0;

  const alreadyRestored = await tx.loyaltyTransaction.findFirst({
    where: { saleId: sale.id, type: 'ADJUST', points: { gt: 0 } },
  });
  if (alreadyRestored) return 0;

  const cust = await tx.customer.findUnique({
    where: { id: sale.customerId },
    select: { loyaltyPoints: true },
  });
  const newBalance = (cust?.loyaltyPoints || 0) + redeemedPoints;
  await tx.customer.update({
    where: { id: sale.customerId },
    data: { loyaltyPoints: newBalance },
  });
  await tx.loyaltyTransaction.create({
    data: {
      customerId: sale.customerId,
      storeId: sale.storeId,
      type: 'ADJUST',
      points: redeemedPoints,
      balance: newBalance,
      description: `Restored ${redeemedPoints} redeemed points from voided ${sale.saleNo}`,
      saleId: sale.id,
      createdBy: userId,
    },
  });
  return redeemedPoints;
}

export async function voidSaleAtomic(input: {
  saleId: string;
  userId: string;
  reason?: string;
  userStoreId: string;
}) {
  const { saleId, userId, reason, userStoreId } = input;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${saleId} FOR UPDATE`;

    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });
    if (!sale) {
      const err: any = new Error('Sale not found');
      err.statusCode = 404;
      throw err;
    }
    if (sale.status === 'VOID') {
      const err: any = new Error('Sale already voided');
      err.statusCode = 400;
      throw err;
    }
    if (sale.status !== 'PAID' && sale.status !== 'OPEN') {
      const err: any = new Error('Only paid or open sales can be voided');
      err.statusCode = 400;
      throw err;
    }

    const restoredCount = await restoreInventoryNetForSale(tx, saleId, sale.storeId);
    const pointsRestored = await restoreRedeemedLoyalty(tx, sale, userId);

    let pointsReversed = 0;
    if (sale.customerId) {
      try {
        const rev = await reverseSaleLoyaltyEarn(tx, {
          saleId,
          saleNo: sale.saleNo,
          customerId: sale.customerId,
          storeId: sale.storeId,
          userId,
        });
        pointsReversed = rev.pointsReversed;
      } catch (loyaltyErr) {
        console.warn('[Void] Could not reverse earned loyalty points:', loyaltyErr);
      }
    }

    const updatedSale = await tx.sale.update({
      where: { id: saleId },
      data: { status: 'VOID' },
    });

    await tx.auditLog.create({
      data: {
        storeId: sale.storeId,
        actorUserId: userId,
        action: 'SALE_VOIDED',
        entityType: 'Sale',
        entityId: saleId,
        metaJson: {
          reason: reason || 'No reason provided',
          userStoreId,
          inventoryRestored: restoredCount,
          loyaltyPointsRestored: pointsRestored,
          loyaltyPointsReversed: pointsReversed,
        },
      },
    });

    return updatedSale;
  });
}

export async function refundSaleAtomic(input: {
  saleId: string;
  userId: string;
  storeId: string;
  amount?: number;
  reason?: string;
  method?: string;
  reference?: string;
  idempotencyKey?: string;
}) {
  const {
    saleId,
    userId,
    storeId,
    amount,
    reason,
    method = 'CASH',
    reference,
    idempotencyKey,
  } = input;

  const key = idempotencyKey ? String(idempotencyKey).trim().slice(0, 64) : null;

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Sale" WHERE id = ${saleId} FOR UPDATE`;

    if (key) {
      const existing = await tx.refund.findFirst({
        where: { storeId, idempotencyKey: key },
      });
      if (existing) {
        const sale = await tx.sale.findUnique({ where: { id: saleId } });
        return { sale, refund: existing, idempotent: true };
      }
    }

    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: { refunds: true, payments: true },
    });
    if (!sale) {
      const err: any = new Error('Sale not found');
      err.statusCode = 404;
      throw err;
    }
    if (sale.status === 'VOID') {
      const err: any = new Error('Cannot refund a voided sale');
      err.statusCode = 400;
      throw err;
    }
    if (sale.status !== 'PAID' && sale.status !== 'REFUNDED') {
      const err: any = new Error('Sale must be paid to refund');
      err.statusCode = 400;
      throw err;
    }

    const alreadyRefunded = (sale.refunds || [])
      .filter((r) => r.status === 'COMPLETED')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const paidActual = (sale.payments || [])
      .filter((p) => p.method !== 'CREDIT')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const eligible = Math.max(0, Math.round(Math.min(sale.grandTotal, paidActual) - alreadyRefunded));

    const refundAmount = Math.round(Number(amount ?? eligible));
    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
      const err: any = new Error('Invalid refund amount');
      err.statusCode = 400;
      throw err;
    }
    if (refundAmount > eligible + 0.5) {
      const err: any = new Error(
        `Refund amount exceeds eligible balance (eligible: ${eligible})`
      );
      err.statusCode = 400;
      throw err;
    }

    const methodStr = String(method || 'CASH').toUpperCase() as PaymentMethod;
    const refund = await tx.refund.create({
      data: {
        saleId,
        storeId: sale.storeId,
        amount: refundAmount,
        method: methodStr,
        reason: reason || null,
        reference: reference || null,
        processedByUserId: userId,
        idempotencyKey: key,
        status: 'COMPLETED',
      },
    });

    const cumulative = alreadyRefunded + refundAmount;
    const isFull = cumulative >= Math.round(sale.grandTotal) - 0.5;

    let inventoryRestored = 0;
    if (isFull) {
      inventoryRestored = await restoreInventoryNetForSale(tx, saleId, sale.storeId);
      if (sale.customerId) {
        await restoreRedeemedLoyalty(tx, sale, userId);
        try {
          await reverseSaleLoyaltyEarn(tx, {
            saleId,
            saleNo: sale.saleNo,
            customerId: sale.customerId,
            storeId: sale.storeId,
            userId,
          });
        } catch (e) {
          console.warn('[Refund] loyalty reverse failed:', e);
        }
      }
    }

    const updatedSale = await tx.sale.update({
      where: { id: saleId },
      data: { status: isFull ? 'REFUNDED' : 'PAID' },
    });

    await tx.auditLog.create({
      data: {
        storeId: sale.storeId,
        actorUserId: userId,
        action: 'SALE_REFUNDED',
        entityType: 'Sale',
        entityId: saleId,
        metaJson: {
          reason,
          refundAmount,
          cumulative,
          isFull,
          inventoryRestored,
          refundId: refund.id,
        },
      },
    });

    return { sale: updatedSale, refund, idempotent: false };
  });
}
