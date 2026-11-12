// @ts-nocheck
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma, Prisma } from '@azela-pos/db';
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
    const deadLetter: Array<{ clientQueueId?: number; error: string }> = [];

    for (const event of data.events) {
      const clientEventId =
        (typeof event.clientEventId === 'string' && event.clientEventId.trim()) ||
        (typeof event.clientQueueId === 'number'
          ? `q:${event.clientQueueId}:${event.eventType}:${event.clientCreatedAt}`
          : `h:${event.eventType}:${event.clientCreatedAt}:${JSON.stringify(event.payloadJson).slice(0, 120)}`);

      try {
        let syncEvent;
        try {
          syncEvent = await prisma.syncEvent.create({
            data: {
              storeId,
              deviceId: data.deviceId,
              clientEventId,
              eventType: event.eventType,
              payloadJson: event.payloadJson,
              clientCreatedAt: new Date(event.clientCreatedAt),
              serverReceivedAt: new Date(),
              status: 'PENDING',
            },
          });
        } catch (err: any) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            // Duplicate client event — acknowledge without reprocessing if already done
            const existing = await prisma.syncEvent.findFirst({
              where: { storeId, deviceId: data.deviceId, clientEventId },
            });
            if (existing?.ackedAt || existing?.status === 'PROCESSED') {
              ackedIds.push(existing.id);
              if (typeof event.clientQueueId === 'number') {
                ackedQueueIds.push(event.clientQueueId);
              }
              continue;
            }
            syncEvent = existing;
            if (!syncEvent) throw err;
          } else {
            throw err;
          }
        }

        // Process only after the SyncEvent row exists; ack only after success
        await processSyncEvent(event.eventType, event.payloadJson, storeId, userId);

        await prisma.syncEvent.update({
          where: { id: syncEvent.id },
          data: { ackedAt: new Date(), status: 'PROCESSED', processingError: null },
        });

        ackedIds.push(syncEvent.id);
        if (typeof event.clientQueueId === 'number' && Number.isFinite(event.clientQueueId)) {
          ackedQueueIds.push(event.clientQueueId);
        }
      } catch (error: any) {
        console.error('Error processing sync event:', error);
        const msg = error?.message || 'sync failed';
        if (typeof event.clientQueueId === 'number') {
          deadLetter.push({ clientQueueId: event.clientQueueId, error: msg });
        }
        // Persist failure when we can identify the row
        try {
          await prisma.syncEvent.updateMany({
            where: {
              storeId,
              deviceId: data.deviceId,
              clientEventId,
              ackedAt: null,
            },
            data: { status: 'FAILED', processingError: msg.slice(0, 500) },
          });
        } catch {
          /* ignore */
        }
      }
    }

    const syncRetentionCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    prisma.syncEvent
      .deleteMany({
        where: {
          storeId,
          ackedAt: { not: null },
          status: 'PROCESSED',
          serverReceivedAt: { lt: syncRetentionCutoff },
        },
      })
      .catch((err) => console.warn('[Sync] Failed to prune old SyncEvent rows:', err));

    return { ackedIds, ackedQueueIds, deadLetter, success: true };
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

    const scaleConfigs = await prisma.scaleBarcodeConfig.findMany({
      where: {
        storeId: { in: scaleScopeIds },
        isActive: true,
      },
    });

    const customerStoreFilter = await resolveStoreIdFilter(storeId, (getUser(request) as any).role);

    const customers = await prisma.customer.findMany({
      where: { storeId: customerStoreFilter },
      include: { addresses: true },
      take: 200,
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
