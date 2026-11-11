import { createHash } from 'node:crypto';
import { prisma, Prisma } from '@azela-pos/db';
import type { z } from 'zod';
import { buildQuote, type Quote, type RequestedLine } from '../domain/quote.js';
import { getRewardsConfig } from '../domain/rewards.js';
import { generateSlots, isValidSlot } from '../domain/slots.js';
import { formatInr, gramsToKg } from '../domain/money.js';
import { methodsFor, WEIGHT_PRICING_DISCLOSURE } from '../providers/payments.js';
import type { placeOrderSchema, quoteRequestSchema } from '../contracts.js';
import { HttpError } from '../errors.js';
import { getProductSnapshots } from './catalog.js';
import { getStoreConfig, isPincodeServiceable, type StoreCommerceConfig } from './config.js';
import type { IdentityContext } from './identity.js';
import { availablePoints, lockAndCheckAvailable } from './loyalty.js';
import { enqueueOutbox } from './outbox.js';

type QuoteRequest = z.infer<typeof quoteRequestSchema>;
type PlaceOrderRequest = z.infer<typeof placeOrderSchema>;

async function resolveAddress(ctx: IdentityContext | null, addressId: string | null | undefined) {
  if (!ctx || !addressId) return null;
  const a = await prisma.customerAddress.findFirst({ where: { id: addressId, customerId: { in: ctx.customerIds } } });
  if (!a) throw new HttpError(404, 'ADDRESS_NOT_FOUND', 'Address not found');
  return a;
}

export async function computeQuote(
  ctx: IdentityContext | null,
  req: QuoteRequest,
  cfgIn?: StoreCommerceConfig
): Promise<{ quote: Quote; config: StoreCommerceConfig; address: Awaited<ReturnType<typeof resolveAddress>> }> {
  const config = cfgIn ?? (await getStoreConfig(req.storeId));
  if (!config.appOrderingEnabled) throw new HttpError(403, 'ORDERING_DISABLED', 'App ordering is paused for this store');
  const products = await getProductSnapshots(req.storeId, req.lines.map((l) => l.productId));
  const address = await resolveAddress(ctx, req.addressId);
  const loyalty = ctx ? await availablePoints(ctx.primaryCustomerId) : null;
  const quote = buildQuote({
    lines: req.lines as RequestedLine[],
    products,
    fulfillment: req.fulfillment,
    delivery: {
      enabled: config.deliveryEnabled,
      feePaise: config.deliveryFeePaise,
      freeAbovePaise: config.freeDeliveryAbovePaise,
      serviceable: address ? isPincodeServiceable(config, address.zip) : null,
    },
    minOrderPaise: config.minOrderPaise,
    cutOptions: config.cutOptions,
    loyalty: { requestedPoints: req.redeemPoints, availablePoints: loyalty?.available ?? null, config: getRewardsConfig() },
  });
  return { quote, config, address };
}

export function quoteResponse(quote: Quote, config: StoreCommerceConfig, now = new Date()) {
  return {
    quote,
    slots: generateSlots({
      now,
      hours: config.hours,
      slotMinutes: config.slotMinutes,
      leadTimeMinutes: config.leadTimeMinutes,
      maxDaysAhead: config.maxDaysAhead,
    }),
    paymentMethods: [...methodsFor('PICKUP'), ...(config.deliveryEnabled ? methodsFor('DELIVERY') : [])],
    disclosure: WEIGHT_PRICING_DISCLOSURE,
    cutOptions: config.cutOptions,
    quotedAt: now.toISOString(),
  };
}

function stableHash(value: unknown): string {
  const norm = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(norm)
      : v && typeof v === 'object'
        ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, norm(x)]))
        : v;
  return createHash('sha256').update(JSON.stringify(norm(value))).digest('hex');
}

const TRACKING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function trackingCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += TRACKING_ALPHABET[Math.floor(Math.random() * TRACKING_ALPHABET.length)];
  return code;
}

