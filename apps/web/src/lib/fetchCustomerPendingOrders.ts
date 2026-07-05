import api from '@/lib/api';
import type { PendingOpenOrder } from '@/lib/pendingCreditCheckout';

type PendingPaymentsCustomer = {
  id: string;
  openOrders?: PendingOpenOrder[];
};

/** Pending credit bills for one customer (empty if none or walk-in). */
export async function fetchCustomerPendingOrders(customerId: string | null | undefined): Promise<PendingOpenOrder[]> {
  if (!customerId) return [];

  const response = await api.get('/api/v1/customers/pending-payments');
  const rows: PendingPaymentsCustomer[] = response.data || [];
  const match = rows.find((c) => c.id === customerId);
  if (!match?.openOrders?.length) return [];

  return match.openOrders
    .filter((o) => Math.round(Number(o.pending ?? o.remainingBalance ?? 0)) > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
