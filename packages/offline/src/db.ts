import Dexie, { Table } from 'dexie';

export interface CartItem {
  id?: number;
  productId: string;
  productName: string;
  qtyKg?: number;
  qtyPcs?: number;
  rate: number;
  taxRate: number;
  lineTotal: number;
  metaJson?: Record<string, any>;
  createdAt: number;
}

export interface QueuedEvent {
  id?: number;
  eventType: string;
  payloadJson: Record<string, any>;
  clientCreatedAt: string;
  serverReceivedAt?: string;
  ackedAt?: string;
  retryCount: number;
  lastError?: string;
}

export interface LocalSale {
  id?: number;
  localSaleId: string;
  serverSaleId?: string;
  storeId: string;
  saleNo: string;
  customerId?: string;
  customerPhone?: string;
  status: 'OPEN' | 'PAID' | 'VOID' | 'REFUNDED';
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  items: CartItem[];
  payments: Array<{
    method: 'CASH' | 'CARD' | 'UPI';
    amount: number;
    txnRef?: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface LocalProduct {
  id?: number;
  productId: string;
  sku: string;
  plu: string;
  name: string;
  categoryId: string;
  categoryName: string;
  unitType: 'KG' | 'PCS';
  taxRate: number;
  pricePerUnit: number;
  isActive: boolean;
  lastSyncedAt: number;
}

export interface LocalCustomer {
  id?: number;
  customerId: string;
  storeId: string;
  name: string;
  phone: string;
  email?: string;
  lastSyncedAt: number;
}

export class OfflineDB extends Dexie {
  cart!: Table<CartItem, number>;
  queuedEvents!: Table<QueuedEvent, number>;
  localSales!: Table<LocalSale, number>;
  localProducts!: Table<LocalProduct, number>;
  localCustomers!: Table<LocalCustomer, number>;

  constructor() {
    super('AzelaPOS');
    this.version(1).stores({
      cart: '++id, productId, createdAt',
      queuedEvents: '++id, eventType, clientCreatedAt, ackedAt',
      localSales: '++id, localSaleId, serverSaleId, status, createdAt',
      localProducts: '++id, productId, sku, plu, lastSyncedAt',
      localCustomers: '++id, customerId, phone, lastSyncedAt',
    });
  }
}

export const offlineDB = new OfflineDB();

