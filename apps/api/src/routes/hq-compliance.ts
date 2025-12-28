// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { z } from 'zod';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

const complianceRecordSchema = z.object({
  franchiseConfigId: z.string(),
  checkType: z.enum(['DAILY_CLEANING', 'TEMPERATURE_LOG', 'PHOTO_PROOF', 'LICENSE_EXPIRY', 'DOCUMENT_EXPIRY']),
  status: z.enum(['COMPLIANT', 'WARNING', 'NON_COMPLIANT']),
  temperature: z.number().optional(),
  photoUrl: z.string().url().optional(),
  documentUrl: z.string().url().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
});

export async function hqComplianceRoutes(fastify: FastifyInstance) {
  // Get compliance records for a franchise
  fastify.get(
    '/compliance/records',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const {

        const where: any = {};
        if (franchiseConfigId) {
          where.franchiseConfigId = franchiseConfigId;
        }
        if (checkType) {
          where.checkType = checkType;
        }
        if (status) {
          where.status = status;
        }

        const records = await prisma.complianceRecord.findMany({
          where,
          include: {
            franchiseConfig: {
              include: {
                franchiseStore: {
                  select: { id: true, name: true, parentOwnerStoreId: true },
                },
              },
            },
            checker: {
              select: { id: true, name: true },
            },
          },
          orderBy: { checkedAt: 'desc' },
        });

        // Filter by owner store
        const filteredRecords = records.filter(
          (r) => r.franchiseConfig.franchiseStore.parentOwnerStoreId === ownerStoreId
        );

        return filteredRecords;
      } catch (error: any) {
        console.error('Failed to load compliance records:', error);
        reply.code(500).send({ error: 'Failed to load compliance records' });
      }
    }
  );

  // Create compliance record
  fastify.post(
    '/compliance/records',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const userId = (getUser(request) as any).userId;
        const data = complianceRecordSchema.parse(request.body as any);

        // Verify franchise config belongs to owner
        const config = await prisma.franchiseConfig.findUnique({
          where: { id: data.franchiseConfigId },
          include: {
            franchiseStore: true,
          },
        });

        if (!config || config.franchiseStore.parentOwnerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Franchise config not found' });
          return;
        }

        const record = await prisma.complianceRecord.create({
          data: {
            ...data,
            checkedBy: userId,
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          } as any,
          include: {
            franchiseConfig: {
              include: {
                franchiseStore: {
                  select: { id: true, name: true, parentOwnerStoreId: true },
                },
              },
            },
            checker: {
              select: { id: true, name: true },
            },
          },
        });

        // Create alert if non-compliant
        if (data.status === 'NON_COMPLIANT') {
          await prisma.hQAlert.create({
            data: {
              ownerStoreId,
              franchiseStoreId: config.franchiseStoreId,
              alertType: 'COMPLIANCE_FAILURE',
              severity: 'HIGH',
              title: `Compliance Failure: ${data.checkType}`,
              message: `Franchise ${config.franchiseStore.name} failed ${data.checkType} check`,
              metadata: {
                complianceRecordId: record.id,
                checkType: data.checkType,
              },
            },
          });
        }

        return record;
      } catch (error: any) {
        console.error('Failed to create compliance record:', error);
        reply.code(500).send({ error: 'Failed to create compliance record' });
      }
    }
  );

  // Get compliance score for a franchise
  fastify.get(
    '/compliance/score/:franchiseConfigId',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const {

        const config = await prisma.franchiseConfig.findUnique({
          where: { id: franchiseConfigId },
          include: {
            franchiseStore: true,
          },
        });

        if (!config || config.franchiseStore.parentOwnerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Franchise config not found' });
          return;
        }

        // Get recent compliance records (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const records = await prisma.complianceRecord.findMany({
          where: {
            franchiseConfigId,
            checkedAt: {
              gte: thirtyDaysAgo,
            },
          },
        });

        // Calculate average score
        const scores = records.filter((r: any) => r.score !== null).map((r) => r.score!);
        const avgScore = scores.length > 0 ? scores.reduce((sum: any, s: any) => sum + s, 0) / scores.length : 0;

        // Count by status
        const compliantCount = records.filter((r: any) => r.status === 'COMPLIANT').length;
        const warningCount = records.filter((r: any) => r.status === 'WARNING').length;
        const nonCompliantCount = records.filter((r: any) => r.status === 'NON_COMPLIANT').length;

        // Count by check type
        const checkTypeCounts = records.reduce((acc: any, r) => {
          acc[r.checkType] = (acc[r.checkType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return {
          franchiseConfigId,
          franchiseName: config.franchiseStore.name,
          averageScore: Math.round(avgScore),
          totalChecks: records.length,
          compliantCount,
          warningCount,
          nonCompliantCount,
          checkTypeCounts,
          recentRecords: records.slice(0, 10),
        };
      } catch (error: any) {
        console.error('Failed to load compliance score:', error);
        reply.code(500).send({ error: 'Failed to load compliance score' });
      }
    }
  );

  // Get compliance summary for all franchises
  fastify.get(
    '/compliance/summary',
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
                complianceRecords: {
                  where: {
                    checkedAt: {
                      gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    },
                  },
                  orderBy: { checkedAt: 'desc' },
                  take: 10,
                },
              },
            },
          },
        });

        const summary = await Promise.all(
          franchises
            .filter((f: any) => f.franchiseConfig)
            .map(async (franchise: any) => {
              const config = franchise.franchiseConfig!;
              const records = config.complianceRecords;

              const scores = records.filter((r: any) => r.score !== null).map((r) => r.score!);
              const avgScore = scores.length > 0 ? scores.reduce((sum: any, s: any) => sum + s, 0) / scores.length : 0;

              const compliantCount = records.filter((r: any) => r.status === 'COMPLIANT').length;
              const warningCount = records.filter((r: any) => r.status === 'WARNING').length;
              const nonCompliantCount = records.filter((r: any) => r.status === 'NON_COMPLIANT').length;

              return {
                franchiseId: franchise.id,
                franchiseName: franchise.name,
                averageScore: Math.round(avgScore),
                totalChecks: records.length,
                compliantCount,
                warningCount,
                nonCompliantCount,
                status: avgScore >= 80 ? 'COMPLIANT' : avgScore >= 60 ? 'WARNING' : 'NON_COMPLIANT',
              };
            })
        );

        return summary;
      } catch (error: any) {
        console.error('Failed to load compliance summary:', error);
        reply.code(500).send({ error: 'Failed to load compliance summary' });
      }
    }
  );

  // ============================================
  // CHECKLIST TEMPLATES
  // ============================================

  // Get all checklist templates
  fastify.get(
    '/compliance/templates',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const {

        const where: any = { ownerStoreId, isActive: true };
        if (checkType) {
          where.checkType = checkType;
        }

        const templates = await prisma.complianceChecklistTemplate.findMany({
          where,
          orderBy: { createdAt: 'desc' },
        });

        return templates;
      } catch (error: any) {
        console.error('Failed to load templates:', error);
        reply.code(500).send({ error: 'Failed to load templates' });
      }
    }
  );

  // Create checklist template
  fastify.post(
    '/compliance/templates',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Body: {
          name: string;
          checkType: string;
          items: any[];
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const {

        const template = await prisma.complianceChecklistTemplate.create({
          data: {
            ownerStoreId,
            name,
            checkType: checkType as any,
            items,
          },
        });

        return template;
      } catch (error: any) {
        console.error('Failed to create template:', error);
        reply.code(500).send({ error: 'Failed to create template' });
      }
    }
  );

  // Review store submission
  fastify.patch(
    '/compliance/records/:id/review',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          status: string;
          score?: number;
          notes?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = (getUser(request) as any).userId;
        const {
        const {

        const record = await prisma.complianceRecord.findUnique({
          where: { id },
          include: {
            franchiseConfig: {
              include: {
                franchiseStore: true,
              },
            },
          },
        });

        if (!record) {
          reply.code(404).send({ error: 'Compliance record not found' });
          return;
        }

        const updated = await prisma.complianceRecord.update({
          where: { id },
          data: {
            status: status as any,
            score: score || record.score,
            notes: notes || record.notes,
            reviewedBy: userId,
            reviewedAt: new Date(),
          },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to review record:', error);
        reply.code(500).send({ error: 'Failed to review record' });
      }
    }
  );

  // Get document expiry alerts
  fastify.get(
    '/compliance/expiry-alerts',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = (getUser(request) as any).storeId;
        const daysAhead = parseInt((request.query as any).daysAhead || '30');

        const alertDate = new Date();
        alertDate.setDate(alertDate.getDate() + daysAhead);

        const records = await prisma.complianceRecord.findMany({
          where: {
            expiryDate: {
              lte: alertDate,
              gte: new Date(),
            },
            checkType: {
              in: ['LICENSE_EXPIRY', 'DOCUMENT_EXPIRY'],
            },
          },
          include: {
            franchiseConfig: {
              include: {
                franchiseStore: {
                  select: { id: true, name: true, parentOwnerStoreId: true },
                },
              },
            },
          },
          orderBy: { expiryDate: 'asc' },
        });

        // Filter by owner store
        const filteredRecords = records.filter(
          (r) => r.franchiseConfig.franchiseStore.parentOwnerStoreId === ownerStoreId
        );

        // Create alerts for expiring documents (check if alert already exists)
        for (const record of filteredRecords) {
          const daysUntilExpiry = Math.ceil(
            (record.expiryDate!.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );

          // Check if alert already exists
          const existingAlert = await prisma.hQAlert.findFirst({
            where: {
              ownerStoreId,
              franchiseStoreId: record.franchiseConfig.franchiseStoreId,
              alertType: 'DOCUMENT_EXPIRY' as any,
              metadata: {
                path: ['complianceRecordId'],
                equals: record.id,
              },
              isResolved: false,
            },
          });

          if (!existingAlert) {
            await prisma.hQAlert.create({
              data: {
                ownerStoreId,
                franchiseStoreId: record.franchiseConfig.franchiseStoreId,
                alertType: 'DOCUMENT_EXPIRY' as any,
                severity: daysUntilExpiry <= 7 ? 'HIGH' : daysUntilExpiry <= 14 ? 'MEDIUM' : 'LOW',
                title: `Document Expiring: ${record.checkType}`,
                message: `${record.franchiseConfig.franchiseStore.name} has ${record.checkType} expiring in ${daysUntilExpiry} days`,
                metadata: {
                  complianceRecordId: record.id,
                  expiryDate: record.expiryDate,
                  daysUntilExpiry,
                },
              },
            });
          }
        }

        return filteredRecords;
      } catch (error: any) {
        console.error('Failed to load expiry alerts:', error);
        reply.code(500).send({ error: 'Failed to load expiry alerts' });
      }
    }
  );
}

