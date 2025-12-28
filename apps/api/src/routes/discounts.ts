import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { z } from 'zod';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

const discountOverrideSchema = z.object({
  saleId: z.string(),
  overrideDiscount: z.number().min(0),
  reason: z.string().min(1),
});

export async function discountRoutes(fastify: FastifyInstance) {
  // Request discount override
  fastify.post(
    '/discounts/override/request',
    { preHandler: [fastify.authenticate] },
    async (request: any, reply: FastifyReply) => {
      try {
        const storeId = getUser(request).storeId;
        const userId = getUser(request).userId;
        const { saleId, overrideDiscount, reason } = request.body;

        // Get the sale
        const sale = await prisma.sale.findUnique({
          where: { id: saleId },
          include: {
            store: {
              include: {
                franchiseConfig: true,
              },
            },
          },
        });

        if (!sale || sale.storeId !== storeId) {
          reply.code(404).send({ error: 'Sale not found' });
          return;
        }

        // Check discount limit from franchise config
        const config = sale.store.franchiseConfig;
        const allowedDiscountPercent = config?.allowedDiscountPercent || 10.0;
        const subTotal = sale.subTotal;
        const maxAllowedDiscount = (subTotal * allowedDiscountPercent) / 100;

        // Calculate discount percentage
        const discountPercent = (overrideDiscount / subTotal) * 100;

        // If discount exceeds limit, require approval
        if (overrideDiscount > maxAllowedDiscount) {
          // Check if override already exists
          const existingOverride = await prisma.discountOverride.findUnique({
            where: { saleId },
          });

          if (existingOverride) {
            reply.code(400).send({ error: 'Discount override already requested for this sale' });
            return;
          }

          // Create override request
          const override = await prisma.discountOverride.create({
            data: {
              saleId,
              storeId,
              requestedBy: userId,
              originalDiscount: sale.discountTotal,
              overrideDiscount,
              reason,
              status: 'PENDING',
            },
            include: {
              requester: {
                select: { id: true, name: true },
              },
            },
          });

          // Create audit log
          await prisma.auditLog.create({
            data: {
              storeId,
              actorUserId: userId,
              action: 'DISCOUNT_OVERRIDE_REQUESTED',
              entityType: 'Sale',
              entityId: saleId,
              metaJson: {
                originalDiscount: sale.discountTotal,
                overrideDiscount,
                discountPercent,
                allowedDiscountPercent,
                reason,
              },
            },
          });

          return {
            override,
            requiresApproval: true,
            message: 'Discount override request created. Manager approval required.',
          };
        } else {
          // Discount is within limit, update sale directly
          const updatedSale = await prisma.sale.update({
            where: { id: saleId },
            data: {
              discountTotal: overrideDiscount,
              grandTotal: sale.subTotal + sale.taxTotal - overrideDiscount,
            },
          });

          // Create audit log
          await prisma.auditLog.create({
            data: {
              storeId,
              actorUserId: userId,
              action: 'DISCOUNT_APPLIED',
              entityType: 'Sale',
              entityId: saleId,
              metaJson: {
                discount: overrideDiscount,
                discountPercent,
              },
            },
          });

          return {
            sale: updatedSale,
            requiresApproval: false,
            message: 'Discount applied successfully.',
          };
        }
      } catch (error: any) {
        console.error('Failed to request discount override:', error);
        reply.code(500).send({ error: 'Failed to request discount override' });
      }
    }
  );

  // Get pending discount overrides (for managers)
  fastify.get(
    '/discounts/override/pending',
    { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const storeId = getUser(request).storeId;

        const overrides = await prisma.discountOverride.findMany({
          where: {
            storeId,
            status: 'PENDING',
          },
          include: {
            sale: {
              include: {
                customer: {
                  select: { id: true, name: true, phone: true },
                },
              },
            },
            requester: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        return overrides;
      } catch (error: any) {
        console.error('Failed to load pending overrides:', error);
        reply.code(500).send({ error: 'Failed to load pending overrides' });
      }
    }
  );

  // Approve discount override
  fastify.patch(
    '/discounts/override/:id/approve',
    { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const storeId = getUser(request).storeId;
        const userId = getUser(request).userId;
        const { id } = request.params;

        const override = await prisma.discountOverride.findUnique({
          where: { id },
          include: {
            sale: true,
          },
        });

        if (!override || override.storeId !== storeId) {
          reply.code(404).send({ error: 'Override not found' });
          return;
        }

        if (override.status !== 'PENDING') {
          reply.code(400).send({ error: 'Override is not pending' });
          return;
        }

        // Update override status
        const updatedOverride = await prisma.discountOverride.update({
          where: { id },
          data: {
            status: 'APPROVED',
            approvedBy: userId,
            approvedAt: new Date(),
          },
        });

        // Update sale with new discount
        const updatedSale = await prisma.sale.update({
          where: { id: override.saleId },
          data: {
            discountTotal: override.overrideDiscount,
            grandTotal: override.sale.subTotal + override.sale.taxTotal - override.overrideDiscount,
          },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            storeId,
            actorUserId: userId,
            action: 'DISCOUNT_OVERRIDE_APPROVED',
            entityType: 'Sale',
            entityId: override.saleId,
            metaJson: {
              overrideId: id,
              originalDiscount: override.originalDiscount,
              overrideDiscount: override.overrideDiscount,
              reason: override.reason,
            },
          },
        });

        return {
          override: updatedOverride,
          sale: updatedSale,
        };
      } catch (error: any) {
        console.error('Failed to approve override:', error);
        reply.code(500).send({ error: 'Failed to approve override' });
      }
    }
  );

  // Reject discount override
  fastify.patch(
    '/discounts/override/:id/reject',
    { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const storeId = getUser(request).storeId;
        const userId = getUser(request).userId;
        const { id } = request.params;
        const { rejectionReason } = request.body;

        const override = await prisma.discountOverride.findUnique({
          where: { id },
        });

        if (!override || override.storeId !== storeId) {
          reply.code(404).send({ error: 'Override not found' });
          return;
        }

        if (override.status !== 'PENDING') {
          reply.code(400).send({ error: 'Override is not pending' });
          return;
        }

        // Update override status
        const updatedOverride = await prisma.discountOverride.update({
          where: { id },
          data: {
            status: 'REJECTED',
            approvedBy: userId,
            approvedAt: new Date(),
          },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            storeId,
            actorUserId: userId,
            action: 'DISCOUNT_OVERRIDE_REJECTED',
            entityType: 'Sale',
            entityId: override.saleId,
            metaJson: {
              overrideId: id,
              rejectionReason,
            },
          },
        });

        return updatedOverride;
      } catch (error: any) {
        console.error('Failed to reject override:', error);
        reply.code(500).send({ error: 'Failed to reject override' });
      }
    }
  );

  // Get discount override history
  fastify.get(
    '/discounts/override/history',
    { preHandler: [fastify.authenticate] },
    async (request: any, reply: FastifyReply) => {
      try {
        const storeId = getUser(request).storeId;
        const { startDate, endDate } = request.query;

        const where: any = { storeId };

        if (startDate && endDate) {
          where.createdAt = {
            gte: new Date(startDate + 'T00:00:00.000Z'),
            lte: new Date(endDate + 'T23:59:59.999Z'),
          };
        }

        const overrides = await prisma.discountOverride.findMany({
          where,
          include: {
            sale: {
              include: {
                customer: {
                  select: { id: true, name: true, phone: true },
                },
              },
            },
            requester: {
              select: { id: true, name: true, role: true },
            },
            approver: {
              select: { id: true, name: true, role: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });

        return overrides;
      } catch (error: any) {
        console.error('Failed to load override history:', error);
        reply.code(500).send({ error: 'Failed to load override history' });
      }
    }
  );
}

