import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { z } from 'zod';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

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

export async function hqRoyaltyRoutes(fastify: FastifyInstance) {
  // Calculate royalty for a franchise
  fastify.post(
    '/royalty/calculate',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Body: {
          franchiseConfigId: string;
          periodStart: string;
          periodEnd: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = getUser(request).storeId;
        const { franchiseConfigId, periodStart, periodEnd } = request.body;

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

        const dateFilter = getDateRange(periodStart, periodEnd);

        // Get all sales for the period
        const sales = await prisma.sale.findMany({
          where: {
            storeId: config.franchiseStoreId,
            status: 'PAID',
            createdAt: dateFilter,
          },
        });

        // Calculate gross sales (total revenue before any deductions)
        const grossSales = sales.reduce((sum: any, s: any) => sum + s.grandTotal, 0);
        
        // Calculate total discounts
        const totalDiscounts = sales.reduce((sum: any, s: any) => sum + s.discountTotal, 0);
        
        // Calculate wastage (must be fetched before using it)
        const wastageLedgers = await prisma.inventoryLedger.findMany({
          where: {
            storeId: config.franchiseStoreId,
            reason: 'WASTAGE',
            createdAt: dateFilter,
          },
        });
        
        // Calculate total wastage value (cost of wasted inventory)
        const wastageValue = wastageLedgers.reduce((sum: any, ledger) => {
          // Get product price at time of wastage (simplified - use current price)
          // In production, you'd want to track the actual cost at time of wastage
          return sum + ((ledger.qtyKg || 0) + (ledger.qtyPcs || 0)) * 100; // Placeholder: ₹100/kg
        }, 0);
        
        // Net Sales Formula:
        // If NET_SALES base: Gross Sales - Discounts - Wastage Value
        // If GROSS_SALES base: Gross Sales (no deductions)
        const netSales = config.royaltyCalculationBase === 'NET_SALES' 
          ? grossSales - totalDiscounts - wastageValue
          : grossSales;

        const totalWastage = wastageLedgers.reduce(
          (sum, ledger) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
          0
        );

        // Get total received to calculate wastage percentage
        const totalReceived = await prisma.inventoryLedger.aggregate({
          where: {
            storeId: config.franchiseStoreId,
            type: 'IN',
            reason: 'RECEIVE',
            createdAt: dateFilter,
          },
          _sum: {
            qtyKg: true,
            qtyPcs: true,
          },
        });

        const totalReceivedKg = (totalReceived._sum.qtyKg || 0) + (totalReceived._sum.qtyPcs || 0);
        const wastagePercent = totalReceivedKg > 0 ? (totalWastage / totalReceivedKg) * 100 : 0;

        // Calculate penalties
        const allowedWastagePercent = config.allowedWastagePercent || 5.0;
        const excessWastage = Math.max(0, wastagePercent - allowedWastagePercent);
        const wastagePenalty = excessWastage > 0 ? grossSales * (excessWastage / 100) * 0.1 : 0; // 10% of excess wastage value

        // Check for pricing violations (simplified - check if prices match HQ locked prices)
        let pricingViolationPenalty = 0;
        // TODO: Implement pricing violation detection logic

        // Check compliance
        const complianceRecords = await prisma.complianceRecord.findMany({
          where: {
            franchiseConfigId,
            checkedAt: dateFilter,
            status: 'NON_COMPLIANT',
          },
        });

        const compliancePenalty = complianceRecords.length * 1000; // Fixed penalty per violation

        // Calculate base royalty
        const royaltyBase = config.royaltyCalculationBase === 'NET_SALES' ? netSales : grossSales;
        const baseRoyalty = royaltyBase * (config.royaltyPercentage / 100);

        // Total royalty = base - penalties (ensure non-negative)
        const totalRoyalty = Math.max(0, baseRoyalty - wastagePenalty - pricingViolationPenalty - compliancePenalty);

        // Generate invoice number
        const year = new Date(periodStart).getFullYear();
        const month = String(new Date(periodStart).getMonth() + 1).padStart(2, '0');
        const invoiceNo = `ROY-${config.franchiseStoreId.substring(0, 6)}-${year}-${month}`;

        // Create or update royalty invoice
        const invoice = await prisma.royaltyInvoice.upsert({
          where: {
            franchiseConfigId_invoiceNo: {
              franchiseConfigId,
              invoiceNo,
            },
          },
          update: {
            grossSales,
            netSales,
            totalDiscounts,
            totalWastage,
            wastagePenalty,
            pricingViolationPenalty,
            compliancePenalty,
            baseRoyalty,
            totalRoyalty,
            status: 'CALCULATED',
          },
          create: {
            franchiseConfigId,
            invoiceNo,
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
            grossSales,
            netSales,
            totalDiscounts,
            totalWastage,
            wastagePenalty,
            pricingViolationPenalty,
            compliancePenalty,
            baseRoyalty,
            totalRoyalty,
            dueDate: new Date(periodEnd),
            status: 'CALCULATED',
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
        });

        // Create ledger entries for audit trail
        await prisma.royaltyLedger.create({
          data: {
            franchiseConfigId,
            invoiceId: invoice.id,
            type: 'ROYALTY',
            amount: baseRoyalty,
            description: `Base royalty for period ${new Date(periodStart).toLocaleDateString()} - ${new Date(periodEnd).toLocaleDateString()}`,
            createdBy: getUser(request).userId,
          },
        });

        if (wastagePenalty > 0) {
          await prisma.royaltyLedger.create({
            data: {
              franchiseConfigId,
              invoiceId: invoice.id,
              type: 'PENALTY',
              amount: -wastagePenalty,
              description: `Wastage penalty: ${excessWastage.toFixed(2)}% excess (allowed: ${allowedWastagePercent}%)`,
              createdBy: getUser(request).userId,
            },
          });
        }

        if (pricingViolationPenalty > 0) {
          await prisma.royaltyLedger.create({
            data: {
              franchiseConfigId,
              invoiceId: invoice.id,
              type: 'PENALTY',
              amount: -pricingViolationPenalty,
              description: 'Pricing violation penalty',
              createdBy: getUser(request).userId,
            },
          });
        }

        if (compliancePenalty > 0) {
          await prisma.royaltyLedger.create({
            data: {
              franchiseConfigId,
              invoiceId: invoice.id,
              type: 'PENALTY',
              amount: -compliancePenalty,
              description: `Compliance penalty: ${complianceRecords.length} violation(s)`,
              createdBy: getUser(request).userId,
            },
          });
        }

        return invoice;
      } catch (error: any) {
        console.error('Failed to calculate royalty:', error);
        reply.code(500).send({ error: 'Failed to calculate royalty' });
      }
    }
  );

  // Get all royalty invoices
  fastify.get(
    '/royalty/invoices',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = getUser(request).storeId;
        const { franchiseConfigId, status } = request.query;

        const where: any = {};
        if (franchiseConfigId) {
          where.franchiseConfigId = franchiseConfigId;
        }
        if (status) {
          where.status = status;
        }

        const invoices = await prisma.royaltyInvoice.findMany({
          where,
          include: {
            franchiseConfig: {
              include: {
                franchiseStore: {
                  select: { id: true, name: true, parentOwnerStoreId: true },
                },
              },
            },
          },
          orderBy: { periodStart: 'desc' },
        });

        // Filter by owner store
        const filteredInvoices = invoices.filter(
          (inv) => inv.franchiseConfig.franchiseStore.parentOwnerStoreId === ownerStoreId
        );

        return filteredInvoices;
      } catch (error: any) {
        console.error('Failed to load royalty invoices:', error);
        reply.code(500).send({ error: 'Failed to load royalty invoices' });
      }
    }
  );

  // Get single royalty invoice
  fastify.get(
    '/royalty/invoices/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = getUser(request).storeId;
        const { id } = request.params;

        const invoice = await prisma.royaltyInvoice.findUnique({
          where: { id },
          include: {
            franchiseConfig: {
              include: {
                franchiseStore: {
                  select: { id: true, name: true, parentOwnerStoreId: true },
                },
              },
            },
          },
        });

        if (!invoice || invoice.franchiseConfig.franchiseStore.parentOwnerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Invoice not found' });
          return;
        }

        return invoice;
      } catch (error: any) {
        console.error('Failed to load royalty invoice:', error);
        reply.code(500).send({ error: 'Failed to load royalty invoice' });
      }
    }
  );

  // Mark invoice as invoiced
  fastify.patch(
    '/royalty/invoices/:id/invoice',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const ownerStoreId = getUser(request).storeId;
        const { id } = request.params;

        const invoice = await prisma.royaltyInvoice.findUnique({
          where: { id },
          include: {
            franchiseConfig: {
              include: {
                franchiseStore: true,
              },
            },
          },
        });

        if (!invoice || invoice.franchiseConfig.franchiseStore.parentOwnerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Invoice not found' });
          return;
        }

        const updated = await prisma.royaltyInvoice.update({
          where: { id },
          data: { status: 'INVOICED' },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to mark invoice as invoiced:', error);
        reply.code(500).send({ error: 'Failed to mark invoice as invoiced' });
      }
    }
  );

  // Mark invoice as paid
  fastify.patch(
    '/royalty/invoices/:id/pay',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { paymentReference?: string; notes?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = getUser(request).storeId;
        const { id } = request.params;
        const { paymentReference, notes } = request.body;

        const invoice = await prisma.royaltyInvoice.findUnique({
          where: { id },
          include: {
            franchiseConfig: {
              include: {
                franchiseStore: true,
              },
            },
          },
        });

        if (!invoice || invoice.franchiseConfig.franchiseStore.parentOwnerStoreId !== ownerStoreId) {
          reply.code(404).send({ error: 'Invoice not found' });
          return;
        }

        const updated = await prisma.royaltyInvoice.update({
          where: { id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
            paymentReference,
            notes,
          },
        });

        return updated;
      } catch (error: any) {
        console.error('Failed to mark invoice as paid:', error);
        reply.code(500).send({ error: 'Failed to mark invoice as paid' });
      }
    }
  );

  // Auto-calculate royalties for all franchises (monthly)
  fastify.post(
    '/royalty/calculate-all',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Body: {
          periodStart: string;
          periodEnd: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = getUser(request).storeId;
        const { periodStart, periodEnd } = request.body;

        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: ownerStoreId,
          },
          include: {
            franchiseConfig: true,
          },
        });

        const results = await Promise.allSettled(
          franchises
            .filter((f: any) => f.franchiseConfig)
            .map(async (franchise: any) => {
              const config = franchise.franchiseConfig!;

              // Reuse calculation logic from calculate endpoint
              const dateFilter = getDateRange(periodStart, periodEnd);

              const sales = await prisma.sale.findMany({
                where: {
                  storeId: franchise.id,
                  status: 'PAID',
                  createdAt: dateFilter,
                },
              });

              const grossSales = sales.reduce((sum: any, s: any) => sum + s.grandTotal, 0);
              const totalDiscounts = sales.reduce((sum: any, s: any) => sum + s.discountTotal, 0);
              const netSales = grossSales - totalDiscounts;

              const wastageLedgers = await prisma.inventoryLedger.findMany({
                where: {
                  storeId: franchise.id,
                  reason: 'WASTAGE',
                  createdAt: dateFilter,
                },
              });

              const totalWastage = wastageLedgers.reduce(
                (sum, ledger) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
                0
              );

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

              const totalReceivedKg = (totalReceived._sum.qtyKg || 0) + (totalReceived._sum.qtyPcs || 0);
              const wastagePercent = totalReceivedKg > 0 ? (totalWastage / totalReceivedKg) * 100 : 0;

              const allowedWastagePercent = config.allowedWastagePercent || 5.0;
              const excessWastage = Math.max(0, wastagePercent - allowedWastagePercent);
              const wastagePenalty = excessWastage > 0 ? grossSales * (excessWastage / 100) * 0.1 : 0;

              const complianceRecords = await prisma.complianceRecord.findMany({
                where: {
                  franchiseConfigId: config.id,
                  checkedAt: dateFilter,
                  status: 'NON_COMPLIANT',
                },
              });

              const compliancePenalty = complianceRecords.length * 1000;

              const royaltyBase = config.royaltyCalculationBase === 'NET_SALES' ? netSales : grossSales;
              const baseRoyalty = royaltyBase * (config.royaltyPercentage / 100);
              const totalRoyalty = baseRoyalty - wastagePenalty - compliancePenalty;

              const invoiceNo = `ROY-${franchise.id.substring(0, 6)}-${new Date(periodStart).getFullYear()}-${new Date(periodStart).getMonth() + 1}`;

              return await prisma.royaltyInvoice.upsert({
                where: {
                  franchiseConfigId_invoiceNo: {
                    franchiseConfigId: config.id,
                    invoiceNo,
                  },
                },
                update: {
                  grossSales,
                  netSales,
                  totalDiscounts,
                  totalWastage,
                  wastagePenalty,
                  compliancePenalty,
                  baseRoyalty,
                  totalRoyalty,
                  status: 'CALCULATED',
                },
                create: {
                  franchiseConfigId: config.id,
                  invoiceNo,
                  periodStart: new Date(periodStart),
                  periodEnd: new Date(periodEnd),
                  grossSales,
                  netSales,
                  totalDiscounts,
                  totalWastage,
                  wastagePenalty,
                  compliancePenalty,
                  baseRoyalty,
                  totalRoyalty,
                  dueDate: new Date(periodEnd),
                  status: 'CALCULATED',
                },
              });
            })
        );

        const successful = results.filter((r: any) => r.status === 'fulfilled').length;
        const failed = results.filter((r: any) => r.status === 'rejected').length;

        return {
          message: `Calculated royalties for ${successful} franchises`,
          successful,
          failed,
          results: results.map((r, i) => ({
            franchiseId: franchises[i].id,
            status: r.status,
            error: r.status === 'rejected' ? (r as any).reason?.message : null,
          })),
        };
      } catch (error: any) {
        console.error('Failed to calculate all royalties:', error);
        reply.code(500).send({ error: 'Failed to calculate all royalties' });
      }
    }
  );

  // Monthly royalty calculation job (for all franchises)
  fastify.post(
    '/royalty/calculate-monthly',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Body: {
          year?: number;
          month?: number;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = getUser(request).storeId;
        const { year, month } = request.body;

        // Default to previous month if not specified
        const now = new Date();
        const targetYear = year || (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
        const targetMonth = month || (now.getMonth() === 0 ? 12 : now.getMonth());

        const periodStart = new Date(targetYear, targetMonth - 1, 1);
        const periodEnd = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

        // Get all franchise configs
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
          successful: 0,
          failed: 0,
          errors: [] as string[],
        };

        // Calculate for each franchise
        for (const franchise of franchises) {
          if (!franchise.franchiseConfig) {
            results.failed++;
            results.errors.push(`${franchise.name}: No franchise config found`);
            continue;
          }

          try {
            // Reuse the calculation logic
            const dateFilter = {
              gte: periodStart,
              lte: periodEnd,
            };

            const sales = await prisma.sale.findMany({
              where: {
                storeId: franchise.id,
                status: 'PAID',
                createdAt: dateFilter,
              },
            });

            const grossSales = sales.reduce((sum: any, s: any) => sum + s.grandTotal, 0);
            const totalDiscounts = sales.reduce((sum: any, s: any) => sum + s.discountTotal, 0);

            const wastageLedgers = await prisma.inventoryLedger.findMany({
              where: {
                storeId: franchise.id,
                reason: 'WASTAGE',
                createdAt: dateFilter,
              },
            });

            const wastageValue = wastageLedgers.reduce((sum: any, ledger) => {
              return sum + ((ledger.qtyKg || 0) + (ledger.qtyPcs || 0)) * 100;
            }, 0);

            const netSales = franchise.franchiseConfig.royaltyCalculationBase === 'NET_SALES'
              ? grossSales - totalDiscounts - wastageValue
              : grossSales;

            const totalWastage = wastageLedgers.reduce(
              (sum, ledger) => sum + (ledger.qtyKg || 0) + (ledger.qtyPcs || 0),
              0
            );

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

            const totalReceivedKg = (totalReceived._sum.qtyKg || 0) + (totalReceived._sum.qtyPcs || 0);
            const wastagePercent = totalReceivedKg > 0 ? (totalWastage / totalReceivedKg) * 100 : 0;

            const allowedWastagePercent = franchise.franchiseConfig.allowedWastagePercent || 5.0;
            const excessWastage = Math.max(0, wastagePercent - allowedWastagePercent);
            const wastagePenalty = excessWastage > 0 ? grossSales * (excessWastage / 100) * 0.1 : 0;

            const complianceRecords = await prisma.complianceRecord.findMany({
              where: {
                franchiseConfigId: franchise.franchiseConfig.id,
                checkedAt: dateFilter,
                status: 'NON_COMPLIANT',
              },
            });

            const compliancePenalty = complianceRecords.length * 1000;
            const royaltyBase = franchise.franchiseConfig.royaltyCalculationBase === 'NET_SALES' ? netSales : grossSales;
            const baseRoyalty = royaltyBase * (franchise.franchiseConfig.royaltyPercentage / 100);
            const totalRoyalty = Math.max(0, baseRoyalty - wastagePenalty - compliancePenalty);

            const invoiceNo = `ROY-${franchise.id.substring(0, 6)}-${targetYear}-${String(targetMonth).padStart(2, '0')}`;

            await prisma.royaltyInvoice.upsert({
              where: {
                franchiseConfigId_invoiceNo: {
                  franchiseConfigId: franchise.franchiseConfig.id,
                  invoiceNo,
                },
              },
              update: {
                grossSales,
                netSales,
                totalDiscounts,
                totalWastage,
                wastagePenalty,
                compliancePenalty,
                baseRoyalty,
                totalRoyalty,
                status: 'CALCULATED',
              },
              create: {
                franchiseConfigId: franchise.franchiseConfig.id,
                invoiceNo,
                periodStart,
                periodEnd,
                grossSales,
                netSales,
                totalDiscounts,
                totalWastage,
                wastagePenalty,
                compliancePenalty,
                baseRoyalty,
                totalRoyalty,
                dueDate: periodEnd,
                status: 'CALCULATED',
              },
            });

            results.successful++;
          } catch (error: any) {
            results.failed++;
            results.errors.push(`${franchise.name}: ${error.message}`);
          }
        }

        return results;
      } catch (error: any) {
        console.error('Failed to calculate monthly royalties:', error);
        reply.code(500).send({ error: 'Failed to calculate monthly royalties' });
      }
    }
  );

  // Export invoices to CSV
  fastify.get(
    '/royalty/invoices/export',
    { preHandler: [fastify.authenticate, requireRole('OWNER')] },
    async (
      request: FastifyRequest<{
        Querystring: {
          franchiseConfigId?: string;
          status?: string;
          startDate?: string;
          endDate?: string;
        };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const ownerStoreId = getUser(request).storeId;
        const { franchiseConfigId, status, startDate, endDate } = request.query;

        const where: any = {};
        if (franchiseConfigId) {
          where.franchiseConfigId = franchiseConfigId;
        }
        if (status) {
          where.status = status;
        }
        if (startDate && endDate) {
          where.periodStart = {
            gte: new Date(startDate),
            lte: new Date(endDate),
          };
        }

        const invoices = await prisma.royaltyInvoice.findMany({
          where,
          include: {
            franchiseConfig: {
              include: {
                franchiseStore: {
                  select: { id: true, name: true, parentOwnerStoreId: true },
                },
              },
            },
          },
          orderBy: { periodStart: 'desc' },
        });

        const filteredInvoices = invoices.filter(
          (inv) => inv.franchiseConfig.franchiseStore.parentOwnerStoreId === ownerStoreId
        );

        // Generate CSV
        const headers = [
          'Invoice No',
          'Franchise',
          'Period Start',
          'Period End',
          'Gross Sales',
          'Net Sales',
          'Total Discounts',
          'Total Wastage',
          'Wastage Penalty',
          'Pricing Violation Penalty',
          'Compliance Penalty',
          'Base Royalty',
          'Total Royalty',
          'Status',
          'Due Date',
          'Paid At',
          'Payment Reference',
        ];

        const rows = filteredInvoices.map((inv) => [
          inv.invoiceNo,
          inv.franchiseConfig.franchiseStore.name,
          inv.periodStart.toISOString().split('T')[0],
          inv.periodEnd.toISOString().split('T')[0],
          inv.grossSales.toFixed(2),
          inv.netSales.toFixed(2),
          inv.totalDiscounts.toFixed(2),
          inv.totalWastage.toFixed(2),
          inv.wastagePenalty.toFixed(2),
          inv.pricingViolationPenalty.toFixed(2),
          inv.compliancePenalty.toFixed(2),
          inv.baseRoyalty.toFixed(2),
          inv.totalRoyalty.toFixed(2),
          inv.status,
          inv.dueDate.toISOString().split('T')[0],
          inv.paidAt ? inv.paidAt.toISOString().split('T')[0] : '',
          inv.paymentReference || '',
        ]);

        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', `attachment; filename="royalty-invoices-${new Date().toISOString().split('T')[0]}.csv"`);
        return csv;
      } catch (error: any) {
        console.error('Failed to export invoices:', error);
        reply.code(500).send({ error: 'Failed to export invoices' });
      }
    }
  );
}

