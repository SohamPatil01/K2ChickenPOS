/** Delivery fee without a Sale column — from DeliveryOrder or implied by grandTotal. */
export function resolveSaleDeliveryFee(sale: {
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  deliveryOrder?: { deliveryFee?: number } | null;
}): number {
  const fromOrder = sale.deliveryOrder?.deliveryFee;
  if (fromOrder != null && fromOrder > 0) return fromOrder;

  const itemsTotal = Math.round(
    Math.round(sale.subTotal * 100) / 100 +
      Math.round(sale.taxTotal * 100) / 100 -
      Math.round(sale.discountTotal * 100) / 100
  );
  return Math.max(0, Math.round(sale.grandTotal) - itemsTotal);
}

export function enrichSaleWithDeliveryFee<
  T extends {
    subTotal: number;
    taxTotal: number;
    discountTotal: number;
    grandTotal: number;
    deliveryOrder?: { deliveryFee?: number } | null;
  },
>(sale: T): T & { deliveryFee: number } {
  return { ...sale, deliveryFee: resolveSaleDeliveryFee(sale) };
}
