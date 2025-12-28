import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { requireRole } from '../utils/auth.js';

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

export async function franchiseHQRoutes(fastify: FastifyInstance) {
  // Get overall HQ dashboard summary
  fastify.get('/dashboard', { preHandler: [fastify.authenticate, requireRole('OWNER')] }, async (request: FastifyRequest<{ Querystring: QueryParams }>, reply: FastifyReply) => {
    try {
      const { startDate, endDate } = request.query;
      const dateFilter = getDateRange(startDate, endDate);
      const ownerStoreId = request.user!.storeId;

      const ownerStore = await prisma.store.findUnique({ where: { id: ownerStoreId } });
      if (!ownerStore || ownerStore.type !== 'OWNER') {
        reply.code(403).send({ error: 'Access denied. Owner store not found.' });
        return;
      }

      // Get all franchises
      const franchises = await prisma.store.findMany({
        where: {
          type: 'FRANCHISE',
          parentOwnerStoreId: ownerStoreId,
        },
      });

      const franchiseIds = franchises.map(f => f.id);

      // Aggregate sales data
      const [totalSales, totalRevenue, totalCustomers, franchiseSales] = await Promise.all([
        prisma.sale.count({
          where: {
            storeId: { in: franchiseIds },
            status: 'PAID',
            createdAt: dateFilter,
          },
        }),
        prisma.sale.aggregate({
          where: {
            storeId: { in: franchiseIds },
            status: 'PAID',
            createdAt: dateFilter,
          },
          _sum: { grandTotal: true },
        }),
        prisma.customer.count({
          where: {
            storeId: { in: franchiseIds },
            createdAt: dateFilter,
          },
        }),
        prisma.sale.groupBy({
          by: ['storeId'],
          where: {
            storeId: { in: franchiseIds },
            status: 'PAID',
            createdAt: dateFilter,
          },
          _count: { id: true },
          _sum: { grandTotal: true },
        }),
      ]);

      // Get franchise-wise breakdown
      const franchiseBreakdown = await Promise.all(
        franchises.map(async (franchise) => {
          const sales = await prisma.sale.findMany({
            where: {
              storeId: franchise.id,
              status: 'PAID',
              createdAt: dateFilter,
            },
          });

          const revenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
          const customers = await prisma.customer.count({
            where: {
              storeId: franchise.id,
              createdAt: dateFilter,
            },
          });

          return {
            franchiseId: franchise.id,
            franchiseName: franchise.name,
            sales: sales.length,
            revenue,
            customers,
            avgBillValue: sales.length > 0 ? revenue / sales.length : 0,
          };
        })
      );

      return {
        summary: {
          totalFranchises: franchises.length,
          totalSales: totalSales,
          totalRevenue: totalRevenue._sum.grandTotal || 0,
          totalCustomers: totalCustomers,
          avgRevenuePerFranchise: franchises.length > 0 ? (totalRevenue._sum.grandTotal || 0) / franchises.length : 0,
        },
        franchiseBreakdown: franchiseBreakdown.sort((a, b) => b.revenue - a.revenue),
        period: {
          startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0],
        },
      };
    } catch (error: any) {
      console.error('Failed to load HQ dashboard:', error);
      reply.code(500).send({ error: 'Failed to load HQ dashboard' });
    }
  });

  // Get sales monitoring across all franchises
  fastify.get('/sales-monitoring', async (request: FastifyRequest<{ Querystring: QueryParams }>, reply: FastifyReply) => {
    try {
      const { startDate, endDate, franchiseId } = request.query;
      const dateFilter = getDateRange(startDate, endDate);

      const ownerStore = await prisma.store.findFirst({ where: { type: 'OWNER' } });
      if (!ownerStore) {
        reply.code(404).send({ error: 'Owner store not found' });
        return;
      }

      let storeIds: string[] = [];
      if (franchiseId && franchiseId !== 'all') {
        storeIds = [franchiseId];
      } else {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: ownerStore.id,
          },
        });
        storeIds = franchises.map(f => f.id);
      }

      const sales = await prisma.sale.findMany({
        where: {
          storeId: { in: storeIds },
          status: 'PAID',
          createdAt: dateFilter,
        },
        include: {
          store: {
            select: { id: true, name: true },
          },
          customer: {
            select: { name: true, phone: true },
          },
          items: {
            include: {
              product: {
                select: { name: true, sku: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100, // Limit to recent 100 sales
      });

      // Daily sales trend
      const dailySales = await prisma.sale.groupBy({
        by: ['storeId', 'createdAt'],
        where: {
          storeId: { in: storeIds },
          status: 'PAID',
          createdAt: dateFilter,
        },
        _count: { id: true },
        _sum: { grandTotal: true },
      });

      return {
        recentSales: sales,
        dailyTrend: dailySales,
        totalSales: sales.length,
      };
    } catch (error: any) {
      console.error('Failed to load sales monitoring:', error);
      reply.code(500).send({ error: 'Failed to load sales monitoring' });
    }
  });

  // Get inventory monitoring across franchises
  fastify.get('/inventory-monitoring', async (request: FastifyRequest<{ Querystring: { franchiseId?: string } }>, reply: FastifyReply) => {
    try {
      const { franchiseId } = request.query;

      const ownerStore = await prisma.store.findFirst({ where: { type: 'OWNER' } });
      if (!ownerStore) {
        reply.code(404).send({ error: 'Owner store not found' });
        return;
      }

      let storeIds: string[] = [];
      if (franchiseId && franchiseId !== 'all') {
        storeIds = [franchiseId];
      } else {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: ownerStore.id,
          },
        });
        storeIds = franchises.map(f => f.id);
      }

      // Get all products from owner store
      const products = await prisma.product.findMany({
        where: {
          ownerStoreId: ownerStore.id,
          isActive: true,
        },
        include: {
          category: true,
        },
      });

      // Get inventory for each franchise
      const inventoryData = await Promise.all(
        storeIds.map(async (storeId) => {
          const store = await prisma.store.findUnique({ where: { id: storeId } });
          const inventory = await Promise.all(
            products.map(async (product) => {
              const ledgers = await prisma.inventoryLedger.findMany({
                where: {
                  productId: product.id,
                  storeId: storeId,
                },
              });

              let totalQty = 0;
              for (const ledger of ledgers) {
                if (ledger.type === 'IN') {
                  totalQty += (ledger.qtyKg || 0) + (ledger.qtyPcs || 0);
                } else {
                  totalQty -= (ledger.qtyKg || 0) + (ledger.qtyPcs || 0);
                }
              }

              return {
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                category: product.category.name,
                currentStock: Math.max(0, totalQty),
              };
            })
          );

          return {
            storeId,
            storeName: store?.name || 'Unknown',
            inventory,
          };
        })
      );

      return inventoryData;
    } catch (error: any) {
      console.error('Failed to load inventory monitoring:', error);
      reply.code(500).send({ error: 'Failed to load inventory monitoring' });
    }
  });

  // Get compliance status
  fastify.get('/compliance', async (request: FastifyRequest, reply: FastifyReply) => {
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
          users: {
            where: { isActive: true },
          },
          _count: {
            select: {
              sales: true,
              customers: true,
            },
          },
        },
      });

      const complianceData = franchises.map((franchise) => {
        // Basic compliance checks
        const hasUsers = franchise.users.length > 0;
        const hasSales = franchise._count.sales > 0;
        const hasCustomers = franchise._count.customers > 0;
        const hasManager = franchise.users.some(u => u.role === 'MANAGER');
        const hasCashier = franchise.users.some(u => u.role === 'CASHIER');

        const complianceScore = [
          hasUsers,
          hasManager,
          hasCashier,
          hasSales,
          hasCustomers,
        ].filter(Boolean).length * 20; // 0-100 score

        return {
          franchiseId: franchise.id,
          franchiseName: franchise.name,
          complianceScore,
          status: complianceScore >= 80 ? 'COMPLIANT' : complianceScore >= 60 ? 'WARNING' : 'NON_COMPLIANT',
          checks: {
            hasUsers,
            hasManager,
            hasCashier,
            hasSales,
            hasCustomers,
          },
          userCount: franchise.users.length,
        };
      });

      return complianceData;
    } catch (error: any) {
      console.error('Failed to load compliance data:', error);
      reply.code(500).send({ error: 'Failed to load compliance data' });
    }
  });

  // Get payments and commissions
  fastify.get('/payments-commissions', async (request: FastifyRequest<{ Querystring: QueryParams }>, reply: FastifyReply) => {
    try {
      const { startDate, endDate, franchiseId } = request.query;
      const dateFilter = getDateRange(startDate, endDate);

      const ownerStore = await prisma.store.findFirst({ where: { type: 'OWNER' } });
      if (!ownerStore) {
        reply.code(404).send({ error: 'Owner store not found' });
        return;
      }

      let storeIds: string[] = [];
      if (franchiseId && franchiseId !== 'all') {
        storeIds = [franchiseId];
      } else {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: ownerStore.id,
          },
        });
        storeIds = franchises.map(f => f.id);
      }

      // Calculate commissions/royalties (example: 5% of revenue)
      const COMMISSION_RATE = 0.05; // 5%

      const franchisePayments = await Promise.all(
        storeIds.map(async (storeId) => {
          const store = await prisma.store.findUnique({ where: { id: storeId } });
          const sales = await prisma.sale.findMany({
            where: {
              storeId,
              status: 'PAID',
              createdAt: dateFilter,
            },
          });

          const totalRevenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
          const commission = totalRevenue * COMMISSION_RATE;
          const netPayment = totalRevenue - commission;

          // Payment method breakdown
          const paymentBreakdown = sales.reduce((acc, sale) => {
            acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.grandTotal;
            return acc;
          }, {} as Record<string, number>);

          return {
            franchiseId: storeId,
            franchiseName: store?.name || 'Unknown',
            totalRevenue,
            commission,
            netPayment,
            salesCount: sales.length,
            paymentBreakdown,
          };
        })
      );

      const totalRevenue = franchisePayments.reduce((sum, p) => sum + p.totalRevenue, 0);
      const totalCommission = franchisePayments.reduce((sum, p) => sum + p.commission, 0);

      return {
        summary: {
          totalRevenue,
          totalCommission,
          totalNetPayment: totalRevenue - totalCommission,
          commissionRate: COMMISSION_RATE * 100,
        },
        franchisePayments: franchisePayments.sort((a, b) => b.totalRevenue - a.totalRevenue),
        period: {
          startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0],
        },
      };
    } catch (error: any) {
      console.error('Failed to load payments/commissions:', error);
      reply.code(500).send({ error: 'Failed to load payments/commissions' });
    }
  });
}

