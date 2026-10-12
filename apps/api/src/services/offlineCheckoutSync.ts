// @ts-nocheck
import { prisma, PaymentMethod } from '@azela-pos/db';
import {
  createSaleSchema,
  paymentSchema,
  normalizePaymentsForSale,
  ymdInStoreTz,
  businessDateForNow,
  LOYALTY_POINT_VALUE,
} from '@azela-pos/shared';
import { z } from 'zod';
import {
  quantitiesForInventoryDeduction,
  ensureInventoryDeductedForSale,
} from '../utils/saleItemLedger.js';
import { upsertCustomerArea } from '../utils/customerArea.js';
import { resolveSaleItemsForCreate } from '../utils/resolveSaleItemProduct.js';
import { awardSaleLoyaltyEarn } from '../lib/loyalty.js';
import { applyPaymentsToSale } from './applySalePayment.js';
import { ensureDeliveryForSale } from './ensureDeliveryForSale.js';
import { applyStoreCredit } from './storeCredit.js';
import { DAY_IN_REQUIRED, requireOpenShiftId } from './shiftService.js';

const offlinePayloadSchema = z.object({
  idempotencyKey: z.string().min(8),
  createSale: createSaleSchema,
  payments: z.array(paymentSchema).min(1),
  fulfillmentType: z.enum(['PICKUP', 'DELIVERY']).optional(),
});

/**
 * Apply a queued offline checkout from POST /sync/events (idempotent per store + key).
 */
