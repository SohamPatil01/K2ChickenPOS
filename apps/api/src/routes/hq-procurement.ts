// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { z } from 'zod';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

const supplierSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  gstin: z.string().optional(),
});

const centralPOSchema = z.object({
  supplierId: z.string(),
  poNo: z.string().optional(),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string(),
      qtyKg: z.number().optional(),
      qtyPcs: z.number().int().optional(),
      unitRate: z.number(),
    })
  ),
});

const inwardStockSchema = z.object({
  centralPOId: z.string().optional(),
  supplierId: z.string(),
  productId: z.string(),
  batchNo: z.string().optional(),
  totalWeightKg: z.number(),
  temperatureCheck: z.number().optional(),
  notes: z.string().optional(),
});

const stockAllocationSchema = z.object({
  centralPOId: z.string().optional(),
  inwardStockId: z.string().optional(),
  franchiseStoreId: z.string(),
  productId: z.string(),
  allocatedQtyKg: z.number(),
  allocatedQtyPcs: z.number().int().optional(),
  notes: z.string().optional(),
});

export async function hqProcurementRoutes(fastify: FastifyInstance) {
  // ============================================
  // SUPPLIER MASTER
  // ============================================

  // Get all suppliers
  fastify.get(
    '/suppliers',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;

        const suppliers = await prisma.supplier.findMany({
          where: { ownerStoreId },
          orderBy: { name: 'asc' },
        });

        return suppliers;
      } catch (error: any) {
        console.error('Failed to load suppliers:', error);
        reply.code(500).send({ error: 'Failed to load suppliers' });
      }
    }
  );

  // Create supplier
  fastify.post(
    '/suppliers',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const data = supplierSchema.parse(request.body as any);

      const supplier = await prisma.supplier.create({
        data: {
          ownerStoreId,
          name: data.name,
          phone: data.phone,
          email: data.email,
          city: data.city,
          state: data.state,
          zip: data.zip,
          address: data.address,
          contactName: data.contactName,
          gstin: data.gstin,
        },
      });

        return supplier;
      } catch (error: any) {
        console.error('Failed to create supplier:', error);
        reply.code(500).send({ error: 'Failed to create supplier' });
      }
    }
  );

  // Update supplier
  fastify.put(
    '/suppliers/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const {
        const data = supplierSchema.parse(request.body as any);

        const supplier = await prisma.supplier.findUnique({
          where: { id },
        });

        if (!supplier || supplier.ownerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Supplier not found' });
          return;
        }

        const updated = await prisma.supplier.update({
          where: { id },
          data,
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to update supplier:', error);
        reply.code(500).send({ error: 'Failed to update supplier' });
      }
    }
  );

  // Delete supplier
  fastify.delete(
    '/suppliers/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const {

        const supplier = await prisma.supplier.findUnique({
          where: { id },
        });

        if (!supplier || supplier.ownerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Supplier not found' });
          return;
        }

        await prisma.supplier.delete({
          where: { id },
        });

        return { message: 'Supplier deleted successfully' };
      } catch (error: any) {
        console.error('Failed to delete supplier:', error);
        reply.code(500).send({ error: 'Failed to delete supplier' });
      }
    }
  );

  // ============================================
  // CENTRAL PURCHASE ORDERS
  // ============================================

  // Get all central POs
  fastify.get(
    '/central-pos',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const {

        const where: any = { ownerStoreId };
        if (status) {
          where.status = status;
        }

        const pos = await prisma.centralPurchaseOrder.findMany({
          where,
          include: {
            supplier: true,
            items: {
              include: {
                product: {
                  select: { id: true, name: true, sku: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        return pos;
      } catch (error: any) {
        console.error('Failed to load central POs:', error);
        reply.code(500).send({ error: 'Failed to load central POs' });
      }
    }
  );

  // Create central PO
  fastify.post(
    '/central-pos',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const data = centralPOSchema.parse(request.body as any);

        // Generate PO number if not provided
        const poNo = data.poNo || `CPO-${Date.now()}`;

        // Calculate total amount
        const totalAmount = data.items.reduce((sum: any, item) => {
          const qty = item.qtyKg || item.qtyPcs || 0;
          return sum + qty * item.unitRate;
        }, 0);

        const po = await prisma.centralPurchaseOrder.create({
          data: {
            ownerStoreId,
            supplierId: data.supplierId,
            poNo,
            orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
            expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
            totalAmount,
            notes: data.notes,
            items: {
              create: data.items.map((item: any) => ({
                productId: item.productId,
                qtyKg: item.qtyKg,
                qtyPcs: item.qtyPcs,
                unitRate: item.unitRate,
                totalAmount: (item.qtyKg || item.qtyPcs || 0) * item.unitRate,
              })),
            },
          },
          include: {
            supplier: true,
            items: {
              include: {
                product: {
                  select: { id: true, name: true, sku: true },
                },
              },
            },
          },
        });

        return po;
      } catch (error: any) {
        console.error('Failed to create central PO:', error);
        reply.code(500).send({ error: 'Failed to create central PO' });
      }
    }
  );

  // Update central PO status
  fastify.patch(
    '/central-pos/:id/status',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const {
        const {

        const po = await prisma.centralPurchaseOrder.findUnique({
          where: { id },
        });

        if (!po || po.ownerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'PO not found' });
          return;
        }

        const updated = await prisma.centralPurchaseOrder.update({
          where: { id },
          data: { status: status as any },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to update PO status:', error);
        reply.code(500).send({ error: 'Failed to update PO status' });
      }
    }
  );

  // ============================================
  // INWARD STOCK
  // ============================================

  // Get all inward stock
  fastify.get(
    '/inward-stock',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;

        const inwardStocks = await prisma.inwardStock.findMany({
          where: { ownerStoreId },
          include: {
            supplier: true,
            product: {
              select: { id: true, name: true, sku: true },
            },
            centralPO: {
              select: { id: true, poNo: true },
            },
            receiver: {
              select: { id: true, name: true },
            },
            allocations: {
              include: {
                franchiseStore: {
                  select: { id: true, name: true },
                },
              },
            },
          },
          orderBy: { receivedAt: 'desc' },
        });

        return inwardStocks;
      } catch (error: any) {
        console.error('Failed to load inward stock:', error);
        reply.code(500).send({ error: 'Failed to load inward stock' });
      }
    }
  );

  // Create inward stock entry
  fastify.post(
    '/inward-stock',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const userId = (getUser(request) as any).userId;
        const data = inwardStockSchema.parse(request.body as any);

        const inwardStock = await prisma.inwardStock.create({
          data: {
            ownerStoreId,
            receivedBy: userId,
            centralPOId: data.centralPOId || null,
            supplierId: data.supplierId,
            productId: data.productId,
            batchNo: data.batchNo,
            totalWeightKg: data.totalWeightKg,
            temperatureCheck: data.temperatureCheck,
            notes: data.notes,
          },
          include: {
            supplier: true,
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        });

        // Create inventory ledger entry for HQ
        await prisma.inventoryLedger.create({
          data: {
            storeId: ownerStoreId,
            productId: data.productId,
            type: 'IN',
            reason: 'RECEIVE',
            qtyKg: data.totalWeightKg,
            refId: inwardStock.id,
          },
        });

        return inwardStock;
      } catch (error: any) {
        console.error('Failed to create inward stock:', error);
        reply.code(500).send({ error: 'Failed to create inward stock' });
      }
    }
  );

  // ============================================
  // STOCK ALLOCATION
  // ============================================

  // Get all stock allocations
  fastify.get(
    '/stock-allocations',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const {

        const where: any = { ownerStoreId };
        if (franchiseId) {
          where.franchiseStoreId = franchiseId;
        }
        if (status) {
          where.status = status;
        }

        const allocations = await prisma.stockAllocation.findMany({
          where,
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
            franchiseStore: {
              select: { id: true, name: true },
            },
            centralPO: {
              select: { id: true, poNo: true },
            },
            inwardStock: {
              select: { id: true, batchNo: true },
            },
          },
          orderBy: { allocatedAt: 'desc' },
        });

        return allocations;
      } catch (error: any) {
        console.error('Failed to load stock allocations:', error);
        reply.code(500).send({ error: 'Failed to load stock allocations' });
      }
    }
  );

  // Create stock allocation
  fastify.post(
    '/stock-allocations',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const data = stockAllocationSchema.parse(request.body as any);

        // Verify franchise belongs to owner
        const franchise = await prisma.store.findUnique({
          where: { id: data.franchiseStoreId },
        });

        if (!franchise || franchise.parentOwnerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Franchise not found' });
          return;
        }

        const allocation = await prisma.stockAllocation.create({
          data: {
            ownerStoreId,
            centralPOId: data.centralPOId || null,
            inwardStockId: data.inwardStockId || null,
            franchiseStoreId: data.franchiseStoreId,
            productId: data.productId,
            allocatedQtyKg: data.allocatedQtyKg,
            allocatedQtyPcs: data.allocatedQtyPcs,
            notes: data.notes,
          },
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
            franchiseStore: {
              select: { id: true, name: true },
            },
          },
        });

        return allocation;
      } catch (error: any) {
        console.error('Failed to create stock allocation:', error);
        reply.code(500).send({ error: 'Failed to create stock allocation' });
      }
    }
  );

  // Update allocation status (dispatch/receive)
  fastify.patch(
    '/stock-allocations/:id/status',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { status: string; dispatchedAt?: string; receivedAt?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const {
        const {

        const allocation = await prisma.stockAllocation.findUnique({
          where: { id },
        });

        if (!allocation || allocation.ownerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Allocation not found' });
          return;
        }

        const updateData: any = {
          status: status as any,
        };

        if (dispatchedAt) {
          updateData.dispatchedAt = new Date(dispatchedAt);
        }

        if (receivedAt) {
          updateData.receivedAt = new Date(receivedAt);
          // Create inventory ledger entry for franchise when received
          await prisma.inventoryLedger.create({
            data: {
              storeId: allocation.franchiseStoreId,
              productId: allocation.productId,
              type: 'IN',
              reason: 'RECEIVE',
              qtyKg: allocation.allocatedQtyKg,
              qtyPcs: allocation.allocatedQtyPcs,
              refId: allocation.id,
            },
          });
        }

        const updated = await prisma.stockAllocation.update({
          where: { id },
          data: updateData,
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to update allocation status:', error);
        reply.code(500).send({ error: 'Failed to update allocation status' });
      }
    }
  );
}

