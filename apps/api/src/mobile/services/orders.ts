import { prisma } from '@azela-pos/db';
import { buildTimeline, deriveStatus, isOpenStatus, statusLabel, type CustomerOrderStatus } from '../domain/orderStatus.js';
import { kgToGrams, rupeesToPaise } from '../domain/money.js';
import { WEIGHT_RULES, type Quote, type RequestedLine } from '../domain/quote.js';
import { HttpError } from '../errors.js';
import { getStoreConfig } from './config.js';
import type { IdentityContext } from './identity.js';
import { enqueueOutbox } from './outbox.js';

export type OrderRef = { kind: 'po' | 'sale'; id: string };

export function parseOrderRef(raw: string): OrderRef {
  const m = /^(po|sale)_([\w-]{8,64})$/.exec(raw);
  if (!m) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  return { kind: m[1] as 'po' | 'sale', id: m[2] };
}

const saleInclude = {
  items: { include: { product: { select: { id: true, name: true, unitType: true, imageUrl: true } } } },
  payments: { select: { method: true, amount: true, createdAt: true } },
  deliveryOrder: { select: { status: true, deliveryFee: true, outForDeliveryAt: true, deliveredAt: true } },
  store: { select: { id: true, name: true } },
} as const;

function identityPreOrderWhere(ctx: IdentityContext) {
  return {
    OR: [
      { customerId: { in: ctx.customerIds } },
      { customerPhone: ctx.phone }, // web bookings made before the app, same verified phone
    ],
  };
}

export type OrderSummary = {
  id: string;
  channel: 'APP' | 'WEB' | 'STORE' | 'PHONE';
  storeId: string;
  storeName: string | null;
  placedAt: string;
  status: CustomerOrderStatus;
  statusLabel: string;
  fulfillment: 'PICKUP' | 'DELIVERY';
  itemCount: number;
  itemsPreview: string;
  totalPaise: number;
  totalIsEstimate: boolean;
  trackingCode: string | null;
  canReorder: boolean;
};

function channelOf(source: string | null | undefined): OrderSummary['channel'] {
  if (source === 'MOBILE_APP') return 'APP';
  if (source === 'WEB_FORM') return 'WEB';
  if (source === 'PHONE_CALL' || source === 'WHATSAPP') return 'PHONE';
  return 'STORE';
}

