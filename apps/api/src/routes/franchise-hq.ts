// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
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

export async function franchiseHQRoutes(fastify: FastifyInstance) {
  // Get overall HQ dashboard summary
  fastify.get('/dashboard', async (request: any, reply: FastifyReply) => {
    try {
      const { startDate, endDate } = (request.query as any) || {};
      const dateFilter = getDateRange(startDate, endDate);

      // Try to get ownerStoreId from authenticated user, fallback to default store
      let ownerStoreId = '';

      try {
        const user = getUser(request);
        ownerStoreId = (user as any).storeId || '';
      } catch (error) {
        // Not authenticated, use oldest OWNER store as fallback
        console.log('[HQ Dashboard] User not authenticated, using fallback store');
        const defaultStore = await prisma.store.findFirst({
          where: { type: 'OWNER' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, type: true, parentOwnerStoreId: true }
        });
        ownerStoreId = defaultStore?.id || '';
      }

      if (!ownerStoreId) {
        reply.code(400).send({ error: 'Owner store not found' });
        return;
      }

      const ownerStore = await prisma.store.findUnique({
        where: { id: ownerStoreId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });
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

      // Include owner store in the store IDs for aggregate data
      const allStoreIds = [ownerStoreId, ...franchiseIds];

      // Aggregate sales data - include owner store and all franchises
      const [totalSales, totalRevenue, totalCustomers, franchiseSales, saleItems] = await Promise.all([
        prisma.sale.count({
          where: {
            storeId: { in: allStoreIds },
            status: 'PAID',
            createdAt: dateFilter,
          },
        }),
        prisma.sale.aggregate({
          where: {
            storeId: { in: allStoreIds },
            status: 'PAID',
            createdAt: dateFilter,
          },
          _sum: { grandTotal: true },
        }),
        prisma.customer.count({
          where: {
            storeId: { in: allStoreIds },
            createdAt: dateFilter,
          },
        }),
        prisma.sale.groupBy({
          by: ['storeId'],
          where: {
            storeId: { in: allStoreIds },
            status: 'PAID',
            createdAt: dateFilter,
          },
          _count: { id: true },
          _sum: { grandTotal: true },
        }),
        prisma.saleItem.findMany({
          where: {
            sale: {
              storeId: { in: allStoreIds },
              status: 'PAID',
              createdAt: dateFilter,
            },
          },
          select: {
            lineTotal: true,
          },
        }),
      ]);

      // Calculate total product sales (sum of lineTotal from all sale items)
      const totalProductSales = Math.round(saleItems.reduce((sum: any, item: any) => sum + (item.lineTotal || 0), 0) * 100) / 100;

      // Get store-wise breakdown (owner store + all franchises)
      const storeBreakdown = await Promise.all(
        [
          // Include owner store first
          {
            id: ownerStoreId,
            name: ownerStore.name,
            type: 'OWNER',
          },
          // Then all franchises
          ...franchises.map((f: any) => ({
            id: f.id,
            name: f.name,
            type: 'FRANCHISE',
          })),
        ].map(async (store: any) => {
          const sales = await prisma.sale.findMany({
            where: {
              storeId: store.id,
              status: 'PAID',
              createdAt: dateFilter,
            },
          });

          const revenue = Math.round(sales.reduce((sum: any, s: any) => sum + (s.grandTotal || 0), 0) * 100) / 100;
          const customers = await prisma.customer.count({
            where: {
              storeId: store.id,
              createdAt: dateFilter,
            },
          });

          return {
            franchiseId: store.id,
            franchiseName: store.name,
            storeType: store.type,
            sales: sales.length,
            revenue,
            customers,
            avgBillValue: sales.length > 0 ? Math.round((revenue / sales.length) * 100) / 100 : 0,
          };
        })
      );

      return {
        summary: {
          totalFranchises: franchises.length,
          totalSales: totalSales,
          totalRevenue: Math.round((totalRevenue._sum.grandTotal || 0) * 100) / 100,
          totalProductSales: totalProductSales, // Sum of lineTotal (before discounts/taxes)
          totalCustomers: totalCustomers,
          avgRevenuePerFranchise: franchises.length > 0 ? Math.round(((totalRevenue._sum.grandTotal || 0) / franchises.length) * 100) / 100 : 0,
        },
        franchiseBreakdown: storeBreakdown.sort((a: any, b: any) => b.revenue - a.revenue),
        period: {
          startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: endDate || new Date().toISOString().split('T')[0],
        },
      };
    } catch (error: any) {
      console.error('Failed to load HQ dashboard:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        meta: error.meta,
      });
      reply.code(500).send({
        error: 'Failed to load HQ dashboard',
        details: error.message || 'Unknown error',
      });
    }
  });

  // Get sales monitoring across all franchises
  fastify.get('/sales-monitoring', async (request: any, reply: FastifyReply) => {
    try {
      const { startDate, endDate } = (request.query as any) || {};
      const dateFilter = getDateRange(startDate, endDate);

      const ownerStore = await prisma.store.findFirst({ where: { type: 'OWNER' }, select: { id: true, name: true, type: true, parentOwnerStoreId: true } });
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
  fastify.get('/inventory-monitoring', { preHandler: [fastify.authenticate, requireRole('OWNER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const { franchiseId } = (request.query as any) || {};
      const ownerStoreId = (getUser(request) as any).storeId;

      const ownerStore = await prisma.store.findUnique({
        where: { id: ownerStoreId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });
      if (!ownerStore || ownerStore.type !== 'OWNER') {
        reply.code(403).send({ error: 'Access denied. Owner store not found.' });
        return;
      }

      let storeIds: string[] = [];
      if (franchiseId && franchiseId !== 'all') {
        storeIds = [franchiseId];
      } else {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: ownerStoreId,
          },
        });
        storeIds = franchises.map(f => f.id);
      }

      // Get all products from owner store
      const products = await prisma.product.findMany({
        where: {
          ownerStoreId: ownerStoreId,
          isActive: true,
        },
        include: {
          category: true,
        },
      });

      // Get inventory for each franchise
      const inventoryData = await Promise.all(
        storeIds.map(async (storeId) => {
          const store = await prisma.store.findUnique({
            where: { id: storeId },
            select: { id: true, name: true, type: true, parentOwnerStoreId: true }
          });
          const inventory = await Promise.all(
            products.map(async (product) => {
              const ledgers = await prisma.inventoryLedger.findMany({
                where: {
                  productId: product.id,
                  storeId: storeId,
                },
              });

              // Calculate kg and pcs separately (don't combine different units!)
              let totalQtyKg = 0;
              let totalQtyPcs = 0;

              for (const ledger of ledgers) {
                if (ledger.type === 'IN') {
                  totalQtyKg = Math.round((totalQtyKg + (ledger.qtyKg || 0)) * 100) / 100;
                  totalQtyPcs = Math.round(totalQtyPcs + (ledger.qtyPcs || 0));
                } else {
                  totalQtyKg = Math.round((totalQtyKg - (ledger.qtyKg || 0)) * 100) / 100;
                  totalQtyPcs = Math.round(totalQtyPcs - (ledger.qtyPcs || 0));
                }
              }

              // Ensure non-negative values
              totalQtyKg = Math.max(0, Math.round(totalQtyKg * 100) / 100);
              totalQtyPcs = Math.max(0, Math.round(totalQtyPcs));

              return {
                productId: product.id,
                productName: product.name,
                sku: product.sku,
                category: product.category?.name || 'Uncategorized',
                currentQtyKg: totalQtyKg,
                currentQtyPcs: totalQtyPcs,
                unitType: product.unitType,
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
      reply.code(500).send({ error: 'Failed to load inventory monitoring', details: error.message });
    }
  });

  // Get compliance status
  fastify.get('/compliance', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ownerStore = await prisma.store.findFirst({ where: { type: 'OWNER' }, select: { id: true, name: true, type: true, parentOwnerStoreId: true } });
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
  fastify.get('/payments-commissions', async (request: any, reply: FastifyReply) => {
    try {
      const { startDate, endDate, franchiseId } = (request.query as any) || {};
      const dateFilter = getDateRange(startDate, endDate);

      const ownerStore = await prisma.store.findFirst({ where: { type: 'OWNER' }, select: { id: true, name: true, type: true, parentOwnerStoreId: true } });
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
          const store = await prisma.store.findUnique({
            where: { id: storeId },
            select: { id: true, name: true, type: true, parentOwnerStoreId: true }
          });
          const sales = await prisma.sale.findMany({
            where: {
              storeId,
              status: 'PAID',
              createdAt: dateFilter,
            },
            include: {
              payments: {
                select: {
                  method: true,
                  amount: true,
                },
              },
            },
          });

          const totalRevenue = sales.reduce((sum: any, s: any) => sum + Number(s.grandTotal ?? 0), 0);
          const commission = totalRevenue * COMMISSION_RATE;
          const netPayment = totalRevenue - commission;

          // Payment method breakdown
          const paymentBreakdown = sales.reduce((acc: any, sale: any) => {
            sale.payments?.forEach((payment: any) => {
              const method = payment.method ?? 'UNKNOWN';
              const amount = Number(payment.amount ?? 0);
              acc[method] = (acc[method] || 0) + amount;
            });
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

      const totalRevenue = franchisePayments.reduce((sum: any, p) => sum + p.totalRevenue, 0);
      const totalCommission = franchisePayments.reduce((sum: any, p) => sum + p.commission, 0);

      return {
        summary: {
          totalRevenue,
          totalCommission,
          totalNetPayment: totalRevenue - totalCommission,
          commissionRate: COMMISSION_RATE * 100,
        },
        franchisePayments: franchisePayments.sort((a: any, b: any) => b.totalRevenue - a.totalRevenue),
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

