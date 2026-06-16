// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { prisma } from '@azela-pos/db';
import {
  createDeliverySchema,
  patchDeliverySchema,
  assignDriverSchema,
  updateDeliveryStatusSchema,
  verifyOTPSchema,
  customerAddressSchema,
} from '@azela-pos/shared';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';
import { canAccessStoreResource } from '../utils/storeScope.js';

/** Create or reuse a matching CustomerAddress for delivery flows */
async function ensureCustomerAddress(customerId: string, rawAddress: unknown): Promise<string> {
  const parsed = customerAddressSchema.parse(rawAddress);
  const existing = await prisma.customerAddress.findFirst({
    where: {
      customerId,
      line1: { equals: parsed.line1.trim(), mode: 'insensitive' },
      city: { equals: parsed.city.trim(), mode: 'insensitive' },
    },
  });
  if (existing) return existing.id;
  const created = await prisma.customerAddress.create({
    data: {
      customerId,
      label: parsed.label,
      line1: parsed.line1.trim(),
      line2: parsed.line2?.trim() || null,
      city: parsed.city.trim(),
      state: parsed.state,
      zip: parsed.zip,
      geoLat: parsed.geoLat ?? null,
      geoLng: parsed.geoLng ?? null,
    },
  });
  return created.id;
}

