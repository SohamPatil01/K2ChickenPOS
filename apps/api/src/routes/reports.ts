// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { getUser, requireRole } from '../utils/auth.js';

interface QueryParams {
  startDate?: string;
  endDate?: string;
  storeId?: string;
  productId?: string;
  categoryId?: string;
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

export async function reportRoutes(fastify: FastifyInstance) {
  // Stock Report
  fastify.get('/stock', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      
      // Get user's store
      const userStore = await prisma.store.findUnique({
        where: { id: user.storeId },
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      // Determine which store to use
      const userStoreId = queryStoreId || user.storeId;
      
      // Get owner store ID
      const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;
      if (!ownerStoreId) {
        reply.code(400).send({ error: 'Owner store not found' });
        return;
      }

      const products = await prisma.product.findMany({
      where: {
        ownerStoreId,
        isActive: true,
      },
      include: {
        category: true,
        storeProductPrices: {
          where: {
            storeId: userStoreId,
            isActive: true,
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
        inventoryLedgers: {
          where: { storeId: userStoreId },
          orderBy: { createdAt: 'desc' },
        },
      },
      });

      const stockData = products.map((product: any) => {
      // Calculate KG and PCS separately - don't mix units
      let inQtyKg = 0;
      let inQtyPcs = 0;
      let outQtyKg = 0;
      let outQtyPcs = 0;
      
      product.inventoryLedgers.forEach((l: any) => {
        // Handle null/undefined values properly
        const qtyKg = l.qtyKg !== null && l.qtyKg !== undefined ? l.qtyKg : 0;
        const qtyPcs = l.qtyPcs !== null && l.qtyPcs !== undefined ? l.qtyPcs : 0;
        
        if (l.type === 'IN') {
          inQtyKg += qtyKg;
          inQtyPcs += qtyPcs;
        } else {
          outQtyKg += qtyKg;
          outQtyPcs += qtyPcs;
        }
      });
      
      // Round to 3 decimal places for KG (for consistency with other calculations), integer for PCS
      const currentQtyKg = Math.round((Math.max(0, inQtyKg - outQtyKg)) * 1000) / 1000;
      const currentQtyPcs = Math.max(0, Math.round(inQtyPcs - outQtyPcs));
      
      // For display, use the appropriate unit based on product unitType
      const currentStock = product.unitType === 'KG' ? currentQtyKg : currentQtyPcs;

      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        plu: product.plu,
        category: product.category.name,
        unitType: product.unitType,
        currentStock: currentStock > 0 ? currentStock : 0,
        price: product.storeProductPrices[0]?.pricePerUnit || 0,
        stockValue: (currentStock > 0 ? currentStock : 0) * (product.storeProductPrices[0]?.pricePerUnit || 0),
      };
      });

      return stockData;
    } catch (error: any) {
      console.error('Stock report error:', error);
      reply.code(500).send({ error: 'Failed to generate stock report', details: error.message });
    }
  });

  // Product Wise Sale Report
  fastify.get('/product-wise-sale', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      const userStoreId = queryStoreId || user.storeId;

    const dateFilter = getDateRange(startDate, endDate);

    const sales = await prisma.sale.findMany({
      where: {
        storeId: userStoreId,
        status: 'PAID',
        createdAt: dateFilter,
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    const productStats: Record<string, any> = {};

    for (const sale of sales) {
      for (const item of sale.items) {
        const key = item.productId;
        if (!productStats[key]) {
          productStats[key] = {
            productId: item.productId,
            productName: item.product.name,
            sku: item.product.sku,
            category: item.product.category.name,
            unitType: item.product.unitType,
            qtyKg: 0,
            qtyPcs: 0,
            totalQty: 0,
            revenue: 0,
            salesCount: 0,
          };
        }
        productStats[key].qtyKg = Math.round((productStats[key].qtyKg + (item.qtyKg || 0)) * 100) / 100;
        productStats[key].qtyPcs = Math.round(productStats[key].qtyPcs + (item.qtyPcs || 0));
        productStats[key].totalQty = Math.round((productStats[key].totalQty + (item.qtyKg || 0) + (item.qtyPcs || 0)) * 100) / 100;
        // Round revenue to 3 decimal places for consistency with other financial calculations
        productStats[key].revenue = Math.round((productStats[key].revenue + item.lineTotal) * 1000) / 1000;
        productStats[key].salesCount += 1;
      }
    }

      return Object.values(productStats).sort((a: any, b: any) => b.revenue - a.revenue);
    } catch (error: any) {
      console.error('Product-wise sale report error:', error);
      reply.code(500).send({ error: 'Failed to generate product-wise sale report', details: error.message });
    }
  });

  // Bill Wise Sale Report
  fastify.get('/bill-wise-sale', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      const userStoreId = queryStoreId || user.storeId;

    const dateFilter = getDateRange(startDate, endDate);

    const sales = await prisma.sale.findMany({
      where: {
        storeId: userStoreId,
        status: 'PAID',
        createdAt: dateFilter,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
        createdBy: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sales.map((sale) => ({
      saleId: sale.id,
      saleNo: sale.saleNo,
      date: sale.createdAt,
      customerName: sale.customer?.name || 'Walk-in',
      customerPhone: sale.customer?.phone || 'N/A',
      itemsCount: sale.items.length,
      subTotal: sale.subTotal,
      discount: sale.discountTotal,
      tax: sale.taxTotal,
      grandTotal: sale.grandTotal,
      payments: sale.payments.map((p: any) => ({
        method: p.method,
        amount: p.amount,
      })),
      createdBy: sale.createdBy.name,
      items: sale.items.map((item: any) => ({
        productName: item.product.name,
        sku: item.product.sku,
        qtyKg: item.qtyKg,
        qtyPcs: item.qtyPcs,
        rate: item.rate,
        lineTotal: item.lineTotal,
      })),
    }));
    } catch (error: any) {
      console.error('Bill-wise sale report error:', error);
      reply.code(500).send({ error: 'Failed to generate bill-wise sale report', details: error.message });
    }
  });

  // Sales Register Summary
  fastify.get('/sales-register-summary', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      const userStoreId = queryStoreId || user.storeId;

    const dateFilter = getDateRange(startDate, endDate);

    const sales = await prisma.sale.findMany({
      where: {
        storeId: userStoreId,
        status: 'PAID',
        createdAt: dateFilter,
      },
      include: {
        payments: true,
      },
    });

    const paymentStats: Record<string, { method: string; count: number; total: number }> = {};

    for (const sale of sales) {
      for (const payment of sale.payments) {
        if (!paymentStats[payment.method]) {
          paymentStats[payment.method] = {
            method: payment.method,
            count: 0,
            total: 0,
          };
        }
        paymentStats[payment.method].count += 1;
        paymentStats[payment.method].total += payment.amount;
      }
    }

    // Round to 3 decimal places for consistency
    const totalSales = sales.length;
    const totalRevenue = Math.round(sales.reduce((sum: any, s: any) => sum + s.grandTotal, 0) * 1000) / 1000;
    const totalDiscount = Math.round(sales.reduce((sum: any, s: any) => sum + s.discountTotal, 0) * 1000) / 1000;
    const totalTax = Math.round(sales.reduce((sum: any, s: any) => sum + s.taxTotal, 0) * 1000) / 1000;

    return {
      period: {
        startDate: dateFilter.gte,
        endDate: dateFilter.lte,
      },
      summary: {
        totalSales,
        totalRevenue,
        totalDiscount,
        totalTax,
        netRevenue: totalRevenue - totalDiscount,
      },
      paymentMethods: Object.values(paymentStats),
    };
    } catch (error: any) {
      console.error('Sales register summary error:', error);
      reply.code(500).send({ error: 'Failed to generate sales register summary', details: error.message });
    }
  });

  // Sales Sub Register (Detailed)
  fastify.get('/sales-sub-register', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      const userStoreId = queryStoreId || user.storeId;

    const dateFilter = getDateRange(startDate, endDate);

    const sales = await prisma.sale.findMany({
      where: {
        storeId: userStoreId,
        status: 'PAID',
        createdAt: dateFilter,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        payments: true,
        createdBy: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return sales.map((sale) => ({
      date: sale.createdAt,
      saleNo: sale.saleNo,
      time: sale.createdAt.toLocaleTimeString(),
      customer: sale.customer?.name || 'Walk-in',
      items: sale.items.length,
      subTotal: sale.subTotal,
      discount: sale.discountTotal,
      tax: sale.taxTotal,
      total: sale.grandTotal,
      paymentMethod: sale.payments.map((p: any) => p.method).join(', '),
      cashier: sale.createdBy.name,
    }));
    } catch (error: any) {
      console.error('Sales sub register error:', error);
      reply.code(500).send({ error: 'Failed to generate sales sub register', details: error.message });
    }
  });

  // Bill Wise Sale Cancel
  fastify.get('/bill-wise-sale-cancel', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      const userStoreId = queryStoreId || user.storeId;

    const dateFilter = getDateRange(startDate, endDate);

    const cancelledSales = await prisma.sale.findMany({
      where: {
        storeId: userStoreId,
        status: 'VOID',
        createdAt: dateFilter,
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true,
          },
        },
        createdBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return cancelledSales.map((sale) => ({
      saleId: sale.id,
      saleNo: sale.saleNo,
      date: sale.createdAt,
      customerName: sale.customer?.name || 'Walk-in',
      originalTotal: sale.grandTotal,
      itemsCount: sale.items.length,
      cancelledBy: sale.createdBy.name,
      items: sale.items.map((item: any) => ({
        productName: item.product.name,
        qty: item.qtyKg || item.qtyPcs || 0,
        amount: item.lineTotal,
      })),
    }));
    } catch (error: any) {
      console.error('Bill-wise sale cancel report error:', error);
      reply.code(500).send({ error: 'Failed to generate bill-wise sale cancel report', details: error.message });
    }
  });

  // PO Report
  fastify.get('/po-report', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      const userStoreId = queryStoreId || user.storeId;

    const dateFilter = getDateRange(startDate, endDate);

    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        franchiseStoreId: userStoreId,
        createdAt: dateFilter,
      },
      include: {
        franchiseStore: {
          select: { name: true },
        },
        ownerStore: {
          select: { name: true },
        },
        items: {
          include: {
            product: true,
          },
        },
        dispatch: {
          include: {
            grn: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return purchaseOrders.map((po) => ({
      poId: po.id,
      poNo: po.poNo,
      date: po.createdAt,
      franchiseStore: po.franchiseStore.name,
      ownerStore: po.ownerStore.name,
      status: po.status,
      itemsCount: po.items.length,
      items: po.items.map((item: any) => ({
        productName: item.product.name,
        sku: item.product.sku,
        qtyKg: item.qtyKg,
        qtyPcs: item.qtyPcs,
        requestedRate: item.requestedRate,
      })),
      hasDispatch: !!po.dispatch,
      hasGRN: !!po.dispatch?.grn,
    }));
    } catch (error: any) {
      console.error('PO report error:', error);
      reply.code(500).send({ error: 'Failed to generate PO report', details: error.message });
    }
  });

  // Helper function to get store IDs for owner (all franchises or specific)
  async function getStoreIdsForOwner(ownerStoreId: string, queryStoreId?: string) {
    if (queryStoreId === 'all' || !queryStoreId) {
      // Get all franchises for owner
      const franchises = await prisma.store.findMany({
        where: {
          type: 'FRANCHISE',
          parentOwnerStoreId: ownerStoreId,
        },
        select: { id: true },
      });
      return [ownerStoreId, ...franchises.map(f => f.id)];
    } else {
      return [queryStoreId];
    }
  }

  // SKU Wise Sales Report
  fastify.get('/sku-wise-sales', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      
      // Get user's store
      const userStore = await prisma.store.findUnique({
        where: { id: user.storeId },
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;
      const userStoreId = queryStoreId || user.storeId;

    const dateFilter = getDateRange(startDate, endDate);

      // If owner and queryStoreId is 'all', get all franchise store IDs
      let storeIds = [userStoreId];
      if (userStore.type === 'OWNER' && (queryStoreId === 'all' || !queryStoreId)) {
        storeIds = await getStoreIdsForOwner(ownerStoreId, queryStoreId);
      }

    const sales = await prisma.sale.findMany({
      where: {
        storeId: { in: storeIds },
        status: 'PAID',
        createdAt: dateFilter,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    const skuStats: Record<string, any> = {};

    for (const sale of sales) {
      for (const item of sale.items) {
        const sku = item.product.sku;
        if (!skuStats[sku]) {
          skuStats[sku] = {
            sku: sku,
            productName: item.product.name,
            plu: item.product.plu,
            qtyKg: 0,
            qtyPcs: 0,
            revenue: 0,
            salesCount: 0,
            avgPrice: 0,
          };
        }
        skuStats[sku].qtyKg = Math.round((skuStats[sku].qtyKg + (item.qtyKg || 0)) * 100) / 100;
        skuStats[sku].qtyPcs = Math.round(skuStats[sku].qtyPcs + (item.qtyPcs || 0));
        skuStats[sku].revenue = Math.round((skuStats[sku].revenue + item.lineTotal) * 1000) / 1000;
        skuStats[sku].salesCount += 1;
      }
    }

    // Calculate average price - Round to 3 decimal places
    Object.values(skuStats).forEach((stat: any) => {
      const totalQty = stat.qtyKg + stat.qtyPcs;
      stat.avgPrice = totalQty > 0 ? Math.round((stat.revenue / totalQty) * 1000) / 1000 : 0;
      // Also round the final revenue to 3 decimal places
      stat.revenue = Math.round(stat.revenue * 1000) / 1000;
    });

      return Object.values(skuStats).sort((a: any, b: any) => b.revenue - a.revenue);
    } catch (error: any) {
      console.error('SKU-wise sales report error:', error);
      reply.code(500).send({ error: 'Failed to generate SKU-wise sales report', details: error.message });
    }
  });

  // Summary Report
  fastify.get('/summary-report', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      const userStoreId = queryStoreId || user.storeId;
      
      // Get user's store
      const userStore = await prisma.store.findUnique({
        where: { id: user.storeId },
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;

    const dateFilter = getDateRange(startDate, endDate);

    const [sales, products, customers, inventoryMovements] = await Promise.all([
      prisma.sale.findMany({
        where: {
          storeId: userStoreId,
          status: 'PAID',
          createdAt: dateFilter,
        },
        include: {
          items: true,
          payments: true,
        },
      }),
      prisma.product.count({
        where: {
          ownerStoreId: ownerStoreId || '',
          isActive: true,
        },
      }),
      prisma.customer.count({
        where: {
          storeId: userStoreId,
        },
      }),
      prisma.inventoryLedger.count({
        where: {
          storeId: userStoreId,
          createdAt: dateFilter,
        },
      }),
    ]);

    // Round to 3 decimal places for consistency
    const totalRevenue = Math.round(sales.reduce((sum: any, s: any) => sum + s.grandTotal, 0) * 1000) / 1000;
    const totalItemsSold = sales.reduce((sum: any, s: any) => sum + s.items.length, 0);
    const avgBillValue = sales.length > 0 ? Math.round((totalRevenue / sales.length) * 1000) / 1000 : 0;

    const paymentBreakdown: Record<string, number> = {};
    sales.forEach((sale) => {
      sale.payments.forEach((payment: any) => {
        paymentBreakdown[payment.method] = Math.round(((paymentBreakdown[payment.method] || 0) + payment.amount) * 1000) / 1000;
      });
    });

    return {
      period: {
        startDate: dateFilter.gte,
        endDate: dateFilter.lte,
      },
      sales: {
        totalSales: sales.length,
        totalRevenue,
        totalItemsSold,
        avgBillValue,
      },
      inventory: {
        totalProducts: products,
        totalMovements: inventoryMovements,
      },
      customers: {
        totalCustomers: customers,
      },
      payments: paymentBreakdown,
    };
    } catch (error: any) {
      console.error('Summary report error:', error);
      reply.code(500).send({ error: 'Failed to generate summary report', details: error.message });
    }
  });

  // Pending Report
  fastify.get('/pending', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      const userStoreId = queryStoreId || user.storeId;

    const [pendingPOs, pendingDeliveries, openSales] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: {
          franchiseStoreId: userStoreId,
          status: {
            in: ['DRAFT', 'SUBMITTED', 'APPROVED'],
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      }),
      prisma.deliveryOrder.findMany({
        where: {
          storeId: userStoreId,
          status: {
            in: ['CREATED', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY'],
          },
        },
        include: {
          sale: {
            select: {
              saleNo: true,
              grandTotal: true,
            },
          },
        },
      }),
      prisma.sale.findMany({
        where: {
          storeId: userStoreId,
          status: 'OPEN',
        },
        include: {
          customer: true,
          items: true,
        },
      }),
    ]);

    return {
      pendingPurchaseOrders: pendingPOs.map((po) => ({
        poNo: po.poNo,
        status: po.status,
        itemsCount: po.items.length,
        createdAt: po.createdAt,
      })),
      pendingDeliveries: pendingDeliveries.map((delivery) => ({
        saleNo: delivery.sale.saleNo,
        status: delivery.status,
        amount: delivery.sale.grandTotal,
        createdAt: delivery.createdAt,
      })),
      openSales: openSales.map((sale) => ({
        saleNo: sale.saleNo,
        customer: sale.customer?.name || 'Walk-in',
        total: sale.grandTotal,
        itemsCount: sale.items.length,
        createdAt: sale.createdAt,
      })),
    };
    } catch (error: any) {
      console.error('Pending report error:', error);
      reply.code(500).send({ error: 'Failed to generate pending report', details: error.message });
    }
  });

  // MRN & Balance Confirmation
  fastify.get('/mrn-balance', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const user = getUser(request);
      const { startDate, endDate, storeId: queryStoreId } = (request.query as any);
      const userStoreId = queryStoreId || user.storeId;
      
      // Get user's store
      const userStore = await prisma.store.findUnique({
        where: { id: user.storeId },
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      const ownerStoreId = userStore.type === 'OWNER' ? userStore.id : userStore.parentOwnerStoreId;

    const grns = await prisma.gRN.findMany({
      where: {
        dispatch: {
          po: {
            franchiseStoreId: userStoreId,
          },
        },
      },
      include: {
        dispatch: {
          include: {
            po: {
              include: {
                franchiseStore: true,
                ownerStore: true,
              },
            },
            items: {
              include: {
                product: true,
              },
            },
          },
        },
        receiver: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
    });

      const products = await prisma.product.findMany({
        where: {
          ownerStoreId: ownerStoreId || '',
          isActive: true,
        },
      include: {
        inventoryLedgers: {
          where: { storeId: userStoreId },
        },
        storeProductPrices: {
          where: {
            storeId: userStoreId,
            isActive: true,
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });

    const balanceData = products.map((product: any) => {
      const inQty = product.inventoryLedgers
        .filter((l: any) => l.type === 'IN')
        .reduce((sum: any, l) => Math.round((sum + (l.qtyKg || 0) + (l.qtyPcs || 0)) * 100) / 100, 0);
      const outQty = product.inventoryLedgers
        .filter((l: any) => l.type === 'OUT')
        .reduce((sum: any, l) => Math.round((sum + (l.qtyKg || 0) + (l.qtyPcs || 0)) * 100) / 100, 0);
      const balance = Math.round((inQty - outQty) * 100) / 100;

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        balance: balance > 0 ? balance : 0,
        unitType: product.unitType,
        price: product.storeProductPrices[0]?.pricePerUnit || 0,
        value: (balance > 0 ? balance : 0) * (product.storeProductPrices[0]?.pricePerUnit || 0),
      };
    });

    return {
      mrnList: grns.map((grn) => ({
        grnId: grn.id,
        dispatchNo: grn.dispatch.dispatchNo,
        poNo: grn.dispatch.po.poNo,
        receivedAt: grn.receivedAt,
        receivedBy: grn.receiver.name,
        status: grn.status,
        items: grn.dispatch.items.map((item: any) => ({
          productName: item.product.name,
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
        })),
      })),
      balanceConfirmation: balanceData,
    };
    } catch (error: any) {
      console.error('MRN balance report error:', error);
      reply.code(500).send({ error: 'Failed to generate MRN balance report', details: error.message });
    }
  });
}

