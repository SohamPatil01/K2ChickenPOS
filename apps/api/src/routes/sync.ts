import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { getUser } from '../utils/auth.js';
import { syncEventsSchema } from '@azela-pos/shared';

export async function syncRoutes(fastify: FastifyInstance) {

  fastify.post('/events', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = syncEventsSchema.parse(request.body);
    const storeId = getUser(request).storeId;

    const ackedIds: string[] = [];

    for (const event of data.events) {
      try {
        // Create sync event record
        const syncEvent = await prisma.syncEvent.create({
          data: {
            storeId,
            deviceId: data.deviceId,
            eventType: event.eventType,
            payloadJson: event.payloadJson,
            clientCreatedAt: new Date(event.clientCreatedAt),
            serverReceivedAt: new Date(),
          },
        });

        // Process event based on type
        await processSyncEvent(event.eventType, event.payloadJson, storeId);

        // Mark as acked
        await prisma.syncEvent.update({
          where: { id: syncEvent.id },
          data: { ackedAt: new Date() },
        });

        ackedIds.push(syncEvent.id);
      } catch (error) {
        console.error('Error processing sync event:', error);
        // Continue processing other events
      }
    }

    return { ackedIds, success: true };
  });

  fastify.get('/bootstrap', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = getUser(request).storeId;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      reply.code(404).send({ error: 'Store not found' });
      return;
    }

    const ownerStoreId = store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
    if (!ownerStoreId) {
      reply.code(400).send({ error: 'Owner store not found' });
      return;
    }

    // Get products with prices
    const products = await prisma.product.findMany({
      where: {
        ownerStoreId,
        isActive: true,
      },
      include: {
        category: true,
        storeProductPrices: {
          where: {
            storeId,
            isActive: true,
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
    });

    // Get scale configs
    const scaleConfigs = await prisma.scaleBarcodeConfig.findMany({
      where: {
        storeId,
        isActive: true,
      },
    });

    // Get customers
    const customers = await prisma.customer.findMany({
      where: { storeId },
      include: { addresses: true },
      take: 1000, // Limit for bootstrap
    });

    return {
      products: products.map((p: any) => ({
        productId: p.id,
        sku: p.sku,
        plu: p.plu,
        name: p.name,
        categoryId: p.categoryId,
        categoryName: p.category.name,
        unitType: p.unitType,
        taxRate: p.taxRate,
        pricePerUnit: p.storeProductPrices[0]?.pricePerUnit || 0,
        isActive: p.isActive,
      })),
      scaleConfigs,
      customers: customers.map((c) => ({
        customerId: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        addresses: c.addresses,
      })),
      store: {
        id: store.id,
        name: store.name,
        type: store.type,
      },
    };
  });
}

async function processSyncEvent(
  eventType: string,
  payload: Record<string, any>,
  storeId: string
): Promise<void> {
  // Process different event types
  switch (eventType) {
    case 'SALE_CREATED':
    case 'SALE_PAID':
      // Sales are already created on server, just acknowledge
      break;
    case 'INVENTORY_ADJUSTED':
      // Inventory adjustments can be synced
      break;
    default:
      console.log(`Unhandled event type: ${eventType}`);
  }
}

