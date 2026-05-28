// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma, PaymentMethod } from '@azela-pos/db';
import { createSaleSchema, paySaleSchema } from '@azela-pos/shared';
import { requireRole } from '../utils/auth.js';
import { getUser } from '../utils/auth.js';
import { quantitiesForInventoryDeduction } from '../utils/saleItemLedger.js';

async function loadProductUnitTypes(productIds) {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (ids.length === 0) return new Map();
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, unitType: true },
  });
  return new Map(rows.map((r) => [r.id, r.unitType]));
}

/** CREDIT is a promise to pay — only non-credit amounts reduce the balance owed. */
function sumPaymentAmounts(paymentList: Array<{ method?: string; amount?: number }>) {
  let actual = 0;
  let credit = 0;
  for (const p of paymentList || []) {
    const amt = Number(p.amount) || 0;
    if (String(p.method || '').toUpperCase() === 'CREDIT') {
      credit += amt;
    } else {
      actual += amt;
    }
  }
  return { actual: Math.round(actual), credit: Math.round(credit) };
}

async function fetchSaleForPayResponse(saleId: string) {
  return prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      items: { include: { product: true } },
      payments: true,
      customer: true,
    },
  });
}

export async function saleRoutes(fastify: FastifyInstance) {

  // Get sales list
  fastify.get('/', async (request: any, reply: FastifyReply) => {
    try {
      const limit = parseInt((request.query as any).limit || '1000');
      const status = (request.query as any).status;
      const startDate = (request.query as any).startDate;
      const endDate = (request.query as any).endDate;
      const businessDayStart = (request.query as any).businessDayStart;
      const businessDayEnd = (request.query as any).businessDayEnd;
      const paymentMethod = (request.query as any).paymentMethod;

      // Try to get storeId from authenticated user, fallback to default store
      let storeId = '';
      let userId = '';
      let userRole = '';
      let storeIds: string[] = [];

      try {
        const user = getUser(request);
        storeId = (user as any).storeId;
        userId = (user as any).userId;
        userRole = (user as any).role;
      } catch (error) {
        // Not authenticated, use oldest OWNER store as fallback
        console.log('[Sales API] User not authenticated, using fallback store');
        const defaultStore = await prisma.store.findFirst({
          where: { type: 'OWNER' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, type: true, parentOwnerStoreId: true }
        });
        storeId = defaultStore?.id || '';
        userRole = 'OWNER';
      }

      if (!storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      // Get user's store to check if owner
      const userStore = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });

      if (!userStore) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      // For OWNER role, get sales from all franchise stores + owner store
      storeIds = [storeId];
      if (userRole === 'OWNER' && userStore.type === 'OWNER') {
        // Get all franchise stores under this owner
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: storeId,
          },
          select: { id: true },
        });
        storeIds = [storeId, ...franchises.map(f => f.id)];
        console.log('[Sales API] Owner accessing sales from stores:', storeIds);
      }

      const where: any = {
        storeId: userRole === 'OWNER' && userStore.type === 'OWNER'
          ? { in: storeIds }
          : storeId
      };

      if (status) {
        where.status = status;
      }
      if (paymentMethod) {
        where.payments = { some: { method: String(paymentMethod).toUpperCase() } };
      }
      if (startDate || endDate) {
        const parseBound = (value: string, endOfDay: boolean) => {
          if (value.includes('T')) {
            return new Date(value);
          }
          return new Date(value + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z'));
        };

        const createdStart = startDate ? parseBound(String(startDate), false) : undefined;
        const createdEnd = endDate ? parseBound(String(endDate), true) : undefined;

        const bStartYmd = businessDayStart
          ? String(businessDayStart).split('T')[0]
          : startDate
            ? String(startDate).split('T')[0]
            : undefined;
        const bEndYmd = businessDayEnd
          ? String(businessDayEnd).split('T')[0]
          : endDate
            ? String(endDate).split('T')[0]
            : undefined;

        const dateOr: any[] = [];
        if (createdStart || createdEnd) {
          const createdAt: any = {};
          if (createdStart) createdAt.gte = createdStart;
          if (createdEnd) createdAt.lte = createdEnd;
          dateOr.push({ createdAt });
        }
        if (bStartYmd && bEndYmd) {
          dateOr.push({
            businessDate: {
              gte: new Date(bStartYmd + 'T00:00:00.000Z'),
              lte: new Date(bEndYmd + 'T23:59:59.999Z'),
            },
          });
        }
        if (dateOr.length === 1) {
          Object.assign(where, dateOr[0]);
        } else if (dateOr.length > 1) {
          where.OR = dateOr;
        }
      }

      const sales = await prisma.sale.findMany({
        where,
        select: {
          id: true,
          saleNo: true,
          status: true,
          subTotal: true,
          discountTotal: true,
          taxTotal: true,
          grandTotal: true,
          createdAt: true,
          updatedAt: true,
          storeId: true,
          customerId: true,
          createdByUserId: true,
          items: {
            include: {
              product: true
            }
          },
          customer: true,
          payments: true,
          store: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          deliveryOrder: {
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return sales;
    } catch (error: any) {
      console.error('Failed to get sales:', error);
      reply.code(500).send({
        error: 'Failed to get sales',
        details: error.message
      });
    }
  });

  // Dashboard summary
  fastify.get('/dashboard', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Try to get user's store from authentication, fallback to default store
      let storeId = '';
      let userRole = '';

      try {
        const user = getUser(request as any);
        storeId = user?.storeId || '';
        userRole = (user as any).role || '';
      } catch (error) {
        // Not authenticated, use oldest OWNER store as fallback
        console.log('[Sales Dashboard] User not authenticated, using fallback store');
        const defaultStore = await prisma.store.findFirst({
          where: { type: 'OWNER' },
          orderBy: { createdAt: 'asc' },
          select: { id: true, name: true, type: true, parentOwnerStoreId: true }
        });
        storeId = defaultStore?.id || '';
        userRole = 'OWNER';
      }

      if (!storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      // Verify store exists
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
      });
      if (!store) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      // For OWNER role, get sales from all franchise stores + owner store
      let storeIds: string[] = [storeId];
      if (userRole === 'OWNER' && store.type === 'OWNER') {
        const franchises = await prisma.store.findMany({
          where: {
            type: 'FRANCHISE',
            parentOwnerStoreId: storeId,
          },
          select: { id: true },
        });
        storeIds = [storeId, ...franchises.map(f => f.id)];
        console.log('[Sales Dashboard] Owner accessing sales from stores:', storeIds);
      }

      // Use UTC to avoid timezone issues - consistent with frontend
      const todayStr = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD in UTC
      const today = new Date(todayStr + 'T00:00:00.000Z');
      const todayEnd = new Date(todayStr + 'T23:59:59.999Z');

      // Today's sales
      const todaySales = await prisma.sale.findMany({
        where: {
          storeId: userRole === 'OWNER' && store.type === 'OWNER' ? { in: storeIds } : storeId,
          status: 'PAID',
          createdAt: { gte: today, lte: todayEnd },
        },
      });

      const todayRevenue = Math.round(todaySales.reduce((sum: any, s: any) => sum + s.grandTotal, 0) * 1000) / 1000;
      const todayCount = todaySales.length;
      const todayAvgBill = todayCount > 0 ? Math.round((todayRevenue / todayCount) * 1000) / 1000 : 0;

      // This month - use UTC for consistency
      const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const monthSales = await prisma.sale.findMany({
        where: {
          storeId: userRole === 'OWNER' && store.type === 'OWNER' ? { in: storeIds } : storeId,
          status: 'PAID',
          createdAt: { gte: monthStart },
        },
      });

      const monthRevenue = Math.round(monthSales.reduce((sum: any, s: any) => sum + s.grandTotal, 0) * 1000) / 1000;
      const monthCount = monthSales.length;

      // Recent sales
      const recentSales = await prisma.sale.findMany({
        where: {
          storeId: userRole === 'OWNER' && store.type === 'OWNER' ? { in: storeIds } : storeId
        },
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
    } catch (error: any) {
      console.error('Dashboard error:', error);
      reply.code(500).send({
        error: 'Failed to load dashboard',
        details: error.message
      });
    }
  });

  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      console.log('[Sales API] Creating sale, request body:', request.body);
      const data = createSaleSchema.parse(request.body as any);
      const user = getUser(request);
      const storeId = (user as any).storeId;
      const userId = (user as any).userId;

      console.log('[Sales API] Store ID:', storeId, 'User ID:', userId);

      if (!storeId) {
        console.error('[Sales API] Store ID missing');
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      if (!userId) {
        console.error('[Sales API] User ID missing');
        reply.code(400).send({ error: 'User ID is required' });
        return;
      }

      // Get store
      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, type: true, parentOwnerStoreId: true }
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
            grandTotal: Math.round(subTotal + taxTotal),
            createdByUserId: userId,
            items: {
              create: data.items.map((item: any) => {
                const qty = item.qtyKg || item.qtyPcs || 0;
                const lineTotal = Math.round(qty * item.rate * 100) / 100;
                const taxAmount = Math.round(lineTotal * (item.taxRate / 100) * 100) / 100;
                return {
                  productId: item.productId,
                  qtyKg: item.qtyKg,
                  qtyPcs: item.qtyPcs,
                  rate: item.rate,
                  lineTotal,
                  taxRate: item.taxRate,
                  taxAmount,
                };
              }),
            },
          },
          include: {
            items: true,
          },
        });

        // Deduct inventory for OPEN orders (even when discount override is required)
        const unitMapOverride = await loadProductUnitTypes(sale.items.map((i) => i.productId));
        for (const item of sale.items) {
          const ut = unitMapOverride.get(item.productId) || 'KG';
          const { qtyKg, qtyPcs } = quantitiesForInventoryDeduction(item, ut);
          if ((qtyKg != null && qtyKg > 0) || (qtyPcs != null && qtyPcs > 0)) {
            await prisma.inventoryLedger.create({
              data: {
                storeId,
                productId: item.productId,
                type: 'OUT',
                qtyKg,
                qtyPcs,
                reason: 'SALE',
                refId: sale.id,
              },
            });
          }
        }

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
            create: data.items.map((item: any) => {
              const qty = item.qtyKg || item.qtyPcs || 0;
              const lineTotal = Math.round(qty * item.rate * 100) / 100;
              const taxAmount = Math.round(lineTotal * (item.taxRate / 100) * 100) / 100;
              return {
                productId: item.productId,
                qtyKg: item.qtyKg,
                qtyPcs: item.qtyPcs,
                rate: item.rate,
                lineTotal,
                taxRate: item.taxRate,
                taxAmount,
                metaJson: item.metaJson,
              };
            }),
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
      const unitMapCreate = await loadProductUnitTypes(sale.items.map((i) => i.productId));
      for (const item of sale.items) {
        const ut = unitMapCreate.get(item.productId) || 'KG';
        const { qtyKg, qtyPcs } = quantitiesForInventoryDeduction(item, ut);
        if ((qtyKg != null && qtyKg > 0) || (qtyPcs != null && qtyPcs > 0)) {
          await prisma.inventoryLedger.create({
            data: {
              storeId,
              productId: item.productId,
              type: 'OUT',
              qtyKg,
              qtyPcs,
              reason: 'SALE',
              refId: sale.id,
            },
          });
        }
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
      console.error('Error stack:', error.stack);
      console.error('Request body:', request.body);
      console.error('User:', getUser(request));

      // Check for specific error types
      if (error.code === 'P2002') {
        reply.code(400).send({
          error: 'Duplicate sale number. Please try again.',
          details: error.message
        });
        return;
      }

      if (error.name === 'ZodError') {
        reply.code(400).send({
          error: 'Invalid request data',
          details: error.errors
        });
        return;
      }

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

      console.log('[Payment API] Processing payment for sale:', id, 'Store ID:', storeId, 'User ID:', userId);

      if (!storeId || !userId) {
        console.error('[Payment API] Missing storeId or userId. StoreId:', storeId, 'UserId:', userId);
        reply.code(400).send({ error: 'Store ID and User ID are required' });
        return;
      }

      // First check if sale exists (without storeId filter to get better error message)
      const saleExists = await prisma.sale.findUnique({
        where: { id },
        select: { id: true, storeId: true, saleNo: true },
      });

      if (!saleExists) {
        console.error('[Payment API] Sale not found:', id);
        reply.code(404).send({ error: 'Sale not found', saleId: id });
        return;
      }

      // Get user's role and store to check access
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              type: true,
            }
          }
        },
      });

      if (!user) {
        console.error('[Payment API] User not found:', userId);
        reply.code(401).send({ error: 'User not found' });
        return;
      }

      // Check if user has access to this sale's store
      let hasAccess = false;

      if (saleExists.storeId === storeId) {
        // Direct match - user's store matches sale's store
        hasAccess = true;
      } else if (user.role === 'OWNER' && user.store?.type === 'OWNER') {
        // OWNER users can access sales from their franchise stores
        const saleStore = await prisma.store.findUnique({
          where: { id: saleExists.storeId },
          select: { id: true, type: true, parentOwnerStoreId: true },
        });

        if (saleStore && saleStore.type === 'FRANCHISE' && saleStore.parentOwnerStoreId === storeId) {
          // Sale belongs to a franchise store owned by this user
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        console.error('[Payment API] User does not have access to sale. Sale storeId:', saleExists.storeId, 'User storeId:', storeId, 'User role:', user.role);
        reply.code(403).send({
          error: 'You do not have permission to process this sale',
          saleId: id,
          saleStoreId: saleExists.storeId,
          userStoreId: storeId,
          userRole: user.role,
        });
        return;
      }

      // Fetch sale with items and payments using the sale's storeId (not user's storeId)
      // This allows OWNER users to pay for sales from franchise stores
      const sale = await prisma.sale.findUnique({
        where: {
          id,
        },
        include: {
          items: { include: { product: true } },
          payments: true,
        },
      });

      if (!sale) {
        console.error('[Payment API] Sale not found:', id);
        reply.code(404).send({ error: 'Sale not found' });
        return;
      }

      // Verify the sale's storeId matches what we checked earlier
      if (sale.storeId !== saleExists.storeId) {
        console.error('[Payment API] Sale storeId mismatch');
        reply.code(500).send({ error: 'Internal error: Sale data inconsistency' });
        return;
      }

      // Get existing payments to check if it's a credit order
      const existingPayments = sale.payments || [];
      const hasCreditPayment = existingPayments.some((p) => p.method === 'CREDIT');

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

      const existingSums = sumPaymentAmounts(allExistingPayments);
      const incomingSums = sumPaymentAmounts(payments);
      const roundedGrandTotal = Math.round(sale.grandTotal);

      const newActualTotal = existingSums.actual + incomingSums.actual;
      const newCreditTotal = existingSums.credit + incomingSums.credit;
      const newPaymentsTotal = payments.reduce(
        (sum: any, p) => sum + (Number(p.amount) || 0),
        0
      );

      const hasNewCreditPayment = payments.some((p: any) => p.method === 'CREDIT');
      const hasAnyCreditPayment = hasCreditPayment || hasNewCreditPayment;

      const returnExistingSaleIfPaid = async (reason: string) => {
        console.warn(`[Payment API] ${reason}:`, id);
        const freshSale = await fetchSaleForPayResponse(id);
        if (freshSale) {
          return freshSale;
        }
        return null;
      };

      if (sale.status === 'OPEN' || hasAnyCreditPayment) {
        if (newActualTotal > roundedGrandTotal + 0.5) {
          const idempotent =
            incomingSums.actual > 0 && existingSums.actual >= roundedGrandTotal - 0.5;
          if (idempotent) {
            const fresh = await returnExistingSaleIfPaid('Duplicate actual payment ignored');
            if (fresh) return fresh;
          }
          reply.code(400).send({
            error: 'Payment amount exceeds remaining balance',
            details: `Actual paid: ₹${newActualTotal}, Grand total: ₹${roundedGrandTotal}`,
          });
          return;
        }

        if (
          incomingSums.credit > 0 &&
          incomingSums.actual === 0 &&
          existingSums.credit >= roundedGrandTotal - 0.5
        ) {
          const fresh = await returnExistingSaleIfPaid('Duplicate credit payment ignored');
          if (fresh) return fresh;
        }

        if (newCreditTotal > roundedGrandTotal + 0.5) {
          if (existingSums.credit >= roundedGrandTotal - 0.5) {
            const fresh = await returnExistingSaleIfPaid(
              'Duplicate credit payment ignored (over credit)'
            );
            if (fresh) return fresh;
          }
          reply.code(400).send({
            error: 'Credit amount exceeds bill total',
            details: `Credit recorded: ₹${newCreditTotal}, Grand total: ₹${roundedGrandTotal}`,
          });
          return;
        }
      } else {
        if (Math.abs(newPaymentsTotal - roundedGrandTotal) > 0.5) {
          reply.code(400).send({ error: 'Payment amount mismatch' });
          return;
        }
      }

      const isCompletionOnly =
        newPaymentsTotal === 0 &&
        (existingSums.actual >= roundedGrandTotal - 0.5 ||
          (hasCreditPayment && existingSums.credit >= roundedGrandTotal - 0.5));

      // Create payments - ensure method is valid enum value (skip when completion-only with no positive amounts)
      const validPaymentMethods: PaymentMethod[] = ['CASH', 'CARD', 'UPI', 'CREDIT', 'ONLINE'];
      const paymentData: Array<{
        saleId: string;
        method: PaymentMethod;
        amount: number;
        txnRef: string | null;
      }> = [];

      for (const p of payments) {
        const methodStr = String((p as any).method || '').toUpperCase().trim();
        if (!validPaymentMethods.includes(methodStr as PaymentMethod)) {
          reply.code(400).send({
            error: `Invalid payment method: "${(p as any).method}". Must be one of: ${validPaymentMethods.join(', ')}`,
          });
          return;
        }
        const amount = Number((p as any).amount);
        if (Number.isNaN(amount) || !Number.isFinite(amount)) {
          reply.code(400).send({ error: 'Invalid payment amount' });
          return;
        }
        paymentData.push({
          saleId: id,
          method: methodStr as PaymentMethod,
          amount,
          txnRef: (p as any).txnRef || null,
        });
      }

      const paymentsToCreate = paymentData.filter((p) => p.amount > 0);

      let saleStatus = sale.status;

      const isSettledWithActual = newActualTotal >= roundedGrandTotal - 0.5;
      const isCreditOnlyBooked =
        hasAnyCreditPayment &&
        newActualTotal < roundedGrandTotal - 0.5 &&
        newCreditTotal >= roundedGrandTotal - 0.5;

      if (isSettledWithActual || isCompletionOnly) {
        saleStatus = 'PAID';
      } else if (isCreditOnlyBooked || sale.status === 'OPEN') {
        saleStatus = 'OPEN';
      }

      const updatedSale = await prisma.$transaction(async (tx) => {
        if (paymentsToCreate.length > 0) {
          console.log('[Payment] Creating payments:', JSON.stringify(paymentsToCreate, null, 2));
          await tx.payment.createMany({
            data: paymentsToCreate,
          });
        } else if (isCompletionOnly) {
          console.log(
            '[Payment] Completion-only (credit order already fully paid); skipping payment createMany, will update status to PAID'
          );
        }

        return tx.sale.update({
          where: { id },
          data: { status: saleStatus },
          include: {
            items: { include: { product: true } },
            payments: true,
            customer: true,
          },
        });
      });

      // Update inventory - only if not already deducted
      // Check if inventory was already deducted for this sale (when order was created)
      // Use sale's storeId, not user's storeId (for OWNER users paying franchise sales)
      try {
        // Check if any ledger entries exist for this sale to prevent double-deduction
        const existingLedgerCount = await prisma.inventoryLedger.count({
          where: {
            refId: id,
            reason: 'SALE',
            storeId: sale.storeId, // Also check by storeId to be more precise
          },
        });

        // Only create inventory ledger if no entries exist for this sale
        // This prevents double-deduction for credit/OPEN orders
        if (existingLedgerCount === 0) {
          for (const item of sale.items) {
            const ut = item.product?.unitType || 'KG';
            const { qtyKg, qtyPcs } = quantitiesForInventoryDeduction(item, ut);
            if ((qtyKg != null && qtyKg > 0) || (qtyPcs != null && qtyPcs > 0)) {
              await prisma.inventoryLedger.create({
                data: {
                  storeId: sale.storeId, // Use sale's storeId, not user's storeId
                  productId: item.productId,
                  type: 'OUT',
                  qtyKg,
                  qtyPcs,
                  reason: 'SALE',
                  refId: id,
                },
              });
            }
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
                    storeId: sale.storeId, // Use sale's storeId, not user's storeId
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
      // Use sale's storeId for audit log to track which store the sale belongs to
      try {
        await prisma.auditLog.create({
          data: {
            storeId: sale.storeId, // Use sale's storeId, not user's storeId
            actorUserId: userId,
            action: 'SALE_PAID',
            entityType: 'Sale',
            entityId: id,
            metaJson: { payments, userStoreId: storeId }, // Include user's storeId in metadata for tracking
          },
        });
      } catch (auditError: any) {
        // Log audit error but don't fail payment
        console.warn('Failed to create audit log (non-critical):', auditError);
      }

      return updatedSale;
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        reply.code(400).send({
          error: 'Invalid payment data',
          details: error.issues || error.errors,
        });
        return;
      }
      const message = error?.message || 'Unknown error';
      console.error('Failed to process payment:', error);
      console.error('Error details:', {
        name: error?.name,
        message,
        code: error?.code,
        stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
      });
      reply.code(500).send({
        error: message,
        details: message,
        code: error?.code,
      });
    }
  });

  fastify.post('/:id/void', { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const { id } = (request.params as any);
      const { reason } = (request.body as any) || {};
      const storeId = (getUser(request) as any).storeId;
      const userId = (getUser(request) as any).userId;

      console.log('[Void API] Processing void for sale:', id, 'Store ID:', storeId, 'User ID:', userId);

      if (!storeId || !userId) {
        console.error('[Void API] Missing storeId or userId. StoreId:', storeId, 'UserId:', userId);
        reply.code(400).send({ error: 'Store ID and User ID are required' });
        return;
      }

      // First check if sale exists (without storeId filter to get better error message)
      const saleExists = await prisma.sale.findUnique({
        where: { id },
        select: { id: true, storeId: true, saleNo: true, status: true },
      });

      if (!saleExists) {
        console.error('[Void API] Sale not found:', id);
        reply.code(404).send({ error: 'Sale not found', saleId: id });
        return;
      }

      // Get user's role and store to check access
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          store: {
            select: {
              id: true,
              name: true,
              type: true,
            }
          }
        },
      });

      if (!user) {
        console.error('[Void API] User not found:', userId);
        reply.code(401).send({ error: 'User not found' });
        return;
      }

      // Check if user has access to this sale's store
      let hasAccess = false;

      if (saleExists.storeId === storeId) {
        // Direct match - user's store matches sale's store
        hasAccess = true;
      } else if (user.role === 'OWNER' && user.store?.type === 'OWNER') {
        // OWNER users can access sales from their franchise stores
        const saleStore = await prisma.store.findUnique({
          where: { id: saleExists.storeId },
          select: { id: true, type: true, parentOwnerStoreId: true },
        });

        if (saleStore && saleStore.type === 'FRANCHISE' && saleStore.parentOwnerStoreId === storeId) {
          // Sale belongs to a franchise store owned by this user
          hasAccess = true;
        }
      }

      if (!hasAccess) {
        console.error('[Void API] User does not have access to sale. Sale storeId:', saleExists.storeId, 'User storeId:', storeId, 'User role:', user.role);
        reply.code(403).send({
          error: 'You do not have permission to void this sale',
          saleId: id,
          saleStoreId: saleExists.storeId,
          userStoreId: storeId,
          userRole: user.role,
        });
        return;
      }

      // Fetch full sale data with items
      const sale = await prisma.sale.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!sale) {
        console.error('[Void API] Sale not found after access check:', id);
        reply.code(404).send({ error: 'Sale not found' });
        return;
      }

      if (sale.status === 'VOID') {
        reply.code(400).send({ error: 'Sale already voided' });
        return;
      }

      // Allow voiding both PAID and OPEN sales
      if (sale.status !== 'PAID' && sale.status !== 'OPEN') {
        reply.code(400).send({ error: 'Only paid or open sales can be voided' });
        return;
      }

      // Restore inventory when voiding a sale
      // Find existing inventory deductions for this sale
      const existingLedgers = await prisma.inventoryLedger.findMany({
        where: {
          refId: id,
          reason: 'SALE',
          storeId: sale.storeId,
        },
      });

      console.log(`[Void API] Found ${existingLedgers.length} inventory ledger entries to reverse for sale ${id}`);

      // Restore inventory by creating IN entries for each OUT entry
      for (const ledger of existingLedgers) {
        // Only restore if there's actual quantity
        const hasQtyKg = ledger.qtyKg !== null && ledger.qtyKg !== undefined && ledger.qtyKg > 0;
        const hasQtyPcs = ledger.qtyPcs !== null && ledger.qtyPcs !== undefined && ledger.qtyPcs > 0;

        if (hasQtyKg || hasQtyPcs) {
          await prisma.inventoryLedger.create({
            data: {
              storeId: sale.storeId,
              productId: ledger.productId,
              type: 'IN', // Restore inventory
              qtyKg: hasQtyKg ? ledger.qtyKg : null,
              qtyPcs: hasQtyPcs ? ledger.qtyPcs : null,
              reason: 'ADJUSTMENT', // Use ADJUSTMENT reason for voided sales (adjusting inventory back)
              refId: id,
            },
          });
          console.log(`[Void API] Restored inventory for product ${ledger.productId}: ${ledger.qtyKg || 0} kg, ${ledger.qtyPcs || 0} pcs`);
        }
      }

      const updatedSale = await prisma.sale.update({
        where: { id },
        data: { status: 'VOID' },
      });

      // Use sale's storeId for audit log to track which store the sale belongs to
      await prisma.auditLog.create({
        data: {
          storeId: sale.storeId, // Use sale's storeId, not user's storeId
          actorUserId: userId,
          action: 'SALE_VOIDED',
          entityType: 'Sale',
          entityId: id,
          metaJson: {
            reason: reason || 'No reason provided',
            userStoreId: storeId,
            inventoryRestored: existingLedgers.length,
          }, // Include user's storeId in metadata
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
        const ut = item.product?.unitType || 'KG';
        const { qtyKg, qtyPcs } = quantitiesForInventoryDeduction(item, ut);
        if ((qtyKg != null && qtyKg > 0) || (qtyPcs != null && qtyPcs > 0)) {
          await prisma.inventoryLedger.create({
            data: {
              storeId,
              productId: item.productId,
              type: 'IN',
              qtyKg,
              qtyPcs,
              reason: 'ADJUSTMENT',
              refId: id,
            },
          });
        }
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

      // Check if user is OWNER, MANAGER, or CASHIER
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || (user.role !== 'OWNER' && user.role !== 'MANAGER' && user.role !== 'CASHIER')) {
        reply.code(403).send({ error: 'Only owners, managers, and cashiers can edit orders' });
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

      // Adjust inventory when items are changed
      // First, reverse the existing inventory deductions
      const existingLedgers = await prisma.inventoryLedger.findMany({
        where: {
          refId: id,
          reason: 'SALE',
          storeId: existingSale.storeId,
        },
      });

      // Reverse existing inventory deductions
      for (const ledger of existingLedgers) {
        await prisma.inventoryLedger.create({
          data: {
            storeId: existingSale.storeId,
            productId: ledger.productId,
            type: 'IN', // Reverse the OUT entry
            qtyKg: ledger.qtyKg,
            qtyPcs: ledger.qtyPcs,
            reason: 'ADJUSTMENT',
            refId: id,
          },
        });
      }

      // Delete existing items
      await prisma.saleItem.deleteMany({
        where: { saleId: id },
      });

      // Create new items
      const newItems = await prisma.saleItem.createMany({
        data: data.items.map((item: any) => {
          const qty = item.qtyKg || item.qtyPcs || 0;
          const lineTotal = Math.round(qty * item.rate * 100) / 100;
          const taxAmount = Math.round(lineTotal * (item.taxRate / 100) * 100) / 100;
          return {
            saleId: id,
            productId: item.productId,
            qtyKg: item.qtyKg,
            qtyPcs: item.qtyPcs,
            rate: item.rate,
            lineTotal,
            taxRate: item.taxRate,
            taxAmount,
          };
        }),
      });

      const unitMapPut = await loadProductUnitTypes(data.items.map((i) => i.productId));
      for (const item of data.items) {
        const ut = unitMapPut.get(item.productId) || 'KG';
        const { qtyKg, qtyPcs } = quantitiesForInventoryDeduction(item, ut);
        if ((qtyKg != null && qtyKg > 0) || (qtyPcs != null && qtyPcs > 0)) {
          await prisma.inventoryLedger.create({
            data: {
              storeId: existingSale.storeId,
              productId: item.productId,
              type: 'OUT',
              qtyKg,
              qtyPcs,
              reason: 'SALE',
              refId: id,
            },
          });
        }
      }

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

