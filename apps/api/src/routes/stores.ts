// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { resolveStoreDateRange, salesInDateRangeWhere, ymdDaysAgoInStoreTz, ymdInStoreTz } from '@azela-pos/shared';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

export async function storeRoutes(fastify: FastifyInstance) {
  // Get all franchises for owner
  fastify.get('/franchises', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ownerStore = await prisma.store.findFirst({
        where: { type: 'OWNER' },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!ownerStore) {
        reply.code(404).send({ error: 'Owner store not found' });
        return;
      }

      const franchises = await prisma.store.findMany({
        where: {
          type: 'FRANCHISE',
          parentOwnerStoreId: ownerStore.id,
        },
        include: {
          _count: {
            select: {
              users: true,
              sales: true,
              customers: true,
              deliveryOrders: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return franchises;
    } catch (error: any) {
      console.error('Failed to fetch franchises:', error);
      reply.code(500).send({ error: 'Failed to fetch franchises' });
    }
  });

  // Get all franchises with summary stats (must be before /franchises/:id so "summary" is not treated as id)
  fastify.get('/franchises/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ownerStore = await prisma.store.findFirst({
        where: { type: 'OWNER' },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!ownerStore) {
        reply.code(404).send({ error: 'Owner store not found' });
        return;
      }

      const franchises = await prisma.store.findMany({
        where: {
          type: 'FRANCHISE',
          parentOwnerStoreId: ownerStore.id,
        },
        include: {
          _count: {
            select: {
              users: true,
              sales: true,
              customers: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const end = new Date();
      end.setUTCHours(23, 59, 59, 999);
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - 30);
      start.setUTCHours(0, 0, 0, 0);

      const franchisesWithStats = await Promise.all(
        franchises.map(async (franchise: any) => {
          const revenue = await prisma.sale.aggregate({
            where: {
              storeId: franchise.id,
              status: 'PAID',
              createdAt: {
                gte: start,
                lte: end,
              },
            },
            _sum: {
              grandTotal: true,
            },
          });

          return {
            ...franchise,
            recentRevenue: revenue._sum.grandTotal || 0,
          };
        })
      );

      return franchisesWithStats;
    } catch (error: any) {
      console.error('Failed to fetch franchises summary:', error);
      reply.code(500).send({ error: 'Failed to fetch franchises summary' });
    }
  });

  // Get single franchise/store details (supports both OWNER and FRANCHISE)
  fastify.get('/franchises/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);

      const store = await prisma.store.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          type: true,
          parentOwnerStoreId: true,
          createdAt: true,
          updatedAt: true,
        },
        include: {
          _count: {
            select: {
              users: true,
              sales: true,
              customers: true,
              deliveryOrders: true,
              inventoryLedgers: true,
            },
          },
          users: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              role: true,
              isActive: true,
            },
          },
        },
      });

      if (!store || (store.type !== 'FRANCHISE' && store.type !== 'OWNER')) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      return store;
    } catch (error: any) {
      console.error('Failed to fetch franchise:', error);
      reply.code(500).send({ error: 'Failed to fetch franchise' });
    }
  });

  // Create new franchise
  fastify.post('/franchises', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);

      if (!name || name.trim() === '') {
        reply.code(400).send({ error: 'Franchise name is required' });
        return;
      }

      const ownerStore = await prisma.store.findFirst({
        where: { type: 'OWNER' },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!ownerStore) {
        reply.code(404).send({ error: 'Owner store not found' });
        return;
      }

      // Check if franchise name already exists
      const existing = await prisma.store.findFirst({
        where: {
          name: name.trim(),
          parentOwnerStoreId: ownerStore.id,
        },
      });

      if (existing) {
        reply.code(400).send({ error: 'Franchise with this name already exists' });
        return;
      }

      const franchise = await prisma.store.create({
        data: {
          name: name.trim(),
          type: 'FRANCHISE',
          parentOwnerStoreId: ownerStore.id,
        },
        include: {
          _count: {
            select: {
              users: true,
              sales: true,
              customers: true,
            },
          },
        },
      });

      return franchise;
    } catch (error: any) {
      console.error('Failed to create franchise:', error);
      reply.code(500).send({ error: 'Failed to create franchise' });
    }
  });

  // Update franchise
  fastify.put('/franchises/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);

      if (!name || name.trim() === '') {
        reply.code(400).send({ error: 'Franchise name is required' });
        return;
      }

      const franchise = await prisma.store.findUnique({
        where: { id },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!franchise || franchise.type !== 'FRANCHISE') {
        reply.code(404).send({ error: 'Franchise not found' });
        return;
      }

      // Check if name already exists (excluding current franchise)
      const existing = await prisma.store.findFirst({
        where: {
          name: name.trim(),
          parentOwnerStoreId: franchise.parentOwnerStoreId,
          id: { not: id },
        },
      });

      if (existing) {
        reply.code(400).send({ error: 'Franchise with this name already exists' });
        return;
      }

      const updated = await prisma.store.update({
        where: { id },
        data: { name: name.trim() },
        include: {
          _count: {
            select: {
              users: true,
              sales: true,
              customers: true,
            },
          },
        },
      });

      return updated;
    } catch (error: any) {
      console.error('Failed to update franchise:', error);
      reply.code(500).send({ error: 'Failed to update franchise' });
    }
  });

  // Delete franchise (soft delete - deactivate)
  fastify.delete('/franchises/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);

      const franchise = await prisma.store.findUnique({
        where: { id },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!franchise || franchise.type !== 'FRANCHISE') {
        reply.code(404).send({ error: 'Franchise not found' });
        return;
      }

      // Check if franchise has active sales or users
      const hasActiveData = await prisma.sale.count({
        where: { storeId: id },
      }) > 0;

      if (hasActiveData) {
        reply.code(400).send({ error: 'Cannot delete franchise with existing sales data' });
        return;
      }

      await prisma.store.delete({
        where: { id },
      });

      return { message: 'Franchise deleted successfully' };
    } catch (error: any) {
      console.error('Failed to delete franchise:', error);
      reply.code(500).send({ error: 'Failed to delete franchise' });
    }
  });

  // Get franchise statistics
  fastify.get('/franchises/:id/stats', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const { startDate, endDate } = (request.query as any) || {};

      if (!id) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      const store = await prisma.store.findUnique({
        where: { id },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!store || (store.type !== 'FRANCHISE' && store.type !== 'OWNER')) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      // Date range (store calendar IST)
      let dateFilter: any = {};
      if (startDate && endDate) {
        dateFilter = resolveStoreDateRange(startDate, endDate);
      } else {
        dateFilter = resolveStoreDateRange(undefined, ymdInStoreTz(), 30);
      }

      const [sales, revenue, customers] = await Promise.all([
        prisma.sale.count({
          where: {
            storeId: id,
            status: 'PAID',
            ...salesInDateRangeWhere(dateFilter.gte, dateFilter.lte),
          },
        }),
        prisma.sale.aggregate({
          where: {
            storeId: id,
            status: 'PAID',
            ...salesInDateRangeWhere(dateFilter.gte, dateFilter.lte),
          },
          _sum: {
            grandTotal: true,
          },
        }),
        prisma.customer.count({
          where: {
            storeId: id,
            createdAt: dateFilter,
          },
        }),
      ]);

      return {
        sales,
        revenue: revenue._sum.grandTotal || 0,
        customers,
        period: {
          startDate: startDate || ymdDaysAgoInStoreTz(30),
          endDate: endDate || ymdInStoreTz(),
        },
      };
    } catch (error: any) {
      console.error('Failed to fetch franchise stats:', error);
      reply.code(500).send({ error: 'Failed to fetch franchise statistics' });
    }
  });

  // Get franchise config for the current store (for franchise store users)
  // Returns default config for OWNER stores
  fastify.get(
    '/franchise-config',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = getUser(request);
        const storeId = user.storeId;

        // Load store only — avoids joining FranchiseConfig for OWNER (common on POS).
        const store = await prisma.store.findUnique({
          where: { id: storeId },
          select: { id: true, name: true, type: true },
        });

        if (!store) {
          reply.code(404).send({ error: 'Store not found' });
          return;
        }

        const defaultFranchisePayload = {
          id: null,
          franchiseStoreId: store.id,
          status: 'ACTIVE' as const,
          pricingPlan: null,
          royaltyPercentage: 0,
          allowedWastagePercent: 5.0,
          allowedDiscountPercent: 10.0,
          isPricingLocked: false,
          isDiscountLocked: false,
          isWastageLocked: false,
          areaManager: null,
          onboardingCompleted: false,
        };

        // For OWNER stores, return default config (no restrictions)
        if (store.type === 'OWNER') {
          return {
            id: null,
            franchiseStoreId: store.id,
            status: 'ACTIVE',
            royaltyPercentage: 0,
            allowedWastagePercent: 100.0, // No restriction for owner
            allowedDiscountPercent: 100.0, // No restriction for owner
            isPricingLocked: false,
            isDiscountLocked: false,
            isWastageLocked: false,
            areaManager: null,
            onboardingCompleted: true,
            pricingPlan: null,
          };
        }

        // For FRANCHISE stores, load config by franchiseStoreId (1:1), not via Store include
        if (store.type === 'FRANCHISE') {
          let cfg = null;
          try {
            cfg = await prisma.franchiseConfig.findUnique({
              where: { franchiseStoreId: store.id },
              include: {
                pricingPlan: true,
                areaManager: {
                  select: { id: true, name: true, phone: true },
                },
              },
            });
          } catch (cfgErr: any) {
            console.error('[franchise-config] FranchiseConfig query failed:', cfgErr?.message || cfgErr);
            // POS should still load: return conservative defaults
            return defaultFranchisePayload;
          }

          if (!cfg) {
            return defaultFranchisePayload;
          }

          return {
            id: cfg.id,
            franchiseStoreId: store.id,
            status: cfg.status,
            pricingPlan: cfg.pricingPlan,
            royaltyPercentage: cfg.royaltyPercentage || 0,
            allowedWastagePercent: cfg.allowedWastagePercent || 5.0,
            allowedDiscountPercent: cfg.allowedDiscountPercent || 10.0,
            isPricingLocked: cfg.isPricingLocked || false,
            isDiscountLocked: cfg.isDiscountLocked || false,
            isWastageLocked: cfg.isWastageLocked || false,
            areaManager: cfg.areaManager,
            onboardingCompleted: !!cfg.onboardingCompletedAt,
          };
        }

        reply.code(400).send({ error: 'Invalid store type' });
        return;
      } catch (error: any) {
        console.error('Failed to fetch franchise config:', error?.message || error);
        reply.code(500).send({
          error: 'Failed to fetch franchise config',
          ...(process.env.NODE_ENV !== 'production' && {
            details: error?.message || String(error),
          }),
        });
      }
    }
  );
}

