import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { createPOSchema } from '@azela-pos/shared';
import { requireRole } from '../utils/auth.js';

export async function poRoutes(fastify: FastifyInstance) {

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createPOSchema.parse(request.body);
    
    // Get stores - allow both franchise and owner stores to create POs
    const defaultOwnerStore = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const defaultFranchiseStore = await prisma.store.findFirst({ where: { type: 'FRANCHISE' } });
    
    // Use provided ownerStoreId or default to first owner store
    let ownerStoreId = data.ownerStoreId || defaultOwnerStore?.id || '';
    
    // For franchise stores, use the franchise store; for owner/manager, use owner store as both
    let franchiseStoreId = defaultFranchiseStore?.id || ownerStoreId;

    // If we have a franchise store, use it; otherwise use owner store as both
    if (defaultFranchiseStore?.id && defaultFranchiseStore.parentOwnerStoreId) {
      franchiseStoreId = defaultFranchiseStore.id;
      ownerStoreId = defaultFranchiseStore.parentOwnerStoreId;
    } else {
      // Owner/Manager creating PO - use owner store as both
      franchiseStoreId = ownerStoreId;
    }

    if (!franchiseStoreId || !ownerStoreId) {
      reply.code(400).send({ error: 'Store configuration error' });
      return;
    }

    // Generate PO number
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const count = await prisma.purchaseOrder.count({
      where: {
        franchiseStoreId,
        createdAt: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
        },
      },
    });
    const poNo = `PO-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    const po = await prisma.purchaseOrder.create({
      data: {
        franchiseStoreId,
        ownerStoreId,
        poNo,
        status: 'DRAFT',
        notes: data.notes,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            qtyKg: item.qtyKg,
            qtyPcs: item.qtyPcs,
            requestedRate: item.requestedRate,
          })),
        },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    return po;
  });

  fastify.get('/', async (request: FastifyRequest<{ Querystring: { status?: string } }>, reply: FastifyReply) => {
    const { status } = request.query;
    // Get default store (since auth is disabled for now)
    const defaultStore = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const storeId = defaultStore?.id || '';
    const userRole = 'OWNER'; // Default

    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      reply.code(404).send({ error: 'Store not found' });
      return;
    }

    const where: any = {};

    if (store.type === 'FRANCHISE') {
      where.franchiseStoreId = storeId;
    } else if (store.type === 'OWNER') {
      where.ownerStoreId = storeId;
    }

    if (status) {
      where.status = status;
    }

    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: {
        items: {
          include: { product: true },
        },
        franchiseStore: {
          select: { id: true, name: true },
        },
        ownerStore: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pos;
  });

  fastify.post('/:id/submit', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    // Get default store (since auth is disabled for now)
    const store = await prisma.store.findFirst({ where: { type: 'FRANCHISE' } });
    const storeId = store?.id || '';

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!po || po.franchiseStoreId !== storeId) {
      reply.code(404).send({ error: 'PO not found' });
      return;
    }

    if (po.status !== 'DRAFT') {
      reply.code(400).send({ error: 'PO cannot be submitted' });
      return;
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });

    return updated;
  });

  fastify.post('/:id/approve', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    // Get default store (since auth is disabled for now)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const storeId = store?.id || '';

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!po || po.ownerStoreId !== storeId) {
      reply.code(404).send({ error: 'PO not found' });
      return;
    }

    if (po.status !== 'SUBMITTED') {
      reply.code(400).send({ error: 'PO cannot be approved' });
      return;
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    return updated;
  });

  fastify.post('/:id/reject', async (request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    // Get default store (since auth is disabled for now)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const storeId = store?.id || '';

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!po || po.ownerStoreId !== storeId) {
      reply.code(404).send({ error: 'PO not found' });
      return;
    }

    if (po.status !== 'SUBMITTED') {
      reply.code(400).send({ error: 'PO cannot be rejected' });
      return;
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'REJECTED',
        notes: request.body.reason ? `${po.notes || ''}\nRejected: ${request.body.reason}` : po.notes,
      },
    });

    return updated;
  });

  fastify.post('/:id/dispatch', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    // Get default store (since auth is disabled for now)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const storeId = store?.id || '';

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!po || po.ownerStoreId !== storeId) {
      reply.code(404).send({ error: 'PO not found' });
      return;
    }

    if (po.status !== 'APPROVED') {
      reply.code(400).send({ error: 'PO must be approved to dispatch' });
      return;
    }

    // Generate dispatch number
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const count = await prisma.dispatch.count({
      where: {
        createdAt: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
        },
      },
    });
    const dispatchNo = `DISP-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    const dispatch = await prisma.dispatch.create({
      data: {
        poId: id,
        dispatchNo,
        status: 'CREATED',
        items: {
          create: po.items.map((item) => ({
            productId: item.productId,
            qtyKg: item.qtyKg,
            qtyPcs: item.qtyPcs,
          })),
        },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'DISPATCHED' },
    });

    return dispatch;
  });

  fastify.post('/dispatch/:dispatchId/receive', async (request: FastifyRequest<{ Params: { dispatchId: string } }>, reply: FastifyReply) => {
    const { dispatchId } = request.params;
    // Get default store and user (since auth is disabled for now)
    const store = await prisma.store.findFirst({ where: { type: 'FRANCHISE' } });
    const storeId = store?.id || '';
    const user = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
    const userId = user?.id || '';

    const dispatch = await prisma.dispatch.findUnique({
      where: { id: dispatchId },
      include: {
        items: true,
        po: true,
      },
    });

    if (!dispatch || dispatch.po.franchiseStoreId !== storeId) {
      reply.code(404).send({ error: 'Dispatch not found' });
      return;
    }

    // Create GRN
    const grn = await prisma.gRN.create({
      data: {
        dispatchId,
        receivedBy: userId,
        status: 'RECEIVED',
      },
    });

    // Update inventory
    for (const item of dispatch.items) {
      await prisma.inventoryLedger.create({
        data: {
          storeId,
          productId: item.productId,
          type: 'IN',
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
          reason: 'RECEIVE',
          refId: dispatchId,
        },
      });
    }

    // Update PO status
    await prisma.purchaseOrder.update({
      where: { id: dispatch.poId },
      data: { status: 'RECEIVED' },
    });

    return grn;
  });
}

