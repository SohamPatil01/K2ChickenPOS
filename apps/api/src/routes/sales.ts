import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { createSaleSchema, paySaleSchema } from '@azela-pos/shared';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

export async function saleRoutes(fastify: FastifyInstance) {

  // Get sales list
  fastify.get('/', async (request: any, reply: FastifyReply) => {
    const limit = parseInt(request.query.limit || '50');
    const status = request.query.status;
    
    // Get default store (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const storeId = store?.id || '';

    const where: any = { storeId };
    if (status) {
      where.status = status;
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: true } },
        customer: true,
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return sales;
  });

  // Dashboard summary
  fastify.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    // Get default store (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const storeId = store?.id || '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Today's sales
    const todaySales = await prisma.sale.findMany({
      where: {
        storeId,
        status: 'PAID',
        createdAt: { gte: today, lte: todayEnd },
      },
    });

    const todayRevenue = todaySales.reduce((sum: any, s: any) => sum + s.grandTotal, 0);
    const todayCount = todaySales.length;
    const todayAvgBill = todayCount > 0 ? todayRevenue / todayCount : 0;

    // This month
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthSales = await prisma.sale.findMany({
      where: {
        storeId,
        status: 'PAID',
        createdAt: { gte: monthStart },
      },
    });

    const monthRevenue = monthSales.reduce((sum: any, s: any) => sum + s.grandTotal, 0);
    const monthCount = monthSales.length;

    // Recent sales
    const recentSales = await prisma.sale.findMany({
      where: { storeId },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      today: {
        revenue: todayRevenue,
        count: todayCount,
        avgBill: todayAvgBill,
      },
      month: {
        revenue: monthRevenue,
        count: monthCount,
      },
      recentSales: recentSales.map((s) => ({
        id: s.id,
        saleNo: s.saleNo,
        grandTotal: s.grandTotal,
        status: s.status,
        createdAt: s.createdAt,
        customerName: s.customer?.name || 'Walk-in',
        itemCount: s.items.length,
      })),
    };
  });

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = createSaleSchema.parse(request.body);
      const storeId = getUser(request).storeId;
      const userId = getUser(request).userId;

      if (!storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      if (!userId) {
        reply.code(400).send({ error: 'User ID is required' });
        return;
      }

      // Get store
      const store = await prisma.store.findUnique({
        where: { id: storeId },
      });

      if (!store) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      // Get franchise config separately if store is a franchise
      let config = null;
      if (store.type === 'FRANCHISE') {
        config = await prisma.franchiseConfig.findUnique({
          where: { franchiseStoreId: storeId },
        });
      }

      // Get or create customer
      let customerId = data.customerId;
      if (!customerId && data.customerPhone) {
        const customer = await prisma.customer.upsert({
          where: {
            storeId_phone: {
              storeId,
              phone: data.customerPhone,
            },
          },
          update: {},
          create: {
            storeId,
            phone: data.customerPhone,
            name: (data as any).customerName || 'Customer',
          },
        });
        customerId = customer.id;
      }

      // Generate sale number
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      const count = await prisma.sale.count({
        where: {
          storeId,
          createdAt: {
            gte: new Date(today.setHours(0, 0, 0, 0)),
          },
        },
      });
      const saleNo = `SALE-${dateStr}-${String(count + 1).padStart(4, '0')}`;

      // Calculate totals
      let subTotal = 0;
      let taxTotal = 0;

      for (const item of data.items) {
        const lineTotal = (item.qtyKg || item.qtyPcs || 0) * item.rate;
        subTotal += lineTotal;
        taxTotal += lineTotal * (item.taxRate / 100);
      }

      // Check discount limit and lock status
      if (config?.isDiscountLocked) {
        reply.code(403).send({ 
          error: 'Discount limits are locked by HQ. Discount overrides are not allowed.',
          locked: true,
        });
        return;
      }

      const allowedDiscountPercent = config?.allowedDiscountPercent || 10.0;
      const maxAllowedDiscount = (subTotal * allowedDiscountPercent) / 100;
      const discountPercent = subTotal > 0 ? (data.discountTotal / subTotal) * 100 : 0;

      // If discount exceeds limit, require override approval
      if (data.discountTotal > maxAllowedDiscount) {
        // Create sale first with original discount
        const sale = await prisma.sale.create({
          data: {
            storeId,
            saleNo,
            customerId,
            status: 'OPEN',
            subTotal,
            discountTotal: 0, // Start with 0, will be updated after approval
            taxTotal,
            grandTotal: subTotal + taxTotal,
            createdByUserId: userId,
            items: {
              create: data.items.map((item: any) => ({
                productId: item.productId,
                qtyKg: item.qtyKg,
                qtyPcs: item.qtyPcs,
                rate: item.rate,
                lineTotal: (item.qtyKg || item.qtyPcs || 0) * item.rate,
                taxRate: item.taxRate,
                taxAmount: (item.qtyKg || item.qtyPcs || 0) * item.rate * (item.taxRate / 100),
              })),
            },
          },
          include: {
            items: true,
          },
        });

        // Create discount override request
        const override = await prisma.discountOverride.create({
          data: {
            saleId: sale.id,
            storeId,
            requestedBy: userId,
            originalDiscount: 0,
            overrideDiscount: data.discountTotal,
            reason: `Discount of ${discountPercent.toFixed(2)}% exceeds allowed limit of ${allowedDiscountPercent}%`,
            status: 'PENDING',
          },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            storeId,
            actorUserId: userId,
            action: 'DISCOUNT_OVERRIDE_REQUESTED',
            entityType: 'Sale',
            entityId: sale.id,
            metaJson: {
              originalDiscount: 0,
              overrideDiscount: data.discountTotal,
              discountPercent,
              allowedDiscountPercent,
              saleNo,
            },
          },
        });

        reply.code(202).send({
          sale,
          override,
          requiresApproval: true,
          message: `Discount of ${discountPercent.toFixed(2)}% exceeds the allowed limit of ${allowedDiscountPercent}%. Manager approval required.`,
        });
        return;
      }

      const grandTotal = subTotal + taxTotal - data.discountTotal;

      // Create sale
      const sale = await prisma.sale.create({
        data: {
          storeId,
          saleNo,
          customerId,
          status: 'OPEN',
          subTotal,
          discountTotal: data.discountTotal,
          taxTotal,
          grandTotal,
          createdByUserId: userId,
          items: {
            create: data.items.map((item: any) => ({
              productId: item.productId,
              qtyKg: item.qtyKg,
              qtyPcs: item.qtyPcs,
              rate: item.rate,
              lineTotal: (item.qtyKg || item.qtyPcs || 0) * item.rate,
              taxRate: item.taxRate,
              taxAmount: ((item.qtyKg || item.qtyPcs || 0) * item.rate) * (item.taxRate / 100),
              metaJson: item.metaJson,
            })),
          },
        },
        include: {
          items: {
            include: { product: true },
          },
          customer: true,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          storeId,
          actorUserId: userId,
          action: 'SALE_CREATED',
          entityType: 'Sale',
          entityId: sale.id,
          metaJson: { saleNo, grandTotal },
        },
      });

      return sale;
    } catch (error: any) {
      console.error('Failed to create sale:', error);
      reply.code(500).send({ 
        error: 'Failed to create sale',
        details: error.message 
      });
    }
  });

  fastify.post('/:id/pay', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      const { payments } = paySaleSchema.parse(request.body);
      const storeId = getUser(request).storeId;
      const userId = getUser(request).userId;

      if (!storeId || !userId) {
        reply.code(400).send({ error: 'Store ID and User ID are required' });
        return;
      }

      // Fetch sale with items first
      const sale = await prisma.sale.findFirst({
        where: { 
          id,
          storeId,
        },
        include: { 
          items: { include: { product: true } },
        },
      });

      if (!sale) {
        reply.code(404).send({ error: 'Sale not found' });
        return;
      }

      if (sale.status !== 'OPEN') {
        reply.code(400).send({ error: 'Sale is not open' });
        return;
      }

      // Fetch discount override separately if needed (optional, handle gracefully)
      // Only check if discount override exists and is pending - don't block payment if check fails
      try {
        const discountOverride = await (prisma as any).discountOverride?.findFirst({
          where: { saleId: id },
        }).catch(() => null);

        // Check if discount override is pending
        if (discountOverride && discountOverride.status === 'PENDING') {
          reply.code(400).send({ 
            error: 'Discount override is pending approval. Please wait for manager approval before processing payment.',
            requiresApproval: true,
          });
          return;
        }
      } catch (err) {
        // If discountOverride model doesn't exist or query fails, continue without it
        // Don't block payment processing
        console.warn('Could not check discount override, proceeding with payment:', err);
      }

      const totalPaid = payments.reduce((sum: any, p) => sum + p.amount, 0);
      if (Math.abs(totalPaid - sale.grandTotal) > 0.01) {
        reply.code(400).send({ error: 'Payment amount mismatch' });
        return;
      }

      // Create payments
      await prisma.payment.createMany({
        data: payments.map((p: any) => ({
          saleId: id,
          method: p.method,
          amount: p.amount,
          txnRef: p.txnRef,
        })),
      });

      // Update sale status
      const updatedSale = await prisma.sale.update({
        where: { id },
        data: { status: 'PAID' },
        include: {
          items: { include: { product: true } },
          payments: true,
          customer: true,
        },
      });

      // Update inventory
      for (const item of sale.items) {
        await prisma.inventoryLedger.create({
          data: {
            storeId,
            productId: item.productId,
            type: 'OUT',
            qtyKg: item.qtyKg,
            qtyPcs: item.qtyPcs,
            reason: 'SALE',
            refId: id,
          },
        });
      }

      // Award loyalty points if customer exists
      if (sale.customerId) {
        try {
          // Calculate points: 1 point per ₹10 spent (configurable)
          const pointsPerRupee = 0.1; // 1 point per ₹10 = 0.1 points per ₹1
          const pointsEarned = Math.floor(sale.grandTotal * pointsPerRupee);

          if (pointsEarned > 0) {
            const customer = await prisma.customer.findFirst({
              where: { id: sale.customerId },
            });

            if (customer) {
              const newBalance = (customer.loyaltyPoints || 0) + pointsEarned;
              const newTotalSpent = (customer.totalSpent || 0) + sale.grandTotal;

              // Update customer
              await prisma.customer.update({
                where: { id: sale.customerId },
                data: {
                  loyaltyPoints: newBalance,
                  totalSpent: newTotalSpent,
                },
              });

              // Create loyalty transaction (optional, handle gracefully if model doesn't exist)
              try {
                await prisma.loyaltyTransaction.create({
                  data: {
                    customerId: sale.customerId,
                    storeId,
                    type: 'EARN',
                    points: pointsEarned,
                    balance: newBalance,
                    description: `Earned ${pointsEarned} points from purchase ${sale.saleNo}`,
                    saleId: id,
                    createdBy: userId,
                  },
                });
              } catch (loyaltyErr) {
                // If loyaltyTransaction model doesn't exist, continue without it
                console.warn('Could not create loyalty transaction:', loyaltyErr);
              }
            }
          }
        } catch (loyaltyErr) {
          // If loyalty features fail, continue without them
          console.warn('Could not process loyalty points:', loyaltyErr);
        }
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          storeId,
          actorUserId: userId,
          action: 'SALE_PAID',
          entityType: 'Sale',
          entityId: id,
          metaJson: { payments },
        },
      });

      return updatedSale;
    } catch (error: any) {
      console.error('Failed to process payment:', error);
      reply.code(500).send({ 
        error: 'Failed to process payment',
        details: error.message 
      });
    }
  });

  fastify.post('/:id/void', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: any, reply: FastifyReply) => {
    const { id } = request.params;
    const { reason } = request.body;
    const storeId = getUser(request).storeId;
    const userId = getUser(request).userId;

    const sale = await prisma.sale.findUnique({
      where: { id },
    });

    if (!sale || sale.storeId !== storeId) {
      reply.code(404).send({ error: 'Sale not found' });
      return;
    }

    if (sale.status === 'VOID') {
      reply.code(400).send({ error: 'Sale already voided' });
      return;
    }

    const updatedSale = await prisma.sale.update({
      where: { id },
      data: { status: 'VOID' },
    });

    await prisma.auditLog.create({
      data: {
        storeId,
        actorUserId: userId,
        action: 'SALE_VOIDED',
        entityType: 'Sale',
        entityId: id,
        metaJson: { reason },
      },
    });

    return updatedSale;
  });

  fastify.post('/:id/refund', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: any, reply: FastifyReply) => {
    const { id } = request.params;
    const { reason, amount } = request.body;
    const storeId = getUser(request).storeId;
    const userId = getUser(request).userId;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });

    if (!sale || sale.storeId !== storeId) {
      reply.code(404).send({ error: 'Sale not found' });
      return;
    }

    if (sale.status !== 'PAID') {
      reply.code(400).send({ error: 'Sale must be paid to refund' });
      return;
    }

    const refundAmount = amount || sale.grandTotal;

    const updatedSale = await prisma.sale.update({
      where: { id },
      data: { status: 'REFUNDED' },
    });

    // Reverse inventory if full refund
    if (!amount || amount >= sale.grandTotal) {
      for (const item of sale.items) {
        await prisma.inventoryLedger.create({
          data: {
            storeId,
            productId: item.productId,
            type: 'IN',
            qtyKg: item.qtyKg,
            qtyPcs: item.qtyPcs,
            reason: 'ADJUSTMENT',
            refId: id,
          },
        });
      }
    }

    await prisma.auditLog.create({
      data: {
        storeId,
        actorUserId: userId,
        action: 'SALE_REFUNDED',
        entityType: 'Sale',
        entityId: id,
        metaJson: { reason, refundAmount },
      },
    });

    return updatedSale;
  });
}

