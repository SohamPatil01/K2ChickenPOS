// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { z } from 'zod';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

const pricingPlanSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['STANDARD', 'PREMIUM', 'CUSTOM']),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const pricingRuleSchema = z.object({
  pricingPlanId: z.string(),
  productId: z.string().optional(),
  categoryId: z.string().optional(),
  basePrice: z.number(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
});

const pricingOverrideSchema = z.object({
  franchiseConfigId: z.string(),
  productId: z.string(),
  overridePrice: z.number(),
  lockStatus: z.enum(['UNLOCKED', 'LOCKED_BY_HQ', 'LOCKED_BY_REGION']).optional(),
  reason: z.string().optional(),
  effectiveFrom: z.string().optional(),
  effectiveTo: z.string().optional(),
});

export async function hqPricingRoutes(fastify: FastifyInstance) {
  // ============================================
  // PRICING PLANS
  // ============================================

  // Get all pricing plans
  fastify.get(
    '/pricing-plans',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const pricingPlans = await prisma.pricingPlan.findMany({
          include: {
            franchises: {
              include: {
                franchiseStore: {
                  select: { id: true, name: true },
                },
              },
            },
            pricingRules: {
              include: {
                product: {
                  select: { id: true, name: true, sku: true },
                },
                category: {
                  select: { id: true, name: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        return pricingPlans;
      } catch (error: any) {
        console.error('Failed to load pricing plans:', error);
        reply.code(500).send({ error: 'Failed to load pricing plans' });
      }
    }
  );

  // Create pricing plan
  fastify.post(
    '/pricing-plans',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const data = pricingPlanSchema.parse(request.body as any);

        const pricingPlan = await prisma.pricingPlan.create({
          data: data as any,
        });

        return pricingPlan;
      } catch (error: any) {
        console.error('Failed to create pricing plan:', error);
        reply.code(500).send({ error: 'Failed to create pricing plan' });
      }
    }
  );

  // Update pricing plan
  fastify.put(
    '/pricing-plans/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const {
        const data = pricingPlanSchema.partial().parse(request.body as any);

        const updated = await prisma.pricingPlan.update({
          where: { id },
          data,
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to update pricing plan:', error);
        reply.code(500).send({ error: 'Failed to update pricing plan' });
      }
    }
  );

  // ============================================
  // PRICING RULES
  // ============================================

  // Get pricing rules for a plan
  fastify.get(
    '/pricing-plans/:planId/rules',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const {

        const rules = await prisma.pricingRule.findMany({
          where: { pricingPlanId: planId },
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
            category: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        return rules;
      } catch (error: any) {
        console.error('Failed to load pricing rules:', error);
        reply.code(500).send({ error: 'Failed to load pricing rules' });
      }
    }
  );

  // Create pricing rule
  fastify.post(
    '/pricing-rules',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const data = pricingRuleSchema.parse(request.body as any);

        const rule = await prisma.pricingRule.create({
          data: {
            ...data,
            effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
            effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
          } as any,
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
            category: {
              select: { id: true, name: true },
            },
          },
        });

        return rule;
      } catch (error: any) {
        console.error('Failed to create pricing rule:', error);
        reply.code(500).send({ error: 'Failed to create pricing rule' });
      }
    }
  );

  // Update pricing rule
  fastify.put(
    '/pricing-rules/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const {
        const data = pricingRuleSchema.partial().parse(request.body as any);

        const updateData: any = { ...data };
        if (data.effectiveFrom) {
          updateData.effectiveFrom = new Date(data.effectiveFrom);
        }
        if (data.effectiveTo !== undefined) {
          updateData.effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;
        }

        const updated = await prisma.pricingRule.update({
          where: { id },
          data: updateData,
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to update pricing rule:', error);
        reply.code(500).send({ error: 'Failed to update pricing rule' });
      }
    }
  );

  // Lock/Unlock pricing rule
  fastify.patch(
    '/pricing-rules/:id/lock',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const {
        const {

        // Note: PricingRule doesn't have lockStatus field in schema
        // This would need to be added to the schema or handled via ProductMaster
        // For now, we'll update the related ProductMaster if it exists
        const rule = await prisma.pricingRule.findUnique({
          where: { id },
          include: { product: true },
        });

        if (!rule) {
          reply.code(404).send({ error: 'Pricing rule not found' });
          return;
        }

        // Update ProductMaster lock status if product exists
        if (rule.productId) {
          await prisma.productMaster.updateMany({
            where: { productId: rule.productId },
            data: {
              isHQLocked: lockStatus === 'LOCKED_BY_HQ',
            },
          });
        }

        return { message: 'Lock status updated successfully', lockStatus };
      } catch (error: any) {
        console.error('Failed to update lock status:', error);
        reply.code(500).send({ error: 'Failed to update lock status' });
      }
    }
  );

  // Delete pricing rule
  fastify.delete(
    '/pricing-rules/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const {

        await prisma.pricingRule.delete({
          where: { id },
        });

        return { message: 'Pricing rule deleted successfully' };
      } catch (error: any) {
        console.error('Failed to delete pricing rule:', error);
        reply.code(500).send({ error: 'Failed to delete pricing rule' });
      }
    }
  );

  // ============================================
  // PRICING OVERRIDES
  // ============================================

  // Get pricing overrides for a franchise
  fastify.get(
    '/franchises/:franchiseId/pricing-overrides',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const {

        // Verify franchise belongs to owner
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
          return [];
        }

        const overrides = await prisma.pricingOverride.findMany({
          where: { franchiseConfigId: config.id },
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
            approvedBy: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        return overrides;
      } catch (error: any) {
        console.error('Failed to load pricing overrides:', error);
        reply.code(500).send({ error: 'Failed to load pricing overrides' });
      }
    }
  );

  // Create pricing override (with lock check)
  fastify.post(
    '/pricing-overrides',
    { preHandler: [fastify.authenticate] },
    async (request: any, reply: FastifyReply) => {
      try {
        const data = pricingOverrideSchema.parse(request.body as any);
        const userId = (getUser(request) as any).userId;
        const storeId = (getUser(request) as any).storeId;

        // Check if pricing is locked for this franchise
        const config = await prisma.franchiseConfig.findUnique({
          where: { id: data.franchiseConfigId },
          include: {
            franchiseStore: true,
          },
        });

        if (!config) {
          reply.code(404).send({ error: 'Franchise config not found' });
          return;
        }

        // Verify store access
        if (config.franchiseStore.parentOwnerStoreId !== storeId && config.franchiseStoreId !== storeId) {
          reply.code(403).send({ error: 'Access denied' });
          return;
        }

        // Check if pricing is locked by HQ
        if (config.isPricingLocked) {
          reply.code(403).send({ 
            error: 'Pricing is locked by HQ. Override requests are not allowed.',
            locked: true,
            lockedBy: config.lockedBy,
            lockedAt: config.lockedAt,
          });
          return;
        }

        // Check if product has HQ lock
        const productMaster = await prisma.productMaster.findUnique({
          where: { productId: data.productId },
        });

        if (productMaster?.isHQLocked) {
          reply.code(403).send({ 
            error: 'Product pricing is locked by HQ. Override requests are not allowed.',
            locked: true,
          });
          return;
        }

        // Create audit log
        await prisma.auditLog.create({
          data: {
            storeId: config.franchiseStoreId,
            actorUserId: userId,
            action: 'PRICING_OVERRIDE_REQUESTED',
            entityType: 'PricingOverride',
            metaJson: {
              productId: data.productId,
              overridePrice: data.overridePrice,
              reason: data.reason,
            } as any,
          } as any,
        });

        const override = await prisma.pricingOverride.create({
          data: {
            ...data,
            effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
            effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
            lockStatus: 'UNLOCKED', // Override starts as unlocked, HQ can lock it
          } as any,
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        });

        return override;
      } catch (error: any) {
        console.error('Failed to create pricing override:', error);
        reply.code(500).send({ error: 'Failed to create pricing override' });
      }
    }
  );

  // Approve pricing override
  fastify.patch(
    '/pricing-overrides/:id/approve',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const userId = (getUser(request) as any).userId;
        const { id } = (request.params as any);

        const override = await prisma.pricingOverride.findUnique({
          where: { id },
        });

        if (!override) {
          reply.code(404).send({ error: 'Pricing override not found' });
          return;
        }

        const updated = await prisma.pricingOverride.update({
          where: { id },
          data: {
            approvedByHQ: true,
            approvedByUserId: userId,
            approvedAt: new Date(),
          },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to approve pricing override:', error);
        reply.code(500).send({ error: 'Failed to approve pricing override' });
      }
    }
  );

  // Lock/unlock pricing
  fastify.patch(
    '/pricing-overrides/:id/lock',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const { id } = (request.params as any);
        const { lockStatus } = (request.body as any);

        const updated = await prisma.pricingOverride.update({
          where: { id },
          data: {
            lockStatus: lockStatus as any,
          },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to update lock status:', error);
        reply.code(500).send({ error: 'Failed to update lock status' });
      }
    }
  );
}

