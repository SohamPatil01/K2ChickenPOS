// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { getUser } from '../utils/auth.js';
import { syncEventsSchema } from '@azela-pos/shared';
import { applyOfflineCheckoutFromSync } from '../services/offlineCheckoutSync.js';
import { scaleBarcodeConfigScopeIdsFromStore } from '../utils/barcode.js';
import { resolveStoreIdFilter } from '../utils/storeScope.js';

export async function syncRoutes(fastify: FastifyInstance) {

  fastify.post('/events', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const data = syncEventsSchema.parse(request.body as any);
    const storeId = (getUser(request) as any).storeId;
    const userId = (getUser(request) as any).userId;

    /** Server SyncEvent row ids (audit). */
    const ackedIds: string[] = [];
    /** Dexie queuedEvents.id values — client clears queue rows by these. */
    const ackedQueueIds: number[] = [];

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
        await processSyncEvent(event.eventType, event.payloadJson, storeId, userId);

        // Mark as acked
        await prisma.syncEvent.update({
          where: { id: syncEvent.id },
          data: { ackedAt: new Date() },
        });

        ackedIds.push(syncEvent.id);
        if (typeof event.clientQueueId === 'number' && Number.isFinite(event.clientQueueId)) {
          ackedQueueIds.push(event.clientQueueId);
        }
      } catch (error) {
        console.error('Error processing sync event:', error);
        // Continue processing other events
      }
    }

    const syncRetentionCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    prisma.syncEvent
      .deleteMany({
        where: {
          storeId,
          ackedAt: { not: null },
          serverReceivedAt: { lt: syncRetentionCutoff },
        },
      })
      .catch((err) => console.warn('[Sync] Failed to prune old SyncEvent rows:', err));

    return { ackedIds, ackedQueueIds, success: true };
  });

  fastify.get('/bootstrap', { preHandler: [fastify.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const storeId = (getUser(request) as any).storeId;

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, type: true, parentOwnerStoreId: true }
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

    const scaleScopeIds = scaleBarcodeConfigScopeIdsFromStore(store) ?? [storeId];

    // Get scale configs (franchise till + parent owner / HQ)
    const scaleConfigs = await prisma.scaleBarcodeConfig.findMany({
      where: {
        storeId: { in: scaleScopeIds },
        isActive: true,
      },
    });

    const customerStoreFilter = await resolveStoreIdFilter(storeId, (getUser(request) as any).role);

    // Get customers
    const customers = await prisma.customer.findMany({
      where: { storeId: customerStoreFilter },
      include: { addresses: true },
      take: 200, // Offline bootstrap only — keep Neon egress low (5GB budget)
    });

    reply.header('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
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
  storeId: string,
  userId: string
): Promise<void> {
  switch (eventType) {
    case 'SALE_CREATED':
    case 'SALE_PAID':
      break;
    case 'OFFLINE_CHECKOUT_COMPLETE':
      await applyOfflineCheckoutFromSync(payload, storeId, userId);
      break;
    case 'INVENTORY_ADJUSTED':
      break;
    default:
      console.log(`Unhandled event type: ${eventType}`);
  }
}