function itemNote(line: Quote['lines'][number]): string | null {
  const parts = [line.cutLabel ? `Cut: ${line.cutLabel}` : null, line.notes ? `Note: ${line.notes}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ').slice(0, 300) : null;
}

function staffNote(args: {
  quote: Quote;
  paymentMethod: string;
  address: { line1: string; line2: string | null; city: string; zip: string } | null;
  customerNote: string | null | undefined;
}): string {
  const { quote } = args;
  const bits = [
    `📱 App order · ${args.paymentMethod === 'PAY_ON_DELIVERY' ? 'Pay on delivery' : 'Pay at store'} · est. ${formatInr(quote.totalPaise)}`,
    quote.loyalty.appliedPoints > 0
      ? `Redeem ${quote.loyalty.appliedPoints} pts (${formatInr(quote.loyalty.discountPaise)}) — apply when billing`
      : null,
    args.address ? `Deliver: ${[args.address.line1, args.address.line2, args.address.city, args.address.zip].filter(Boolean).join(', ')}` : null,
    args.customerNote?.trim() ? `Customer: ${args.customerNote.trim()}` : null,
  ].filter(Boolean);
  return bits.join('\n').slice(0, 500);
}

export type PlaceOrderResult = { orderId: string; replayed: boolean };

/**
 * Places an app order as a POS PreOrder (source MOBILE_APP) so it appears in the existing
 * Pre-orders screen. Idempotent per (identity, Idempotency-Key).
 */
export async function placeOrder(ctx: IdentityContext, req: PlaceOrderRequest, idempotencyKey: string): Promise<PlaceOrderResult> {
  if (!/^[\w-]{16,80}$/.test(idempotencyKey)) {
    throw new HttpError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header (16–80 chars) is required');
  }
  const requestHash = stableHash(req);
  const existing = await prisma.mobileOrder.findUnique({
    where: { identityId_idempotencyKey: { identityId: ctx.identityId, idempotencyKey } },
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new HttpError(409, 'IDEMPOTENCY_KEY_REUSED', 'This order request was already used for a different cart');
    }
    return { orderId: `po_${existing.preOrderId}`, replayed: true };
  }

  const { quote, config, address } = await computeQuote(ctx, req);
  if (!quote.canCheckout) {
    throw new HttpError(422, 'QUOTE_NOT_ORDERABLE', quote.issues[0]?.message ?? 'Cart cannot be ordered', { quote });
  }
  if (quote.totalPaise !== req.confirmedTotalPaise) {
    throw new HttpError(409, 'QUOTE_CHANGED', 'Prices or availability changed. Please review your updated total.', { quote });
  }
  if (req.redeemPoints > 0 && quote.loyalty.appliedPoints !== req.redeemPoints) {
    throw new HttpError(409, 'QUOTE_CHANGED', 'Your available points changed. Please review your updated total.', { quote });
  }
  const methods = methodsFor(req.fulfillment).map((m) => m.id);
  if (!methods.includes(req.paymentMethod)) {
    throw new HttpError(400, 'PAYMENT_METHOD_INVALID', 'Payment method not available for this order type');
  }
  if (req.fulfillment === 'DELIVERY' && !address) throw new HttpError(400, 'ADDRESS_REQUIRED', 'Add a delivery address');
  const slots = generateSlots({
    now: new Date(),
    hours: config.hours,
    slotMinutes: config.slotMinutes,
    leadTimeMinutes: config.leadTimeMinutes,
    maxDaysAhead: config.maxDaysAhead,
  });
  const slot = isValidSlot(slots, req.slotStart);
  if (!slot) throw new HttpError(409, 'SLOT_UNAVAILABLE', 'That time slot is no longer available. Pick another.');

  const customer = await prisma.customer.findUnique({ where: { id: ctx.primaryCustomerId }, select: { name: true, phone: true } });
  const orderable = quote.lines.filter((l) => l.orderable);

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        if (quote.loyalty.appliedPoints > 0) {
          const available = await lockAndCheckAvailable(tx, ctx.primaryCustomerId);
          if (available < quote.loyalty.appliedPoints) {
            throw new HttpError(409, 'QUOTE_CHANGED', 'Your available points changed. Please review your updated total.');
          }
        }
        let preOrder: { id: string } | null = null;
        for (let attempt = 0; attempt < 5 && !preOrder; attempt++) {
          const code = trackingCode();
          const clash = await tx.preOrder.findFirst({ where: { storeId: req.storeId, trackingCode: code }, select: { id: true } });
          if (clash) continue;
          preOrder = await tx.preOrder.create({
            data: {
              storeId: req.storeId,
              customerId: ctx.primaryCustomerId,
              customerName: customer?.name || 'K2 Customer',
              customerPhone: ctx.phone,
              trackingCode: code,
              fulfillment: req.fulfillment,
              readyAt: new Date(slot.start),
              notes: staffNote({ quote, paymentMethod: req.paymentMethod, address, customerNote: req.notes }),
              source: 'MOBILE_APP',
              status: 'PENDING',
              items: {
                create: orderable.map((l) => ({
                  productId: l.productId,
                  productName: l.name,
                  unitType: l.unitType,
                  qtyKg: l.unitType === 'KG' ? gramsToKg(l.grams ?? 0) : null,
                  qtyPcs: l.unitType === 'PCS' ? l.pieces : null,
                  notes: itemNote(l),
                })),
              },
              events: {
                create: [
                  {
                    kind: 'STATUS',
                    status: 'PENDING',
                    message: `Order placed in the K2 Chicken app for ${slot.label} on ${slot.ymd}. The store will confirm shortly.`,
                    visibleToCustomer: true,
                  },
                ],
              },
            },
            select: { id: true },
          });
        }
        if (!preOrder) throw new HttpError(503, 'TRY_AGAIN', 'Could not allocate an order number, please retry');
        const mo = await tx.mobileOrder.create({
          data: {
            preOrderId: preOrder.id,
            identityId: ctx.identityId,
            customerId: ctx.primaryCustomerId,
            storeId: req.storeId,
            idempotencyKey,
            requestHash,
            quoteJson: quote as unknown as Prisma.InputJsonValue,
            estimatedTotalPaise: quote.totalPaise,
            fulfillment: req.fulfillment,
            addressId: address?.id ?? null,
            addressSnapshot: address
              ? ({ label: address.label, line1: address.line1, line2: address.line2, city: address.city, zip: address.zip } as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            slotStart: new Date(slot.start),
            slotEnd: new Date(slot.end),
            paymentMethod: req.paymentMethod,
            loyaltyPointsHeld: quote.loyalty.appliedPoints,
            loyaltyHoldStatus: quote.loyalty.appliedPoints > 0 ? 'HELD' : 'NONE',
            source: req.source,
            sourceRef: req.sourceRef ?? null,
          },
        });
        await enqueueOutbox(tx, {
          type: 'order.placed',
          aggregateType: 'MobileOrder',
          aggregateId: mo.id,
          dedupeKey: `order.placed:${mo.id}`,
          payload: { identityId: ctx.identityId, preOrderId: preOrder.id, totalPaise: quote.totalPaise, source: req.source },
        });
        return preOrder;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 }
    );
    return { orderId: `po_${created.id}`, replayed: false };
  } catch (e) {
    // Concurrent duplicate submit with the same key: the unique index wins; replay the winner.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const winner = await prisma.mobileOrder.findUnique({
        where: { identityId_idempotencyKey: { identityId: ctx.identityId, idempotencyKey } },
      });
      if (winner && winner.requestHash === requestHash) return { orderId: `po_${winner.preOrderId}`, replayed: true };
    }
    throw e;
  }
}
