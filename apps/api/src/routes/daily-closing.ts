// @ts-nocheck
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
        const storeId = (getUser(request) as any).storeId;
        const userId = (getUser(request) as any).userId;
        const { closingDate, openingCash, cashReceived, closingCash, notes, shiftId } = (request.body as any);

        // Use UTC to avoid timezone issues - consistent with other date filtering
        const closingDateStr = closingDate.split('T')[0]; // Get YYYY-MM-DD
        const closingDateObj = new Date(closingDateStr + 'T00:00:00.000Z');
        const closingDateEnd = new Date(closingDateStr + 'T23:59:59.999Z');

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

        // Calculate totals - Round to 3 decimal places for money to avoid calculation mismatches
        const totalSales = sales.length;
        const totalRevenue = Math.round(sales.reduce((sum: any, s: any) => sum + s.grandTotal, 0) * 1000) / 1000;
        const totalDiscounts = Math.round(sales.reduce((sum: any, s: any) => sum + s.discountTotal, 0) * 1000) / 1000;
        const totalTax = Math.round(sales.reduce((sum: any, s: any) => sum + s.taxTotal, 0) * 1000) / 1000;

        // Calculate payment method breakdown - Round to 3 decimal places
        const cashSales = Math.round(sales.reduce((sum: any, s: any) => {
          const cashPayments = s.payments.filter((p: any) => p.method === 'CASH');
          return sum + cashPayments.reduce((pSum, p) => pSum + p.amount, 0);
        }, 0) * 1000) / 1000;

        const cardSales = Math.round(sales.reduce((sum: any, s: any) => {
          const cardPayments = s.payments.filter((p: any) => p.method === 'CARD');
          return sum + cardPayments.reduce((pSum, p) => pSum + p.amount, 0);
        }, 0) * 1000) / 1000;

        const upiSales = Math.round(sales.reduce((sum: any, s: any) => {
          const upiPayments = s.payments.filter((p: any) => p.method === 'UPI');
          return sum + upiPayments.reduce((pSum, p) => pSum + p.amount, 0);
        }, 0) * 1000) / 1000;

        // Auto-set cashReceived from cashSales (cash revenue)
        // If cashReceived is provided, use it; otherwise use cashSales
        const finalCashReceived = cashReceived !== undefined && cashReceived !== null ? cashReceived : cashSales;

        // Calculate total weight sold - Round to 2 decimal places for KG
        const totalWeightSoldKg = Math.round(sales.reduce((sum: any, s: any) => {
          return (
            sum +
            s.items.reduce((itemSum, item) => {
              if (item.product.unitType === 'KG') {
                return itemSum + (item.qtyKg || 0);
              }
              return itemSum;
            }, 0)
          );
        }, 0) * 100) / 100;

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

        const totalWastageKg = Math.round(wastageLedgers.reduce(
          (sum, ledger) => Math.round((sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0)) * 100) / 100,
          0
        ) * 100) / 100;

        // Get closing stock for all products
        // First get the owner store ID
        const store = await prisma.store.findUnique({
          where: { id: storeId },
          select: { id: true, name: true, type: true, parentOwnerStoreId: true }
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

          // Round to 2 decimal places for KG, integer for PCS
          closingStock[product.id] = {
            qtyKg: Math.round((Math.max(0, qtyKg)) * 100) / 100,
            qtyPcs: Math.max(0, Math.round(qtyPcs)),
          };
        }

        // Calculate cash difference - Round to 3 decimal places
        // Expected cash = opening cash + cash received (which is auto-set from cash sales)
        const cashExpected = Math.round((openingCash + finalCashReceived) * 1000) / 1000;
        const cashDifference = Math.round((closingCash - cashExpected) * 1000) / 1000;

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
            cashReceived: finalCashReceived,
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
            cashReceived: finalCashReceived,
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
        const storeId = (getUser(request) as any).storeId;
        const userId = (getUser(request) as any).userId;
        const { startDate, endDate } = (request.query as any);

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
        const storeId = (getUser(request) as any).storeId;
        let { date } = request.params as any;

        // Decode URL-encoded date if needed
        date = decodeURIComponent(date);

        // Use UTC to avoid timezone issues - consistent with other date filtering
        // Handle both YYYY-MM-DD and ISO date strings
        const closingDateStr = date.split('T')[0]; // Get YYYY-MM-DD
        const closingDate = new Date(closingDateStr + 'T00:00:00.000Z');
        
        // Validate date
        if (isNaN(closingDate.getTime())) {
          reply.code(400).send({ error: 'Invalid date format. Expected YYYY-MM-DD' });
          return;
        }

        // Try to find closing with exact date match
        let closing = await prisma.dailyClosing.findUnique({
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

        // If not found with exact match, try finding by date range (in case of timezone issues)
        if (!closing) {
          const closingDateStart = new Date(closingDateStr + 'T00:00:00.000Z');
          const closingDateEnd = new Date(closingDateStr + 'T23:59:59.999Z');
          
          closing = await prisma.dailyClosing.findFirst({
            where: {
              storeId,
              closingDate: {
                gte: closingDateStart,
                lte: closingDateEnd,
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
        }

        if (!closing) {
          reply.code(404).send({ error: 'Daily closing not found for this date' });
          return;
        }

        return closing;
      } catch (error: any) {
        console.error('Failed to load daily closing:', error);
        console.error('Date parameter:', request.params?.date);
        reply.code(500).send({ error: 'Failed to load daily closing', details: error.message });
      }
    }
  );

  // Get daily closing history
  fastify.get(
    '/daily-closing',
    { preHandler: [fastify.authenticate] },
    async (request: any, reply: FastifyReply) => {
      try {
        const storeId = (getUser(request) as any).storeId;
        const { startDate, endDate } = (request.query as any);

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

