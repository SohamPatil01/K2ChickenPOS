import api from '@/lib/api';
import { saveLocalProducts, saveLocalCustomers } from '@azela-pos/offline';

const CATALOG_REFRESH_KEY = 'azela-offline-catalog-refreshed-at';
/** Avoid re-pulling full product/customer catalog from Neon more than once per hour. */
const CATALOG_REFRESH_TTL_MS = 60 * 60 * 1000;

/** Pull catalog from GET /api/v1/sync/bootstrap into IndexedDB for offline POS. */
export async function refreshOfflineCatalog(opts?: { force?: boolean }): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }
  const token =
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (!token) {
    return;
  }

  if (typeof window !== 'undefined' && !opts?.force) {
    const last = Number(localStorage.getItem(CATALOG_REFRESH_KEY) || 0);
    if (last > 0 && Date.now() - last < CATALOG_REFRESH_TTL_MS) {
      return;
    }
  }

  try {
    const { data } = await api.get('/api/v1/sync/bootstrap');
    if (Array.isArray(data?.products) && data.products.length > 0) {
      await saveLocalProducts(
        data.products.map((p: Record<string, unknown>) => ({
          productId: String(p.productId),
          sku: String(p.sku ?? ''),
          plu: String(p.plu ?? ''),
          name: String(p.name ?? ''),
          categoryId: String(p.categoryId ?? ''),
          categoryName: String(p.categoryName ?? ''),
          unitType: (p.unitType === 'PCS' ? 'PCS' : 'KG') as 'KG' | 'PCS',
          taxRate: Number(p.taxRate ?? 0),
          pricePerUnit: Number(p.pricePerUnit ?? 0),
          isActive: p.isActive !== false,
        }))
      );
    }
    if (Array.isArray(data?.customers) && data.customers.length > 0) {
      const storeId = String(data?.store?.id ?? '');
      await saveLocalCustomers(
        data.customers.map((c: Record<string, unknown>) => ({
          customerId: String(c.customerId),
          storeId,
          name: String(c.name ?? ''),
          phone: String(c.phone ?? ''),
          email: c.email ? String(c.email) : undefined,
        }))
      );
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(CATALOG_REFRESH_KEY, String(Date.now()));
    }
  } catch (error) {
    console.warn('[offline] Bootstrap catalog refresh failed:', error);
  }
}
