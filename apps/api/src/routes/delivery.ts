import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { prisma } from '@azela-pos/db';
import { createDeliverySchema, assignDriverSchema, updateDeliveryStatusSchema, verifyOTPSchema } from '@azela-pos/shared';
import { requireRole } from '../utils/auth.js';

export async function deliveryRoutes(fastify: FastifyInstance) {

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createDeliverySchema.parse(request.body);
    const storeId = request.user!.storeId;

    const sale = await prisma.sale.findUnique({
      where: { id: data.saleId },
    });

    if (!sale || sale.storeId !== storeId || sale.status !== 'PAID') {
      reply.code(400).send({ error: 'Sale not found or not paid' });
      return;
    }

    if (data.type === 'DELIVERY' && !data.addressId) {
      reply.code(400).send({ error: 'Address required for delivery' });
      return;
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
        createdBy: request.user!.userId,
      },
    });

    return { ...delivery, otp }; // Return OTP only on creation
  });

  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Querystring: { status?: string; driverId?: string; date?: string } }>, reply: FastifyReply) => {
    const { status, driverId, date } = request.query;
    const storeId = request.user!.storeId;
    const userRole = request.user!.role;

    const where: any = {};

    if (userRole === 'DRIVER') {
      where.assignedDriverId = request.user!.userId;
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

  fastify.post('/:id/assign-driver', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { driverId } = assignDriverSchema.parse(request.body);
    const storeId = request.user!.storeId;

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
        createdBy: request.user!.userId,
      },
    });

    return updated;
  });

  fastify.post('/:id/status', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const data = updateDeliveryStatusSchema.parse(request.body);
    const userId = request.user!.userId;
    const userRole = request.user!.role;

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

  fastify.post('/:id/otp/verify', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { otp } = verifyOTPSchema.parse(request.body);
    const userId = request.user!.userId;

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

  fastify.get('/driver/my-deliveries', { preHandler: [fastify.authenticate, requireRole('DRIVER')] }, async (request: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
    const { status } = request.query;
    const userId = request.user!.userId;

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

