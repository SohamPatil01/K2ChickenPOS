// @ts-nocheck
import crypto from 'crypto';
import { prisma } from '@azela-pos/db';

/**
 * Create a delivery row for a settled sale when fulfillment is DELIVERY.
 * Idempotent: returns existing deliveryOrder id when already present.
 */
export async function ensureDeliveryForSale(input: {
  saleId: string;
  deliveryFee?: number;
  actorUserId: string;
  type?: 'DELIVERY' | 'PICKUP';
}): Promise<{ id: string; created: boolean } | null> {
  const type = input.type || 'DELIVERY';
  if (type !== 'DELIVERY') return null;

  const sale = await prisma.sale.findUnique({
    where: { id: input.saleId },
    include: {
      deliveryOrder: { select: { id: true } },
      payments: { select: { method: true } },
    },
  });
  if (!sale) return null;
  if (sale.deliveryOrder) {
    return { id: sale.deliveryOrder.id, created: false };
  }

  const isPaid = sale.status === 'PAID';
  const isBookedCredit =
    sale.status === 'OPEN' &&
    (sale.payments || []).some((p) => String(p.method).toUpperCase() === 'CREDIT');
  if (!isPaid && !isBookedCredit) return null;
  if (!sale.customerId) return null;

  const impliedFee = Math.max(
    0,
    Math.round(sale.grandTotal) -
      Math.round(sale.subTotal + sale.taxTotal - sale.discountTotal)
  );
  const resolvedFee =
    Number(input.deliveryFee) > 0 ? Number(input.deliveryFee) : impliedFee;

  const otp = String(Math.floor(1000 + Math.random() * 9000));
  const otpCodeHash = crypto.createHash('sha256').update(otp).digest('hex');

  try {
    const delivery = await prisma.deliveryOrder.create({
      data: {
        storeId: sale.storeId,
        saleId: sale.id,
        type: 'DELIVERY',
        status: 'CREATED',
        deliveryFee: resolvedFee,
        addressId: null,
        otpCodeHash,
      },
    });
    await prisma.deliveryEvent.create({
      data: {
        deliveryOrderId: delivery.id,
        status: 'CREATED',
        createdBy: input.actorUserId,
      },
    });
    return { id: delivery.id, created: true };
  } catch (err: any) {
    // Race: another request created the row
    if (err?.code === 'P2002') {
      const existing = await prisma.deliveryOrder.findUnique({
        where: { saleId: sale.id },
        select: { id: true },
      });
      if (existing) return { id: existing.id, created: false };
    }
    throw err;
  }
}
