import { z } from 'zod';

// Auth
export const loginSchema = z.object({
  phone: z.string().min(10),
  password: z.string().min(6),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

// Customer
export const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  email: z.string().email().optional(),
});

export const customerAddressSchema = z.object({
  label: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
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

export const paymentSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'UPI']),
  amount: z.number().min(0),
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
  deliveryFee: z.number().default(0),
});

export const assignDriverSchema = z.object({
  driverId: z.string(),
});

export const updateDeliveryStatusSchema = z.object({
  status: z.enum(['READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED']),
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
});

export const syncEventsSchema = z.object({
  deviceId: z.string(),
  events: z.array(syncEventSchema),
});

