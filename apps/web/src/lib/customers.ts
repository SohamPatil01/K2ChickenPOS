/** Normalize GET /api/v1/customers list (array or legacy { customers, total }). */
export function parseCustomerListResponse(
  data: unknown,
  totalHeader?: string | number | null
): {
  customers: Record<string, unknown>[];
  total: number;
} {
  if (Array.isArray(data)) {
    const headerTotal =
      totalHeader != null && totalHeader !== '' ? Number(totalHeader) : NaN;
    return {
      customers: data,
      total: Number.isFinite(headerTotal) ? headerTotal : data.length,
    };
  }
  if (data && typeof data === 'object') {
    const payload = data as { customers?: unknown; total?: unknown };
    const customers = Array.isArray(payload.customers)
      ? (payload.customers as Record<string, unknown>[])
      : [];
    const total =
      typeof payload.total === 'number' ? payload.total : customers.length;
    return { customers, total };
  }
  return { customers: [], total: 0 };
}