export async function applyOfflineCheckoutFromSync(
  payload: Record<string, unknown>,
  storeId: string,
  userId: string
): Promise<void> {
  const data = offlinePayloadSchema.parse(payload);

  const openShiftId = await requireOpenShiftId(storeId);
  if (!openShiftId) {
    throw Object.assign(new Error('Day In required before billing'), {
      code: DAY_IN_REQUIRED,
      statusCode: 403,
    });
  }

  // Prefer indexed Sale.offlineIdempotencyKey; fall back to AuditLog JSON scan.
  let existing = await prisma.sale
    .findUnique({
      where: {
        storeId_offlineIdempotencyKey: {
          storeId,
          offlineIdempotencyKey: data.idempotencyKey,
        },
      },
      include: { payments: true, items: true },
    })
    .catch(() => null);

  if (!existing) {
    const existingAudit = await prisma.auditLog.findFirst({
      where: {
        storeId,
        action: 'SALE_CREATED_OFFLINE_SYNC',
        metaJson: {
          path: ['offlineIdempotencyKey'],
          equals: data.idempotencyKey,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    existing =
      existingAudit?.entityId != null
        ? await prisma.sale.findUnique({
            where: { id: existingAudit.entityId },
            include: { payments: true, items: true },
          })
        : null;
  }

  if (existing) {
    const paid = Math.round(
      existing.payments.reduce((s: number, p: { amount: number }) => s + p.amount, 0)
    );
    const gt = Math.round(existing.grandTotal);
    if (paid >= gt - 1 || existing.status === 'PAID') {
      return;
    }
    // Complete underpaid replay instead of failing the sync batch.
    await applyPaymentsToSale({
      saleId: existing.id,
      payments: data.payments,
      actorUserId: userId,
      actorStoreId: storeId,
      skipInventorySync: true,
      existingSale: {
        id: existing.id,
        status: existing.status,
        grandTotal: existing.grandTotal,
        storeId,
        items: existing.items || [],
        payments: existing.payments,
      },
    });
    return;
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, type: true, parentOwnerStoreId: true },
  });
  if (!store) {
    throw new Error('Store not found');
  }

  const cs = data.createSale;

  const ownerStoreId =
    store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
  if (!ownerStoreId) {
    throw new Error('Owner store is not configured for this location');
  }

  const { items: saleItems } = await resolveSaleItemsForCreate(
    prisma,
    cs.items,
    ownerStoreId
  );

  let config = null;
  if (store.type === 'FRANCHISE') {
    config = await prisma.franchiseConfig.findUnique({
      where: { franchiseStoreId: storeId },
    });
  }
  let customerId = cs.customerId;
  if (!customerId && cs.customerPhone) {
    const customer = await prisma.customer.upsert({
      where: {
        storeId_phone: {
          storeId,
          phone: cs.customerPhone,
        },
      },
      update: {
        name: cs.customerName || undefined,
        ...(cs.customerArea !== undefined
          ? { area: cs.customerArea?.trim() || null }
          : {}),
      },
      create: {
        storeId,
        phone: cs.customerPhone,
        name: cs.customerName || 'Customer',
        ...(cs.customerArea !== undefined
          ? { area: cs.customerArea?.trim() || null }
          : {}),
      },
    });
    customerId = customer.id;
    if (cs.customerArea !== undefined) {
      await upsertCustomerArea(prisma, customer.id, cs.customerArea);
    }
  } else if (customerId && cs.customerArea !== undefined) {
    await upsertCustomerArea(prisma, customerId, cs.customerArea);
  }

  let subTotal = 0;
  let taxTotal = 0;
  for (const item of saleItems) {
    const lineTotal = (item.qtyKg || item.qtyPcs || 0) * item.rate;
    subTotal += lineTotal;
    taxTotal += lineTotal * (item.taxRate / 100);
  }
  subTotal = Math.round(subTotal * 100) / 100;
  taxTotal = Math.round(taxTotal * 100) / 100;

  if (config?.isDiscountLocked && cs.discountTotal > 0) {
    throw new Error('Discount overrides are locked by HQ; offline sale rejected');
  }

  const allowedDiscountPercent = config?.allowedDiscountPercent || 10.0;
  const maxAllowedDiscount = (subTotal * allowedDiscountPercent) / 100;
  if (cs.discountTotal > maxAllowedDiscount) {
    throw new Error(
      'OFFLINE_DISCOUNT_REQUIRES_APPROVAL: discount exceeds franchise limit; retry after approval flow'
    );
  }

  const deliveryFee = Math.max(0, cs.deliveryFee ?? 0);
  const baseGrandTotal =
    Math.round((subTotal + taxTotal - cs.discountTotal + deliveryFee) * 100) / 100;
  const roundedBaseGrandTotal = Math.round(baseGrandTotal);

  let loyaltyPointsToRedeem = 0;
  let loyaltyRedeemValue = 0;
  const requestedRedeem = Math.max(0, Math.floor(Number(cs.loyaltyPointsRedeemed) || 0));
  if (requestedRedeem > 0 && customerId) {
    const redeemCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { loyaltyPoints: true },
    });
    const available = Math.floor(redeemCustomer?.loyaltyPoints || 0);
    const maxByBill = Math.floor(roundedBaseGrandTotal / LOYALTY_POINT_VALUE);
    loyaltyPointsToRedeem = Math.max(0, Math.min(requestedRedeem, available, maxByBill));
    loyaltyRedeemValue = loyaltyPointsToRedeem * LOYALTY_POINT_VALUE;
  }

  let storeCreditToApply = 0;
  if (customerId) {
    const creditCust = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { storeCredit: true },
    });
    const availableCredit = Math.round(Number(creditCust?.storeCredit) || 0);
    const afterLoyalty = Math.max(0, roundedBaseGrandTotal - loyaltyRedeemValue);
    const requestedCredit =
      (cs as any).storeCreditToApply !== undefined && (cs as any).storeCreditToApply !== null
        ? Math.max(0, Math.round(Number((cs as any).storeCreditToApply) || 0))
        : availableCredit;
    storeCreditToApply = Math.max(
      0,
      Math.min(requestedCredit, availableCredit, afterLoyalty)
    );
  }

  const roundedGrandTotal = roundedBaseGrandTotal - loyaltyRedeemValue - storeCreditToApply;

  const todayForNo = new Date();
  const dateStr = ymdInStoreTz(todayForNo).replace(/-/g, '');
  let saleNo: string;
  let attempts = 0;
  const maxAttempts = 5;
  do {
    const dayStart = new Date(todayForNo);
    dayStart.setHours(0, 0, 0, 0);
    const count = await prisma.sale.count({
      where: {
        storeId,
        createdAt: { gte: dayStart },
      },
    });
    saleNo = `SALE-${dateStr}-${String(count + 1 + attempts).padStart(4, '0')}`;
    attempts++;
    const dup = await prisma.sale.findUnique({
      where: { storeId_saleNo: { storeId, saleNo } },
    });
    if (!dup) break;
    if (attempts >= maxAttempts) {
      saleNo = `SALE-${dateStr}-${Date.now().toString().slice(-8)}`;
      break;
    }
  } while (attempts < maxAttempts);

  const normalizedPayments = normalizePaymentsForSale(data.payments, roundedGrandTotal);

  const validPaymentMethods: PaymentMethod[] = [
    'CASH',
    'CARD',
    'UPI',
    'CREDIT',
    'ONLINE',
  ];
  for (const p of normalizedPayments) {
    const methodStr = String(p.method || '')
      .toUpperCase()
      .trim();
    if (!validPaymentMethods.includes(methodStr as PaymentMethod)) {
      throw new Error(`Invalid payment method: ${p.method}`);
    }
  }

  const hasNewCredit = normalizedPayments.some((p) => p.method === 'CREDIT');
  const newPaymentsTotal = normalizedPayments.reduce((s, p) => s + p.amount, 0);
  const roundedPaidAfter = Math.round(newPaymentsTotal);
  let saleStatus: 'OPEN' | 'PAID' = 'PAID';
  if (roundedPaidAfter >= roundedGrandTotal - 1) {
    if (hasNewCredit) {
      saleStatus = 'OPEN';
    } else {
      saleStatus = 'PAID';
    }
  } else {
    saleStatus = 'OPEN';
  }

  const offlineProductIds = [...new Set(saleItems.map((i) => i.productId))];
  const offlineProductRows = await prisma.product.findMany({
    where: { id: { in: offlineProductIds } },
    select: { id: true, unitType: true },
  });
  const offlineUnitMap = new Map(
    offlineProductRows.map((p) => [p.id, p.unitType])
  );

  const sale = await prisma.$transaction(async (tx) => {
    const created = await tx.sale.create({
      data: {
        storeId,
        saleNo,
        customerId: customerId ?? null,
        status: saleStatus,
        subTotal,
        discountTotal: cs.discountTotal,
        taxTotal,
        grandTotal: roundedGrandTotal,
        createdByUserId: userId,
        shiftId: openShiftId,
        businessDate: businessDateForNow(),
        offlineIdempotencyKey: data.idempotencyKey,
        items: {
          create: saleItems.map((item: any) => {
            const qty = item.qtyKg || item.qtyPcs || 0;
            const lineTotal = Math.round(qty * item.rate * 100) / 100;
            const taxAmount =
              Math.round(lineTotal * (item.taxRate / 100) * 100) / 100;
            return {
              productId: item.productId,
              qtyKg: item.qtyKg,
              qtyPcs: item.qtyPcs,
              rate: item.rate,
              lineTotal,
              taxRate: item.taxRate,
              taxAmount,
              metaJson: item.metaJson,
            };
          }),
        },
      },
      include: { items: true },
    });

    await ensureInventoryDeductedForSale(
      tx,
      created.id,
      storeId,
      created.items,
      offlineUnitMap
    );

    const paymentRows = normalizedPayments
      .filter((p) => p.amount > 0)
      .map((p) => ({
        saleId: created.id,
        method: String(p.method).toUpperCase().trim() as PaymentMethod,
        amount: p.amount,
        txnRef: p.txnRef || null,
      }));

    if (paymentRows.length > 0) {
      await tx.payment.createMany({ data: paymentRows });
    }

    if (loyaltyPointsToRedeem > 0 && customerId) {
      const redeemCur = await tx.customer.findUnique({
        where: { id: customerId },
        select: { loyaltyPoints: true },
      });
      const curPoints = Math.floor(redeemCur?.loyaltyPoints || 0);
      const applied = Math.max(0, Math.min(loyaltyPointsToRedeem, curPoints));
      if (applied > 0) {
        const newBalance = curPoints - applied;
        await tx.customer.update({
          where: { id: customerId },
          data: { loyaltyPoints: newBalance },
        });
        await tx.loyaltyTransaction.create({
          data: {
            customerId,
            storeId,
            type: 'REDEEM',
            points: -applied,
            balance: newBalance,
            description: `Redeemed ${applied} points on ${saleNo} (offline sync)`,
            saleId: created.id,
            createdBy: userId,
          },
        });
      }
    }

    if (storeCreditToApply > 0 && customerId) {
      await applyStoreCredit(tx, {
        customerId,
        storeId,
        amount: storeCreditToApply,
        saleId: created.id,
        description: `Applied ₹${storeCreditToApply} store credit on ${saleNo} (offline sync)`,
        actorUserId: userId,
      });
    }

    await tx.auditLog.create({
      data: {
        storeId,
        actorUserId: userId,
        action: 'SALE_CREATED_OFFLINE_SYNC',
        entityType: 'Sale',
        entityId: created.id,
        metaJson: {
          saleNo,
          offlineIdempotencyKey: data.idempotencyKey,
          grandTotal: roundedGrandTotal,
          loyaltyPointsRedeemed: loyaltyPointsToRedeem,
          storeCreditApplied: storeCreditToApply,
          couponCode: cs.couponCode || undefined,
        },
      },
    });

    return created;
  });

  // Award loyalty when offline checkout settled with actual (non-credit) payment.
  if (saleStatus === 'PAID' && sale.customerId) {
    try {
      await awardSaleLoyaltyEarn(prisma, {
        saleId: sale.id,
        saleNo: sale.saleNo,
        customerId: sale.customerId,
        storeId,
        grandTotal: roundedGrandTotal,
        userId,
      });
    } catch (loyaltyErr) {
      console.warn('[offlineCheckoutSync] loyalty earn failed:', loyaltyErr);
    }
  }

  if (data.fulfillmentType === 'DELIVERY' && sale.customerId) {
    try {
      await ensureDeliveryForSale({
        saleId: sale.id,
        deliveryFee,
        actorUserId: userId,
        type: 'DELIVERY',
      });
    } catch (e) {
      console.warn('[offlineCheckoutSync] delivery create skipped:', e);
    }
  }
}
