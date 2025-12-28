// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

export async function storeRoutes(fastify: FastifyInstance) {
  // Get all franchises for owner
  fastify.get('/franchises', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ownerStore = await prisma.store.findFirst({ where: { type: 'OWNER' } });
      
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

  // Get single franchise details
  fastify.get('/franchises/:id', async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      
      const franchise = await prisma.store.findUnique({
        where: { id },
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

      if (!franchise || franchise.type !== 'FRANCHISE') {
        reply.code(404).send({ error: 'Franchise not found' });
        return;
      }

      return franchise;
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

      const ownerStore = await prisma.store.findFirst({ where: { type: 'OWNER' } });
      
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
      const { id } = (request.params as any);

      if (!name || name.trim() === '') {
        reply.code(400).send({ error: 'Franchise name is required' });
        return;
      }

      const franchise = await prisma.store.findUnique({ where: { id } });
      
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

      const franchise = await prisma.store.findUnique({ where: { id } });
      
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
      const { franchiseId } = (request.query as any);
      const id = franchiseId;

      const franchise = await prisma.store.findUnique({ where: { id } });
      
      if (!franchise || franchise.type !== 'FRANCHISE') {
        reply.code(404).send({ error: 'Franchise not found' });
        return;
      }

      // Date range
      let dateFilter: any = {};
      if (startDate && endDate) {
        const start = new Date(startDate + 'T00:00:00.000Z');
        const end = new Date(endDate + 'T23:59:59.999Z');
        dateFilter = {
          gte: start,
          lte: end,
        };
      } else {
        // Default to last 30 days
        const end = new Date();
        end.setUTCHours(23, 59, 59, 999);
        const start = new Date();
        start.setUTCDate(start.getUTCDate() - 30);
        start.setUTCHours(0, 0, 0, 0);
        dateFilter = {
          gte: start,
          lte: end,
        };
      }

      const [sales, revenue, customers] = await Promise.all([
        prisma.sale.count({
          where: {
            storeId: id,
            status: 'PAID',
            createdAt: dateFilter,
          },
        }),
        prisma.sale.aggregate({
          where: {
            storeId: id,
            status: 'PAID',
            createdAt: dateFilter,
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
          startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0],
        },
      };
    } catch (error: any) {
      console.error('Failed to fetch franchise stats:', error);
      reply.code(500).send({ error: 'Failed to fetch franchise statistics' });
    }
  });

  // Get all franchises with summary stats
  fastify.get('/franchises/summary', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ownerStore = await prisma.store.findFirst({ where: { type: 'OWNER' } });
      
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

      // Get stats for each franchise (last 30 days)
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

  // Get franchise config for the current store (for franchise store users)
  fastify.get(
    '/franchise-config',
    { preHandler: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const storeId = (getUser(request) as any).storeId;

        const store = await prisma.store.findUnique({
          where: { id: storeId },
          include: {
            franchiseConfig: {
              include: {
                pricingPlan: true,
                areaManager: {
                  select: { id: true, name: true, phone: true },
                },
              },
            },
          },
        });

        if (!store || store.type !== 'FRANCHISE') {
          reply.code(404).send({ error: 'Franchise store not found' });
          return;
        }

        if (!store.franchiseConfig) {
          reply.code(404).send({ error: 'Franchise config not found' });
          return;
        }

        return {
          id: store.franchiseConfig.id,
          franchiseStoreId: store.id,
          status: store.franchiseConfig.status,
          pricingPlan: store.franchiseConfig.pricingPlan,
          royaltyPercentage: store.franchiseConfig.royaltyPercentage || 0,
          allowedWastagePercent: store.franchiseConfig.allowedWastagePercent || 5.0,
          allowedDiscountPercent: store.franchiseConfig.allowedDiscountPercent || 10.0,
          isPricingLocked: store.franchiseConfig.isPricingLocked || false,
          isDiscountLocked: store.franchiseConfig.isDiscountLocked || false,
          isWastageLocked: store.franchiseConfig.isWastageLocked || false,
          areaManager: store.franchiseConfig.areaManager,
          onboardingCompleted: !!store.franchiseConfig.onboardingCompletedAt,
        };
      } catch (error: any) {
        console.error('Failed to fetch franchise config:', error);
        reply.code(500).send({ error: 'Failed to fetch franchise config' });
      }
    }
  );
}

