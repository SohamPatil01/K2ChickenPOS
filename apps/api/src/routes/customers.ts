// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { customerSchema, customerAddressSchema } from '@azela-pos/shared';
import { requireRole, getUser } from '../utils/auth.js';
import {
  customerAreaAddressInclude,
  upsertCustomerArea,
  withCustomerArea,
} from '../utils/customerArea.js';

interface QueryParams {
  phone?: string;
  q?: string;
}

export async function customerRoutes(fastify: FastifyInstance) {

  fastify.get('/', async (request: any, reply: FastifyReply) => {
    try {
    const { phone, q, limit: limitRaw } = (request.query as any);
    // Get default store (since auth is disabled)
    // Use the oldest OWNER store to ensure consistency
    const store = await prisma.store.findFirst({ 
      where: { type: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, type: true, parentOwnerStoreId: true }
    });
    const storeId = store?.id || '';

    if (!storeId) {
      reply.code(503).send({ error: 'Store not configured' });
      return;
    }

    /** Typeahead / dropdown search: name or phone partial match */
    const searchTerm = typeof q === 'string' ? q.trim() : '';
    if (searchTerm.length > 0) {
      const digits = searchTerm.replace(/\D/g, '');
      const orClause: Array<Record<string, unknown>> = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
      ];
      if (digits.length > 0 && digits !== searchTerm) {
        orClause.push({ phone: { contains: digits } });
      }
      const matches = await prisma.customer.findMany({
        where: {
          storeId,
          OR: orClause,
        },
        include: {
          addresses: customerAreaAddressInclude,
          _count: {
            select: { sales: true, addresses: true },
          },
        },
        orderBy: [{ name: 'asc' }, { phone: 'asc' }],
        take: 30,
      });
      return matches.map((c) => withCustomerArea(c));
    }

    if (phone) {
      const customer = await prisma.customer.findUnique({
        where: {
          storeId_phone: {
            storeId,
            phone,
          },
        },
        include: {
          addresses: customerAreaAddressInclude,
          sales: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              items: {
                include: { product: true },
              },
            },
          },
        },
      });

      return customer ? withCustomerArea(customer) : null;
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: { storeId },
        include: {
          _count: {
            select: { sales: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        // Customers tab needs the full roster; 1000 is enough for this store and stays light.
        take: Math.min(Math.max(parseInt(String(limitRaw || '1000'), 10) || 1000, 1), 2000),
      }),
      prisma.customer.count({ where: { storeId } }),
    ]);

    // Return a JSON array (legacy clients) + total in header for the customers tab count.
    reply.header('X-Customer-Total', String(total));
    reply.header('Cache-Control', 'private, no-store');
    return customers.map((c) => withCustomerArea(c));
    } catch (error: any) {
      console.error('[Customers] List failed:', error?.message || error);
      reply.header('Cache-Control', 'private, no-store, no-cache');
      reply.code(500).send({ error: 'Failed to load customers', details: error?.message });
    }
  });

  fastify.get('/:customerId', async (request: any, reply: FastifyReply) => {
    try {
      const { customerId } = (request.params as any);
      // Get default store (since auth is disabled)
      // Use the oldest OWNER store to ensure consistency
      const store = await prisma.store.findFirst({ 
        where: { type: 'OWNER' },
        orderBy: { createdAt: 'asc' }
      });
      const storeId = store?.id || '';

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          addresses: customerAreaAddressInclude,
          sales: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              items: {
                include: { product: true },
              },
            },
          },
        },
      });

      if (!customer || customer.storeId !== storeId) {
        reply.code(404).send({ error: 'Customer not found' });
        return;
      }

      return withCustomerArea(customer);
    } catch (error: any) {
      console.error('Failed to get customer:', error);
      reply.code(500).send({ error: 'Failed to get customer' });
    }
  });

  fastify.post('/', async (request: any, reply: FastifyReply) => {
    const data = customerSchema.parse(request.body as any);
    // Get default store (since auth is disabled)
    // Use the oldest OWNER store to ensure consistency
    const store = await prisma.store.findFirst({ 
      where: { type: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, type: true, parentOwnerStoreId: true }
    });
    const storeId = store?.id || '';

    const customer = await prisma.customer.upsert({
      where: {
        storeId_phone: {
          storeId,
          phone: data.phone,
        },
      },
      update: {
        name: data.name,
        email: data.email,
        ...(data.area !== undefined
          ? { area: data.area?.trim() || null }
          : {}),
      },
      create: {
        storeId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        area: data.area?.trim() || null,
      },
      include: {
        addresses: customerAreaAddressInclude,
      },
    });

    if (data.area !== undefined) {
      await upsertCustomerArea(prisma, customer.id, data.area);
      const refreshed = await prisma.customer.findUnique({
        where: { id: customer.id },
        include: { addresses: customerAreaAddressInclude },
      });
      return withCustomerArea(refreshed);
    }

    return withCustomerArea(customer);
  });

  fastify.put('/:customerId', async (request: any, reply: FastifyReply) => {
    try {
      const { customerId } = (request.params as any);
      const body = request.body as any;
      
      // Parse schema - email is optional, only include if provided
      // Trim and validate name and phone - ensure they're strings
      const trimmedName = String(body.name || '').trim();
      const trimmedPhone = String(body.phone || '').trim();
      
      console.log('Received customer update data:', {
        name: trimmedName,
        nameLength: trimmedName.length,
        phone: trimmedPhone,
        phoneLength: trimmedPhone.length,
        nameType: typeof body.name,
        phoneType: typeof body.phone,
        rawBody: body
      });
      
      if (!trimmedName || trimmedName.length === 0) {
        reply.code(400).send({ 
          error: 'Invalid input data', 
          details: [{ path: ['name'], message: 'Name is required and cannot be empty' }] 
        });
        return;
      }
      
      if (!trimmedPhone || trimmedPhone.length < 10) {
        reply.code(400).send({ 
          error: 'Invalid input data', 
          details: [{ path: ['phone'], message: 'Phone number must be at least 10 characters' }] 
        });
        return;
      }
      
      const data: any = {
        name: trimmedName,
        phone: trimmedPhone,
      };
      
      if (body.email !== undefined && body.email !== null && body.email !== '') {
        data.email = String(body.email).trim();
      }
      if (body.area !== undefined) {
        data.area = body.area ? String(body.area).trim() : undefined;
      }
      
      console.log('Validating customer data:', { name: data.name, nameLength: data.name.length, phone: data.phone, phoneLength: data.phone.length });
      const validatedData = customerSchema.parse(data);
      console.log('Validation passed:', validatedData);

      // Get customer first to find their storeId
      const existingCustomer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!existingCustomer) {
        reply.code(404).send({ error: 'Customer not found' });
        return;
      }

      // Use the customer's existing storeId
      const storeId = existingCustomer.storeId;

      // If phone is being changed, check if new phone already exists
      if (validatedData.phone && validatedData.phone !== existingCustomer.phone) {
        const phoneExists = await prisma.customer.findUnique({
          where: {
            storeId_phone: {
              storeId,
              phone: validatedData.phone,
            },
          },
        });

        if (phoneExists) {
          reply.code(400).send({ error: 'Phone number already exists for another customer' });
          return;
        }
      }

      // Update customer - only update fields that are provided
      const updateData: any = {
        name: validatedData.name,
        phone: validatedData.phone,
      };
      if (validatedData.email !== undefined) {
        updateData.email = validatedData.email;
      }
      if (body.area !== undefined) {
        updateData.area = body.area ? String(body.area).trim() || null : null;
      }

      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: updateData,
        include: {
          addresses: customerAreaAddressInclude,
          sales: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              items: {
                include: { product: true },
              },
            },
          },
        },
      });

      if (body.area !== undefined) {
        await upsertCustomerArea(
          prisma,
          customerId,
          body.area ? String(body.area).trim() : null
        );
        const refreshed = await prisma.customer.findUnique({
          where: { id: customerId },
          include: {
            addresses: customerAreaAddressInclude,
            sales: {
              take: 10,
              orderBy: { createdAt: 'desc' },
              include: {
                items: {
                  include: { product: true },
                },
              },
            },
          },
        });
        return withCustomerArea(refreshed);
      }

      return withCustomerArea(customer);
    } catch (error: any) {
      console.error('Failed to update customer:', error);
      console.error('Error stack:', error.stack);
      console.error('Error details:', {
        customerId: (request.params as any).customerId,
        body: request.body,
        errorName: error.name,
        errorMessage: error.message,
      });
      
      // Handle Zod validation errors
      if (error.name === 'ZodError') {
        reply.code(400).send({ 
          error: 'Invalid input data', 
          details: error.errors 
        });
        return;
      }
      
      // Handle Prisma errors
      if (error.code) {
        reply.code(500).send({ 
          error: 'Database error', 
          details: error.message,
          code: error.code 
        });
        return;
      }
      
      reply.code(500).send({ 
        error: 'Failed to update customer', 
        details: error.message 
      });
    }
  });

  // Delete customer - Only OWNER can delete
  fastify.delete('/:customerId', { preHandler: [fastify.authenticate, requireRole('OWNER')] }, async (request: any, reply: FastifyReply) => {
    try {
      const { customerId } = (request.params as any);
      const storeId = (getUser(request) as any).storeId;

      if (!storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      // Check if customer exists and belongs to store
      const existingCustomer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          sales: {
            take: 1,
          },
        },
      });

      if (!existingCustomer) {
        reply.code(404).send({ error: 'Customer not found' });
        return;
      }

      if (existingCustomer.storeId !== storeId) {
        reply.code(403).send({ error: 'Access denied' });
        return;
      }

      // Check if customer has any sales - warn but allow deletion
      if (existingCustomer.sales && existingCustomer.sales.length > 0) {
        // Customer has sales history, but we'll still allow deletion
        // The sales will remain but customer reference will be removed
      }

      // Delete customer (addresses will be cascade deleted)
      await prisma.customer.delete({
        where: { id: customerId },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          storeId,
          actorUserId: (getUser(request) as any).userId,
          action: 'CUSTOMER_DELETED',
          entityType: 'Customer',
          entityId: customerId,
          metaJson: {
            customerName: existingCustomer.name,
            customerPhone: existingCustomer.phone,
          },
        },
      });

      return { success: true, message: 'Customer deleted successfully' };
    } catch (error: any) {
      console.error('Failed to delete customer:', error);
      reply.code(500).send({ error: 'Failed to delete customer', details: error.message });
    }
  });

  fastify.post('/:customerId/addresses', async (request: any, reply: FastifyReply) => {
    const { customerId } = (request.params as any);
    const data = customerAddressSchema.parse(request.body as any);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      reply.code(404).send({ error: 'Customer not found' });
      return;
    }

    const address = await prisma.customerAddress.create({
      data: {
        customerId,
        label: data.label || 'Home',
        line1: data.line1,
        line2: data.line2,
        city: data.city,
        state: data.state,
        zip: data.zip,
        geoLat: data.geoLat,
        geoLng: data.geoLng,
      },
    });

    return address;
  });

  // Get customer purchase history
  fastify.get('/:customerId/purchase-history', async (request: any, reply: FastifyReply) => {
    try {
      const { customerId } = (request.params as any);
      const limit = parseInt((request.query as any).limit || '50');
      const offset = parseInt((request.query as any).offset || '0');

      // Get default store (since auth is disabled)
      const store = await prisma.store.findFirst({ where: { type: 'OWNER' }, select: { id: true, name: true, type: true, parentOwnerStoreId: true } });
      const storeId = store?.id || '';

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer || customer.storeId !== storeId) {
        reply.code(404).send({ error: 'Customer not found' });
        return;
      }

      const sales = await prisma.sale.findMany({
        where: {
          customerId,
          status: 'PAID',
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  unitType: true,
                },
              },
            },
          },
          payments: {
            select: {
              method: true,
              amount: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      });

      const totalCount = await prisma.sale.count({
        where: {
          customerId,
          status: 'PAID',
        },
      });

      return {
        sales,
        totalCount,
        hasMore: offset + limit < totalCount,
      };
    } catch (error: any) {
      console.error('Failed to load purchase history:', error);
      reply.code(500).send({ error: 'Failed to load purchase history' });
    }
  });

  // Get customers with pending payments (unpaid credit orders)
  // Shows all unpaid orders (OPEN status) that are either:
  // 1. Associated with a customer, OR
  // 2. Have CREDIT payment method
  fastify.get('/pending-payments', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      // Get storeId from authenticated user
      const user = getUser(request);
      const storeId = (user as any).storeId || '';
      const userRole = (user as any).role || '';
      
      console.log('[Pending Payments API] Using authenticated user storeId:', storeId, 'for user:', user.userId, 'role:', userRole);
      
      if (!storeId) {
        reply.code(400).send({ error: 'Store ID is required. Please ensure you are logged in.' });
        return;
      }

      // For OWNER users, get all franchise stores
      let storeIds: string[] = [storeId];
      if (userRole === 'OWNER') {
        const userStore = await prisma.store.findUnique({
          where: { id: storeId },
          select: { id: true, name: true, type: true, parentOwnerStoreId: true }
        });
        
        if (userStore && userStore.type === 'OWNER') {
          const franchises = await prisma.store.findMany({
            where: {
              type: 'FRANCHISE',
              parentOwnerStoreId: storeId,
            },
            select: { id: true },
          });
          storeIds = [storeId, ...franchises.map(f => f.id)];
          console.log('[Pending Payments API] Owner accessing pending payments from stores:', storeIds);
        }
      }

      console.log('[Pending Payments API] Querying for storeIds:', storeIds);

      // Get all sales that are credit orders:
      // 1. OPEN status orders (unpaid), OR
      // 2. Orders with CREDIT payment method (even if marked PAID, check for pending balance)
      const pendingSaleInclude = {
        customer: true,
        payments: true,
        createdBy: { select: { name: true } },
        deliveryOrder: { select: { deliveryFee: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                unitType: true,
              },
            },
          },
        },
      } as const;

      // First get OPEN sales (capped — full roster not needed for pending UI)
      const openSales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeId,
          status: 'OPEN',
        },
        include: pendingSaleInclude,
        orderBy: {
          createdAt: 'desc',
        },
        take: 200,
      });

      // Then get OPEN/PAID sales with CREDIT payments (excludes cancelled/refunded).
      const creditSales = await prisma.sale.findMany({
        where: {
          storeId: storeIds.length > 1 ? { in: storeIds } : storeId,
          status: { in: ['OPEN', 'PAID'] },
          payments: { some: { method: 'CREDIT' } },
        },
        include: pendingSaleInclude,
        orderBy: {
          createdAt: 'desc',
        },
        take: 200,
      });

      console.log('[Pending Payments API] Found', openSales.length, 'OPEN sales and', creditSales.length, 'credit sales');

      // Combine and deduplicate by sale ID
      const saleMap = new Map();
      [...openSales, ...creditSales].forEach(sale => {
        if (!saleMap.has(sale.id)) {
          saleMap.set(sale.id, sale);
        }
      });
      const openCreditSales = Array.from(saleMap.values());
      
      console.log('[Pending Payments API] Total unique sales after deduplication:', openCreditSales.length);

      // Group by customer
      const customerMap = new Map();

      for (const sale of openCreditSales) {
        if (sale.status === 'VOID' || sale.status === 'REFUNDED') continue;

        const allPayments = sale.payments || [];
        const hasCreditPayment = allPayments.some((p) => p.method === 'CREDIT');
        
        // For credit orders, calculate remaining balance excluding credit payments
        // Credit payments are promises to pay, not actual payments
        const actualPayments = allPayments.filter((p) => p.method !== 'CREDIT');
        const totalPaidActual = actualPayments.reduce((sum, p) => sum + p.amount, 0);
        const creditPayments = allPayments.filter((p) => p.method === 'CREDIT');
        const totalCreditAmount = creditPayments.reduce((sum, p) => sum + p.amount, 0);
        
        // Remaining balance = grandTotal - actual payments (credit doesn't count as payment)
        const remainingBalance = sale.grandTotal - totalPaidActual;
        
        // Skip fully settled orders — actual payments cover the bill total
        if (remainingBalance <= 0.01) continue;
        
        // For display: if it's a credit order, show remaining balance (credit doesn't reduce it)
        const displayPending = hasCreditPayment ? remainingBalance : Math.max(0, remainingBalance);

        // If sale has customer, group by customer
        // If no customer, group as "Walk-in Credit"
        if (sale.customerId && sale.customer) {
          const customerId = sale.customer.id;
          if (!customerMap.has(customerId)) {
            const customerArea = withCustomerArea(sale.customer)?.area ?? null;
            customerMap.set(customerId, {
              id: sale.customer.id,
              name: sale.customer.name,
              phone: sale.customer.phone,
              email: sale.customer.email,
              area: customerArea,
              totalPending: 0,
              openOrders: [],
              orderCount: 0,
            });
          }
          const customer = customerMap.get(customerId);
          customer.totalPending += displayPending;
          customer.openOrders.push({
            id: sale.id,
            saleNo: sale.saleNo,
            status: sale.status,
            subTotal: sale.subTotal,
            discountTotal: sale.discountTotal,
            taxTotal: sale.taxTotal,
            deliveryFee: sale.deliveryOrder?.deliveryFee ?? 0,
            grandTotal: sale.grandTotal,
            totalPaid: totalPaidActual, // Only actual payments, not credit
            creditAmount: totalCreditAmount, // Total credit amount
            pending: Math.round(displayPending * 100) / 100,
            remainingBalance: Math.round(remainingBalance * 100) / 100, // Remaining after actual payments
            createdAt: sale.createdAt,
            createdBy: sale.createdBy,
            payments: allPayments.map((p) => ({
              method: p.method,
              amount: p.amount,
            })),
            items: sale.items,
            hasCreditPayment,
          });
          customer.orderCount += 1;
        } else {
          // No customer - group as "Walk-in Credit" or use sale number
          const walkInKey = 'WALK_IN_CREDIT';
          if (!customerMap.has(walkInKey)) {
            customerMap.set(walkInKey, {
              id: walkInKey,
              name: 'Walk-in Credit',
              phone: '',
              email: '',
              totalPending: 0,
              openOrders: [],
              orderCount: 0,
            });
          }
          const walkIn = customerMap.get(walkInKey);
          walkIn.totalPending += displayPending;
          walkIn.openOrders.push({
            id: sale.id,
            saleNo: sale.saleNo,
            status: sale.status,
            subTotal: sale.subTotal,
            discountTotal: sale.discountTotal,
            taxTotal: sale.taxTotal,
            deliveryFee: sale.deliveryOrder?.deliveryFee ?? 0,
            grandTotal: sale.grandTotal,
            totalPaid: totalPaidActual, // Only actual payments, not credit
            creditAmount: totalCreditAmount, // Total credit amount
            pending: Math.round(displayPending * 100) / 100,
            remainingBalance: Math.round(remainingBalance * 100) / 100, // Remaining after actual payments
            createdAt: sale.createdAt,
            createdBy: sale.createdBy,
            payments: allPayments.map((p) => ({
              method: p.method,
              amount: p.amount,
            })),
            items: sale.items,
            hasCreditPayment,
          });
          walkIn.orderCount += 1;
        }
      }

      // Convert map to array and format
      const customersWithPending = Array.from(customerMap.values())
        .map((customer) => ({
          ...customer,
          totalPending: Math.round(customer.totalPending * 100) / 100,
        }))
        .filter((c) => c.orderCount > 0 && c.totalPending > 0.01)
        .sort((a, b) => {
          // Sort walk-in credit last
          if (a.id === 'WALK_IN_CREDIT') return 1;
          if (b.id === 'WALK_IN_CREDIT') return -1;
          return a.name.localeCompare(b.name);
        });

      return customersWithPending;
    } catch (error: any) {
      console.error('Failed to get pending payments:', error);
      reply.code(500).send({ error: 'Failed to get pending payments', details: error.message });
    }
  });

  // Settle pending balance for one customer in a single request (FIFO across open bills).
  // Avoids mid-loop failures from the old client-side Pay All (N sequential /sales/:id/pay calls).
  fastify.post(
    '/:customerId/settle-pending',
    { preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const { customerId } = request.params as { customerId: string };
        const body = (request.body as any) || {};
        const amount = Math.round(Number(body.amount) || 0);
        const methodRaw = String(body.method || 'CASH').toUpperCase().trim();
        const validMethods = ['CASH', 'CARD', 'UPI', 'ONLINE'];
        if (!validMethods.includes(methodRaw)) {
          reply.code(400).send({ error: `Invalid payment method. Use one of: ${validMethods.join(', ')}` });
          return;
        }
        if (amount <= 0) {
          reply.code(400).send({ error: 'Payment amount must be greater than 0' });
          return;
        }

        const userId = (getUser(request) as any).userId;
        const userStoreId = (getUser(request) as any).storeId;
        const userRole = (getUser(request) as any).role || '';

        if (customerId === 'WALK_IN_CREDIT') {
          reply.code(400).send({ error: 'Settle walk-in credit bills individually from the order list' });
          return;
        }

        const customer = await prisma.customer.findUnique({
          where: { id: customerId },
          select: { id: true, name: true, storeId: true },
        });
        if (!customer) {
          reply.code(404).send({ error: 'Customer not found' });
          return;
        }

        let storeIds: string[] = [userStoreId].filter(Boolean);
        if (userRole === 'OWNER') {
          const userStore = await prisma.store.findUnique({
            where: { id: userStoreId },
            select: { id: true, type: true },
          });
          if (userStore?.type === 'OWNER') {
            const franchises = await prisma.store.findMany({
              where: { type: 'FRANCHISE', parentOwnerStoreId: userStoreId },
              select: { id: true },
            });
            storeIds = [userStoreId, ...franchises.map((f) => f.id)];
          }
        }

        // Authorize by accessible sales, not Customer.storeId alone.
        // Customers are often created under the owner store but billed at a franchise
        // (pending list already keys off sale.storeId, so they show up there).
        const storeFilter =
          storeIds.length > 1 ? { in: storeIds } : storeIds[0];
        const hasAccess =
          storeIds.includes(customer.storeId) ||
          !!(await prisma.sale.findFirst({
            where: { customerId, storeId: storeFilter },
            select: { id: true },
          }));
        if (!hasAccess) {
          reply.code(403).send({ error: 'Customer is not in your store' });
          return;
        }

        const sales = await prisma.sale.findMany({
          where: {
            customerId,
            storeId: storeFilter,
            status: { in: ['OPEN', 'PAID'] },
            OR: [{ status: 'OPEN' }, { payments: { some: { method: 'CREDIT' } } }],
          },
          include: { payments: true },
          orderBy: { createdAt: 'asc' },
        });

        type Allocation = {
          saleId: string;
          saleNo: string;
          amount: number;
          fullyPaid: boolean;
          remainingAfter: number;
        };
        const allocations: Allocation[] = [];
        let pool = amount;

        for (const sale of sales) {
          if (pool <= 0) break;
          if (sale.status === 'VOID' || sale.status === 'REFUNDED') continue;

          const actualPaid = (sale.payments || [])
            .filter((p) => p.method !== 'CREDIT')
            .reduce((s, p) => s + p.amount, 0);
          const remaining = sale.grandTotal - actualPaid;
          if (remaining <= 0.01) continue;

          const payAmt = Math.min(pool, Math.round(remaining));
          if (payAmt <= 0) continue;

          const newActual = actualPaid + payAmt;
          const roundedGrand = Math.round(sale.grandTotal);
          const fullyPaid = newActual >= roundedGrand - 0.5;
          const remainingAfter = Math.max(0, Math.round(sale.grandTotal - newActual));

          allocations.push({
            saleId: sale.id,
            saleNo: sale.saleNo,
            amount: payAmt,
            fullyPaid,
            remainingAfter,
          });
          pool -= payAmt;
        }

        if (allocations.length === 0) {
          reply.code(400).send({ error: 'No pending balance found for this customer' });
          return;
        }

        const applied = allocations.reduce((s, a) => s + a.amount, 0);

        await prisma.$transaction(async (tx) => {
          for (const a of allocations) {
            await tx.payment.create({
              data: {
                saleId: a.saleId,
                method: methodRaw,
                amount: a.amount,
              },
            });
            await tx.sale.update({
              where: { id: a.saleId },
              data: { status: a.fullyPaid ? 'PAID' : 'OPEN' },
            });
          }
        });

        try {
          await prisma.auditLog.create({
            data: {
              storeId: customer.storeId || userStoreId,
              actorUserId: userId,
              action: 'CUSTOMER_SETTLE_PENDING',
              entityType: 'Customer',
              entityId: customerId,
              metaJson: {
                requested: amount,
                applied,
                unallocated: amount - applied,
                method: methodRaw,
                allocations,
              },
            },
          });
        } catch (auditErr) {
          console.warn('[settle-pending] audit log failed:', auditErr);
        }

        return {
          customerId,
          customerName: customer.name,
          requested: amount,
          applied,
          unallocated: amount - applied,
          method: methodRaw,
          allocations,
        };
      } catch (error: any) {
        console.error('Failed to settle pending payments:', error);
        reply.code(500).send({
          error: 'Failed to settle pending payments',
          details: error?.message,
        });
      }
    }
  );

  // Get customer loyalty information
  fastify.get('/:customerId/loyalty', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const { customerId } = (request.params as any);
      const storeId = (getUser(request) as any).storeId;

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          storeId: true,
          name: true,
          loyaltyPoints: true,
          loyaltyTier: true,
          totalSpent: true,
        },
      });

      if (!customer || customer.storeId !== storeId) {
        reply.code(404).send({ error: 'Customer not found' });
        return;
      }

      // Get recent loyalty transactions
      const transactions = await prisma.loyaltyTransaction.findMany({
        where: { customerId },
        include: {
          sale: {
            select: {
              id: true,
              saleNo: true,
              grandTotal: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      // Calculate tier based on total spent (handle null/undefined)
      const tierThresholds = {
        BRONZE: 0,
        SILVER: 5000,
        GOLD: 20000,
        PLATINUM: 50000,
      };

      const totalSpent = customer.totalSpent || 0;
      let calculatedTier = 'BRONZE';
      if (totalSpent >= tierThresholds.PLATINUM) {
        calculatedTier = 'PLATINUM';
      } else if (totalSpent >= tierThresholds.GOLD) {
        calculatedTier = 'GOLD';
      } else if (totalSpent >= tierThresholds.SILVER) {
        calculatedTier = 'SILVER';
      }

      // Update tier if changed
      if (customer.loyaltyTier !== calculatedTier) {
        await prisma.customer.update({
          where: { id: customerId },
          data: { loyaltyTier: calculatedTier },
        });
        customer.loyaltyTier = calculatedTier;
      }

      return {
        customer: {
          ...customer,
          loyaltyPoints: customer.loyaltyPoints || 0,
          totalSpent: totalSpent,
          loyaltyTier: calculatedTier,
        },
        transactions,
      };
    } catch (error: any) {
      console.error('Failed to load loyalty info:', error);
      reply.code(500).send({ error: 'Failed to load loyalty information', details: error.message });
    }
  });

  // Redeem loyalty points
  fastify.post('/:customerId/loyalty/redeem', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply): Promise<any> => {
    try {
      const { customerId } = (request.params as any);
      const { points, description } = (request.body as any);
      const storeId = (getUser(request) as any).storeId;
      const userId = (getUser(request) as any).userId;

      if (points <= 0) {
        reply.code(400).send({ error: 'Points must be greater than 0' });
        return;
      }

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, storeId: true, loyaltyPoints: true },
      });

      if (!customer || customer.storeId !== storeId) {
        reply.code(404).send({ error: 'Customer not found' });
        return;
      }

      if (customer.loyaltyPoints < points) {
        reply.code(400).send({ error: 'Insufficient loyalty points' });
        return;
      }

      const newBalance = customer.loyaltyPoints - points;

      // Update customer points
      await prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: newBalance },
      });

      // Create transaction record
      await prisma.loyaltyTransaction.create({
        data: {
          customerId,
          storeId,
          type: 'REDEEM',
          points: -points,
          balance: newBalance,
          description: description || `Redeemed ${points} points`,
          createdBy: userId,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          storeId,
          actorUserId: userId,
          action: 'LOYALTY_POINTS_REDEEMED',
          entityType: 'Customer',
          entityId: customerId,
          metaJson: {
            points,
            previousBalance: customer.loyaltyPoints,
            newBalance,
            description,
          },
        },
      });

      return {
        success: true,
        pointsRedeemed: points,
        newBalance,
      };
    } catch (error: any) {
      console.error('Failed to redeem points:', error);
      reply.code(500).send({ error: 'Failed to redeem loyalty points' });
    }
  });

  // Adjust loyalty points (for admins)
  fastify.post('/:customerId/loyalty/adjust', { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER')] }, async (request: any, reply: FastifyReply): Promise<any> => {
    try {
      const { customerId } = (request.params as any);
      const { points, description } = (request.body as any);
      const storeId = (getUser(request) as any).storeId;
      const userId = (getUser(request) as any).userId;

      if (!description) {
        reply.code(400).send({ error: 'Description is required' });
        return;
      }

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, storeId: true, loyaltyPoints: true },
      });

      if (!customer || customer.storeId !== storeId) {
        reply.code(404).send({ error: 'Customer not found' });
        return;
      }

      const newBalance = customer.loyaltyPoints + points;

      if (newBalance < 0) {
        reply.code(400).send({ error: 'Adjustment would result in negative balance' });
        return;
      }

      // Update customer points
      await prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: newBalance },
      });

      // Create transaction record
      await prisma.loyaltyTransaction.create({
        data: {
          customerId,
          storeId,
          type: 'ADJUST',
          points,
          balance: newBalance,
          description,
          createdBy: userId,
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          storeId,
          actorUserId: userId,
          action: 'LOYALTY_POINTS_ADJUSTED',
          entityType: 'Customer',
          entityId: customerId,
          metaJson: {
            points,
            previousBalance: customer.loyaltyPoints,
            newBalance,
            description,
          },
        },
      });

      return {
        success: true,
        pointsAdjusted: points,
        newBalance,
      };
    } catch (error: any) {
      console.error('Failed to adjust points:', error);
      reply.code(500).send({ error: 'Failed to adjust loyalty points' });
    }
  });

  // ------------------------------------------------------------------
  // One-time maintenance: recompute every customer's loyalty balance from
  // their purchase history at the current 1.25% rate, net of points already
  // redeemed. OWNER-only. Dry-run by default (preview), apply with dryRun:false.
  //
  // Rules (chosen by the operator):
  //   earned   = floor( sum(grandTotal of all NON-VOID sales) * 0.0125 )
  //   redeemed = sum(|REDEEM points|) excluding redemptions tied to VOID sales
  //              (those were already restored by the void flow)
  //   balance  = max(0, earned - redeemed)
  //   totalSpent / tier are recomputed from the same NON-VOID sales total.
  //
  // No schema changes: only loyaltyPoints / totalSpent / loyaltyTier are
  // written, plus an ADJUST loyalty transaction + audit log for traceability.
  // ------------------------------------------------------------------
  fastify.post('/loyalty/backfill', { preHandler: [fastify.authenticate, requireRole('OWNER')] }, async (request: any, reply: FastifyReply): Promise<any> => {
    try {
      const body = (request.body as any) || {};
      const dryRun = body.dryRun !== false; // default true — must explicitly opt in to apply
      const userId = (getUser(request) as any).userId;
      const POINTS_RATE = 0.0125;

      const tierFor = (totalSpent: number): string => {
        if (totalSpent >= 50000) return 'PLATINUM';
        if (totalSpent >= 20000) return 'GOLD';
        if (totalSpent >= 5000) return 'SILVER';
        return 'BRONZE';
      };

      // Aggregate non-void sales per customer (earning + spend base).
      const salesAgg = await prisma.sale.groupBy({
        by: ['customerId'],
        where: { customerId: { not: null }, status: { not: 'VOID' } },
        _sum: { grandTotal: true },
      });
      const salesByCustomer = new Map<string, number>();
      for (const row of salesAgg as any[]) {
        if (row.customerId) salesByCustomer.set(row.customerId, row._sum?.grandTotal || 0);
      }

      // All redeemed points per customer (stored negative).
      const redeemAgg = await prisma.loyaltyTransaction.groupBy({
        by: ['customerId'],
        where: { type: 'REDEEM' },
        _sum: { points: true },
      });
      const redeemByCustomer = new Map<string, number>();
      for (const row of redeemAgg as any[]) {
        redeemByCustomer.set(row.customerId, Math.abs(row._sum?.points || 0));
      }

      // Redemptions tied to VOID sales — exclude, since the void already
      // restored those points to the customer.
      const voidSales = await prisma.sale.findMany({
        where: { status: 'VOID' },
        select: { id: true },
      });
      const voidSaleIds = voidSales.map((s) => s.id);
      const voidRedeemByCustomer = new Map<string, number>();
      if (voidSaleIds.length > 0) {
        const voidRedeemAgg = await prisma.loyaltyTransaction.groupBy({
          by: ['customerId'],
          where: { type: 'REDEEM', saleId: { in: voidSaleIds } },
          _sum: { points: true },
        });
        for (const row of voidRedeemAgg as any[]) {
          voidRedeemByCustomer.set(row.customerId, Math.abs(row._sum?.points || 0));
        }
      }

      const customers = await prisma.customer.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          storeId: true,
          loyaltyPoints: true,
          totalSpent: true,
          loyaltyTier: true,
        },
      });

      type Change = {
        customerId: string;
        name: string | null;
        phone: string | null;
        storeId: string;
        oldPoints: number;
        newPoints: number;
        delta: number;
        oldTotalSpent: number;
        newTotalSpent: number;
        oldTier: string | null;
        newTier: string;
      };

      const changes: Change[] = [];
      let oldPointsSum = 0;
      let newPointsSum = 0;

      for (const c of customers) {
        const salesSum = salesByCustomer.get(c.id) || 0;
        const earned = Math.floor(salesSum * POINTS_RATE);
        const totalRedeem = redeemByCustomer.get(c.id) || 0;
        const voidRedeem = voidRedeemByCustomer.get(c.id) || 0;
        const redeemedActive = Math.max(0, totalRedeem - voidRedeem);
        const newPoints = Math.max(0, earned - redeemedActive);
        const newTotalSpent = Math.round(salesSum);
        const newTier = tierFor(newTotalSpent);

        const oldPoints = Math.round(c.loyaltyPoints || 0);
        const oldTotalSpent = Math.round(c.totalSpent || 0);

        oldPointsSum += oldPoints;
        newPointsSum += newPoints;

        if (
          newPoints !== oldPoints ||
          newTotalSpent !== oldTotalSpent ||
          newTier !== (c.loyaltyTier || 'BRONZE')
        ) {
          changes.push({
            customerId: c.id,
            name: c.name,
            phone: c.phone,
            storeId: c.storeId,
            oldPoints,
            newPoints,
            delta: newPoints - oldPoints,
            oldTotalSpent,
            newTotalSpent,
            oldTier: c.loyaltyTier,
            newTier,
          });
        }
      }

      const summary = {
        dryRun,
        pointsRate: POINTS_RATE,
        totalCustomers: customers.length,
        changedCount: changes.length,
        totals: {
          oldPointsSum,
          newPointsSum,
          deltaSum: newPointsSum - oldPointsSum,
        },
        sample: changes.slice(0, 100),
      };

      if (dryRun) {
        return { ...summary, applied: false };
      }

      // Apply in small chunks to stay within serverless limits.
      const chunkSize = 20;
      let applied = 0;
      for (let i = 0; i < changes.length; i += chunkSize) {
        const chunk = changes.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (ch) => {
            await prisma.customer.update({
              where: { id: ch.customerId },
              data: {
                loyaltyPoints: ch.newPoints,
                totalSpent: ch.newTotalSpent,
                loyaltyTier: ch.newTier,
              },
            });
            if (ch.delta !== 0) {
              await prisma.loyaltyTransaction.create({
                data: {
                  customerId: ch.customerId,
                  storeId: ch.storeId,
                  type: 'ADJUST',
                  points: ch.delta,
                  balance: ch.newPoints,
                  description: 'Loyalty recalculation backfill (1.25% of purchases, net of redemptions)',
                  createdBy: userId,
                },
              });
            }
          })
        );
        applied += chunk.length;
      }

      // Single summary audit log for the whole run.
      try {
        const actorStoreId = (getUser(request) as any).storeId;
        await prisma.auditLog.create({
          data: {
            storeId: actorStoreId,
            actorUserId: userId,
            action: 'LOYALTY_POINTS_BACKFILL',
            entityType: 'Customer',
            entityId: 'ALL',
            metaJson: {
              pointsRate: POINTS_RATE,
              totalCustomers: customers.length,
              changedCount: changes.length,
              oldPointsSum,
              newPointsSum,
              deltaSum: newPointsSum - oldPointsSum,
            },
          },
        });
      } catch (auditErr) {
        console.warn('[Loyalty Backfill] audit log failed (non-critical):', auditErr);
      }

      return { ...summary, applied: true, appliedCount: applied };
    } catch (error: any) {
      console.error('Failed to backfill loyalty points:', error);
      reply.code(500).send({ error: 'Failed to backfill loyalty points', details: error?.message });
    }
  });
}

