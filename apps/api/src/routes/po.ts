// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { createPOSchema } from '@azela-pos/shared';
import { requireRole, getUser } from '../utils/auth.js';

export async function poRoutes(fastify: FastifyInstance) {

  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createPOSchema.parse(request.body as any);
    
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
          create: data.items.map((item: any) => ({
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

  fastify.get('/', async (request: any, reply: FastifyReply) => {
    try {
      const { startDate, endDate, storeId: queryStoreId, status } = (request.query as any);
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

      // Add date filtering if provided
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
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
    } catch (error: any) {
      console.error('Failed to fetch purchase orders:', error);
      reply.code(500).send({ error: 'Failed to fetch purchase orders', details: error.message });
    }
  });

  fastify.post('/:id/submit', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
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
    } catch (error: any) {
      console.error('Failed to submit PO:', error);
      reply.code(500).send({ error: 'Failed to submit PO', details: error.message });
    }
  });

  fastify.post('/:id/approve', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const user = getUser(request);
      const userStoreId = user.storeId;

      // Get user's store to check if it's an owner store
      const userStore = await prisma.store.findUnique({
        where: { id: userStoreId },
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      // Determine the owner store ID (could be the user's store or parent)
      const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;
      
      if (!ownerStoreId) {
        reply.code(400).send({ error: 'Owner store not found' });
        return;
      }

      const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      if (!po) {
        reply.code(404).send({ error: 'PO not found' });
        return;
      }

      // Check if PO belongs to the owner store
      if (po.ownerStoreId !== ownerStoreId) {
        reply.code(403).send({ error: 'Access denied. PO does not belong to your store.' });
        return;
      }

      // Allow approval of DRAFT or SUBMITTED POs
      if (po.status !== 'SUBMITTED' && po.status !== 'DRAFT') {
        reply.code(400).send({ error: `PO cannot be approved. Current status: ${po.status}` });
        return;
      }

      // Update PO status to APPROVED
      const updated = await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'APPROVED' },
      });

      // Add inventory for each item in the PO
      // Inventory should be added to the franchise store
      const franchiseStoreId = po.franchiseStoreId;
      
      console.log(`[PO Approve] PO ID: ${id}`);
      console.log(`[PO Approve] Franchise Store ID: ${franchiseStoreId}`);
      console.log(`[PO Approve] User Store ID: ${userStoreId}`);
      console.log(`[PO Approve] Owner Store ID: ${ownerStoreId}`);
      console.log(`[PO Approve] PO has ${po.items.length} items`);
      
      // Verify franchise store exists
      const franchiseStore = await prisma.store.findUnique({
        where: { id: franchiseStoreId },
      });
      
      if (!franchiseStore) {
        console.error(`[PO Approve] Franchise store ${franchiseStoreId} not found`);
        reply.code(400).send({ error: 'Franchise store not found' });
        return;
      }
      
      console.log(`[PO Approve] Franchise store found: ${franchiseStore.name}`);
      
      const inventoryEntries = [];
      for (const item of po.items) {
        // Skip items with no quantity
        if (!item.qtyKg && !item.qtyPcs) {
          console.warn(`[PO Approve] Skipping item ${item.productId} - no quantity specified`);
          continue;
        }

        const ledgerEntry = {
          storeId: franchiseStoreId,
          productId: item.productId,
          type: 'IN' as const,
          qtyKg: item.qtyKg || undefined,
          qtyPcs: item.qtyPcs || undefined,
          reason: 'RECEIVE' as const,
          refId: id, // Reference to the PO
        };

        console.log(`[PO Approve] Creating inventory ledger entry for product ${item.productId}:`, {
          storeId: franchiseStoreId,
          productId: item.productId,
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
        });
        
        try {
          const created = await prisma.inventoryLedger.create({
            data: ledgerEntry,
          });
          
          inventoryEntries.push(created);
          console.log(`[PO Approve] Inventory ledger entry created successfully: ${created.id}`);
        } catch (error: any) {
          console.error(`[PO Approve] Failed to create inventory ledger entry:`, error);
          console.error(`[PO Approve] Error details:`, error.message, error.code);
          // Continue with other items even if one fails
        }
      }

      console.log(`[PO Approve] Created ${inventoryEntries.length} out of ${po.items.length} inventory ledger entries for PO ${id}`);

      return {
        ...updated,
        inventoryEntriesCreated: inventoryEntries.length,
      };
    } catch (error: any) {
      console.error('Failed to approve PO:', error);
      if (error.message === 'User not authenticated') {
        reply.code(401).send({ error: 'Unauthorized' });
        return;
      }
      reply.code(500).send({ error: 'Failed to approve PO', details: error.message });
    }
  });

  fastify.post('/:id/reject', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
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
          notes: (request.body as any).reason ? `${po.notes || ''}\nRejected: ${(request.body as any).reason}` : po.notes,
        },
      });

      return updated;
    } catch (error: any) {
      console.error('Failed to reject PO:', error);
      reply.code(500).send({ error: 'Failed to reject PO', details: error.message });
    }
  });

  fastify.post('/:id/dispatch', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
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
            create: po.items.map((item: any) => ({
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
    } catch (error: any) {
      console.error('Failed to dispatch PO:', error);
      reply.code(500).send({ error: 'Failed to dispatch PO', details: error.message });
    }
  });

  fastify.post('/dispatch/:dispatchId/receive', async (request: any, reply: FastifyReply) => {
    try {
      const { dispatchId } = (request.params as any);
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
    } catch (error: any) {
      console.error('Failed to receive dispatch:', error);
      reply.code(500).send({ error: 'Failed to receive dispatch', details: error.message });
    }
  });
}