export async function listOrders(ctx: IdentityContext, opts: { before?: Date; limit: number }) {
  const before = opts.before ?? new Date(Date.now() + 60_000);
  const [preOrders, sales] = await Promise.all([
    prisma.preOrder.findMany({
      where: { ...identityPreOrderWhere(ctx), createdAt: { lt: before } },
      include: { items: true, store: { select: { name: true } }, sale: { include: saleInclude } },
      orderBy: { createdAt: 'desc' },
      take: opts.limit,
    }),
    prisma.sale.findMany({
      where: {
        customerId: { in: ctx.customerIds },
        createdAt: { lt: before },
        status: { in: ['PAID', 'REFUNDED', 'VOID'] },
        preOrders: { none: {} },
      },
      include: saleInclude,
      orderBy: { createdAt: 'desc' },
      take: opts.limit,
    }),
  ]);
  const mobileByPo = new Map(
    (await prisma.mobileOrder.findMany({ where: { preOrderId: { in: preOrders.map((p) => p.id) } } })).map((m) => [m.preOrderId, m])
  );

  const rows: OrderSummary[] = [
    ...preOrders.map((po) => {
      const status = deriveStatus(po, po.sale);
      const mo = mobileByPo.get(po.id);
      const billed = po.sale && po.sale.status !== 'OPEN';
      return {
        id: `po_${po.id}`,
        channel: channelOf(po.source),
        storeId: po.storeId,
        storeName: po.store?.name ?? null,
        placedAt: po.createdAt.toISOString(),
        status,
        statusLabel: statusLabel(status, po.fulfillment),
        fulfillment: po.fulfillment as 'PICKUP' | 'DELIVERY',
        itemCount: po.items.length,
        itemsPreview: po.items.map((i) => i.productName).slice(0, 3).join(', '),
        totalPaise: billed ? rupeesToPaise(po.sale!.grandTotal) : (mo?.estimatedTotalPaise ?? 0),
        totalIsEstimate: !billed,
        trackingCode: po.trackingCode,
        canReorder: po.items.some((i) => !!i.productId),
      };
    }),
    ...sales.map((s) => {
      const status = deriveStatus(null, s);
      return {
        id: `sale_${s.id}`,
        channel: 'STORE' as const,
        storeId: s.storeId,
        storeName: s.store?.name ?? null,
        placedAt: s.createdAt.toISOString(),
        status,
        statusLabel: status === 'COMPLETED' ? 'Purchased in store' : statusLabel(status, 'PICKUP'),
        fulfillment: (s.deliveryOrder ? 'DELIVERY' : 'PICKUP') as 'PICKUP' | 'DELIVERY',
        itemCount: s.items.length,
        itemsPreview: s.items.map((i) => i.product?.name ?? 'Item').slice(0, 3).join(', '),
        totalPaise: rupeesToPaise(s.grandTotal),
        totalIsEstimate: false,
        trackingCode: null,
        canReorder: s.status === 'PAID' && s.items.length > 0,
      };
    }),
  ]
    .sort((a, b) => b.placedAt.localeCompare(a.placedAt))
    .slice(0, opts.limit);

  const nextBefore = rows.length === opts.limit ? rows[rows.length - 1].placedAt : null;
  return { orders: rows, nextBefore };
}

function receiptFromSale(sale: NonNullable<Awaited<ReturnType<typeof loadSale>>>) {
  return {
    saleNo: sale.saleNo,
    billedAt: sale.createdAt.toISOString(),
    status: sale.status,
    subtotalPaise: rupeesToPaise(sale.subTotal),
    discountPaise: rupeesToPaise(sale.discountTotal),
    taxPaise: rupeesToPaise(sale.taxTotal),
    deliveryFeePaise: rupeesToPaise(sale.deliveryOrder?.deliveryFee ?? 0),
    totalPaise: rupeesToPaise(sale.grandTotal),
    payments: sale.payments.map((p) => ({ method: p.method, amountPaise: rupeesToPaise(p.amount) })),
    items: sale.items.map((i) => ({
      productId: i.productId,
      name: i.product?.name ?? 'Item',
      unitType: (i.product?.unitType ?? 'KG') as 'KG' | 'PCS',
      grams: i.qtyKg ? kgToGrams(i.qtyKg) : null,
      pieces: i.qtyPcs ?? null,
      ratePaise: rupeesToPaise(i.rate),
      totalPaise: rupeesToPaise(i.lineTotal + (i.taxAmount || 0)),
    })),
  };
}

async function loadSale(id: string) {
  return prisma.sale.findUnique({ where: { id }, include: saleInclude });
}

