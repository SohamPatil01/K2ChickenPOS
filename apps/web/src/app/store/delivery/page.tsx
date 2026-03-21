'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import {
  format,
  subDays,
  startOfMonth,
  startOfWeek,
  endOfWeek,
  isValid,
  parseISO,
} from 'date-fns';

interface Delivery {
  id: string;
  createdAt: string;
  type: string;
  status: string;
  deliveryFee: number;
  sale: {
    saleNo: string;
    grandTotal: number;
    customerId?: string | null;
    customer: { id?: string; name: string; phone: string } | null;
  };
  address: { id?: string; line1: string; city: string } | null;
  assignedDriver: { name: string } | null;
}

interface SaleOption {
  id: string;
  saleNo: string;
  grandTotal: number;
  status: string;
  customerId: string | null;
  customer: { id: string; name: string; phone: string } | null;
  deliveryOrder: { id: string } | null;
}

interface CustomerAddress {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

const DELIVERY_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'CREATED', label: 'Created' },
  { value: 'READY', label: 'Ready' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'RETURNED', label: 'Returned' },
];

const KANBAN_STATUSES = [
  'CREATED',
  'READY',
  'ASSIGNED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
] as const;

type DatePreset = 'today' | 'yesterday' | 'last7' | 'thisWeek' | 'thisMonth' | 'all' | 'custom';

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  thisWeek: 'This week',
  thisMonth: 'This month',
  all: 'All time',
  custom: 'Custom',
};

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    CREATED: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
    READY: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200',
    ASSIGNED: 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200',
    OUT_FOR_DELIVERY: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
    DELIVERED: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
    FAILED: 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200',
    RETURNED: 'bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-200',
  };
  return map[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

export default function StoreDeliveryPage() {
  const { user } = useAuthStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');

  const [showCreate, setShowCreate] = useState(false);
  const [paidSales, setPaidSales] = useState<SaleOption[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    saleId: '',
    type: 'PICKUP' as 'PICKUP' | 'DELIVERY',
    deliveryFee: 0,
    addressId: '',
  });
  const [createAddNewAddress, setCreateAddNewAddress] = useState(false);
  const [createNewAddress, setCreateNewAddress] = useState({
    label: 'Home',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
  });
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [detailsAddresses, setDetailsAddresses] = useState<CustomerAddress[]>([]);
  const [detailsForm, setDetailsForm] = useState({
    customerName: '',
    customerPhone: '',
    addressId: '',
    newAddress: { label: 'Home', line1: '', line2: '', city: '', state: '', zip: '' },
  });
  const [addNewAddress, setAddNewAddress] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const dateRangeParams = useMemo(() => {
    const today = new Date();
    switch (datePreset) {
      case 'today':
        return { startDate: format(today, 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
      case 'yesterday': {
        const y = subDays(today, 1);
        return { startDate: format(y, 'yyyy-MM-dd'), endDate: format(y, 'yyyy-MM-dd') };
      }
      case 'last7':
        return { startDate: format(subDays(today, 6), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
      case 'thisWeek': {
        const start = startOfWeek(today, { weekStartsOn: 1 });
        const end = endOfWeek(today, { weekStartsOn: 1 });
        return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') };
      }
      case 'thisMonth':
        return { startDate: format(startOfMonth(today), 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
      case 'custom':
        if (customStart && customEnd) {
          const a = customStart <= customEnd ? customStart : customEnd;
          const b = customStart <= customEnd ? customEnd : customStart;
          return { startDate: a, endDate: b };
        }
        return null;
      case 'all':
      default:
        return null;
    }
  }, [datePreset, customStart, customEnd]);

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (dateRangeParams) {
        params.startDate = dateRangeParams.startDate;
        params.endDate = dateRangeParams.endDate;
      }
      const response = await api.get<Delivery[]>('/api/v1/delivery', { params });
      setDeliveries(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load deliveries:', error);
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateRangeParams]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  const filteredDeliveries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deliveries;
    return deliveries.filter((d) => {
      const no = d.sale.saleNo?.toLowerCase() || '';
      const name = d.sale.customer?.name?.toLowerCase() || '';
      const phone = d.sale.customer?.phone?.toLowerCase() || '';
      return no.includes(q) || name.includes(q) || phone.includes(q);
    });
  }, [deliveries, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of KANBAN_STATUSES) counts[s] = 0;
    for (const d of filteredDeliveries) {
      if (counts[d.status] !== undefined) counts[d.status] += 1;
    }
    return counts;
  }, [filteredDeliveries]);

  const loadPaidSalesWithoutDelivery = async () => {
    setLoadingSales(true);
    setCreateError(null);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const response = await api.get('/api/v1/sales', {
        params: {
          status: 'PAID',
          startDate: thirtyDaysAgo.toISOString(),
          endDate: new Date().toISOString(),
          limit: 100,
        },
      });
      const sales: SaleOption[] = response.data || [];
      const withoutDelivery = sales.filter((s: SaleOption) => !s.deliveryOrder && s.customerId);
      setPaidSales(withoutDelivery);
      setForm((f) => ({ ...f, saleId: '', addressId: '' }));
      setAddresses([]);
    } catch (e) {
      console.error('Failed to load sales:', e);
      setCreateError('Failed to load paid sales');
    } finally {
      setLoadingSales(false);
    }
  };

  const openCreateModal = () => {
    setShowCreate(true);
    setForm({ saleId: '', type: 'PICKUP', deliveryFee: 0, addressId: '' });
    setAddresses([]);
    setCreateAddNewAddress(false);
    setCreateNewAddress({ label: 'Home', line1: '', line2: '', city: '', state: '', zip: '' });
    setCreateError(null);
    loadPaidSalesWithoutDelivery();
  };

  const onSelectSale = async (saleId: string) => {
    setForm((f) => ({ ...f, saleId, addressId: '' }));
    const sale = paidSales.find((s) => s.id === saleId);
    if (!sale?.customerId) {
      setAddresses([]);
      return;
    }
    try {
      const res = await api.get(`/api/v1/customers/${sale.customerId}`);
      setAddresses(res.data?.addresses || []);
    } catch {
      setAddresses([]);
    }
  };

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!form.saleId) {
      setCreateError('Please select a sale');
      return;
    }
    let addressId: string | undefined = form.addressId || undefined;
    if (form.type === 'DELIVERY') {
      if (createAddNewAddress) {
        if (!createNewAddress.line1?.trim() || !createNewAddress.city?.trim()) {
          setCreateError('Please enter address line 1 and city');
          return;
        }
        const sale = paidSales.find((s) => s.id === form.saleId);
        if (!sale?.customerId) {
          setCreateError('This sale has no customer. Add an address in Customers first or select a sale with a customer.');
          return;
        }
        setCreating(true);
        try {
          const addrRes = await api.post(`/api/v1/customers/${sale.customerId}/addresses`, {
            label: createNewAddress.label || 'Home',
            line1: createNewAddress.line1.trim(),
            line2: createNewAddress.line2?.trim() || undefined,
            city: createNewAddress.city.trim(),
            state: createNewAddress.state?.trim() || undefined,
            zip: createNewAddress.zip?.trim() || undefined,
          });
          addressId = addrRes.data?.id;
        } catch (err: any) {
          setCreateError(err.response?.data?.error || 'Failed to add address');
          setCreating(false);
          return;
        }
      } else if (!form.addressId) {
        setCreateError('Please select a delivery address or add a new one');
        return;
      }
    }
    setCreating(true);
    try {
      await api.post('/api/v1/delivery', {
        saleId: form.saleId,
        type: form.type,
        deliveryFee: Number(form.deliveryFee) || 0,
        addressId: form.type === 'DELIVERY' ? addressId : undefined,
      });
      setShowCreate(false);
      loadDeliveries();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create delivery');
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: string, status: string, extra?: { failureReason?: string }) => {
    try {
      await api.post(`/api/v1/delivery/${id}/status`, {
        status,
        ...(extra?.failureReason ? { failureReason: extra.failureReason } : {}),
      });
      loadDeliveries();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update status');
    }
  };

  const handleStatusSelectChange = async (delivery: Delivery, newStatus: string) => {
    if (newStatus === delivery.status) return;
    let failureReason: string | undefined;
    if (newStatus === 'FAILED') {
      const reason = window.prompt('Reason for failure (optional):') ?? '';
      failureReason = reason.trim() || undefined;
    }
    await updateStatus(delivery.id, newStatus, { failureReason });
  };

  const openDetailsModal = async (delivery: Delivery) => {
    setEditingDelivery(delivery);
    setDetailsError(null);
    setDetailsForm({
      customerName: delivery.sale.customer?.name || '',
      customerPhone: delivery.sale.customer?.phone || '',
      addressId: (delivery.address as { id?: string })?.id || '',
      newAddress: { label: 'Home', line1: '', line2: '', city: '', state: '', zip: '' },
    });
    setAddNewAddress(false);
    const customerId = delivery.sale.customerId || delivery.sale.customer?.id;
    if (customerId) {
      try {
        const res = await api.get(`/api/v1/customers/${customerId}`);
        setDetailsAddresses(res.data?.addresses || []);
      } catch {
        setDetailsAddresses([]);
      }
    } else {
      setDetailsAddresses([]);
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDelivery) return;
    setDetailsError(null);
    setDetailsSaving(true);
    try {
      const customerId = editingDelivery.sale.customerId || editingDelivery.sale.customer?.id;
      let addressId = detailsForm.addressId;
      if (customerId) {
        if (detailsForm.customerName || detailsForm.customerPhone) {
          await api.put(`/api/v1/customers/${customerId}`, {
            name: detailsForm.customerName || undefined,
            phone: detailsForm.customerPhone || undefined,
          });
        }
        if (addNewAddress && detailsForm.newAddress.line1 && detailsForm.newAddress.city) {
          const addrRes = await api.post(`/api/v1/customers/${customerId}/addresses`, {
            label: detailsForm.newAddress.label,
            line1: detailsForm.newAddress.line1,
            line2: detailsForm.newAddress.line2 || undefined,
            city: detailsForm.newAddress.city,
            state: detailsForm.newAddress.state,
            zip: detailsForm.newAddress.zip,
          });
          addressId = addrRes.data?.id;
        }
      }
      await api.patch(`/api/v1/delivery/${editingDelivery.id}`, {
        ...(addressId ? { addressId } : {}),
      });
      setEditingDelivery(null);
      loadDeliveries();
    } catch (err: any) {
      setDetailsError(err.response?.data?.error || 'Failed to save details');
    } finally {
      setDetailsSaving(false);
    }
  };

  const groupedByStatus = useMemo(() => {
    return filteredDeliveries.reduce(
      (acc, delivery) => {
        if (!acc[delivery.status]) acc[delivery.status] = [];
        acc[delivery.status].push(delivery);
        return acc;
      },
      {} as Record<string, Delivery[]>
    );
  }, [filteredDeliveries]);

  const rangeLabel =
    datePreset === 'all'
      ? 'All dates'
      : dateRangeParams
        ? `${dateRangeParams.startDate} → ${dateRangeParams.endDate}`
        : 'Select a valid custom range';

  const formatOrderTime = (iso: string) => {
    try {
      const d = parseISO(iso);
      return isValid(d) ? format(d, 'dd MMM yyyy, h:mm a') : '—';
    } catch {
      return '—';
    }
  };

  const presets: DatePreset[] = ['today', 'yesterday', 'last7', 'thisWeek', 'thisMonth', 'all', 'custom'];

  return (
    <div className="w-full max-w-6xl mx-auto min-h-0 flex flex-col gap-4 pb-8">
      {/* Hero header */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white p-5 sm:p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Deliveries</h1>
            <p className="text-white/85 text-sm mt-1 max-w-xl">
              Filter by date, search by sale or customer, update status, and manage addresses — all in one place.
            </p>
            <p className="text-white/70 text-xs mt-2 font-medium">{rangeLabel}</p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-brand-700 font-semibold text-sm shadow-md hover:bg-brand-50 transition-colors"
          >
            <span className="text-lg leading-none">＋</span> New delivery
          </button>
        </div>
      </div>

      {/* Date presets */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Date range
        </p>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDatePreset(p)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                datePreset === p
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
        {datePreset === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white text-sm font-medium"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {DELIVERY_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sale #, name, phone…"
            className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-white text-sm placeholder:text-gray-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => loadDeliveries()}
            disabled={loading}
            className="px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <div className="flex rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-4 py-3 text-sm font-medium ${
                viewMode === 'list'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              className={`px-4 py-3 text-sm font-medium border-l border-gray-200 dark:border-gray-600 ${
                viewMode === 'board'
                  ? 'bg-brand-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
              }`}
            >
              Board
            </button>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex flex-wrap gap-2">
        {KANBAN_STATUSES.filter((s) => statusCounts[s] > 0).map((s) => (
          <span
            key={s}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${statusBadgeClass(s)}`}
          >
            {formatStatusLabel(s)} <span className="opacity-80">({statusCounts[s]})</span>
          </span>
        ))}
        {!loading && filteredDeliveries.length === 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400 py-1">No orders in this view.</span>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse border border-gray-200/80 dark:border-gray-700"
              />
            ))}
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3">
            {filteredDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-lg text-gray-900 dark:text-white">{delivery.sale.saleNo}</span>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusBadgeClass(delivery.status)}`}
                      >
                        {formatStatusLabel(delivery.status)}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {delivery.type === 'DELIVERY' ? 'Delivery' : 'Pickup'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {delivery.sale.customer?.name || 'Customer'}
                      </span>
                      {delivery.sale.customer?.phone && (
                        <span className="text-gray-500 dark:text-gray-400"> · {delivery.sale.customer.phone}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatOrderTime(delivery.createdAt)}</p>
                    {delivery.address && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        📍 {delivery.address.line1}, {delivery.address.city}
                      </p>
                    )}
                    {delivery.assignedDriver && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">Driver: {delivery.assignedDriver.name}</p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch gap-2 lg:w-64 xl:w-auto">
                    <div className="text-right sm:text-left lg:text-right min-w-[5rem]">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
                      <p className="text-xl font-bold text-brand-600 dark:text-brand-400">
                        ₹{delivery.sale.grandTotal.toFixed(0)}
                      </p>
                      {delivery.deliveryFee > 0 && (
                        <p className="text-xs text-gray-500">Fee ₹{delivery.deliveryFee.toFixed(0)}</p>
                      )}
                    </div>
                    {(user?.role === 'MANAGER' || user?.role === 'OWNER') && (
                      <select
                        value={delivery.status}
                        onChange={(e) => handleStatusSelectChange(delivery, e.target.value)}
                        className="w-full sm:w-44 lg:w-full xl:w-44 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm font-medium"
                        aria-label="Change status"
                      >
                        {DELIVERY_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  {user?.role !== 'DRIVER' && delivery.status === 'ASSIGNED' && (
                    <button
                      type="button"
                      onClick={() => updateStatus(delivery.id, 'OUT_FOR_DELIVERY')}
                      className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
                    >
                      Mark out for delivery
                    </button>
                  )}
                  {user?.role === 'DRIVER' && delivery.status === 'OUT_FOR_DELIVERY' && (
                    <button
                      type="button"
                      onClick={() => {
                        const otp = window.prompt('Enter OTP:');
                        if (otp) {
                          api
                            .post(`/api/v1/delivery/${delivery.id}/otp/verify`, { otp })
                            .then(() => loadDeliveries())
                            .catch((err) => alert(err.response?.data?.error || 'Invalid OTP'));
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
                    >
                      Verify OTP
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openDetailsModal(delivery)}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {delivery.address ? 'Edit customer & address' : 'Add address'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto pb-2 -mx-1">
            <div className="flex gap-3 min-w-max px-1">
              {KANBAN_STATUSES.map((status) => (
                <div
                  key={status}
                  className="w-64 sm:w-72 flex-shrink-0 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 p-3"
                >
                  <h2 className="font-bold text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-3 px-1">
                    {formatStatusLabel(status)}
                    <span className="ml-1 text-gray-400">({(groupedByStatus[status] || []).length})</span>
                  </h2>
                  <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                    {(groupedByStatus[status] || []).length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-6">Empty</p>
                    ) : (
                      (groupedByStatus[status] || []).map((delivery) => (
                        <div
                          key={delivery.id}
                          className="rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3 shadow-sm"
                        >
                          <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {delivery.sale.saleNo}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {delivery.sale.customer?.name}
                          </div>
                          <div className="text-xs font-medium text-brand-600 dark:text-brand-400 mt-1">
                            ₹{delivery.sale.grandTotal.toFixed(0)}
                          </div>
                          {(user?.role === 'MANAGER' || user?.role === 'OWNER') && (
                            <select
                              value={delivery.status}
                              onChange={(e) => handleStatusSelectChange(delivery, e.target.value)}
                              className="mt-2 w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            >
                              {DELIVERY_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            type="button"
                            onClick={() => openDetailsModal(delivery)}
                            className="mt-2 w-full text-xs py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                          >
                            Details
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-lg font-bold dark:text-white">New delivery</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateDelivery} className="p-5 space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Paid sale</label>
                <select
                  value={form.saleId}
                  onChange={(e) => onSelectSale(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                  required
                >
                  <option value="">Choose a sale…</option>
                  {paidSales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.saleNo} — {s.customer?.name} — ₹{s.grandTotal.toFixed(0)}
                    </option>
                  ))}
                </select>
                {loadingSales && <p className="text-xs text-gray-500 mt-1">Loading…</p>}
                {!loadingSales && paidSales.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">No eligible sales (need customer, no delivery yet).</p>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Type</p>
                <div className="flex gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-gray-200 dark:border-gray-600 py-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-900/20">
                    <input
                      type="radio"
                      name="type"
                      checked={form.type === 'PICKUP'}
                      onChange={() => {
                        setForm((f) => ({ ...f, type: 'PICKUP', addressId: '' }));
                        setAddresses([]);
                        setCreateAddNewAddress(false);
                      }}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium dark:text-white">Pickup</span>
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-gray-200 dark:border-gray-600 py-3 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50 dark:has-[:checked]:bg-brand-900/20">
                    <input
                      type="radio"
                      name="type"
                      checked={form.type === 'DELIVERY'}
                      onChange={() => {
                        setForm((f) => ({ ...f, type: 'DELIVERY' }));
                        if (form.saleId) onSelectSale(form.saleId);
                      }}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium dark:text-white">Delivery</span>
                  </label>
                </div>
              </div>
              {form.type === 'DELIVERY' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Address</label>
                  {!createAddNewAddress ? (
                    <>
                      <select
                        value={form.addressId}
                        onChange={(e) => setForm((f) => ({ ...f, addressId: e.target.value }))}
                        className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                      >
                        <option value="">Select saved address</option>
                        {addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}: {a.line1}, {a.city}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setCreateAddNewAddress(true)}
                        className="mt-2 text-sm text-brand-600 dark:text-brand-400 font-medium"
                      >
                        + Add new address
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={createNewAddress.label}
                        onChange={(e) => setCreateNewAddress((a) => ({ ...a, label: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        placeholder="Label"
                      />
                      <input
                        type="text"
                        value={createNewAddress.line1}
                        onChange={(e) => setCreateNewAddress((a) => ({ ...a, line1: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        placeholder="Line 1 *"
                      />
                      <input
                        type="text"
                        value={createNewAddress.line2}
                        onChange={(e) => setCreateNewAddress((a) => ({ ...a, line2: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        placeholder="Line 2"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={createNewAddress.city}
                          onChange={(e) => setCreateNewAddress((a) => ({ ...a, city: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                          placeholder="City *"
                        />
                        <input
                          type="text"
                          value={createNewAddress.state}
                          onChange={(e) => setCreateNewAddress((a) => ({ ...a, state: e.target.value }))}
                          className="w-full px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                          placeholder="State"
                        />
                      </div>
                      <input
                        type="text"
                        value={createNewAddress.zip}
                        onChange={(e) => setCreateNewAddress((a) => ({ ...a, zip: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        placeholder="PIN"
                      />
                      <button
                        type="button"
                        onClick={() => setCreateAddNewAddress(false)}
                        className="text-xs text-gray-500"
                      >
                        Use saved address
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Delivery fee (₹)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.deliveryFee}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryFee: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-3 rounded-xl border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 font-medium text-gray-700 dark:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !form.saleId}
                  className="flex-1 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-700 disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Details modal */}
      {editingDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
            <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800">
              <h2 className="text-lg font-bold dark:text-white">Order {editingDelivery.sale.saleNo}</h2>
              <button
                type="button"
                onClick={() => setEditingDelivery(null)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveDetails} className="p-5 space-y-4">
              {detailsError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 text-sm">{detailsError}</div>
              )}
              <div>
                <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Customer name</label>
                <input
                  type="text"
                  value={detailsForm.customerName}
                  onChange={(e) => setDetailsForm((f) => ({ ...f, customerName: e.target.value }))}
                  className="w-full px-3 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Phone</label>
                <input
                  type="text"
                  value={detailsForm.customerPhone}
                  onChange={(e) => setDetailsForm((f) => ({ ...f, customerPhone: e.target.value }))}
                  className="w-full px-3 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Address</label>
                {!addNewAddress ? (
                  <>
                    <select
                      value={detailsForm.addressId}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, addressId: e.target.value }))}
                      className="w-full px-3 py-3 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                    >
                      <option value="">Select</option>
                      {detailsAddresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}: {a.line1}, {a.city}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setAddNewAddress(true)}
                      className="mt-2 text-sm text-brand-600 font-medium"
                    >
                      + New address
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={detailsForm.newAddress.line1}
                      onChange={(e) =>
                        setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, line1: e.target.value } }))
                      }
                      className="w-full px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                      placeholder="Line 1"
                    />
                    <input
                      type="text"
                      value={detailsForm.newAddress.line2}
                      onChange={(e) =>
                        setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, line2: e.target.value } }))
                      }
                      className="w-full px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                      placeholder="Line 2"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={detailsForm.newAddress.city}
                        onChange={(e) =>
                          setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, city: e.target.value } }))
                        }
                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        placeholder="City"
                      />
                      <input
                        type="text"
                        value={detailsForm.newAddress.state}
                        onChange={(e) =>
                          setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, state: e.target.value } }))
                        }
                        className="w-full px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                        placeholder="State"
                      />
                    </div>
                    <input
                      type="text"
                      value={detailsForm.newAddress.zip}
                      onChange={(e) =>
                        setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, zip: e.target.value } }))
                      }
                      className="w-full px-3 py-2 rounded-xl border dark:border-gray-600 dark:bg-gray-700 dark:text-white text-sm"
                      placeholder="PIN"
                    />
                    <button type="button" onClick={() => setAddNewAddress(false)} className="text-xs text-gray-500">
                      Pick saved address
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingDelivery(null)}
                  className="flex-1 py-3 rounded-xl border font-medium dark:border-gray-600 dark:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={detailsSaving}
                  className="flex-1 py-3 rounded-xl bg-brand-600 text-white font-semibold disabled:opacity-50"
                >
                  {detailsSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
