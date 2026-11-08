/**
 * Customer-facing order status derived ONLY from real POS state:
 *  - PreOrder.status (staff move it in the existing Pre-orders screen)
 *  - linked Sale.status (billing) and Sale.deliveryOrder.status (driver app)
 * The POS has no separate "cutting" state, so "Accepted" covers preparation.
 */
export type CustomerOrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'READY'
  | 'OUT_FOR_DELIVERY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'REFUNDED';

export type TimelineStep = { key: CustomerOrderStatus; label: string; reached: boolean; current: boolean };

type PreOrderLike = { status: string; fulfillment: string };
type SaleLike = { status: string; deliveryOrder?: { status: string } | null } | null;

export function deriveStatus(po: PreOrderLike | null, sale: SaleLike): CustomerOrderStatus {
  if (sale?.status === 'REFUNDED') return 'REFUNDED';
  if (po) {
    if (po.status === 'CANCELLED') return 'CANCELLED';
    if (po.status === 'NO_SHOW') return 'NO_SHOW';
    const ds = sale?.deliveryOrder?.status;
    if (ds === 'DELIVERED') return 'COMPLETED';
    if (ds === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
    if (po.status === 'FULFILLED') {
      // Delivery orders billed but not yet out stay "Ready" until the driver moves them.
      if (po.fulfillment === 'DELIVERY' && ds && ds !== 'DELIVERED') return 'READY';
      return 'COMPLETED';
    }
    if (po.status === 'READY') return 'READY';
    if (po.status === 'CONFIRMED') return 'ACCEPTED';
    return 'PLACED';
  }
  if (sale?.status === 'VOID') return 'CANCELLED';
  return 'COMPLETED';
}

export function statusLabel(s: CustomerOrderStatus, fulfillment: string): string {
  switch (s) {
    case 'PLACED':
      return 'Order placed — waiting for the store to accept';
    case 'ACCEPTED':
      return 'Accepted — the store is preparing your order';
    case 'READY':
      return fulfillment === 'DELIVERY' ? 'Packed and ready to go out' : 'Ready for pickup';
    case 'OUT_FOR_DELIVERY':
      return 'Out for delivery';
    case 'COMPLETED':
      return fulfillment === 'DELIVERY' ? 'Delivered' : 'Collected';
    case 'CANCELLED':
      return 'Cancelled';
    case 'NO_SHOW':
      return 'Not collected';
    case 'REFUNDED':
      return 'Refunded';
  }
}

export function buildTimeline(status: CustomerOrderStatus, fulfillment: string): TimelineStep[] {
  const keys: CustomerOrderStatus[] =
    fulfillment === 'DELIVERY'
      ? ['PLACED', 'ACCEPTED', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED']
      : ['PLACED', 'ACCEPTED', 'READY', 'COMPLETED'];
  const terminalBad = status === 'CANCELLED' || status === 'NO_SHOW' || status === 'REFUNDED';
  const idx = keys.indexOf(status);
  return keys.map((key, i) => ({
    key,
    label: statusLabel(key, fulfillment),
    reached: !terminalBad && idx >= 0 && i <= idx,
    current: !terminalBad && i === idx,
  }));
}

export function isOpenStatus(s: CustomerOrderStatus): boolean {
  return s === 'PLACED' || s === 'ACCEPTED' || s === 'READY' || s === 'OUT_FOR_DELIVERY';
}