export async function getOrder(ctx: IdentityContext, rawId: string) {
  const ref = parseOrderRef(rawId);
  if (ref.kind === 'sale') {
    const sale = await loadSale(ref.id);
    if (!sale || !sale.customerId || !ctx.customerIds.includes(sale.customerId)) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
    const status = deriveStatus(null, sale);
    const cfg = await getStoreConfig(sale.storeId);
    return {
      id: rawId,
      channel: 'STORE' as const,
      store: sale.store,
      placedAt: sale.createdAt.toISOString(),
      status,
      statusLabel: status === 'COMPLETED' ? 'Purchased in store' : statusLabel(status, 'PICKUP'),
      fulfillment: sale.deliveryOrder ? 'DELIVERY' : 'PICKUP',
      timeline: [],
      events: [],
      requestedItems: [],
      estimate: null,
      receipt: receiptFromSale(sale),
      payment: { method: null, status: sale.status === 'PAID' ? 'PAID' : sale.status },
      canCancel: false,
      canReorder: sale.status === 'PAID',
      supportPhone: cfg.supportPhone,
      trackingCode: null,
      slot: null,
      loyaltyHold: null,
    };
  }

  const po = await prisma.preOrder.findFirst({
    where: { id: ref.id, ...identityPreOrderWhere(ctx) },
    include: {
      items: true,
      store: { select: { id: true, name: true } },
      events: { where: { visibleToCustomer: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!po) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  const sale = po.saleId ? await loadSale(po.saleId) : null;
  const mo = await prisma.mobileOrder.findUnique({ where: { preOrderId: po.id } });
  const status = deriveStatus(po, sale);
  const cfg = await getStoreConfig(po.storeId);
  const estimate = (mo?.quoteJson as unknown as Quote | undefined) ?? null;
  return {
    id: rawId,
    channel: channelOf(po.source),
    store: po.store,
    placedAt: po.createdAt.toISOString(),
    status,
    statusLabel: statusLabel(status, po.fulfillment),
    fulfillment: po.fulfillment,
    timeline: buildTimeline(status, po.fulfillment),
    events: po.events.map((e) => ({ id: e.id, kind: e.kind, status: e.status, message: e.message, at: e.createdAt.toISOString() })),
    requestedItems: po.items.map((i) => ({
      productId: i.productId,
      name: i.productName,
      unitType: i.unitType,
      grams: i.qtyKg ? kgToGrams(i.qtyKg) : null,
      pieces: i.qtyPcs,
      notes: i.notes,
    })),
    estimate: estimate
      ? {
          totalPaise: estimate.totalPaise,
          merchandisePaise: estimate.merchandisePaise,
          taxPaise: estimate.taxPaise,
          deliveryFeePaise: estimate.deliveryFeePaise,
          loyaltyDiscountPaise: estimate.loyalty?.discountPaise ?? 0,
          roundOffPaise: estimate.roundOffPaise,
        }
      : null,
    receipt: sale && sale.status !== 'OPEN' ? receiptFromSale(sale) : null,
    payment: {
      method: mo?.paymentMethod ?? null,
      status: sale?.status === 'PAID' ? 'PAID' : sale?.status === 'REFUNDED' ? 'REFUNDED' : 'DUE_ON_FULFILMENT',
    },
    canCancel: cfg.customerCancelWindow === 'PENDING_ONLY' && po.status === 'PENDING' && !!mo,
    canReorder: po.items.some((i) => !!i.productId),
    supportPhone: cfg.supportPhone,
    trackingCode: po.trackingCode,
    cancelReason: po.cancelReason,
    slot: mo ? { start: mo.slotStart.toISOString(), end: mo.slotEnd.toISOString() } : { start: po.readyAt.toISOString(), end: null },
    loyaltyHold: mo && mo.loyaltyPointsHeld > 0 ? { points: mo.loyaltyPointsHeld, status: mo.loyaltyHoldStatus } : null,
    isOpen: isOpenStatus(status),
  };
}

/** Customer cancellation — only before the store accepts (configurable per store). */
export async function cancelOrder(ctx: IdentityContext, rawId: string) {
  const ref = parseOrderRef(rawId);
  if (ref.kind !== 'po') throw new HttpError(400, 'NOT_CANCELLABLE', 'In-store purchases cannot be cancelled in the app');
  const mo = await prisma.mobileOrder.findUnique({ where: { preOrderId: ref.id } });
  if (!mo || mo.identityId !== ctx.identityId) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  const cfg = await getStoreConfig(mo.storeId);
  if (cfg.customerCancelWindow === 'NONE') throw new HttpError(409, 'NOT_CANCELLABLE', 'Please call the store to change this order');
  await prisma.$transaction(async (tx) => {
    const updated = await tx.preOrder.updateMany({
      where: { id: ref.id, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelReason: 'Cancelled by customer in the app' },
    });
    if (updated.count !== 1) throw new HttpError(409, 'NOT_CANCELLABLE', 'The store has already accepted this order. Please call the store.');
    await tx.preOrderEvent.create({
      data: { preOrderId: ref.id, kind: 'STATUS', status: 'CANCELLED', message: 'Cancelled by customer in the app', visibleToCustomer: true },
    });
    await tx.mobileOrder.updateMany({ where: { id: mo.id, loyaltyHoldStatus: 'HELD' }, data: { loyaltyHoldStatus: 'RELEASED' } });
    await enqueueOutbox(tx, {
      type: 'order.cancelled',
      aggregateType: 'MobileOrder',
      aggregateId: mo.id,
      dedupeKey: `order.cancelled:${mo.id}`,
      payload: { identityId: ctx.identityId, preOrderId: ref.id, by: 'CUSTOMER' },
    });
  });
  return getOrder(ctx, rawId);
}

/** Round an in-store weighed quantity to the app's selectable step (e.g. 1.13 kg → 1.25 kg). */
export function roundGramsToStep(grams: number): number {
  const step = WEIGHT_RULES.stepGrams;
  const r = Math.round(grams / step) * step;
  return Math.min(WEIGHT_RULES.maxGrams, Math.max(WEIGHT_RULES.minGrams, r));
}

/** Previous selections → requested lines (fresh prices/stock are applied by the quote). */
export async function reorderLines(ctx: IdentityContext, rawId: string): Promise<{ storeId: string; lines: RequestedLine[]; adjustedWeights: number }> {
  const ref = parseOrderRef(rawId);
  let adjusted = 0;
  if (ref.kind === 'sale') {
    const sale = await loadSale(ref.id);
    if (!sale || !sale.customerId || !ctx.customerIds.includes(sale.customerId)) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
    const lines: RequestedLine[] = sale.items
      .filter((i) => i.product)
      .map((i) => {
        if (i.product!.unitType === 'KG') {
          const g = kgToGrams(i.qtyKg);
          const rounded = roundGramsToStep(g);
          if (rounded !== g) adjusted++;
          return { productId: i.productId, grams: rounded, previousRatePaise: rupeesToPaise(i.rate) };
        }
        return { productId: i.productId, pieces: Math.max(1, i.qtyPcs || 1), previousRatePaise: rupeesToPaise(i.rate) };
      });
    return { storeId: sale.storeId, lines, adjustedWeights: adjusted };
  }
  const po = await prisma.preOrder.findFirst({ where: { id: ref.id, ...identityPreOrderWhere(ctx) }, include: { items: true } });
  if (!po) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  const mo = await prisma.mobileOrder.findUnique({ where: { preOrderId: po.id } });
  const snapshot = (mo?.quoteJson as unknown as Quote | undefined)?.lines ?? [];
  const lines: RequestedLine[] = po.items
    .filter((i) => !!i.productId)
    .map((i) => {
      const prev = snapshot.find((l) => l.productId === i.productId);
      if (i.unitType === 'KG') {
        const g = kgToGrams(i.qtyKg);
        const rounded = roundGramsToStep(g);
        if (rounded !== g) adjusted++;
        return { productId: i.productId!, grams: rounded, cutOptionId: prev?.cutOptionId ?? null, notes: prev?.notes ?? null, previousRatePaise: prev?.ratePaise ?? null };
      }
      return { productId: i.productId!, pieces: Math.max(1, i.qtyPcs || 1), previousRatePaise: prev?.ratePaise ?? null };
    });
  return { storeId: po.storeId, lines, adjustedWeights: adjusted };
}

/** Most recent reorderable order for the Home "Reorder your usual" card. */
export async function lastReorderable(ctx: IdentityContext) {
  const { orders } = await listOrders(ctx, { limit: 10 });
  return orders.find((o) => o.canReorder && (o.status === 'COMPLETED' || o.channel === 'APP')) ?? null;
}
