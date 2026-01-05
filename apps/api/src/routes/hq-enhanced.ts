// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { z } from 'zod';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

interface QueryParams {
  startDate?: string;
  endDate?: string;
  franchiseId?: string;
}

function getDateRange(startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    const start = new Date(startDate + 'T00:00:00.000Z');
    const end = new Date(endDate + 'T23:59:59.999Z');
    return {
      gte: start,
      lte: end,
    };
  } else {
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 30);
    start.setUTCHours(0, 0, 0, 0);
    return {
      gte: start,
      lte: end,
    };
  }
}

// Helper function to create alerts
async function createAlert(
  ownerStoreId: string,
  franchiseStoreId: string | null,
  alertType: string,
  severity: string,
  title: string,
  message: string,
  metadata?: any
) {
  return await prisma.hQAlert.create({
    data: {
      ownerStoreId,
      franchiseStoreId,
      alertType: alertType as any,
      severity: severity as any,
      title,
      message,
      metadata: metadata || {},
    },
  });
}

export async function hqEnhancedRoutes(fastify: FastifyInstance) {
  // ============================================
  // ENHANCED HQ DASHBOARD
  // ============================================

  // Enhanced dashboard with procurement vs sales, yield loss, wastage, alerts
  fastify.get(
    '/dashboard/enhanced',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const { startDate, endDate } = (request.query as any);
        const dateFilter = getDateRange(startDate, endDate);
        const ownerStoreId = (getUser(request) as any).storeId;

        const ownerStore = await prisma.store.findUnique({ where: { id: ownerStoreId } });
        if (!ownerStore || ownerStore.type !== 'OWNER') {
          reply.code(403).send({ error: 'Access denied' });
          return;
        }

        // Get all franchises
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: ownerStoreId,
          },
          include: {
            franchiseConfig: true,
          },
        });

        const franchiseIds = franchises.map(f => f.id);

        // Total Procurement (from Central Purchase Orders)
        const procurementData = await prisma.centralPurchaseOrder.aggregate({
          where: {
            ownerStoreId,
            status: { in: ['APPROVED', 'DISPATCHED', 'RECEIVED'] },
            orderDate: dateFilter,
          },
          _sum: {
            totalAmount: true,
          },
        });

        // Total Inward Stock (weight in kg)
        const inwardStockData = await prisma.inwardStock.aggregate({
          where: {
            ownerStoreId,
            receivedAt: dateFilter,
          },
          _sum: {
            totalWeightKg: true,
          },
        });

        // Total Sales
        const salesData = await prisma.sale.aggregate({
          where: {
            storeId: { in: franchiseIds },
            status: 'PAID',
            createdAt: dateFilter,
          },
          _sum: {
            grandTotal: true,
          },
          _count: {
            id: true,
          },
        });

        // Calculate sold weight from sale items
        const saleItems = await prisma.saleItem.findMany({
          where: {
            sale: {
              storeId: { in: franchiseIds },
              status: 'PAID',
              createdAt: dateFilter,
            },
            product: {
              unitType: 'KG',
            },
          },
          select: {
            qtyKg: true,
          },
        });

        const totalSoldWeightKg = saleItems.reduce((sum: any, item) => sum + (item.qtyKg || 0), 0);
        const totalProcuredWeightKg = inwardStockData._sum.totalWeightKg || 0;

        // Yield Loss = (Procured - Sold) / Procured * 100
        const yieldLossPercent =
          totalProcuredWeightKg > 0
            ? ((totalProcuredWeightKg - totalSoldWeightKg) / totalProcuredWeightKg) * 100
            : 0;

        // Wastage by store (from InventoryLedger with WASTAGE reason)
        const wastageData = await Promise.all(
          franchises.map(async (franchise: any) => {
            const wastageLedgers = await prisma.inventoryLedger.findMany({
              where: {
                storeId: franchise.id,
                reason: 'WASTAGE',
                createdAt: dateFilter,
              },
            });

            const totalWastageKg = Math.round(wastageLedgers.reduce(
              (sum, ledger) => Math.round((sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0)) * 100) / 100,
              0
            ) * 100) / 100;

            const config = franchise.franchiseConfig;
            const allowedWastagePercent = config?.allowedWastagePercent || 5.0;

            // Calculate wastage percentage (need to get total inventory received)
            const totalReceived = await prisma.inventoryLedger.aggregate({
              where: {
                storeId: franchise.id,
                type: 'IN',
                reason: 'RECEIVE',
                createdAt: dateFilter,
              },
              _sum: {
                qtyKg: true,
                qtyPcs: true,
              },
            });

            const totalReceivedKg = Math.round(((totalReceived._sum.qtyKg || 0) + (totalReceived._sum.qtyPcs || 0)) * 100) / 100;
            const wastagePercent = totalReceivedKg > 0 ? Math.round((totalWastageKg / totalReceivedKg) * 100 * 100) / 100 : 0;

            return {
              franchiseId: franchise.id,
              franchiseName: franchise.name,
              wastageKg: totalWastageKg,
              wastagePercent,
              allowedWastagePercent,
              isAbnormal: wastagePercent > allowedWastagePercent,
            };
          })
        );

        // Top/Bottom performing stores
        const franchisePerformance = await Promise.all(
          franchises.map(async (franchise: any) => {
            const sales = await prisma.sale.findMany({
              where: {
                storeId: franchise.id,
                status: 'PAID',
                createdAt: dateFilter,
              },
            });

            const revenue = sales.reduce((sum: any, s: any) => sum + s.grandTotal, 0);
            const salesCount = sales.length;

            return {
              franchiseId: franchise.id,
              franchiseName: franchise.name,
              revenue,
              salesCount,
              avgBillValue: salesCount > 0 ? revenue / salesCount : 0,
            };
          })
        );

        const topStores = [...franchisePerformance]
          .sort((a: any, b: any) => b.revenue - a.revenue)
          .slice(0, 5);
        const bottomStores = [...franchisePerformance]
          .sort((a: any, b: any) => a.revenue - b.revenue)
          .slice(0, 5);

        // Get active alerts
        const alerts = await prisma.hQAlert.findMany({
          where: {
            ownerStoreId,
            isResolved: false,
          },
          include: {
            franchiseStore: {
              select: { id: true, name: true },
            },
          },
          orderBy: [
            { severity: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 20,
        });

        return {
          summary: {
            totalProcurement: procurementData._sum.totalAmount || 0,
            totalProcuredWeightKg: totalProcuredWeightKg,
            totalSales: salesData._sum.grandTotal || 0,
            totalSoldWeightKg: totalSoldWeightKg,
            yieldLossPercent: Math.max(0, yieldLossPercent),
            totalFranchises: franchises.length,
            totalSalesCount: salesData._count.id || 0,
          },
          wastageByStore: wastageData,
          topPerformingStores: topStores,
          bottomPerformingStores: bottomStores,
          alerts: alerts.map((a) => ({
            id: a.id,
            type: a.alertType,
            severity: a.severity,
            title: a.title,
            message: a.message,
            franchiseName: a.franchiseStore?.name,
            createdAt: a.createdAt,
            isRead: a.isRead,
          })),
          period: {
            startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: endDate || new Date().toISOString().split('T')[0],
          },
        };
      } catch (error: any) {
        console.error('Failed to load enhanced HQ dashboard:', error);
        console.error('Error details:', error.message, error.stack);
        reply.code(500).send({ 
          error: 'Failed to load enhanced HQ dashboard',
          details: error.message 
        });
      }
    }
  );

  // ============================================
  // ALERTS API
  // ============================================

  // Get all alerts
  fastify.get(
    '/alerts',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const { startDate, endDate } = (request.query as any);

        const where: any = {
          ownerStoreId,
        };

        if (isResolved !== undefined) {
          where.isResolved = isResolved === 'true';
        }

        if (severity) {
          where.severity = severity;
        }

        const alerts = await prisma.hQAlert.findMany({
          where,
          include: {
            franchiseStore: {
              select: { id: true, name: true },
            },
            resolver: {
              select: { id: true, name: true },
            },
          },
          orderBy: [
            { severity: 'desc' },
            { createdAt: 'desc' },
          ],
          take: 100,
        });

        return alerts;
      } catch (error: any) {
        console.error('Failed to load alerts:', error);
        reply.code(500).send({ error: 'Failed to load alerts' });
      }
    }
  );

  // Mark alert as read
  fastify.patch(
    '/alerts/:id/read',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const { startDate, endDate } = (request.query as any);

        const alert = await prisma.hQAlert.findUnique({
          where: { id },
        });

        if (!alert || alert.ownerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Alert not found' });
          return;
        }

        const updated = await prisma.hQAlert.update({
          where: { id },
          data: { isRead: true },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to mark alert as read:', error);
        reply.code(500).send({ error: 'Failed to mark alert as read' });
      }
    }
  );

  // Resolve alert
  fastify.patch(
    '/alerts/:id/resolve',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const userId = (getUser(request) as any).userId;
        const { startDate, endDate } = (request.query as any);

        const alert = await prisma.hQAlert.findUnique({
          where: { id },
        });

        if (!alert || alert.ownerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Alert not found' });
          return;
        }

        const updated = await prisma.hQAlert.update({
          where: { id },
          data: {
            isResolved: true,
            resolvedBy: userId,
            resolvedAt: new Date(),
          },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to resolve alert:', error);
        reply.code(500).send({ error: 'Failed to resolve alert' });
      }
    }
  );

  // ============================================
  // FRANCHISE MANAGEMENT API
  // ============================================

  // Get all franchise configs
  fastify.get(
    '/franchises/config',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;

        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: ownerStoreId,
          },
          include: {
            franchiseConfig: {
              include: {
                pricingPlan: true,
                areaManager: {
                  select: { id: true, name: true, phone: true },
                },
              },
            },
            _count: {
              select: {
                users: true,
                sales: true,
                customers: true,
              },
            },
          },
        });

        return franchises.map((f) => ({
          id: f.id,
          franchiseConfigId: f.franchiseConfig?.id || null, // Include the config ID
          name: f.name,
          status: f.franchiseConfig?.status || 'INACTIVE',
          pricingPlan: f.franchiseConfig?.pricingPlan,
          royaltyPercentage: f.franchiseConfig?.royaltyPercentage || 0,
          allowedWastagePercent: f.franchiseConfig?.allowedWastagePercent || 5.0,
          allowedDiscountPercent: f.franchiseConfig?.allowedDiscountPercent || 10.0,
          areaManager: f.franchiseConfig?.areaManager,
          onboardingCompleted: !!f.franchiseConfig?.onboardingCompletedAt,
          stats: {
            users: f._count.users,
            sales: f._count.sales,
            customers: f._count.customers,
          },
          createdAt: f.createdAt,
        }));
      } catch (error: any) {
        console.error('Failed to load franchise configs:', error);
        reply.code(500).send({ error: 'Failed to load franchise configs' });
      }
    }
  );

  // Create/Update franchise config
  fastify.post(
    '/franchises/:franchiseId/config',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Params: { franchiseId: string };
        Body: {
          status?: string;
          pricingPlanId?: string;
          royaltyPercentage?: number;
          royaltyCalculationBase?: string;
          allowedWastagePercent?: number;
          allowedDiscountPercent?: number;
          areaManagerId?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const body = request.body as any

        // Verify franchise belongs to owner
        const franchise = await prisma.store.findUnique({
          where: { id: franchiseId },
        });

        if (!franchise || franchise.parentOwnerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Franchise not found' });
          return;
        }

        const config = await prisma.franchiseConfig.upsert({
          where: { franchiseStoreId: franchiseId },
          update: {
            status: body.status as any,
            pricingPlanId: body.pricingPlanId || null,
            royaltyPercentage: body.royaltyPercentage,
            royaltyCalculationBase: (body.royaltyCalculationBase as any) || 'GROSS_SALES',
            allowedWastagePercent: body.allowedWastagePercent,
            allowedDiscountPercent: body.allowedDiscountPercent,
            areaManagerId: body.areaManagerId || null,
          },
          create: {
            franchiseStoreId: franchiseId,
            status: (body.status as any) || 'ACTIVE',
            pricingPlanId: body.pricingPlanId || null,
            royaltyPercentage: body.royaltyPercentage || 0,
            royaltyCalculationBase: (body.royaltyCalculationBase as any) || 'GROSS_SALES',
            allowedWastagePercent: body.allowedWastagePercent || 5.0,
            allowedDiscountPercent: body.allowedDiscountPercent || 10.0,
            areaManagerId: body.areaManagerId || null,
          },
          include: {
            pricingPlan: true,
            areaManager: {
              select: { id: true, name: true, phone: true },
            },
          },
        });

        return config;
      } catch (error: any) {
        console.error('Failed to update franchise config:', error);
        reply.code(500).send({ error: 'Failed to update franchise config' });
      }
    }
  );

  // Lock/Unlock franchise controls
  fastify.patch(
    '/franchises/:franchiseId/locks',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Params: { franchiseId: string };
        Body: {
          isPricingLocked?: boolean;
          isDiscountLocked?: boolean;
          isWastageLocked?: boolean;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const userId = (getUser(request) as any).userId;
        const { startDate, endDate } = (request.query as any);

        const franchise = await prisma.store.findUnique({
          where: { id: franchiseId },
        });

        if (!franchise || franchise.parentOwnerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Franchise not found' });
          return;
        }

        const config = await prisma.franchiseConfig.findUnique({
          where: { franchiseStoreId: franchiseId },
        });

        if (!config) {
          reply.code(404).send({ error: 'Franchise config not found' });
          return;
        }

        const updateData: any = {};
        if (isPricingLocked !== undefined) {
          updateData.isPricingLocked = isPricingLocked;
        }
        if (isDiscountLocked !== undefined) {
          updateData.isDiscountLocked = isDiscountLocked;
        }
        if (isWastageLocked !== undefined) {
          updateData.isWastageLocked = isWastageLocked;
        }

        // Set lock metadata if any lock is being set
        if (isPricingLocked || isDiscountLocked || isWastageLocked) {
          updateData.lockedBy = userId;
          updateData.lockedAt = new Date();
        }

        const updated = await prisma.franchiseConfig.update({
          where: { franchiseStoreId: franchiseId },
          data: updateData,
        });

        // Create audit log
        const lockActions = [];
        if (isPricingLocked !== undefined) {
          lockActions.push(`Pricing: ${isPricingLocked ? 'LOCKED' : 'UNLOCKED'}`);
        }
        if (isDiscountLocked !== undefined) {
          lockActions.push(`Discount: ${isDiscountLocked ? 'LOCKED' : 'UNLOCKED'}`);
        }
        if (isWastageLocked !== undefined) {
          lockActions.push(`Wastage: ${isWastageLocked ? 'LOCKED' : 'UNLOCKED'}`);
        }

        await prisma.auditLog.create({
          data: {
            storeId: franchiseId,
            actorUserId: userId,
            action: 'FRANCHISE_LOCKS_UPDATED',
            entityType: 'FranchiseConfig',
            entityId: config.id,
            metaJson: {
              locks: lockActions,
              isPricingLocked: updated.isPricingLocked,
              isDiscountLocked: updated.isDiscountLocked,
              isWastageLocked: updated.isWastageLocked,
            },
          },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to update locks:', error);
        reply.code(500).send({ error: 'Failed to update locks' });
      }
    }
  );

  // Update franchise status
  fastify.patch(
    '/franchises/:franchiseId/status',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Params: { franchiseId: string };
        Body: { status: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const { startDate, endDate } = (request.query as any);

        // Verify franchise belongs to owner
        const franchise = await prisma.store.findUnique({
          where: { id: franchiseId },
        });

        if (!franchise || franchise.parentOwnerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Franchise not found' });
          return;
        }

        const config = await prisma.franchiseConfig.update({
          where: { franchiseStoreId: franchiseId },
          data: { status: status as any },
          include: {
            pricingPlan: true,
            areaManager: {
              select: { id: true, name: true, phone: true },
            },
          },
        });

        return config;
      } catch (error: any) {
        console.error('Failed to update franchise status:', error);
        reply.code(500).send({ error: 'Failed to update franchise status' });
      }
    }
  );

  // Complete onboarding
  fastify.patch(
    '/franchises/:franchiseId/onboarding-complete',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Params: { franchiseId: string };
        Body: { onboardingData: any };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const { startDate, endDate } = (request.query as any);

        const franchise = await prisma.store.findUnique({
          where: { id: franchiseId },
        });

        if (!franchise || franchise.parentOwnerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Franchise not found' });
          return;
        }

        const config = await prisma.franchiseConfig.upsert({
          where: { franchiseStoreId: franchiseId },
          update: {
            onboardingCompletedAt: new Date(),
            onboardingData: onboardingData || {},
          },
          create: {
            franchiseStoreId: franchiseId,
            onboardingCompletedAt: new Date(),
            onboardingData: onboardingData || {},
          },
        });

        return config;
      } catch (error: any) {
        console.error('Failed to complete onboarding:', error);
        reply.code(500).send({ error: 'Failed to complete onboarding' });
      }
    }
  );
}