export async function deliveryRoutes(fastify: FastifyInstance) {

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createDeliverySchema.parse(request.body as any);
    const userStoreId = (getUser(request) as any).storeId;
    const userId = (getUser(request) as any).userId;

    const sale = await prisma.sale.findUnique({
      where: { id: data.saleId },
      include: { deliveryOrder: { select: { id: true } } },
    });

    if (!sale) {
      reply.code(404).send({ error: 'Sale not found' });
      return;
    }
    if (sale.status !== 'PAID') {
      reply.code(400).send({ error: 'Sale is not paid yet' });
      return;
    }

    // Same access logic as sales pay: user's store or OWNER with franchise sale
    let hasAccess = sale.storeId === userStoreId;
    if (!hasAccess) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { store: { select: { id: true, type: true } } },
      });
      if (user?.role === 'OWNER' && user.store?.type === 'OWNER') {
        const saleStore = await prisma.store.findUnique({
          where: { id: sale.storeId },
          select: { type: true, parentOwnerStoreId: true },
        });
        if (saleStore?.type === 'FRANCHISE' && saleStore.parentOwnerStoreId === userStoreId) {
          hasAccess = true;
        }
      }
    }
    if (!hasAccess) {
      reply.code(403).send({ error: 'You do not have permission to create delivery for this sale' });
      return;
    }

    if (sale.deliveryOrder) {
      reply.code(400).send({ error: 'This sale already has a delivery' });
      return;
    }

    let resolvedAddressId: string | null | undefined = data.addressId;

    if (data.type === 'DELIVERY' && data.newAddress) {
      if (!sale.customerId) {
        reply.code(400).send({ error: 'Add a customer to the sale before saving a delivery address' });
        return;
      }
      try {
        resolvedAddressId = await ensureCustomerAddress(sale.customerId, data.newAddress);
      } catch (e: any) {
        reply.code(400).send({ error: e?.message || 'Invalid delivery address' });
        return;
      }
    }

    // Address can be added later in Delivery section when type is DELIVERY
    if (data.type === 'DELIVERY' && resolvedAddressId) {
      const address = await prisma.customerAddress.findUnique({ where: { id: resolvedAddressId } });
      if (address && sale.customerId && address.customerId !== sale.customerId) {
        reply.code(400).send({ error: 'Address does not belong to sale customer' });
        return;
      }
    }

    // Generate OTP for delivery
    const otp = data.type === 'DELIVERY' ? String(Math.floor(1000 + Math.random() * 9000)) : null;
    const otpCodeHash = otp ? crypto.createHash('sha256').update(otp).digest('hex') : null;

    const impliedFee = Math.max(
      0,
      Math.round(sale.grandTotal) -
        Math.round(sale.subTotal + sale.taxTotal - sale.discountTotal)
    );
    const resolvedFee =
      data.deliveryFee > 0 ? data.deliveryFee : impliedFee;

    // Use sale's storeId so delivery belongs to the same store as the sale (e.g. franchise)
    const delivery = await prisma.deliveryOrder.create({
      data: {
        storeId: sale.storeId,
        saleId: data.saleId,
        type: data.type,
        status: 'CREATED',
        deliveryFee: resolvedFee,
        addressId: resolvedAddressId ?? null,
        otpCodeHash,
      },
      include: {
        sale: {
          include: {
            items: { include: { product: true } },
            customer: true,
          },
        },
        address: true,
      },
    });

    // Create event
    await prisma.deliveryEvent.create({
      data: {
        deliveryOrderId: delivery.id,
        status: 'CREATED',
        createdBy: (getUser(request) as any).userId,
      },
    });

    return { ...delivery, otp }; // Return OTP only on creation
  });

  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const {
      status,
      driverId,
      date,
      startDate: qStart,
      endDate: qEnd,
      createdAfter: qCreatedAfter,
      createdBefore: qCreatedBefore,
    } = (request.query as any);
    const storeId = (getUser(request) as any).storeId;
    const userRole = (getUser(request) as any).role;

    const where: any = {};

    if (userRole === 'DRIVER') {
      where.assignedDriverId = (getUser(request) as any).userId;
    } else {
      // OWNER at HQ: deliveries are stored under franchise sale.storeId — include all franchise stores
      const userStore = await prisma.store.findUnique({
        where: { id: storeId },
        select: { type: true },
      });
      if (userRole === 'OWNER' && userStore?.type === 'OWNER') {
        const franchises = await prisma.store.findMany({
          where: { parentOwnerStoreId: storeId, type: 'FRANCHISE' },
          select: { id: true },
        });
        where.storeId = { in: [storeId, ...franchises.map((f) => f.id)] };
      } else {
        where.storeId = storeId;
      }
    }

    if (status) {
      where.status = status;
    }

    if (driverId) {
      where.assignedDriverId = driverId;
    }

    /** Prefer client local-day bounds (ISO from browser) so “today” matches the user’s timezone */
    if (qCreatedAfter && qCreatedBefore) {
      const gte = new Date(String(qCreatedAfter));
      const lte = new Date(String(qCreatedBefore));
      if (!isNaN(gte.getTime()) && !isNaN(lte.getTime()) && gte <= lte) {
        where.createdAt = { gte, lte };
      }
    } else {
      /** YYYY-MM-DD → UTC day bounds (legacy / server-side tools) */
      const dayBoundsUtc = (iso: string) => {
        const d = String(iso).split('T')[0];
        return {
          gte: new Date(d + 'T00:00:00.000Z'),
          lte: new Date(d + 'T23:59:59.999Z'),
        };
      };

      if (qStart && qEnd) {
        const gte = dayBoundsUtc(qStart).gte;
        const lte = dayBoundsUtc(qEnd).lte;
        if (!isNaN(gte.getTime()) && !isNaN(lte.getTime()) && gte <= lte) {
          where.createdAt = { gte, lte };
        }
      } else if (date) {
        const { gte, lte } = dayBoundsUtc(date);
        if (!isNaN(gte.getTime())) {
          where.createdAt = { gte, lte };
        }
      }
    }

    // Hide walk-in orders (no customer on sale) from delivery list — they are pickup/counter only
    where.sale = { customerId: { not: null } };

    const deliveries = await prisma.deliveryOrder.findMany({
      where,
      include: {
        sale: {
          include: {
            customer: true,
            items: { include: { product: true } },
          },
        },
        address: true,
        assignedDriver: {
          select: { id: true, name: true, phone: true },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return deliveries;
  });

  fastify.post('/:id/assign-driver', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const { driverId } = assignDriverSchema.parse(request.body as any);
    const user = getUser(request) as any;
    const storeId = user.storeId;

    const delivery = await prisma.deliveryOrder.findUnique({
      where: { id },
    });

    if (
      !delivery ||
      !(await canAccessStoreResource(storeId, user.role, delivery.storeId))
    ) {
      reply.code(404).send({ error: 'Delivery not found' });
      return;
    }

    const driver = await prisma.user.findUnique({
      where: { id: driverId },
    });

    const driverOk =
      driver &&
      driver.role === 'DRIVER' &&
      (driver.storeId === delivery.storeId ||
        (await canAccessStoreResource(storeId, user.role, driver.storeId)));

    if (!driverOk) {
      reply.code(400).send({ error: 'Invalid driver' });
      return;
    }

    const updated = await prisma.deliveryOrder.update({
      where: { id },
      data: {
        assignedDriverId: driverId,
        status: 'ASSIGNED',
      },
    });

    await prisma.deliveryEvent.create({
      data: {
        deliveryOrderId: id,
        status: 'ASSIGNED',
        note: `Assigned to ${driver.name}`,
        createdBy: (getUser(request) as any).userId,
      },
    });

    return updated;
  });

  fastify.post('/:id/status', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const data = updateDeliveryStatusSchema.parse(request.body as any);
    const userId = (getUser(request) as any).userId;
    const userRole = (getUser(request) as any).role;

    const delivery = await prisma.deliveryOrder.findUnique({
      where: { id },
    });

    if (!delivery) {
      reply.code(404).send({ error: 'Delivery not found' });
      return;
    }

    // Drivers can only update their own deliveries
    if (userRole === 'DRIVER' && delivery.assignedDriverId !== userId) {
      reply.code(403).send({ error: 'Forbidden' });
      return;
    }

    // Drivers cannot move orders to admin-only workflow steps
    if (userRole === 'DRIVER') {
      const driverAllowed = ['OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED'];
      if (!driverAllowed.includes(data.status)) {
        reply.code(403).send({
          error: 'Drivers can only set status to Out for delivery, Delivered, Failed, or Returned',
        });
        return;
      }
    }

    const updateData: any = {
      status: data.status,
    };

    if (data.status === 'OUT_FOR_DELIVERY') {
      updateData.outForDeliveryAt = new Date();
    } else if (data.status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    } else if (data.status === 'FAILED') {
      updateData.failureReason = data.failureReason;
    }

    const updated = await prisma.deliveryOrder.update({
      where: { id },
      data: updateData,
    });

    await prisma.deliveryEvent.create({
      data: {
        deliveryOrderId: id,
        status: data.status,
        note: data.note,
        createdBy: userId,
      },
    });

    return updated;
  });

  fastify.post('/:id/otp/verify', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const { otp } = verifyOTPSchema.parse(request.body as any);
    const userId = (getUser(request) as any).userId;

    const delivery = await prisma.deliveryOrder.findUnique({
      where: { id },
    });

    if (!delivery) {
      reply.code(404).send({ error: 'Delivery not found' });
      return;
    }

    if (!delivery.otpCodeHash) {
      reply.code(400).send({ error: 'No OTP set for this delivery' });
      return;
    }

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    if (otpHash !== delivery.otpCodeHash) {
      reply.code(400).send({ error: 'Invalid OTP' });
      return;
    }

    const updated = await prisma.deliveryOrder.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        deliveredAt: new Date(),
      },
    });

    await prisma.deliveryEvent.create({
      data: {
        deliveryOrderId: id,
        status: 'DELIVERED',
        note: 'OTP verified',
        createdBy: userId,
      },
    });

    return updated;
  });

  fastify.patch('/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const user = getUser(request) as any;
    const storeId = user.storeId;

    const delivery = await prisma.deliveryOrder.findUnique({
      where: { id },
      include: { sale: { select: { customerId: true } } },
    });

    if (
      !delivery ||
      !(await canAccessStoreResource(storeId, user.role, delivery.storeId))
    ) {
      reply.code(404).send({ error: 'Delivery not found' });
      return;
    }

    let body: ReturnType<typeof patchDeliverySchema.parse>;
    try {
      body = patchDeliverySchema.parse(request.body || {});
    } catch (e: any) {
      reply.code(400).send({ error: e?.message || 'Invalid request body' });
      return;
    }

    const updateData: any = {};

    if (body.newAddress) {
      if (!delivery.sale.customerId) {
        reply.code(400).send({ error: 'Add a customer to the sale before saving a delivery address' });
        return;
      }
      try {
        updateData.addressId = await ensureCustomerAddress(delivery.sale.customerId, body.newAddress);
      } catch (e: any) {
        reply.code(400).send({ error: e?.message || 'Invalid delivery address' });
        return;
      }
    } else if (body.addressId !== undefined) {
      if (body.addressId) {
        const address = await prisma.customerAddress.findUnique({ where: { id: body.addressId } });
        if (!address) {
          reply.code(400).send({ error: 'Address not found' });
          return;
        }
        if (delivery.sale.customerId && address.customerId !== delivery.sale.customerId) {
          reply.code(400).send({ error: 'Address does not belong to sale customer' });
          return;
        }
      }
      updateData.addressId = body.addressId || null;
    }
    if (typeof body.deliveryFee === 'number') updateData.deliveryFee = body.deliveryFee;

    if (Object.keys(updateData).length === 0) {
      const unchanged = await prisma.deliveryOrder.findUnique({
        where: { id },
        include: {
          sale: { include: { customer: true } },
          address: true,
          assignedDriver: { select: { id: true, name: true, phone: true } },
        },
      });
      return unchanged;
    }

    const updated = await prisma.deliveryOrder.update({
      where: { id },
      data: updateData,
      include: {
        sale: { include: { customer: true } },
        address: true,
        assignedDriver: { select: { id: true, name: true, phone: true } },
      },
    });
    return updated;
  });

  fastify.get('/driver/my-deliveries', { preHandler: [fastify.authenticate, requireRole('DRIVER')] }, async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const userId = (getUser(request) as any).userId;

    const where: any = {
      assignedDriverId: userId,
    };

    if (status) {
      where.status = status;
    }

    const deliveries = await prisma.deliveryOrder.findMany({
      where,
      include: {
        sale: {
          include: {
            customer: true,
            items: { include: { product: true } },
          },
        },
        address: true,
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return deliveries;
  });
}

