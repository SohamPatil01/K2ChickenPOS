// @ts-nocheck
import { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '@azela-pos/db';
import { getUser } from '../utils/auth.js';

const heldSnapshotSchema = z.object({
  customerId: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  discountTotal: z.number().default(0),
  discountType: z.enum(['amount', 'percentage']).default('amount'),
  discountPercentage: z.number().default(0),
  fulfillmentType: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  items: z
    .array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        qtyKg: z.number().optional(),
        qtyPcs: z.number().optional(),
        rate: z.number(),
        taxRate: z.number(),
        lineTotal: z.number(),
        metaJson: z.any().optional(),
      })
    )
    .min(1),
});

const upsertSchema = z.object({
  clientHeldId: z.string().min(8).max(64),
  label: z.string().min(1).max(80),
  snapshot: heldSnapshotSchema,
});

/**
 * Multi-register held carts via AuditLog (no schema migration).
 * entityType=HeldCart, entityId=clientHeldId, action=HELD_CART_UPSERT / HELD_CART_DELETE
 */
export async function heldCartRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const storeId = (getUser(request) as any).storeId;
    if (!storeId) {
      reply.code(400).send({ error: 'Store required' });
      return;
    }

    const rows = await prisma.auditLog.findMany({
      where: {
        storeId,
        entityType: 'HeldCart',
        action: { in: ['HELD_CART_UPSERT', 'HELD_CART_DELETE'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const latestById = new Map<string, any>();
    for (const row of rows) {
      const id = String(row.entityId || '');
      if (!id || latestById.has(id)) continue;
      latestById.set(id, row);
    }

    const items = [...latestById.values()]
      .filter((r) => r.action === 'HELD_CART_UPSERT')
      .map((r) => {
        const meta = (r.metaJson || {}) as any;
        return {
          id: r.entityId,
          label: meta.label || 'Hold',
          createdAt: r.createdAt,
          snapshot: meta.snapshot,
          lineCount: Array.isArray(meta.snapshot?.items) ? meta.snapshot.items.length : 0,
        };
      })
      .filter((r) => r.snapshot?.items?.length);

    return { items };
  });

  fastify.put('/', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const storeId = (getUser(request) as any).storeId;
    const userId = (getUser(request) as any).userId;
    if (!storeId || !userId) {
      reply.code(400).send({ error: 'Store and user required' });
      return;
    }
    const data = upsertSchema.parse(request.body);

    await prisma.auditLog.create({
      data: {
        storeId,
        actorUserId: userId,
        action: 'HELD_CART_UPSERT',
        entityType: 'HeldCart',
        entityId: data.clientHeldId,
        metaJson: {
          label: data.label,
          snapshot: data.snapshot,
        },
      },
    });

    return { ok: true, id: data.clientHeldId };
  });

  fastify.delete('/:id', { preHandler: [fastify.authenticate] }, async (request: any, reply: FastifyReply) => {
    const storeId = (getUser(request) as any).storeId;
    const userId = (getUser(request) as any).userId;
    const { id } = request.params as { id: string };
    if (!storeId || !userId || !id) {
      reply.code(400).send({ error: 'Invalid request' });
      return;
    }

    await prisma.auditLog.create({
      data: {
        storeId,
        actorUserId: userId,
        action: 'HELD_CART_DELETE',
        entityType: 'HeldCart',
        entityId: id,
        metaJson: { deleted: true },
      },
    });

    return { ok: true };
  });
}
