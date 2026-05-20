import { z } from 'zod';

// Auth
export const loginSchema = z.object({
  phone: z.string().min(10),
  password: z.string().min(4).max(20).regex(/^\d+$/, 'PIN must contain only numbers'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// Customer
export const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  email: z
    .preprocess((v) => {
      if (v === undefined || v === null || v === '') return undefined;
      return String(v).trim();
    }, z.string().email().optional()),
});

/** Empty/missing state & PIN from POS forms → placeholder so validation always passes */
const addressPlaceField = z.preprocess(
  (v) => {
    if (v === undefined || v === null) return '—';
    const s = String(v).trim();
    return s.length > 0 ? s : '—';
  },
  z.string().min(1)
);

export const customerAddressSchema = z.object({
  label: z.preprocess(
    (v) => {
      if (v === undefined || v === null) return 'Home';
      const s = String(v).trim();
      return s.length > 0 ? s : 'Home';
    },
    z.string().min(1)
  ),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: addressPlaceField,
  zip: addressPlaceField,
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
});

// Sale
export const saleItemSchema = z.object({
  productId: z.string(),
  qtyKg: z.number().optional(),
  qtyPcs: z.number().int().optional(),
  rate: z.number().min(0),
  taxRate: z.number().default(0),
  metaJson: z.record(z.any()).optional(),
});

export const createSaleSchema = z.object({
  customerId: z.string().optional(),
  customerPhone: z.string().optional(),
  items: z.array(saleItemSchema).min(1),
  discountTotal: z.number().default(0),
  couponCode: z.string().optional(),
});

const paymentMethodEnum = z.enum(['CASH', 'CARD', 'UPI', 'CREDIT', 'ONLINE']);

export const paymentSchema = z.object({
  method: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase() : v),
    paymentMethodEnum
  ),
  /** Coerce: JSON/clients sometimes send amounts as strings */
  amount: z.coerce.number().min(0),
  txnRef: z.string().optional(),
});

export const paySaleSchema = z.object({
  payments: z.array(paymentSchema).min(1),
});

// Scale Barcode
export const scaleBarcodeConfigSchema = z.object({
  name: z.string().min(1),
  prefix: z.string().min(1),
  pluStart: z.number().int().min(0),
  pluLength: z.number().int().min(1),
  weightStart: z.number().int().min(0),
  weightLength: z.number().int().min(0), // Allow 0 when weight is not encoded
  weightDecimal: z.number().int().min(0).default(2),
  priceStart: z.number().int().optional(),
  priceLength: z.number().int().optional(),
  priceDecimal: z.number().int().optional(),
  checksumType: z.enum(['NONE', 'MOD10', 'MOD11']).default('NONE'),
  isActive: z.boolean().default(true),
});

export const parseBarcodeSchema = z.object({
  barcode: z.string().min(1),
  configId: z.string().optional(),
});

// Inventory
export const inventoryAdjustSchema = z.object({
  productId: z.string(),
  qtyKg: z.number().optional(),
  qtyPcs: z.number().int().optional(),
  reason: z.string(),
  /** When set (e.g. by HQ owner), ledger row is written for this store after permission checks */
  ledgerStoreId: z.string().optional(),
});

export const wastageSchema = z.object({
  productId: z.string(),
  qtyKg: z.number().optional(),
  qtyPcs: z.number().int().optional(),
  reason: z.string().min(1),
});

// Purchase Order
export const poItemSchema = z.object({
  productId: z.string(),
  qtyKg: z.number().optional(),
  qtyPcs: z.number().int().optional(),
  requestedRate: z.number().optional(),
});

export const createPOSchema = z.object({
  ownerStoreId: z.string().optional(),
  items: z.array(poItemSchema).min(1),
  notes: z.string().optional(),
});

// Delivery
export const createDeliverySchema = z.object({
  saleId: z.string(),
  type: z.enum(['PICKUP', 'DELIVERY']),
  addressId: z.string().optional(),
  /** When set for DELIVERY, server creates CustomerAddress for the sale customer and links it */
  newAddress: customerAddressSchema.optional(),
  deliveryFee: z.number().default(0),
});

/** PATCH /delivery/:id — update fee, link saved address, or create + link a new customer address */
export const patchDeliverySchema = z.object({
  addressId: z.string().nullable().optional(),
  newAddress: customerAddressSchema.optional(),
  deliveryFee: z.number().optional(),
});

export const assignDriverSchema = z.object({
  driverId: z.string(),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.enum([
    'CREATED',
    'READY',
    'ASSIGNED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'FAILED',
    'RETURNED',
  ]),
  note: z.string().optional(),
  failureReason: z.string().optional(),
});

export const verifyOTPSchema = z.object({
  otp: z.string().min(4).max(6),
});

// Sync
export const syncEventSchema = z.object({
  eventType: z.string(),
  payloadJson: z.record(z.any()),
  clientCreatedAt: z.string().datetime(),
  /** Dexie queuedEvents.id — echoed back as ackedQueueIds for client-side ack */
  clientQueueId: z.number().int().optional(),
});

export const syncEventsSchema = z.object({
  deviceId: z.string(),
  events: z.array(syncEventSchema),
});

