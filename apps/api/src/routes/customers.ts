// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { customerSchema, customerAddressSchema } from '@azela-pos/shared';
import { requireRole, getUser } from '../utils/auth.js';

interface QueryParams {
  phone?: string;
}

export async function customerRoutes(fastify: FastifyInstance) {

  fastify.get('/', async (request: any, reply: FastifyReply) => {
    const { phone } = (request.query as any);
    // Get default store (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
    const storeId = store?.id || '';

    if (phone) {
      const customer = await prisma.customer.findUnique({
        where: {
          storeId_phone: {
            storeId,
            phone,
          },
        },
        include: {
          addresses: true,
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

      return customer || null;
    }

    const customers = await prisma.customer.findMany({
      where: { storeId },
      include: {
        _count: {
          select: { sales: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return customers;
  });

  fastify.get('/:customerId', async (request: any, reply: FastifyReply) => {
    try {
      const { customerId } = (request.params as any);
      // Get default store (since auth is disabled)
      const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
      const storeId = store?.id || '';

      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          addresses: true,
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

      return customer;
    } catch (error: any) {
      console.error('Failed to get customer:', error);
      reply.code(500).send({ error: 'Failed to get customer' });
    }
  });

  fastify.post('/', async (request: any, reply: FastifyReply) => {
    const data = customerSchema.parse(request.body as any);
    // Get default store (since auth is disabled)
    const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
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
      },
      create: {
        storeId,
        name: data.name,
        phone: data.phone,
        email: data.email,
      },
      include: {
        addresses: true,
      },
    });

    return customer;
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

      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: updateData,
        include: {
          addresses: true,
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

      return customer;
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
      const store = await prisma.store.findFirst({ where: { type: 'OWNER' } });
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

  // Get customers with pending payments
  fastify.get('/pending-payments', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    try {
      const storeId = (getUser(request) as any).storeId;
      
      if (!storeId) {
        reply.code(400).send({ error: 'Store ID is required' });
        return;
      }

      // Get all customers with OPEN orders
      const customers = await prisma.customer.findMany({
        where: {
          storeId,
          sales: {
            some: {
              status: 'OPEN',
            },
          },
        },
        include: {
          sales: {
            where: {
              status: 'OPEN',
            },
            include: {
              payments: true,
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      // Calculate pending amounts for each customer
      const customersWithPending = customers.map((customer) => {
        let totalPending = 0;
        const openOrders = customer.sales.map((sale) => {
          const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
          const pending = sale.grandTotal - totalPaid;
          totalPending += pending;
          
          return {
            id: sale.id,
            saleNo: sale.saleNo,
            grandTotal: sale.grandTotal,
            totalPaid,
            pending,
            createdAt: sale.createdAt,
            items: sale.items,
          };
        });

        return {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          totalPending: Math.round(totalPending * 100) / 100,
          openOrders,
          orderCount: openOrders.length,
        };
      }).filter((c) => c.totalPending > 0); // Only return customers with pending payments

      return customersWithPending;
    } catch (error: any) {
      console.error('Failed to get pending payments:', error);
      reply.code(500).send({ error: 'Failed to get pending payments', details: error.message });
    }
  });

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
}

