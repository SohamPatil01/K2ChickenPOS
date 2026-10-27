import type { AxiosInstance } from 'axios';
import { useCartStore } from '@/store/cart';

export type LoadablePreOrder = {
  id: string;
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

/**
 * Load a pre-order into the POS cart. Weights/qty stay fully editable afterward.
 * Only used for pre-orders — does not change normal cart add behavior.
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
    preOrder: po,
    products = [],
    replaceCart = true,
    markConfirmed = true,
  } = options;

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

  if (markConfirmed) {
    try {
      await api.patch(`/api/v1/pre-orders/${po.id}`, { status: 'CONFIRMED' });
    } catch (err) {
      console.warn('[preorder] mark CONFIRMED failed:', err);
    }
  }

  return { loadedCount };
}
