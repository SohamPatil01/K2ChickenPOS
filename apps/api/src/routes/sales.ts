// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma, PaymentMethod } from '@azela-pos/db';
import { createSaleSchema, paySaleSchema } from '@azela-pos/shared';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';

export async function saleRoutes(fastify: FastifyInstance) {

  // Get sales list
  fastify.get('/', async (request: any, reply: FastifyReply) => {
    const limit = parseInt((request.query as any).limit || '50');
    const status = (request.query as any).status;
    const startDate = (request.query as any).startDate;
    const endDate = (request.query as any).endDate;
    
    // Get default store (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const storeId = store?.id || '';

    const where: any = { storeId };
    if (status) {
      where.status = status;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: { include: { product: true } },
        customer: true,
        payments: true,
        createdBy: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return sales;
  });

  // Dashboard summary
  fastify.get('/dashboard', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get user's store from authentication
      const user = getUser(request as any);
      const storeId = user?.storeId;
      
      if (!storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }
      
      // Verify store exists
      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

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

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const data = createSaleSchema.parse(request.body as any);
      const storeId = (getUser(request) as any).storeId;
      const userId = (getUser(request) as any).userId;

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

      // Generate sale number - retry if duplicate
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      let saleNo: string;
      let attempts = 0;
      const maxAttempts = 5;
      
      do {
        const count = await prisma.sale.count({
          where: {
            storeId,
            createdAt: {
              gte: new Date(today.setHours(0, 0, 0, 0)),
            },
          },
        });
        saleNo = `SALE-${dateStr}-${String(count + 1 + attempts).padStart(4, '0')}`;
        attempts++;
        
        // Check if this sale number already exists
        const existing = await prisma.sale.findUnique({
          where: {
            storeId_saleNo: {
              storeId,
              saleNo,
            },
          },
        });
        
        if (!existing) {
          break; // Sale number is unique, proceed
        }
        
        if (attempts >= maxAttempts) {
          // Fallback to timestamp-based number if we can't find a unique sequential one
          saleNo = `SALE-${dateStr}-${Date.now().toString().slice(-8)}`;
          break;
        }
      } while (attempts < maxAttempts);

      // Calculate totals
      let subTotal = 0;
      let taxTotal = 0;

      for (const item of data.items) {
        const lineTotal = (item.qtyKg || item.qtyPcs || 0) * item.rate;
        subTotal += lineTotal;
        taxTotal += lineTotal * (item.taxRate / 100);
      }

      // Round to 2 decimal places to avoid floating point precision issues
      subTotal = Math.round(subTotal * 100) / 100;
      taxTotal = Math.round(taxTotal * 100) / 100;

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
            grandTotal: Math.round(Math.round((subTotal + taxTotal) * 100) / 100),
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

      // Calculate grand total and round to nearest integer to match frontend
      const grandTotal = Math.round((subTotal + taxTotal - data.discountTotal) * 100) / 100;
      const roundedGrandTotal = Math.round(grandTotal);

      // Check for recent duplicate sale (within last 5 seconds with same items and total)
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      const recentDuplicate = await prisma.sale.findFirst({
        where: {
          storeId,
          createdByUserId: userId,
          grandTotal: roundedGrandTotal,
          status: 'OPEN',
          createdAt: {
            gte: fiveSecondsAgo,
          },
        },
        include: {
          items: true,
        },
      });

      // If duplicate found, return existing sale instead of creating new one
      if (recentDuplicate) {
        console.log(`[Sale Create] Duplicate sale detected, returning existing sale: ${recentDuplicate.id}`);
        return recentDuplicate;
      }

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
          grandTotal: roundedGrandTotal,
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

      // Deduct inventory for OPEN orders (credit sales)
      // Inventory should be deducted when order is created, not when payment is made
      for (const item of sale.items) {
        await prisma.inventoryLedger.create({
          data: {
            storeId,
            productId: item.productId,
            type: 'OUT',
            qtyKg: item.qtyKg,
            qtyPcs: item.qtyPcs,
            reason: 'SALE',
            refId: sale.id,
          },
        });
      }

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
      const { id } = (request.params as any);
      const { payments } = paySaleSchema.parse(request.body as any);
      const storeId = (getUser(request) as any).storeId;
      const userId = (getUser(request) as any).userId;

      if (!storeId || !userId) {
        reply.code(400).send({ error: 'Store ID and User ID are required' });
        return;
      }

      // Fetch sale with items and payments first
      const sale = await prisma.sale.findFirst({
        where: { 
          id,
          storeId,
        },
        include: { 
          items: { include: { product: true } },
          payments: true,
        },
      });

      if (!sale) {
        reply.code(404).send({ error: 'Sale not found' });
        return;
      }

      // Get existing payments to check if it's a credit order
      const existingPayments = sale.payments || [];
      const hasCreditPayment = existingPayments.some((p) => p.method === 'CREDIT');
      const existingTotalPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
      const pendingAmount = sale.grandTotal - existingTotalPaid;

      // Allow payment if:
      // 1. Sale is OPEN, OR
      // 2. Sale has CREDIT payment (even if fully paid, customer can pay off credit balance)
      if (sale.status !== 'OPEN') {
        if (!hasCreditPayment) {
          reply.code(400).send({ error: 'Sale is not open and cannot accept additional payments' });
          return;
        }
        // If it's a credit order, allow payment even if marked as PAID
        // This allows customers to pay off their credit balance
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

      // Use existing payments already fetched (or fetch if not included)
      const allExistingPayments = existingPayments.length > 0 
        ? existingPayments 
        : await prisma.payment.findMany({ where: { saleId: id } });
      const currentTotalPaid = allExistingPayments.reduce((sum, p) => sum + p.amount, 0);
      
      const newPaymentsTotal = payments.reduce((sum: any, p) => sum + p.amount, 0);
      const totalPaidAfter = currentTotalPaid + newPaymentsTotal;
      
      // Round amounts for comparison
      const roundedTotalPaidAfter = Math.round(totalPaidAfter);
      const roundedGrandTotal = Math.round(sale.grandTotal);
      
      // Check if any NEW payment is credit
      const hasNewCreditPayment = payments.some((p: any) => p.method === 'CREDIT');
      
      // For OPEN orders or credit orders (existing or new), allow partial payments
      // For credit orders, allow payments to pay off credit balance
      if (sale.status === 'OPEN' || hasCreditPayment || hasNewCreditPayment) {
        // Allow partial payments for OPEN orders or credit orders
        if (roundedTotalPaidAfter > roundedGrandTotal + 0.5) {
          reply.code(400).send({ 
            error: 'Payment amount exceeds remaining balance',
            details: `Total paid: ₹${roundedTotalPaidAfter}, Grand total: ₹${roundedGrandTotal}`
          });
          return;
        }
      } else {
        // For new sales (non-credit, non-open), validate amount matches
        if (Math.abs(newPaymentsTotal - roundedGrandTotal) > 0.5) {
          reply.code(400).send({ error: 'Payment amount mismatch' });
          return;
        }
      }

      // Create payments - ensure method is valid enum value
      // The Zod schema should have validated this, but ensure it's properly formatted
      const validPaymentMethods: PaymentMethod[] = ['CASH', 'CARD', 'UPI', 'CREDIT', 'ONLINE'];
      const paymentData = payments.map((p: any) => {
        // Normalize the method to uppercase and trim
        const methodStr = String(p.method || '').toUpperCase().trim();
        
        if (!validPaymentMethods.includes(methodStr as PaymentMethod)) {
          throw new Error(`Invalid payment method: "${p.method}". Must be one of: ${validPaymentMethods.join(', ')}`);
        }
        
        // Cast to PaymentMethod enum type
        const method = methodStr as PaymentMethod;
        
        return {
          saleId: id,
          method: method,
          amount: Number(p.amount),
          txnRef: p.txnRef || null,
        };
      });

      console.log('[Payment] Creating payments:', JSON.stringify(paymentData, null, 2));
      
      await prisma.payment.createMany({
        data: paymentData,
      });

      // Update sale status
      // Credit orders should always remain OPEN, even when fully paid
      // This allows tracking of credit sales separately
      let saleStatus = sale.status; // Keep current status initially
      
      // Check if order has any CREDIT payment (existing or new)
      const hasAnyCreditPayment = hasCreditPayment || hasNewCreditPayment;
      
      if (roundedTotalPaidAfter >= roundedGrandTotal - 0.5) {
        // Fully paid
        if (hasAnyCreditPayment) {
          // Credit orders always stay OPEN, even when fully paid
          saleStatus = 'OPEN';
        } else {
          // Regular order - mark as PAID
          saleStatus = 'PAID';
        }
      } else {
        // Still has pending amount
        if (hasAnyCreditPayment || sale.status === 'OPEN') {
          saleStatus = 'OPEN'; // Keep as OPEN if credit order or was already OPEN
        }
      }
      
      const updatedSale = await prisma.sale.update({
        where: { id },
        data: { status: saleStatus },
        include: {
          items: { include: { product: true } },
          payments: true,
          customer: true,
        },
      });

      // Update inventory - only if not already deducted
      // Check if inventory was already deducted for this sale (when order was created)
      try {
        const existingLedger = await prisma.inventoryLedger.findFirst({
          where: {
            refId: id,
            reason: 'SALE',
          },
        });

        // Only create inventory ledger if it doesn't exist
        // This prevents double-deduction for credit/OPEN orders
        if (!existingLedger) {
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
        }
      } catch (inventoryError: any) {
        // Log inventory error but don't fail payment
        console.error('Failed to update inventory (non-critical):', inventoryError);
        // Continue with payment processing even if inventory update fails
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

      // Create audit log (non-blocking)
      try {
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
      } catch (auditError: any) {
        // Log audit error but don't fail payment
        console.warn('Failed to create audit log (non-critical):', auditError);
      }

      return updatedSale;
    } catch (error: any) {
      console.error('Failed to process payment:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
      });
      reply.code(500).send({ 
        error: 'Failed to process payment',
        details: error.message || 'Unknown error',
        code: error.code,
      });
    }
  });

  fastify.post('/:id/void', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const { reason } = (request.body as any) || {};
      const storeId = (getUser(request) as any).storeId;
      const userId = (getUser(request) as any).userId;

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

      if (sale.status !== 'PAID') {
        reply.code(400).send({ error: 'Only paid sales can be voided' });
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
          metaJson: { reason: reason || 'No reason provided' },
        },
      });

      return updatedSale;
    } catch (error: any) {
      console.error('Failed to void sale:', error);
      reply.code(500).send({ error: 'Failed to void sale', details: error.message });
    }
  });

  fastify.post('/:id/refund', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: any, reply: FastifyReply) => {
    const { id } = (request.params as any);
    const storeId = (getUser(request) as any).storeId;
    const userId = (getUser(request) as any).userId;

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

  // Update sale (for editing orders)
  fastify.put('/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const data = request.body as any;
      const storeId = (getUser(request) as any).storeId;
      const userId = (getUser(request) as any).userId;

      if (!storeId || !userId) {
        reply.code(400).send({ error: 'Store ID and User ID are required' });
        return;
      }

      // Check if user is OWNER
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.role !== 'OWNER') {
        reply.code(403).send({ error: 'Only owners can edit orders' });
        return;
      }

      // Fetch existing sale
      const existingSale = await prisma.sale.findFirst({
        where: {
          id,
          storeId,
        },
        include: {
          items: true,
          payments: true,
        },
      });

      if (!existingSale) {
        reply.code(404).send({ error: 'Sale not found' });
        return;
      }

      // Validate items
      if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
        reply.code(400).send({ error: 'At least one item is required' });
        return;
      }

      // Calculate totals
      let subTotal = 0;
      let taxTotal = 0;

      for (const item of data.items) {
        const qty = item.qtyKg || item.qtyPcs || 0;
        const lineTotal = qty * item.rate;
        subTotal += lineTotal;
        taxTotal += lineTotal * (item.taxRate / 100);
      }

      // Round to 2 decimal places to avoid floating point precision issues
      subTotal = Math.round(subTotal * 100) / 100;
      taxTotal = Math.round(taxTotal * 100) / 100;

      const discountTotal = parseFloat(data.discountTotal) || 0;
      // Calculate grand total and round to nearest integer to match frontend
      const grandTotal = Math.round((subTotal + taxTotal - discountTotal) * 100) / 100;
      const roundedGrandTotal = Math.round(grandTotal);

      // Delete existing items
      await prisma.saleItem.deleteMany({
        where: { saleId: id },
      });

      // Create new items
      await prisma.saleItem.createMany({
        data: data.items.map((item: any) => ({
          saleId: id,
          productId: item.productId,
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
          rate: item.rate,
          lineTotal: (item.qtyKg || item.qtyPcs || 0) * item.rate,
          taxRate: item.taxRate,
          taxAmount: ((item.qtyKg || item.qtyPcs || 0) * item.rate) * (item.taxRate / 100),
        })),
      });

      // Update sale totals
      const updatedSale = await prisma.sale.update({
        where: { id },
        data: {
          subTotal,
          taxTotal,
          discountTotal,
          grandTotal: roundedGrandTotal,
        },
        include: {
          items: {
            include: { product: true },
          },
          customer: true,
          payments: true,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          storeId,
          actorUserId: userId,
          action: 'SALE_UPDATED',
          entityType: 'Sale',
          entityId: id,
          metaJson: { saleNo: updatedSale.saleNo, grandTotal },
        },
      });

      return updatedSale;
    } catch (error: any) {
      console.error('Failed to update sale:', error);
      reply.code(500).send({
        error: 'Failed to update sale',
        details: error.message,
      });
    }
  });
}

