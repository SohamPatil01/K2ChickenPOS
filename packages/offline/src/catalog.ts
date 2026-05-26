import { offlineDB, LocalProduct, LocalCustomer } from './db';

export async function saveLocalProducts(
  products: Omit<LocalProduct, 'id' | 'lastSyncedAt'>[]
): Promise<void> {
  const now = Date.now();
  await offlineDB.transaction('rw', offlineDB.localProducts, async () => {
    await offlineDB.localProducts.clear();
    for (const product of products) {
      await offlineDB.localProducts.add({ ...product, lastSyncedAt: now });
    }
  });
}

export async function getCachedProducts(): Promise<LocalProduct[]> {
  const rows = await offlineDB.localProducts.toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveLocalCustomers(
  customers: Omit<LocalCustomer, 'id' | 'lastSyncedAt'>[]
): Promise<void> {
  const now = Date.now();
  await offlineDB.transaction('rw', offlineDB.localCustomers, async () => {
    await offlineDB.localCustomers.clear();
    for (const customer of customers) {
      await offlineDB.localCustomers.add({ ...customer, lastSyncedAt: now });
    }
  });
}

export async function getCachedCustomers(): Promise<LocalCustomer[]> {
  const rows = await offlineDB.localCustomers.toArray();
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
