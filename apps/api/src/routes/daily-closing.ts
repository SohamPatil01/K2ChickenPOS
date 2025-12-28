import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { z } from 'zod';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

const dailyClosingSchema = z.object({
  closingDate: z.string(),
  shiftId: z.string().optional(),
  openingCash: z.number().min(0),
  cashReceived: z.number().min(0),
  closingCash: z.number().min(0),
  notes: z.string().optional(),
});

export async function dailyClosingRoutes(fastify: FastifyInstance) {
  // Create daily closing
  fastify.post(
    '/daily-closing',
    { preHandler: [fastify.authenticate] },
    async (request: any, reply: FastifyReply) => {
      try {
        const storeId = getUser(request).storeId;
        const userId = getUser(request).userId;
        const { closingDate, shiftId, openingCash, cashReceived, closingCash, notes } = request.body;

        const closingDateObj = new Date(closingDate);
        closingDateObj.setHours(0, 0, 0, 0);
        const closingDateEnd = new Date(closingDateObj);
        closingDateEnd.setHours(23, 59, 59, 999);

        // Check if closing already exists for this date
        const existing = await prisma.dailyClosing.findUnique({
          where: {
            storeId_closingDate: {
              storeId,
              closingDate: closingDateObj,
            },
          },
        });

        if (existing && existing.isFinalized) {
          reply.code(400).send({ error: 'Daily closing already finalized for this date' });
          return;
        }

        // Get all sales for the day
        const sales = await prisma.sale.findMany({
          where: {
            storeId,
            status: 'PAID',
            createdAt: {
              gte: closingDateObj,
              lte: closingDateEnd,
            },
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            payments: true,
          },
        });

        // Calculate totals
        const totalSales = sales.length;
        const totalRevenue = sales.reduce((sum: any, s: any) => sum + s.grandTotal, 0);
        const totalDiscounts = sales.reduce((sum: any, s: any) => sum + s.discountTotal, 0);
        const totalTax = sales.reduce((sum: any, s: any) => sum + s.taxTotal, 0);

        // Calculate payment method breakdown
        const cashSales = sales.reduce((sum: any, s: any) => {
          const cashPayments = s.payments.filter((p: any) => p.method === 'CASH');
          return sum + cashPayments.reduce((pSum, p) => pSum + p.amount, 0);
        }, 0);

        const cardSales = sales.reduce((sum: any, s: any) => {
          const cardPayments = s.payments.filter((p: any) => p.method === 'CARD');
          return sum + cardPayments.reduce((pSum, p) => pSum + p.amount, 0);
        }, 0);

        const upiSales = sales.reduce((sum: any, s: any) => {
          const upiPayments = s.payments.filter((p: any) => p.method === 'UPI');
          return sum + upiPayments.reduce((pSum, p) => pSum + p.amount, 0);
        }, 0);

        // Calculate total weight sold
        const totalWeightSoldKg = sales.reduce((sum: any, s: any) => {
          return (
            sum +
            s.items.reduce((itemSum, item) => {
              if (item.product.unitType === 'KG') {
                return itemSum + (item.qtyKg || 0);
              }
              return itemSum;
            }, 0)
          );
        }, 0);

        // Get wastage for the day
        const wastageLedgers = await prisma.inventoryLedger.findMany({
          where: {
            storeId,
            reason: 'WASTAGE',
            createdAt: {
              gte: closingDateObj,
              lte: closingDateEnd,
            },
          },
        });

        const totalWastageKg = wastageLedgers.reduce(
          (sum, ledger) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
          0
        );

        // Get closing stock for all products
        // First get the owner store ID
        const store = await prisma.store.findUnique({
          where: { id: storeId },
        });
        
        const ownerStoreId = store?.type === 'FRANCHISE' ? store.parentOwnerStoreId : storeId;
        
        const products = await prisma.product.findMany({
          where: {
            ownerStoreId: ownerStoreId || storeId,
            isActive: true,
          },
        });

        const closingStock: Record<string, { qtyKg: number; qtyPcs: number }> = {};

        for (const product of products) {
          const ledgers = await prisma.inventoryLedger.findMany({
            where: {
              storeId,
              productId: product.id,
            },
            orderBy: { createdAt: 'asc' },
          });

          let qtyKg = 0;
          let qtyPcs = 0;

          for (const ledger of ledgers) {
            if (ledger.type === 'IN') {
              qtyKg += ledger.qtyKg || 0;
              qtyPcs += ledger.qtyPcs || 0;
            } else {
              qtyKg -= ledger.qtyKg || 0;
              qtyPcs -= ledger.qtyPcs || 0;
            }
          }

          closingStock[product.id] = {
            qtyKg: Math.max(0, qtyKg),
            qtyPcs: Math.max(0, qtyPcs),
          };
        }

        // Calculate cash difference
        const cashExpected = openingCash + cashSales;
        const cashDifference = closingCash - cashExpected;

        // Create or update daily closing
        const dailyClosing = await prisma.dailyClosing.upsert({
          where: {
            storeId_closingDate: {
              storeId,
              closingDate: closingDateObj,
            },
          },
          update: {
            shiftId: shiftId || null,
            openingCash,
            cashSales,
            cardSales,
            upiSales,
            cashReceived,
            cashExpected,
            cashDifference,
            closingCash,
            totalWeightSoldKg,
            totalWastageKg,
            closingStockJson: closingStock,
            totalSales,
            totalRevenue,
            totalDiscounts,
            totalTax,
            notes: notes || null,
          },
          create: {
            storeId,
            shiftId: shiftId || null,
            closingDate: closingDateObj,
            closedBy: userId,
            openingCash,
            cashSales,
            cardSales,
            upiSales,
            cashReceived,
            cashExpected,
            cashDifference,
            closingCash,
            totalWeightSoldKg,
            totalWastageKg,
            closingStockJson: closingStock,
            totalSales,
            totalRevenue,
            totalDiscounts,
            totalTax,
            notes: notes || null,
          },
          include: {
            closer: {
              select: { id: true, name: true },
            },
            shift: {
              select: { id: true, openedAt: true, closedAt: true },
            },
          },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            storeId,
            actorUserId: userId,
            action: 'DAILY_CLOSING_CREATED',
            entityType: 'DailyClosing',
            entityId: dailyClosing.id,
            metaJson: {
              closingDate: closingDateObj.toISOString(),
              totalSales,
              totalRevenue,
              cashDifference,
            },
          },
        });

        return dailyClosing;
      } catch (error: any) {
        console.error('Failed to create daily closing:', error);
        reply.code(500).send({ error: 'Failed to create daily closing' });
      }
    }
  );

  // Finalize daily closing
  fastify.patch(
    '/daily-closing/:id/finalize',
    { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const storeId = getUser(request).storeId;
        const userId = getUser(request).userId;
        const { id } = request.params;

        const closing = await prisma.dailyClosing.findUnique({
          where: { id },
        });

        if (!closing || closing.storeId !== storeId) {
          reply.code(404).send({ error: 'Daily closing not found' });
          return;
        }

        if (closing.isFinalized) {
          reply.code(400).send({ error: 'Daily closing already finalized' });
          return;
        }

        const updated = await prisma.dailyClosing.update({
          where: { id },
          data: {
            isFinalized: true,
            finalizedAt: new Date(),
          },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            storeId,
            actorUserId: userId,
            action: 'DAILY_CLOSING_FINALIZED',
            entityType: 'DailyClosing',
            entityId: id,
          },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to finalize daily closing:', error);
        reply.code(500).send({ error: 'Failed to finalize daily closing' });
      }
    }
  );

  // Get daily closing by date
  fastify.get(
    '/daily-closing/:date',
    { preHandler: [fastify.authenticate] },
    async (request: any, reply: FastifyReply) => {
      try {
        const storeId = getUser(request).storeId;
        const { date } = request.params;

        const closingDate = new Date(date);
        closingDate.setHours(0, 0, 0, 0);

        const closing = await prisma.dailyClosing.findUnique({
          where: {
            storeId_closingDate: {
              storeId,
              closingDate,
            },
          },
          include: {
            closer: {
              select: { id: true, name: true },
            },
            shift: {
              select: { id: true, openedAt: true, closedAt: true },
            },
          },
        });

        if (!closing) {
          reply.code(404).send({ error: 'Daily closing not found for this date' });
          return;
        }

        return closing;
      } catch (error: any) {
        console.error('Failed to load daily closing:', error);
        reply.code(500).send({ error: 'Failed to load daily closing' });
      }
    }
  );

  // Get daily closing history
  fastify.get(
    '/daily-closing',
    { preHandler: [fastify.authenticate] },
    async (request: any, reply: FastifyReply) => {
      try {
        const storeId = getUser(request).storeId;
        const { startDate, endDate } = request.query;

        const where: any = { storeId };

        if (startDate && endDate) {
          where.closingDate = {
            gte: new Date(startDate + 'T00:00:00.000Z'),
            lte: new Date(endDate + 'T23:59:59.999Z'),
          };
        }

        const closings = await prisma.dailyClosing.findMany({
          where,
          include: {
            closer: {
              select: { id: true, name: true },
            },
          },
          orderBy: { closingDate: 'desc' },
          take: 30,
        });

        return closings;
      } catch (error: any) {
        console.error('Failed to load daily closing history:', error);
        reply.code(500).send({ error: 'Failed to load daily closing history' });
      }
    }
  );
}

