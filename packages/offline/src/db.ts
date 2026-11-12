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
  clientEventId?: string;
  eventType: string;
  payloadJson: Record<string, any>;
  clientCreatedAt: string;
  serverReceivedAt?: string;
  ackedAt?: string;
  retryCount: number;
  lastError?: string;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  /** Permanent failure after max retries — manager intervention */
  deadLetter?: boolean;
  syncStatus?: 'pending' | 'synced' | 'failed' | 'dead' | 'uncertain';
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
  syncStatus?: 'pending' | 'synced' | 'failed' | 'dead' | 'uncertain';
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

/** Serialized POS/cart state for hold/recall */
export interface HeldCartRow {
  id?: number;
  label: string;
  createdAt: number;
  snapshotJson: string;
}

export class OfflineDB extends Dexie {
  cart!: Table<CartItem, number>;
  queuedEvents!: Table<QueuedEvent, number>;
  localSales!: Table<LocalSale, number>;
  localProducts!: Table<LocalProduct, number>;
  localCustomers!: Table<LocalCustomer, number>;
  heldCarts!: Table<HeldCartRow, number>;

  constructor(dbName: string) {
    super(dbName);
    this.version(1).stores({
      cart: '++id, productId, createdAt',
      queuedEvents: '++id, eventType, clientCreatedAt, ackedAt',
      localSales: '++id, localSaleId, serverSaleId, status, createdAt',
      localProducts: '++id, productId, sku, plu, lastSyncedAt',
      localCustomers: '++id, customerId, phone, lastSyncedAt',
    });
    this.version(2).stores({
      cart: '++id, productId, createdAt',
      queuedEvents: '++id, eventType, clientCreatedAt, ackedAt',
      localSales: '++id, localSaleId, serverSaleId, status, createdAt',
      localProducts: '++id, productId, sku, plu, lastSyncedAt',
      localCustomers: '++id, customerId, phone, lastSyncedAt',
      heldCarts: '++id, label, createdAt',
    });
    this.version(3).stores({
      cart: '++id, productId, createdAt',
      queuedEvents: '++id, eventType, clientCreatedAt, ackedAt, nextRetryAt',
      localSales: '++id, localSaleId, serverSaleId, status, createdAt',
      localProducts: '++id, productId, sku, plu, lastSyncedAt',
      localCustomers: '++id, customerId, phone, lastSyncedAt',
      heldCarts: '++id, label, createdAt',
    });
    this.version(4).stores({
      cart: '++id, productId, createdAt',
      queuedEvents: '++id, clientEventId, eventType, clientCreatedAt, ackedAt, nextRetryAt, deadLetter',
      localSales: '++id, localSaleId, serverSaleId, storeId, status, createdAt, syncStatus',
      localProducts: '++id, productId, sku, plu, lastSyncedAt',
      localCustomers: '++id, customerId, storeId, phone, lastSyncedAt',
      heldCarts: '++id, label, createdAt',
    });
  }
}

const dbCache = new Map<string, OfflineDB>();
let activeStoreKey = '_pending';

function dbNameForStore(storeId: string | null | undefined): string {
  const key = (storeId || '').trim() || '_pending';
  return `AzelaPOS_${key}`;
}

export function bindOfflineStore(storeId: string | null | undefined): OfflineDB {
  const key = (storeId || '').trim() || '_pending';
  activeStoreKey = key;
  const name = dbNameForStore(key);
  let db = dbCache.get(name);
  if (!db) {
    db = new OfflineDB(name);
    dbCache.set(name, db);
  }
  return db;
}

/** Clear sensitive tables for the active store scope (logout / account switch). */
export async function clearSensitiveOfflineData(): Promise<void> {
  const db = getOfflineDB();
  await db.transaction(
    'rw',
    db.cart,
    db.queuedEvents,
    db.localSales,
    db.localCustomers,
    db.heldCarts,
    async () => {
      await Promise.all([
        db.cart.clear(),
        db.queuedEvents.clear(),
        db.localSales.clear(),
        db.localCustomers.clear(),
        db.heldCarts.clear(),
      ]);
    }
  );
}

export function getOfflineDB(): OfflineDB {
  return bindOfflineStore(activeStoreKey === '_pending' ? null : activeStoreKey);
}

/**
 * Backward-compatible singleton. Always resolves to the active store-scoped DB.
 * Call bindOfflineStore(storeId) after login / store hydrate.
 */
export const offlineDB: OfflineDB = new Proxy({} as OfflineDB, {
  get(_target, prop, receiver) {
    const db = getOfflineDB();
    const value = Reflect.get(db, prop, receiver);
    return typeof value === 'function' ? value.bind(db) : value;
  },
  set(_target, prop, value) {
    const db = getOfflineDB();
    return Reflect.set(db as any, prop, value);
  },
});
