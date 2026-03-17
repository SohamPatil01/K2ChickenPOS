// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { prisma } from '@azela-pos/db';
import { createDeliverySchema, assignDriverSchema, updateDeliveryStatusSchema, verifyOTPSchema } from '@azela-pos/shared';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

export async function deliveryRoutes(fastify: FastifyInstance) {

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createDeliverySchema.parse(request.body as any);
    const storeId = (getUser(request) as any).storeId;

    const sale = await prisma.sale.findUnique({
      where: { id: data.saleId },
      include: { deliveryOrder: { select: { id: true } } },
    });

    if (!sale || sale.storeId !== storeId || sale.status !== 'PAID') {
      reply.code(400).send({ error: 'Sale not found or not paid' });
      return;
    }

    if (sale.deliveryOrder) {
      reply.code(400).send({ error: 'This sale already has a delivery' });
      return;
    }

    // Address can be added later in Delivery section when type is DELIVERY
    if (data.type === 'DELIVERY' && data.addressId) {
      // Validate address belongs to sale's customer if provided
      const address = await prisma.customerAddress.findUnique({ where: { id: data.addressId } });
      if (address && sale.customerId && address.customerId !== sale.customerId) {
        reply.code(400).send({ error: 'Address does not belong to sale customer' });
        return;
      }
    }

    // Generate OTP for delivery
    const otp = data.type === 'DELIVERY' ? String(Math.floor(1000 + Math.random() * 9000)) : null;
    const otpCodeHash = otp ? crypto.createHash('sha256').update(otp).digest('hex') : null;

    const delivery = await prisma.deliveryOrder.create({
      data: {
        storeId,
        saleId: data.saleId,
        type: data.type,
        status: 'CREATED',
        deliveryFee: data.deliveryFee,
        addressId: data.addressId,
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
    const { status, driverId, date } = (request.query as any);
    const storeId = (getUser(request) as any).storeId;
    const userRole = (getUser(request) as any).role;

    const where: any = {};

    if (userRole === 'DRIVER') {
      where.assignedDriverId = (getUser(request) as any).userId;
    } else {
      where.storeId = storeId;
    }

    if (status) {
      where.status = status;
    }

    if (driverId) {
      where.assignedDriverId = driverId;
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt = {
        gte: startDate,
        lte: endDate,
      };
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
    const storeId = (getUser(request) as any).storeId;

    const delivery = await prisma.deliveryOrder.findUnique({
      where: { id },
    });

    if (!delivery || delivery.storeId !== storeId) {
      reply.code(404).send({ error: 'Delivery not found' });
      return;
    }

    const driver = await prisma.user.findUnique({
      where: { id: driverId },
    });

    if (!driver || driver.role !== 'DRIVER' || driver.storeId !== storeId) {
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
    const body = (request.body as any) || {};
    const storeId = (getUser(request) as any).storeId;

    const delivery = await prisma.deliveryOrder.findUnique({
      where: { id },
      include: { sale: { select: { customerId: true } } },
    });

    if (!delivery || delivery.storeId !== storeId) {
      reply.code(404).send({ error: 'Delivery not found' });
      return;
    }

    const updateData: any = {};
    if (body.addressId !== undefined) {
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

