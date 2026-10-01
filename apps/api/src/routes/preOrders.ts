// @ts-nocheck
import { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '@azela-pos/db';
import { z } from 'zod';
import { getUser, requireRole } from '../utils/auth.js';
import { ymdInStoreTz, STORE_TZ_OFFSET } from '@azela-pos/shared';

const itemSchema = z.object({
  productId: z.string().optional().nullable(),
  productName: z.string().min(1).max(200),
  unitType: z.enum(['KG', 'PCS']).default('KG'),
  qtyKg: z.number().positive().optional().nullable(),
  qtyPcs: z.number().int().positive().optional().nullable(),
  notes: z.string().max(300).optional().nullable(),
});

const createPreOrderSchema = z.object({
  storeId: z.string().min(1),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(10).max(15),
  fulfillment: z.enum(['PICKUP', 'DELIVERY']).default('PICKUP'),
  readyAt: z.string().min(1), // ISO or datetime-local
  notes: z.string().max(500).optional().nullable(),
  source: z.enum(['WEB_FORM', 'PHONE_CALL', 'WHATSAPP', 'WALK_IN']).optional(),
  items: z.array(itemSchema).min(1).max(20),
});

const statusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'READY', 'FULFILLED', 'CANCELLED', 'NO_SHOW']),
  notes: z.string().max(500).optional().nullable(),
  saleId: z.string().optional().nullable(),
  cancelReason: z.string().max(500).optional().nullable(),
  customerMessage: z.string().max(500).optional().nullable(),
});

const messageSchema = z.object({
  message: z.string().min(1).max(500),
  visibleToCustomer: z.boolean().optional().default(true),
});

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function parseReadyAt(raw: string): Date {
  const s = String(raw).trim();
  if (!s) throw new Error('readyAt required');
  // datetime-local: 2026-10-02T18:00
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !s.includes('+') && !s.endsWith('Z')) {
    const base = s.length === 16 ? `${s}:00` : s.slice(0, 19);
    return new Date(`${base}${STORE_TZ_OFFSET}`);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid readyAt');
  return d;
}

function serializePreOrder(po: any, opts?: { includePrivate?: boolean }) {
  const events = (po.events || [])
    .filter((e: any) => opts?.includePrivate || e.visibleToCustomer)
    .map((e: any) => ({
      id: e.id,
      kind: e.kind,
      message: e.message,
      status: e.status,
      createdAt: e.createdAt,
      createdBy: e.createdBy ? { id: e.createdBy.id, name: e.createdBy.name } : null,
    }));

  return {
    id: po.id,
    storeId: po.storeId,
    storeName: po.store?.name || null,
    trackingCode: po.trackingCode,
    customerId: po.customerId,
    customerName: po.customerName,
    customerPhone: po.customerPhone,
    fulfillment: po.fulfillment,
    readyAt: po.readyAt,
    status: po.status,
    source: po.source,
    notes: po.notes,
    cancelReason: po.cancelReason,
    saleId: po.saleId,
    createdByUserId: po.createdByUserId,
    createdBy: po.createdBy
      ? { id: po.createdBy.id, name: po.createdBy.name }
      : null,
    customer: po.customer
      ? { id: po.customer.id, name: po.customer.name, phone: po.customer.phone }
      : null,
    items: (po.items || []).map((it: any) => ({
      id: it.id,
      productId: it.productId,
      productName: it.productName,
      unitType: it.unitType,
      qtyKg: it.qtyKg,
      qtyPcs: it.qtyPcs,
      notes: it.notes,
      product: it.product
        ? {
            id: it.product.id,
            name: it.product.name,
            unitType: it.product.unitType,
            taxRate: it.product.taxRate,
            imageUrl: it.product.imageUrl,
          }
        : null,
      pricePerUnit: it.pricePerUnit ?? null,
    })),
    events,
    createdAt: po.createdAt,
    updatedAt: po.updatedAt,
  };
}

function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Received — waiting for the shop to confirm';
    case 'CONFIRMED':
      return 'Confirmed — we will prepare as soon as we can';
    case 'READY':
      return 'Ready for pickup';
    case 'FULFILLED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'NO_SHOW':
      return 'Marked as no-show';
    default:
      return status;
  }
}

