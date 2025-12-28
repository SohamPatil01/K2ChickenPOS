export type UserRole = 'OWNER' | 'MANAGER' | 'CASHIER' | 'DRIVER';
export type StoreType = 'OWNER' | 'FRANCHISE';
export type SaleStatus = 'OPEN' | 'PAID' | 'VOID' | 'REFUNDED';
export type PaymentMethod = 'CASH' | 'CARD' | 'UPI';
export type DeliveryType = 'PICKUP' | 'DELIVERY';
export type DeliveryStatus = 'CREATED' | 'READY' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED';
export type POStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'DISPATCHED' | 'RECEIVED' | 'CLOSED';

export interface ParsedBarcode {
  productId: string;
  plu: string;
  weightKg?: number;
  qtyPcs?: number;
  pricePerKg?: number;
  lineTotal?: number;
  raw: string;
}

export interface SyncEventPayload {
  eventType: string;
  payload: Record<string, any>;
  clientCreatedAt: string;
}

