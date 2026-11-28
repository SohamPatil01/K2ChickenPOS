import type { AxiosInstance } from 'axios';
import { useCartStore } from '@/store/cart';
import { isOfflineForCheckout } from '@/lib/offlineCheckout';

export type LoadablePreOrder = {
  id: string;
  trackingCode?: string;
  status?: string;
  saleId?: string | null;
  saleNo?: string | null;
  saleStatus?: string | null;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    unitType: 'KG' | 'PCS';
    qtyKg: number | null;
    qtyPcs: number | null;
    pricePerUnit?: number | null;
    product?: {
      id: string;
      name: string;
      unitType: string;
      taxRate: number;
      imageUrl?: string | null;
      pricePerUnit?: number;
    } | null;
  }>;
};

type CatalogProduct = {
  id: string;
  name: string;
  unitType: 'KG' | 'PCS';
  taxRate: number;
  pricePerUnit: number;
  imageUrl?: string | null;
};

function assertPreOrderLoadable(po: LoadablePreOrder): void {
  const label = po.trackingCode ? `#${po.trackingCode}` : po.id.slice(-6);
  const status = String(po.status || '').toUpperCase();
  const hasActiveSale = Boolean(po.saleId && po.saleStatus !== 'VOID');

  if (status === 'CANCELLED' || status === 'NO_SHOW') {
    throw new Error(`Order ${label} is ${status.toLowerCase().replace('_', '-')} and cannot be billed.`);
  }
  if (hasActiveSale || (status === 'FULFILLED' && !po.saleId)) {
    const bill = po.saleNo ? ` (${po.saleNo})` : '';
    throw new Error(`Order ${label} has already been billed${bill}.`);
  }
}

/**
 * Load a pre-order into the POS cart. Weights/qty stay fully editable afterward.
 * Checks live server status first (when online) so an already-billed order on
 * another counter cannot be loaded into a second cart.
 */
export async function loadPreOrderIntoCart(options: {
  api: AxiosInstance;
  preOrder: LoadablePreOrder;
  products?: CatalogProduct[];
  /** Replace current cart lines so staff can tweak weights cleanly (default true). */
  replaceCart?: boolean;
  markConfirmed?: boolean;
}): Promise<{ loadedCount: number }> {
  const {
    api,
    preOrder: initialPo,
    products = [],
    replaceCart = true,
    markConfirmed = true,
  } = options;

  let po: LoadablePreOrder = initialPo;
  if (!isOfflineForCheckout()) {
    try {
      const freshRes = await api.get(`/api/v1/pre-orders/${initialPo.id}`);
      if (freshRes.data?.preOrder) {
        po = freshRes.data.preOrder;
      }
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 409) {
        throw err;
      }
      // Network blip: fall back to the passed-in pre-order; POST /sales still locks & guards on Pay.
    }
  }

  assertPreOrderLoadable(po);

  const cart = useCartStore.getState();
  if (replaceCart) {
    // Keep customer after clear — clearCart wipes customer; re-attach below.
    await cart.clearCart();
  }

  let loadedCount = 0;
  for (const it of po.items) {
    const product =
      it.product ||
      products.find((p) => p.id === it.productId) ||
      null;
    const rate =
      it.pricePerUnit ??
      (product as any)?.pricePerUnit ??
      products.find((p) => p.id === it.productId)?.pricePerUnit ??
      0;
    const taxRate = product?.taxRate ?? 0;
    const unitType = (it.unitType || product?.unitType || 'KG') as 'KG' | 'PCS';
    const qtyKg = unitType === 'KG' ? Number(it.qtyKg) || 0 : undefined;
    const qtyPcs = unitType === 'PCS' ? Number(it.qtyPcs) || 0 : undefined;
    const qty = unitType === 'KG' ? qtyKg || 0 : qtyPcs || 0;
    if (!it.productId || qty <= 0) continue;
    const lineTotal = Math.round(qty * rate * 100) / 100;
    await useCartStore.getState().addItem({
      productId: it.productId,
      productName: it.productName || product?.name || 'Item',
      qtyKg,
      qtyPcs,
      rate,
      taxRate,
      lineTotal,
      metaJson: {
        preOrderId: po.id,
        preOrderItemId: it.id,
        unitType,
        imageUrl: product?.imageUrl || null,
        fromPreOrder: true,
      },
    });
    loadedCount += 1;
  }

  if (po.customerId || po.customerPhone) {
    useCartStore
      .getState()
      .setCustomer(po.customerId || null, po.customerPhone, po.customerName, null);
  }
  useCartStore.getState().linkPreOrderId(po.id);
  await useCartStore.getState().loadCart();

  // Only advance PENDING -> CONFIRMED; never downgrade READY back to CONFIRMED.
  const currentStatus = String(po.status || 'PENDING').toUpperCase();
  if (markConfirmed && currentStatus === 'PENDING') {
    try {
      await api.patch(`/api/v1/pre-orders/${po.id}`, { status: 'CONFIRMED' });
    } catch (err) {
      console.warn('[preorder] mark CONFIRMED failed:', err);
    }
  }

  return { loadedCount };
}
