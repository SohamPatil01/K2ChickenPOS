import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { requireRole } from '../utils/auth.js';

export async function hqFraudAlertsRoutes(fastify: FastifyInstance) {
  // ============================================
  // ALERT RULES
  // ============================================

  // Get all alert rules
  fastify.get(
    '/alert-rules',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const ownerStoreId = request.user!.storeId;

        const rules = await prisma.alertRule.findMany({
          where: { ownerStoreId },
          orderBy: { createdAt: 'desc' },
        });

        return rules;
      } catch (error: any) {
        console.error('Failed to load alert rules:', error);
        reply.code(500).send({ error: 'Failed to load alert rules' });
      }
    }
  );

  // Create alert rule
  fastify.post(
    '/alert-rules',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Body: {
          name: string;
          ruleType: string;
          threshold: number;
          severity: string;
          description?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = request.user!.storeId;
        const { name, ruleType, threshold, severity, description } = request.body;

        const rule = await prisma.alertRule.create({
          data: {
            ownerStoreId,
            name,
            ruleType,
            threshold,
            severity: severity as any,
            description,
          },
        });

        return rule;
      } catch (error: any) {
        console.error('Failed to create alert rule:', error);
        reply.code(500).send({ error: 'Failed to create alert rule' });
      }
    }
  );

  // Update alert rule
  fastify.put(
    '/alert-rules/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          name?: string;
          threshold?: number;
          severity?: string;
          isActive?: boolean;
          description?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = request.user!.storeId;
        const { id } = request.params;
        const body = request.body;

        const rule = await prisma.alertRule.findUnique({
          where: { id },
        });

        if (!rule || rule.ownerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Alert rule not found' });
          return;
        }

        const updated = await prisma.alertRule.update({
          where: { id },
          data: body,
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to update alert rule:', error);
        reply.code(500).send({ error: 'Failed to update alert rule' });
      }
    }
  );

  // Delete alert rule
  fastify.delete(
    '/alert-rules/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const ownerStoreId = request.user!.storeId;
        const { id } = request.params;

        const rule = await prisma.alertRule.findUnique({
          where: { id },
        });

        if (!rule || rule.ownerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Alert rule not found' });
          return;
        }

        await prisma.alertRule.delete({
          where: { id },
        });

        return { message: 'Alert rule deleted successfully' };
      } catch (error: any) {
        console.error('Failed to delete alert rule:', error);
        reply.code(500).send({ error: 'Failed to delete alert rule' });
      }
    }
  );

  // ============================================
  // ALERT GENERATION (CRON JOB)
  // ============================================

  // Generate alerts based on rules
  fastify.post(
    '/alerts/generate',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const ownerStoreId = request.user!.storeId;

        const rules = await prisma.alertRule.findMany({
          where: {
            ownerStoreId,
            isActive: true,
          },
        });

        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: ownerStoreId,
          },
          include: {
            franchiseConfig: true,
          },
        });

        const results = {
          alertsCreated: 0,
          errors: [] as string[],
        };

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        for (const franchise of franchises) {
          if (!franchise.franchiseConfig) continue;

          const config = franchise.franchiseConfig;

          for (const rule of rules) {
            try {
              let shouldAlert = false;
              let alertTitle = '';
              let alertMessage = '';
              let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
              const metadata: any = { ruleId: rule.id, ruleType: rule.ruleType };

              switch (rule.ruleType) {
                case 'HIGH_WASTAGE': {
                  const wastageLedgers = await prisma.inventoryLedger.findMany({
                    where: {
                      storeId: franchise.id,
                      reason: 'WASTAGE',
                      createdAt: { gte: thirtyDaysAgo },
                    },
                  });

                  const receivedLedgers = await prisma.inventoryLedger.findMany({
                    where: {
                      storeId: franchise.id,
                      type: 'IN',
                      reason: 'RECEIVE',
                      createdAt: { gte: thirtyDaysAgo },
                    },
                  });

                  const totalWastage = wastageLedgers.reduce((sum, l) => sum + (l.qtyKg || 0) + (l.qtyPcs || 0), 0);
                  const totalReceived = receivedLedgers.reduce((sum, l) => sum + (l.qtyKg || 0) + (l.qtyPcs || 0), 0);
                  const wastagePercent = totalReceived > 0 ? (totalWastage / totalReceived) * 100 : 0;

                  shouldAlert = wastagePercent > rule.threshold;
                  alertTitle = 'High Wastage Detected';
                  alertMessage = `${franchise.name} has wastage of ${wastagePercent.toFixed(2)}% (threshold: ${rule.threshold}%)`;
                  severity = wastagePercent > rule.threshold * 1.5 ? 'HIGH' : 'MEDIUM';
                  metadata.wastagePercent = wastagePercent;
                  break;
                }

                case 'FREQUENT_OVERRIDES': {
                  const overrideCount = await prisma.discountOverride.count({
                    where: {
                      storeId: franchise.id,
                      status: 'APPROVED',
                      createdAt: { gte: thirtyDaysAgo },
                    },
                  });

                  shouldAlert = overrideCount > rule.threshold;
                  alertTitle = 'Frequent Discount Overrides';
                  alertMessage = `${franchise.name} has ${overrideCount} approved overrides in last 30 days (threshold: ${rule.threshold})`;
                  severity = overrideCount > rule.threshold * 2 ? 'HIGH' : 'MEDIUM';
                  metadata.overrideCount = overrideCount;
                  break;
                }

                case 'BILL_WEIGHT_ANOMALY': {
                  const sales = await prisma.sale.findMany({
                    where: {
                      storeId: franchise.id,
                      status: 'PAID',
                      createdAt: { gte: thirtyDaysAgo },
                    },
                    include: {
                      items: {
                        include: {
                          product: true,
                        },
                      },
                    },
                  });

                  const avgBillWeight = sales.length > 0
                    ? sales.reduce((sum, s) => {
                        const billWeight = s.items.reduce((itemSum, item) => {
                          if (item.product.unitType === 'KG') {
                            return itemSum + (item.qtyKg || 0);
                          }
                          return itemSum;
                        }, 0);
                        return sum + billWeight;
                      }, 0) / sales.length
                    : 0;

                  // Check if average bill weight is significantly different from threshold
                  const variance = Math.abs(avgBillWeight - rule.threshold);
                  shouldAlert = variance > rule.threshold * 0.3; // 30% variance
                  alertTitle = 'Bill Weight Anomaly';
                  alertMessage = `${franchise.name} has average bill weight of ${avgBillWeight.toFixed(2)}kg (expected: ${rule.threshold}kg)`;
                  severity = variance > rule.threshold * 0.5 ? 'HIGH' : 'MEDIUM';
                  metadata.avgBillWeight = avgBillWeight;
                  metadata.expectedWeight = rule.threshold;
                  break;
                }

                case 'STOCK_MISMATCH': {
                  // Compare expected stock vs actual stock
                  const products = await prisma.product.findMany({
                    where: {
                      ownerStoreId,
                      isActive: true,
                    },
                  });

                  let mismatchCount = 0;
                  for (const product of products) {
                    const ledgers = await prisma.inventoryLedger.findMany({
                      where: {
                        storeId: franchise.id,
                        productId: product.id,
                      },
                    });

                    let actualStock = 0;
                    for (const ledger of ledgers) {
                      if (ledger.type === 'IN') {
                        actualStock += ledger.qtyKg || 0;
                      } else {
                        actualStock -= ledger.qtyKg || 0;
                      }
                    }

                    // Get expected from allocations
                    const allocations = await prisma.stockAllocation.findMany({
                      where: {
                        allocatedToStoreId: franchise.id,
                        productId: product.id,
                      },
                    });

                    const expectedStock = allocations.reduce(
                      (sum, a) => sum + (a.allocatedQtyKg || 0),
                      0
                    );

                    const variance = Math.abs(actualStock - expectedStock);
                    if (variance > rule.threshold) {
                      mismatchCount++;
                    }
                  }

                  shouldAlert = mismatchCount > 0;
                  alertTitle = 'Stock Mismatch Detected';
                  alertMessage = `${franchise.name} has ${mismatchCount} products with stock variance > ${rule.threshold}kg`;
                  severity = mismatchCount > 5 ? 'HIGH' : 'MEDIUM';
                  metadata.mismatchCount = mismatchCount;
                  break;
                }
              }

              if (shouldAlert) {
                // Check if alert already exists
                const existingAlert = await prisma.hQAlert.findFirst({
                  where: {
                    ownerStoreId,
                    franchiseStoreId: franchise.id,
                    alertType: rule.ruleType as any,
                    isResolved: false,
                    createdAt: {
                      gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                    },
                  },
                });

                if (!existingAlert) {
                  await prisma.hQAlert.create({
                    data: {
                      ownerStoreId,
                      franchiseStoreId: franchise.id,
                      alertType: rule.ruleType as any,
                      severity,
                      title: alertTitle,
                      message: alertMessage,
                      metadata,
                    },
                  });
                  results.alertsCreated++;
                }
              }
            } catch (error: any) {
              results.errors.push(`${franchise.name} - ${rule.name}: ${error.message}`);
            }
          }
        }

        return results;
      } catch (error: any) {
        console.error('Failed to generate alerts:', error);
        reply.code(500).send({ error: 'Failed to generate alerts' });
      }
    }
  );

  // Acknowledge alert
  fastify.patch(
    '/alerts/:id/acknowledge',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: {
          notes: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = request.user!.storeId;
        const userId = request.user!.userId;
        const { id } = request.params;
        const { notes } = request.body;

        if (!notes || notes.trim() === '') {
          reply.code(400).send({ error: 'Acknowledgment notes are required' });
          return;
        }

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
            acknowledgedBy: userId,
            acknowledgedAt: new Date(),
            acknowledgmentNotes: notes,
          },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to acknowledge alert:', error);
        reply.code(500).send({ error: 'Failed to acknowledge alert' });
      }
    }
  );
}