async function generateTrackingCode(storeId: string): Promise<string> {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 12; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const exists = await prisma.preOrder.findFirst({
      where: { storeId, trackingCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  return `K${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

async function resolveOwnerStoreId(storeId: string): Promise<string | null> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, type: true, parentOwnerStoreId: true },
  });
  if (!store) return null;
  if (store.type === 'OWNER') return store.id;
  return store.parentOwnerStoreId || null;
}

async function findOrCreateCustomer(
  storeId: string,
  name: string,
  phone: string
) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 10) return null;

  const ownerStoreId = await resolveOwnerStoreId(storeId);
  const customerStoreId = ownerStoreId || storeId;

  const existing = await prisma.customer.findFirst({
    where: {
      phone: { endsWith: normalized.slice(-10) },
      OR: [
        { storeId: customerStoreId },
        { storeId },
      ],
    },
  });
  if (existing) {
    if (name && existing.name !== name) {
      return prisma.customer.update({
        where: { id: existing.id },
        data: { name },
      });
    }
    return existing;
  }

  return prisma.customer.create({
    data: {
      storeId: customerStoreId,
      name: name.trim(),
      phone: normalized,
    },
  });
}

async function createPreOrderRecord(opts: {
  storeId: string;
  customerName: string;
  customerPhone: string;
  fulfillment: 'PICKUP' | 'DELIVERY';
  readyAt: Date;
  notes?: string | null;
  source: 'WEB_FORM' | 'PHONE_CALL' | 'WHATSAPP' | 'WALK_IN';
  createdByUserId?: string | null;
  items: Array<z.infer<typeof itemSchema>>;
}) {
  const phone = normalizePhone(opts.customerPhone);
  if (phone.length < 10) {
    throw Object.assign(new Error('Invalid phone number'), { statusCode: 400 });
  }

  for (const it of opts.items) {
    const hasKg = it.unitType === 'KG' && Number(it.qtyKg) > 0;
    const hasPcs = it.unitType === 'PCS' && Number(it.qtyPcs) > 0;
    if (!hasKg && !hasPcs) {
      throw Object.assign(new Error(`Quantity required for ${it.productName}`), {
        statusCode: 400,
      });
    }
  }

  const customer = await findOrCreateCustomer(
    opts.storeId,
    opts.customerName,
    phone
  );

  const trackingCode = await generateTrackingCode(opts.storeId);

  const preOrder = await prisma.preOrder.create({
    data: {
      storeId: opts.storeId,
      customerId: customer?.id || null,
      customerName: opts.customerName.trim(),
      customerPhone: phone,
      trackingCode,
      fulfillment: opts.fulfillment,
      readyAt: opts.readyAt,
      notes: opts.notes?.trim() || null,
      source: opts.source,
      createdByUserId: opts.createdByUserId || null,
      status: 'PENDING',
      items: {
        create: opts.items.map((it) => ({
          productId: it.productId || null,
          productName: it.productName.trim(),
          unitType: it.unitType || 'KG',
          qtyKg: it.unitType === 'KG' ? Number(it.qtyKg) : null,
          qtyPcs: it.unitType === 'PCS' ? Number(it.qtyPcs) : null,
          notes: it.notes?.trim() || null,
        })),
      },
      events: {
        create: [
          {
            kind: 'STATUS',
            status: 'PENDING',
            message:
              'Order received. We will try our best to prepare it near your requested time, depending on shop rush. This is not an instant guarantee.',
            visibleToCustomer: true,
            createdByUserId: opts.createdByUserId || null,
          },
        ],
      },
    },
    include: {
      items: { include: { product: true } },
      createdBy: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
      store: { select: { name: true } },
      events: {
        orderBy: { createdAt: 'asc' },
        include: { createdBy: { select: { id: true, name: true } } },
      },
    },
  });

  return preOrder;
}

const includeFull = {
  items: { include: { product: true } },
  createdBy: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true, phone: true } },
  store: { select: { name: true } },
  events: {
    orderBy: { createdAt: 'asc' as const },
    include: { createdBy: { select: { id: true, name: true } } },
  },
};

async function attachPrices(storeId: string, preOrder: any, includePrivate = true) {
  const productIds = (preOrder.items || [])
    .map((i: any) => i.productId)
    .filter(Boolean);
  if (!productIds.length) {
    return serializePreOrder(preOrder, { includePrivate });
  }

  const prices = await prisma.storeProductPrice.findMany({
    where: {
      storeId,
      productId: { in: productIds },
      isActive: true,
    },
    orderBy: { effectiveFrom: 'desc' },
  });
  const priceMap = new Map<string, number>();
  for (const p of prices) {
    if (!priceMap.has(p.productId)) priceMap.set(p.productId, p.pricePerUnit);
  }

  const withPrices = {
    ...preOrder,
    items: preOrder.items.map((it: any) => ({
      ...it,
      pricePerUnit: it.productId ? priceMap.get(it.productId) ?? null : null,
    })),
  };
  return serializePreOrder(withPrices, { includePrivate });
}

/** Public (no auth) booking endpoints */
export async function publicPreOrderRoutes(fastify: FastifyInstance) {
  // List stores that accept bookings
  fastify.get('/pre-orders/stores', async () => {
    const stores = await prisma.store.findMany({
      where: {
        OR: [{ type: 'FRANCHISE' }, { type: 'OWNER' }],
      },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    });
    // Prefer franchises for customer-facing; include owner if no franchise
    const franchises = stores.filter((s) => s.type === 'FRANCHISE');
    const list = franchises.length > 0 ? franchises : stores;
    return {
      stores: list.map((s) => ({ id: s.id, name: s.name })),
    };
  });

  // Product catalog for a store
  fastify.get('/pre-orders/catalog', async (request: any, reply: FastifyReply) => {
    const storeId = String(request.query?.storeId || '');
    if (!storeId) {
      reply.code(400).send({ error: 'storeId required' });
      return;
    }

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, type: true, parentOwnerStoreId: true },
    });
    if (!store) {
      reply.code(404).send({ error: 'Store not found' });
      return;
    }

    const ownerStoreId =
      store.type === 'OWNER' ? store.id : store.parentOwnerStoreId;
    if (!ownerStoreId) {
      reply.code(400).send({ error: 'Store not configured' });
      return;
    }

    const products = await prisma.product.findMany({
      where: { ownerStoreId, isActive: true },
      include: {
        category: { select: { name: true } },
        storeProductPrices: {
          where: { storeId, isActive: true },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      store: { id: store.id, name: store.name },
      products: products
        .filter((p) => (p.storeProductPrices[0]?.pricePerUnit || 0) > 0)
        .map((p) => ({
          id: p.id,
          name: p.name,
          unitType: p.unitType,
          taxRate: p.taxRate,
          imageUrl: p.imageUrl,
          categoryName: p.category?.name || null,
          pricePerUnit: p.storeProductPrices[0]?.pricePerUnit || 0,
        })),
    };
  });

  // Live tracker — phone + tracking code
  fastify.get('/pre-orders/track', async (request: any, reply: FastifyReply) => {
    const phone = normalizePhone(String(request.query?.phone || ''));
    const code = String(request.query?.code || request.query?.trackingCode || '')
      .trim()
      .toUpperCase();
    if (phone.length < 10 || code.length < 4) {
      reply.code(400).send({ error: 'Phone and tracking code required' });
      return;
    }

    const po = await prisma.preOrder.findFirst({
      where: {
        trackingCode: code,
        customerPhone: { endsWith: phone.slice(-10) },
      },
      include: includeFull,
      orderBy: { createdAt: 'desc' },
    });
    if (!po) {
      reply.code(404).send({ error: 'Order not found. Check phone and code.' });
      return;
    }

    return {
      preOrder: await attachPrices(po.storeId, po, false),
      statusLabel: statusLabel(po.status),
      disclaimer:
        'Pre-order means we will try our best to prepare your cut near the time you asked. During shop rush it may take longer — thank you for understanding.',
    };
  });

  // Create booking from mini form
  fastify.post('/pre-orders', async (request: any, reply: FastifyReply) => {
    try {
      const data = createPreOrderSchema.parse(request.body);
      const store = await prisma.store.findUnique({
        where: { id: data.storeId },
        select: { id: true },
      });
      if (!store) {
        reply.code(404).send({ error: 'Store not found' });
        return;
      }

      let readyAt: Date;
      try {
        readyAt = parseReadyAt(data.readyAt);
      } catch {
        reply.code(400).send({ error: 'Invalid ready time' });
        return;
      }

      // Must be at least ~30 minutes from now
      if (readyAt.getTime() < Date.now() + 20 * 60 * 1000) {
        reply.code(400).send({
          error: 'Please choose a ready time at least 20 minutes from now',
        });
        return;
      }

      const preOrder = await createPreOrderRecord({
        storeId: data.storeId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        fulfillment: data.fulfillment,
        readyAt,
        notes: data.notes,
        source: data.source || 'WEB_FORM',
        items: data.items,
      });

      reply.code(201).send({
        ok: true,
        preOrder: serializePreOrder(preOrder),
        trackingCode: preOrder.trackingCode,
        message:
          'Booking received. We will try our best near your requested time, depending on shop rush — not an instant guarantee. Save your tracking code to follow live status.',
      });
    } catch (err: any) {
      if (err?.name === 'ZodError') {
        reply.code(400).send({ error: 'Invalid booking data', details: err.errors });
        return;
      }
      reply.code(err.statusCode || 500).send({ error: err.message || 'Failed to book' });
    }
  });
}

/** Authenticated staff pre-order endpoints */
export async function preOrderRoutes(fastify: FastifyInstance) {
  // List pre-orders for store
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER', 'CASHIER')] },
    async (request: any) => {
      const { storeId } = getUser(request) as any;
      const q = request.query || {};
      const status = q.status ? String(q.status) : undefined;
      const day = q.date ? String(q.date).split('T')[0] : ymdInStoreTz();

      const dayStart = new Date(`${day}T00:00:00.000${STORE_TZ_OFFSET}`);
      const dayEnd = new Date(`${day}T23:59:59.999${STORE_TZ_OFFSET}`);

      const where: any = {
        storeId,
        readyAt: { gte: dayStart, lte: dayEnd },
      };
      if (status && status !== 'ALL') {
        where.status = status;
      } else {
        where.status = { in: ['PENDING', 'CONFIRMED', 'READY'] };
      }

      const items = await prisma.preOrder.findMany({
        where,
        include: includeFull,
        orderBy: [{ readyAt: 'asc' }, { createdAt: 'asc' }],
        take: 100,
      });

      const priced = [];
      for (const po of items) {
        priced.push(await attachPrices(storeId, po));
      }

      return { date: day, items: priced };
    }
  );

  // Staff create (phone / WhatsApp call)
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER', 'CASHIER')] },
    async (request: any, reply: FastifyReply) => {
      try {
        const user = getUser(request) as any;
        const body = { ...(request.body as any), storeId: user.storeId };
        const data = createPreOrderSchema.parse(body);

        let readyAt: Date;
        try {
          readyAt = parseReadyAt(data.readyAt);
        } catch {
          reply.code(400).send({ error: 'Invalid ready time' });
          return;
        }

        const preOrder = await createPreOrderRecord({
          storeId: user.storeId,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          fulfillment: data.fulfillment,
          readyAt,
          notes: data.notes,
          source: data.source || 'PHONE_CALL',
          createdByUserId: user.userId,
          items: data.items,
        });

        reply.code(201).send({
          ok: true,
          preOrder: await attachPrices(user.storeId, preOrder),
        });
      } catch (err: any) {
        if (err?.name === 'ZodError') {
          reply.code(400).send({ error: 'Invalid data', details: err.errors });
          return;
        }
        reply.code(err.statusCode || 500).send({ error: err.message || 'Failed' });
      }
    }
  );

  // Update status (confirm / ready / cancel when no stock / etc.)
  fastify.patch(
    '/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER', 'CASHIER')] },
    async (request: any, reply: FastifyReply) => {
      const user = getUser(request) as any;
      const storeId = user.storeId;
      const { id } = request.params as any;
      const data = statusSchema.parse(request.body);

      const existing = await prisma.preOrder.findFirst({
        where: { id, storeId },
      });
      if (!existing) {
        reply.code(404).send({ error: 'Pre-order not found' });
        return;
      }

      if (data.status === 'CANCELLED' && !String(data.cancelReason || data.customerMessage || '').trim()) {
        reply.code(400).send({
          error: 'Please add a cancel reason (e.g. stock not available) — the customer will see it on the tracker',
          code: 'CANCEL_REASON_REQUIRED',
        });
        return;
      }

      const statusChanged = existing.status !== data.status;
      const customerFacing =
        data.customerMessage?.trim() ||
        (data.status === 'CANCELLED'
          ? data.cancelReason?.trim() || 'Cancelled by the shop'
          : null) ||
        (statusChanged ? statusLabel(data.status) : null);

      const updated = await prisma.$transaction(async (tx) => {
        const po = await tx.preOrder.update({
          where: { id },
          data: {
            status: data.status,
            notes: data.notes !== undefined ? data.notes : undefined,
            saleId: data.saleId !== undefined ? data.saleId : undefined,
            cancelReason:
              data.status === 'CANCELLED'
                ? data.cancelReason?.trim() || data.customerMessage?.trim() || existing.cancelReason
                : undefined,
          },
        });

        if (statusChanged || customerFacing) {
          await tx.preOrderEvent.create({
            data: {
              preOrderId: id,
              kind: statusChanged ? 'STATUS' : 'MESSAGE',
              status: data.status,
              message: customerFacing || statusLabel(data.status),
              visibleToCustomer: true,
              createdByUserId: user.userId,
            },
          });
        }

        return tx.preOrder.findUnique({
          where: { id: po.id },
          include: includeFull,
        });
      });

      return { ok: true, preOrder: await attachPrices(storeId, updated) };
    }
  );

  // Staff message to customer (shows on live tracker + WhatsApp deep link)
  fastify.post(
    '/:id/messages',
    { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER', 'CASHIER')] },
    async (request: any, reply: FastifyReply) => {
      const user = getUser(request) as any;
      const storeId = user.storeId;
      const { id } = request.params as any;
      const data = messageSchema.parse(request.body);

      const existing = await prisma.preOrder.findFirst({
        where: { id, storeId },
      });
      if (!existing) {
        reply.code(404).send({ error: 'Pre-order not found' });
        return;
      }

      await prisma.preOrderEvent.create({
        data: {
          preOrderId: id,
          kind: 'MESSAGE',
          message: data.message.trim(),
          visibleToCustomer: data.visibleToCustomer !== false,
          createdByUserId: user.userId,
        },
      });

      const po = await prisma.preOrder.findUnique({
        where: { id },
        include: includeFull,
      });

      const phone = normalizePhone(existing.customerPhone);
      const waText = encodeURIComponent(
        `K2 Chicken — update on your pre-order ${existing.trackingCode}:\n${data.message.trim()}\n\nTrack: (open /book/track with your phone + code ${existing.trackingCode})`
      );
      const whatsappUrl = phone ? `https://wa.me/91${phone}?text=${waText}` : null;

      return {
        ok: true,
        preOrder: await attachPrices(storeId, po),
        whatsappUrl,
      };
    }
  );

  // Get one (for load-to-cart)
  fastify.get(
    '/:id',
    { preHandler: [fastify.authenticate, requireRole('OWNER', 'MANAGER', 'CASHIER')] },
    async (request: any, reply: FastifyReply) => {
      const { storeId } = getUser(request) as any;
      const { id } = request.params as any;
      const po = await prisma.preOrder.findFirst({
        where: { id, storeId },
        include: includeFull,
      });
      if (!po) {
        reply.code(404).send({ error: 'Pre-order not found' });
        return;
      }
      return { preOrder: await attachPrices(storeId, po) };
    }
  );
}
