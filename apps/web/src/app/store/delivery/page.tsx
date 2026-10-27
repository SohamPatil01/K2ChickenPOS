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
  parse,
  startOfDay,
  endOfDay,
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
    status?: string;
    customerId?: string | null;
    customer: { id?: string; name: string; phone: string } | null;
    payments?: Array<{ method: string; amount: number }>;
  };
  address: {
    id?: string;
    line1: string;
    line2?: string | null;
    city: string;
    state?: string | null;
    zip?: string | null;
  } | null;
  assignedDriver: { name: string; phone?: string | null } | null;
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

/** Prefer Home/Delivery, else first saved address (skip Area mirror rows). */
function preferredAddressId(addresses: CustomerAddress[]): string {
  const usable = (addresses || []).filter(
    (a) => a?.id && a.label !== 'Area' && String(a.line1 || '').trim() && a.line1 !== '—'
  );
  if (!usable.length) return '';
  const preferred = usable.find((a) => {
    const label = String(a.label || '').toLowerCase();
    return label === 'home' || label === 'delivery' || label.includes('home');
  });
  return (preferred || usable[0]).id;
}

const SIMPLE_COLUMNS = ['OPEN', 'DELIVERED', 'FAILED'] as const;

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

function isOpenStatus(status: string) {
  return !['DELIVERED', 'FAILED', 'RETURNED'].includes(status);
}

function simpleColumn(status: string): (typeof SIMPLE_COLUMNS)[number] {
  if (status === 'FAILED' || status === 'RETURNED') return 'FAILED';
  if (status === 'DELIVERED') return 'DELIVERED';
  return 'OPEN';
}

function statusBadgeClass(status: string): string {
  if (status === 'DELIVERED') return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200';
  if (status === 'FAILED' || status === 'RETURNED') return 'bg-red-500/15 text-red-800 dark:text-red-200';
  if (status === 'OUT_FOR_DELIVERY') return 'bg-sky-500/15 text-sky-800 dark:text-sky-200';
  return 'bg-brand-500/15 text-brand-800 dark:text-brand-200';
}

function statusAccentClass(status: string): string {
  if (status === 'DELIVERED') return 'bg-emerald-500';
  if (status === 'FAILED' || status === 'RETURNED') return 'bg-red-500';
  if (status === 'OUT_FOR_DELIVERY') return 'bg-sky-500';
  return 'bg-brand-500';
}

const ACTIVE_STATUSES = ['CREATED', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY'] as const;
const DONE_STATUSES = ['DELIVERED', 'FAILED', 'RETURNED'] as const;

type QueueTab = 'active' | 'done' | 'all';

function formatStatusLabel(status: string) {
  switch (status) {
    case 'DELIVERED':
      return 'Delivered';
    case 'FAILED':
    case 'RETURNED':
      return 'Failed';
    case 'OUT_FOR_DELIVERY':
      return 'On the way';
    case 'ASSIGNED':
      return 'Assigned';
    case 'READY':
      return 'Ready';
    case 'CREATED':
      return 'Queued';
    case 'OPEN':
      return 'Open';
    default:
      return 'Open';
  }
}

function phoneDigits(phone?: string | null) {
  return String(phone || '').replace(/\D/g, '');
}

/** Full address string for Maps destination autofill */
function addressDestination(address: Delivery['address']) {
  if (!address?.line1) return '';
  return [address.line1, address.line2, address.city, address.state, address.zip]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ');
}

/** Google Maps directions with destination pre-filled (opens navigate-ready) */
function mapsDirectionsUrl(address: Delivery['address']) {
  const destination = addressDestination(address);
  if (!destination) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

type PaymentSummary = {
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'orange' | 'blue' | 'slate';
};

function paymentSummary(sale: Delivery['sale']): PaymentSummary {
  const payments = sale.payments || [];
  const total = Number(sale.grandTotal) || 0;
  const byMethod: Record<string, number> = {};
  let paidSum = 0;
  for (const p of payments) {
    const m = String(p.method || 'OTHER').toUpperCase();
    const amt = Number(p.amount) || 0;
    byMethod[m] = (byMethod[m] || 0) + amt;
    paidSum += amt;
  }
  const methods = Object.keys(byMethod).filter((m) => byMethod[m] > 0);
  const creditAmt = byMethod.CREDIT || 0;
  const collected = paidSum - creditAmt;
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const methodLabel = (m: string) => {
    if (m === 'CASH') return 'Cash';
    if (m === 'UPI') return 'UPI';
    if (m === 'CARD') return 'Card';
    if (m === 'CREDIT') return 'Credit';
    return m;
  };

  // Pure credit (nothing collected at counter)
  if (creditAmt > 0 && collected < 1 && methods.every((m) => m === 'CREDIT' || byMethod[m] < 1)) {
    return {
      label: 'Credit',
      detail: `${fmt(creditAmt)} due on delivery / later`,
      tone: 'amber',
    };
  }

  // Mix of collected + credit → partial / balance due
  if (creditAmt > 0 && collected >= 1) {
    const parts = methods
      .filter((m) => m !== 'CREDIT')
      .map((m) => `${methodLabel(m)} ${fmt(byMethod[m])}`);
    return {
      label: 'Partial + credit',
      detail: `${parts.join(' · ') || 'Paid'} · Credit ${fmt(creditAmt)}`,
      tone: 'orange',
    };
  }

  // Partial if paid sum clearly under bill (and not pure credit)
  if (paidSum > 0 && paidSum + 0.5 < total) {
    const parts = methods.map((m) => `${methodLabel(m)} ${fmt(byMethod[m])}`);
    return {
      label: 'Partial payment',
      detail: `${parts.join(' · ')} · of ${fmt(total)}`,
      tone: 'orange',
    };
  }

  if (methods.length === 0) {
    return { label: 'Payment unknown', detail: '', tone: 'slate' };
  }

  if (methods.length === 1) {
    const m = methods[0];
    return {
      label: methodLabel(m),
      detail: `Collected ${fmt(byMethod[m])}`,
      tone: m === 'CASH' ? 'emerald' : 'blue',
    };
  }

  return {
    label: 'Split payment',
    detail: methods.map((m) => `${methodLabel(m)} ${fmt(byMethod[m])}`).join(' · '),
    tone: 'blue',
  };
}

function paymentBadgeClass(tone: PaymentSummary['tone']) {
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200';
    case 'amber':
      return 'bg-amber-500/15 text-amber-900 dark:text-amber-200';
    case 'orange':
      return 'bg-orange-500/15 text-orange-900 dark:text-orange-200';
    case 'blue':
      return 'bg-sky-500/12 text-sky-800 dark:text-sky-200';
    default:
      return 'bg-surface-2 text-ink-secondary';
  }
}

export default function StoreDeliveryPage() {
  const { user } = useAuthStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const isDriverUser = user?.role === 'DRIVER';
  const [datePreset, setDatePreset] = useState<DatePreset>(isDriverUser ? 'today' : 'all');
  const [customStart, setCustomStart] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [queueTab, setQueueTab] = useState<QueueTab>('active');
  const [busyId, setBusyId] = useState<string | null>(null);

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
  const [listError, setListError] = useState<string | null>(null);

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
    setListError(null);
    try {
      const params: Record<string, string> = {};
      // Send local calendar-day bounds as ISO so API filters match the user’s timezone (not UTC midnight)
      if (dateRangeParams) {
        const startLocal = startOfDay(parse(dateRangeParams.startDate, 'yyyy-MM-dd', new Date()));
        const endLocal = endOfDay(parse(dateRangeParams.endDate, 'yyyy-MM-dd', new Date()));
        params.createdAfter = startLocal.toISOString();
        params.createdBefore = endLocal.toISOString();
      }
      const response = await api.get<Delivery[]>('/api/v1/delivery', { params });
      const raw = response.data;
      setDeliveries(Array.isArray(raw) ? raw : []);
    } catch (error: unknown) {
      console.error('Failed to load deliveries:', error);
      const msg =
        (error as { response?: { data?: { error?: string; message?: string } } })?.response?.data?.error ||
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (error as { message?: string })?.message ||
        'Could not load deliveries. Check connection and try Refresh.';
      setListError(msg);
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [dateRangeParams]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  useEffect(() => {
    if (user?.role === 'DRIVER') {
      setDatePreset('today');
      setViewMode('list');
      setQueueTab('active');
    }
  }, [user?.role]);

  const searchedDeliveries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deliveries;
    return deliveries.filter((d) => {
      const no = d.sale.saleNo?.toLowerCase() || '';
      const name = d.sale.customer?.name?.toLowerCase() || '';
      const phone = d.sale.customer?.phone?.toLowerCase() || '';
      const area = d.address?.city?.toLowerCase() || '';
      const line = d.address?.line1?.toLowerCase() || '';
      return no.includes(q) || name.includes(q) || phone.includes(q) || area.includes(q) || line.includes(q);
    });
  }, [deliveries, search]);

  const filteredDeliveries = useMemo(() => {
    if (queueTab === 'all') return searchedDeliveries;
    if (queueTab === 'active') {
      return searchedDeliveries.filter((d) =>
        (ACTIVE_STATUSES as readonly string[]).includes(d.status)
      );
    }
    return searchedDeliveries.filter((d) => (DONE_STATUSES as readonly string[]).includes(d.status));
  }, [searchedDeliveries, queueTab]);

  const statusCounts = useMemo(() => {
    const counts = { OPEN: 0, DELIVERED: 0, FAILED: 0 };
    for (const d of searchedDeliveries) counts[simpleColumn(d.status)] += 1;
    return counts;
  }, [searchedDeliveries]);

  const queueCounts = useMemo(() => {
    let active = 0;
    let done = 0;
    for (const d of searchedDeliveries) {
      if ((ACTIVE_STATUSES as readonly string[]).includes(d.status)) active += 1;
      else if ((DONE_STATUSES as readonly string[]).includes(d.status)) done += 1;
    }
    return { active, done, all: searchedDeliveries.length };
  }, [searchedDeliveries]);

  const loadPaidSalesWithoutDelivery = async () => {
    setLoadingSales(true);
    setCreateError(null);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateParams = {
        startDate: thirtyDaysAgo.toISOString(),
        endDate: new Date().toISOString(),
        limit: 100,
      };
      const [paidRes, creditRes] = await Promise.all([
        api.get('/api/v1/sales', { params: { ...dateParams, status: 'PAID' } }),
        api.get('/api/v1/sales', {
          params: { ...dateParams, status: 'OPEN', paymentMethod: 'CREDIT' },
        }),
      ]);
      const sales: SaleOption[] = [...(paidRes.data || []), ...(creditRes.data || [])];
      const seen = new Set<string>();
      const withoutDelivery = sales.filter((s: SaleOption) => {
        if (!s?.id || seen.has(s.id)) return false;
        seen.add(s.id);
        return !s.deliveryOrder && s.customerId;
      });
      setPaidSales(withoutDelivery);
      setForm((f) => ({ ...f, saleId: '', addressId: '' }));
      setAddresses([]);
    } catch (e) {
      console.error('Failed to load sales:', e);
      setCreateError('Failed to load paid and credit sales');
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
    setCreateAddNewAddress(false);
    const sale = paidSales.find((s) => s.id === saleId);
    if (!sale?.customerId) {
      setAddresses([]);
      setForm((f) => ({ ...f, saleId, addressId: '' }));
      return;
    }
    try {
      const res = await api.get(`/api/v1/customers/${sale.customerId}`);
      const list: CustomerAddress[] = res.data?.addresses || [];
      setAddresses(list);
      const autoId = preferredAddressId(list);
      // Auto-fill from customer profile when an address exists; else leave blank for manual entry.
      setForm((f) => ({ ...f, saleId, addressId: autoId }));
    } catch {
      setAddresses([]);
      setForm((f) => ({ ...f, saleId, addressId: '' }));
    }
  };

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!form.saleId) {
      setCreateError('Please select a sale');
      return;
    }
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
      } else if (!form.addressId) {
        setCreateError('Please select a delivery address or add a new one');
        return;
      }
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        saleId: form.saleId,
        type: form.type,
        deliveryFee: Number(form.deliveryFee) || 0,
      };
      if (form.type === 'DELIVERY') {
        if (createAddNewAddress) {
          body.newAddress = {
            label: createNewAddress.label || 'Home',
            line1: createNewAddress.line1.trim(),
            line2: createNewAddress.line2?.trim() || undefined,
            city: createNewAddress.city.trim(),
            state: createNewAddress.state?.trim(),
            zip: createNewAddress.zip?.trim(),
          };
        } else {
          body.addressId = form.addressId;
        }
      }
      await api.post('/api/v1/delivery', body);
      setShowCreate(false);
      loadDeliveries();
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create delivery');
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setBusyId(id);
    try {
      await api.post(`/api/v1/delivery/${id}/status`, { status });
      setDeliveries((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status } : d))
      );
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const openDetailsModal = async (delivery: Delivery) => {
    setEditingDelivery(delivery);
    setDetailsError(null);
    const existingAddressId = (delivery.address as { id?: string })?.id || '';
    setDetailsForm({
      customerName: delivery.sale.customer?.name || '',
      customerPhone: delivery.sale.customer?.phone || '',
      addressId: existingAddressId,
      newAddress: { label: 'Home', line1: '', line2: '', city: '', state: '', zip: '' },
    });
    setAddNewAddress(false);
    const customerId = delivery.sale.customerId || delivery.sale.customer?.id;
    if (customerId) {
      try {
        const res = await api.get(`/api/v1/customers/${customerId}`);
        const list: CustomerAddress[] = res.data?.addresses || [];
        setDetailsAddresses(list);
        if (!existingAddressId) {
          const autoId = preferredAddressId(list);
          if (autoId) {
            setDetailsForm((f) => ({ ...f, addressId: autoId }));
            // Persist so the queue shows the address without a second save click.
            try {
              await api.patch(`/api/v1/delivery/${delivery.id}`, { addressId: autoId });
              loadDeliveries();
            } catch {
              /* keep selected in form; user can save manually */
            }
          }
        }
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
      if (customerId) {
        if (detailsForm.customerName || detailsForm.customerPhone) {
          await api.put(`/api/v1/customers/${customerId}`, {
            name: detailsForm.customerName || undefined,
            phone: detailsForm.customerPhone || undefined,
          });
        }
      }
      const patchBody: Record<string, unknown> = {};
      if (
        addNewAddress &&
        detailsForm.newAddress.line1?.trim() &&
        detailsForm.newAddress.city?.trim()
      ) {
        patchBody.newAddress = {
          label: detailsForm.newAddress.label || 'Home',
          line1: detailsForm.newAddress.line1.trim(),
          line2: detailsForm.newAddress.line2?.trim() || undefined,
          city: detailsForm.newAddress.city.trim(),
          state: detailsForm.newAddress.state?.trim(),
          zip: detailsForm.newAddress.zip?.trim(),
        };
      } else if (detailsForm.addressId) {
        patchBody.addressId = detailsForm.addressId;
      }
      if (Object.keys(patchBody).length > 0) {
        await api.patch(`/api/v1/delivery/${editingDelivery.id}`, patchBody);
      }
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
        const col = simpleColumn(delivery.status);
        if (!acc[col]) acc[col] = [];
        acc[col].push(delivery);
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
      if (!isValid(d)) return '—';
      const today = format(new Date(), 'yyyy-MM-dd');
      if (format(d, 'yyyy-MM-dd') === today) return format(d, 'h:mm a');
      return format(d, 'dd MMM, h:mm a');
    } catch {
      return '—';
    }
  };

  const canManage = user?.role === 'MANAGER' || user?.role === 'OWNER';
  const isDriver = user?.role === 'DRIVER';

  const presets: DatePreset[] = ['today', 'yesterday', 'last7', 'thisWeek', 'thisMonth', 'all', 'custom'];

  const renderDeliveryCard = (delivery: Delivery, compact = false) => {
    const pay = paymentSummary(delivery.sale);
    const phone = phoneDigits(delivery.sale.customer?.phone);
    const open = isOpenStatus(delivery.status);
    const mapLink = mapsDirectionsUrl(delivery.address);
    const dest = addressDestination(delivery.address);
    const missingAddress = delivery.type === 'DELIVERY' && !delivery.address;
    const busy = busyId === delivery.id;
    const onTheWay = delivery.status === 'OUT_FOR_DELIVERY';

    return (
      <article
        key={delivery.id}
        className={`group relative overflow-hidden rounded-2xl border bg-surface shadow-card transition-shadow hover:shadow-md ${
          missingAddress
            ? 'border-amber-400/60'
            : onTheWay
              ? 'border-sky-400/40'
              : 'border-[color:var(--border-subtle)]'
        }`}
      >
        <div className={`absolute inset-y-0 left-0 w-1 ${statusAccentClass(delivery.status)}`} aria-hidden />
        <div className={`${compact ? 'p-3.5 pl-4' : 'p-4 sm:p-5 pl-5'}`}>
          <div className={`flex ${compact ? 'flex-col gap-2.5' : 'flex-col sm:flex-row sm:items-start gap-3 sm:gap-4'}`}>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className={`font-bold tracking-tight text-ink ${compact ? 'text-base' : 'text-lg'}`}>
                  {delivery.sale.saleNo}
                </h3>
                <span className={`text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-md ${statusBadgeClass(delivery.status)}`}>
                  {formatStatusLabel(delivery.status)}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-2 text-ink-secondary">
                  {delivery.type === 'DELIVERY' ? 'Home' : 'Pickup'}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${paymentBadgeClass(pay.tone)}`}
                  title={pay.detail}
                >
                  {pay.label}
                </span>
              </div>

              <div>
                <p className={`font-semibold text-ink leading-snug ${compact ? 'text-sm' : 'text-base'}`}>
                  {delivery.sale.customer?.name || 'Walk-in customer'}
                </p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {formatOrderTime(delivery.createdAt)}
                  {phone.length >= 10 ? ` · ${phone.slice(-10)}` : ''}
                </p>
              </div>

              {pay.detail && (
                <p className="text-xs text-ink-secondary leading-relaxed">{pay.detail}</p>
              )}

              {delivery.address ? (
                mapLink ? (
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-start gap-1.5 text-sm font-medium text-brand-700 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors line-clamp-2"
                    title="Open Google Maps with this destination"
                  >
                    <span className="mt-0.5 shrink-0 inline-block h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
                    <span>{dest}</span>
                  </a>
                ) : (
                  <p className="text-sm text-ink-secondary line-clamp-2">{dest}</p>
                )
              ) : delivery.type === 'DELIVERY' ? (
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Address missing — add before dispatch
                </p>
              ) : (
                <p className="text-sm text-ink-muted">Counter pickup</p>
              )}

              {!isDriver && delivery.assignedDriver && (
                <p className="text-xs text-ink-muted">
                  Driver <span className="font-medium text-ink-secondary">{delivery.assignedDriver.name}</span>
                </p>
              )}
            </div>

            <div className={`shrink-0 ${compact ? '' : 'sm:text-right sm:pt-0.5'}`}>
              <p className={`font-black tabular-nums text-gradient-brand ${compact ? 'text-xl' : 'text-2xl sm:text-3xl'}`}>
                ₹{Math.round(delivery.sale.grandTotal).toLocaleString('en-IN')}
              </p>
              {delivery.deliveryFee > 0 && (
                <p className="text-xs text-ink-muted mt-0.5">
                  + ₹{Math.round(delivery.deliveryFee)} fee
                </p>
              )}
            </div>
          </div>

          <div
            className={`flex flex-wrap gap-2 ${
              compact
                ? 'mt-3'
                : 'mt-4 pt-3.5 border-t border-[color:var(--border-subtle)]'
            }`}
          >
            {(canManage || isDriver) && open && (
              <button
                type="button"
                disabled={busy}
                onClick={() => updateStatus(delivery.id, 'DELIVERED')}
                className="min-h-12 flex-1 sm:flex-none px-5 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-sm hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 transition"
              >
                {busy ? 'Saving…' : 'Mark delivered'}
              </button>
            )}
            {mapLink && (
              <a
                href={mapLink}
                target="_blank"
                rel="noreferrer"
                className={`min-h-12 inline-flex items-center justify-center px-4 rounded-xl text-sm font-bold active:scale-[0.98] transition ${
                  isDriver
                    ? 'bg-gradient-brand text-white shadow-glow-brand'
                    : 'border border-[color:var(--border-strong)] text-ink hover:bg-surface-2'
                }`}
              >
                Maps
              </a>
            )}
            {isDriver && open && !onTheWay && (
              <button
                type="button"
                disabled={busy}
                onClick={() => updateStatus(delivery.id, 'OUT_FOR_DELIVERY')}
                className="min-h-12 px-4 rounded-xl border border-brand-500/40 bg-brand-500/10 text-brand-800 dark:text-brand-200 text-sm font-bold hover:bg-brand-500/20 disabled:opacity-50 transition"
              >
                Start run
              </button>
            )}
            {phone.length >= 10 && (
              <a
                href={`tel:${phone}`}
                className="min-h-11 inline-flex items-center px-3.5 rounded-xl border border-[color:var(--border-subtle)] text-sm font-semibold text-ink hover:bg-surface-2 transition"
              >
                Call
              </a>
            )}
            {phone.length >= 10 && (
              <a
                href={`https://wa.me/91${phone.slice(-10)}`}
                target="_blank"
                rel="noreferrer"
                className="min-h-11 inline-flex items-center px-3.5 rounded-xl border border-[color:var(--border-subtle)] text-sm font-semibold text-ink hover:bg-surface-2 transition"
              >
                WhatsApp
              </a>
            )}
            {!isDriver && (
              <button
                type="button"
                onClick={() => openDetailsModal(delivery)}
                className="min-h-11 px-3.5 rounded-xl border border-[color:var(--border-subtle)] text-sm font-medium text-ink-secondary hover:text-ink hover:bg-surface-2 transition"
              >
                {delivery.address ? 'Edit' : 'Add address'}
              </button>
            )}
            {(canManage || isDriver) && open && (
              <button
                type="button"
                disabled={busy}
                onClick={() => updateStatus(delivery.id, 'FAILED')}
                className="min-h-11 px-3.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50 transition"
              >
                Failed
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto min-h-0 flex flex-col gap-4 sm:gap-5 pb-10">
      <div
        className="pointer-events-none absolute -top-6 right-0 h-40 w-72 rounded-full opacity-70 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(255,106,0,0.18), transparent 70%)' }}
        aria-hidden
      />

      <header className="relative glass-panel-strong rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700 dark:text-brand-300">
              {isDriver ? 'Driver console' : 'Store ops'}
            </p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-ink mt-1">
              {isDriver ? 'My deliveries' : 'Delivery desk'}
            </h1>
            <p className="text-sm text-ink-muted mt-1 max-w-xl">
              {isDriver
                ? 'Check payment, open Maps, then mark delivered when the drop is done.'
                : `${rangeLabel} · manage queue, addresses, and handoffs.`}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadDeliveries()}
              disabled={loading}
              className="min-h-11 px-4 rounded-xl border border-[color:var(--border-strong)] bg-surface text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-50 transition"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            {!isDriver && (
              <button
                type="button"
                onClick={openCreateModal}
                className="min-h-11 px-5 rounded-xl bg-gradient-brand text-white text-sm font-semibold shadow-glow-brand hover:brightness-105 active:scale-[0.98] transition"
              >
                New delivery
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {(
          [
            { id: 'active' as const, label: 'To do', count: queueCounts.active, hint: 'Still open' },
            { id: 'done' as const, label: 'Done', count: queueCounts.done, hint: 'Finished today' },
            { id: 'all' as const, label: 'All', count: queueCounts.all, hint: 'Full queue' },
          ] as const
        ).map((tab) => {
          const active = queueTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setQueueTab(tab.id)}
              className={`min-h-[4.5rem] rounded-2xl border px-3 py-2.5 text-left transition active:scale-[0.99] ${
                active
                  ? 'border-brand-500/40 bg-brand-500/10 shadow-sm'
                  : 'border-[color:var(--border-subtle)] bg-surface hover:bg-surface-2'
              }`}
            >
              <span className={`block text-2xl font-black tabular-nums leading-none ${active ? 'text-brand-700 dark:text-brand-300' : 'text-ink'}`}>
                {tab.count}
              </span>
              <span className={`block text-xs font-bold mt-1.5 ${active ? 'text-brand-800 dark:text-brand-200' : 'text-ink'}`}>
                {tab.label}
              </span>
              <span className="block text-[11px] text-ink-muted mt-0.5">{tab.hint}</span>
            </button>
          );
        })}
      </div>

      <div className="glass-panel rounded-2xl p-3 sm:p-4 space-y-3">
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, sale #, area…"
            className="w-full min-h-12 pl-4 pr-10 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-base placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-500/35"
          />
          {search.trim() && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink text-sm"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        {!isDriver && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDatePreset(p)}
                  className={`min-h-9 px-3 rounded-lg text-xs sm:text-sm font-semibold transition ${
                    datePreset === p
                      ? 'bg-gradient-brand text-white shadow-sm'
                      : 'bg-surface-2 text-ink-secondary hover:text-ink'
                  }`}
                >
                  {PRESET_LABELS[p]}
                </button>
              ))}
            </div>
            {datePreset === 'custom' && (
              <div className="flex flex-wrap items-end gap-3 pt-0.5">
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">From</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="min-h-11 px-3 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-muted mb-1">To</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="min-h-11 px-3 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                  />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-ink-muted">
                <span className="font-semibold text-ink-secondary">{statusCounts.OPEN}</span> open
                <span className="mx-1.5 text-[color:var(--border-strong)]">·</span>
                <span className="font-semibold text-ink-secondary">{statusCounts.DELIVERED}</span> delivered
                <span className="mx-1.5 text-[color:var(--border-strong)]">·</span>
                <span className="font-semibold text-ink-secondary">{statusCounts.FAILED}</span> failed
              </p>
              <div className="flex rounded-xl bg-surface-2 p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    viewMode === 'list' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'
                  }`}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('board')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    viewMode === 'board' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'
                  }`}
                >
                  Board
                </button>
              </div>
            </div>
          </>
        )}
        {isDriver && (
          <p className="text-xs text-ink-muted">
            Showing today · <span className="font-semibold text-ink-secondary">{statusCounts.OPEN}</span> open ·{' '}
            <span className="font-semibold text-ink-secondary">{statusCounts.DELIVERED}</span> delivered
          </p>
        )}
      </div>

      {listError && (
        <div
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200"
          role="alert"
        >
          <strong className="font-semibold">Couldn’t load deliveries. </strong>
          {listError}
        </div>
      )}

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-32 rounded-2xl bg-surface-2 animate-pulse border border-[color:var(--border-subtle)]"
              />
            ))}
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-surface/60 px-6 py-16 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-brand-500/10 flex items-center justify-center">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-500" aria-hidden />
            </div>
            <p className="text-lg font-bold text-ink">
              {queueTab === 'active' && queueCounts.done > 0
                ? 'Queue is clear'
                : queueTab === 'done' && queueCounts.active > 0
                  ? 'Nothing completed in this view'
                  : 'No deliveries found'}
            </p>
            <p className="text-sm text-ink-muted mt-1.5 max-w-md mx-auto leading-relaxed">
              {queueTab === 'active' && queueCounts.done > 0
                ? `${queueCounts.done} finished ${queueCounts.done === 1 ? 'order is' : 'orders are'} under Done.`
                : datePreset !== 'all'
                  ? 'This date filter is hiding older orders. Switch to All time.'
                  : search.trim()
                    ? 'No match for this search. Clear the search box.'
                    : 'Only bills with a delivery row show here. Walk-ins without a customer stay off this list.'}
            </p>
            {(queueTab !== 'all' || datePreset !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setQueueTab('all');
                  setDatePreset('all');
                }}
                className="mt-5 min-h-11 px-5 rounded-xl bg-gradient-brand text-white text-sm font-semibold shadow-glow-brand"
              >
                Show all deliveries
              </button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <div className="space-y-3">{filteredDeliveries.map((d) => renderDeliveryCard(d))}</div>
        ) : (
          <div className="overflow-x-auto pb-2 -mx-1">
            <div className="flex gap-3 min-w-max px-1">
              {(queueTab === 'done'
                ? (['DELIVERED', 'FAILED'] as const)
                : queueTab === 'active'
                  ? (['OPEN'] as const)
                  : SIMPLE_COLUMNS
              ).map((status) => (
                <div
                  key={status}
                  className="w-80 flex-shrink-0 rounded-2xl border border-[color:var(--border-subtle)] bg-surface-2/70 p-3"
                >
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className={`h-2 w-2 rounded-full ${statusAccentClass(status)}`} aria-hidden />
                    <h2 className="font-bold text-xs uppercase tracking-wide text-ink-secondary">
                      {formatStatusLabel(status)}
                    </h2>
                    <span className="text-xs text-ink-muted tabular-nums">
                      {(groupedByStatus[status] || []).length}
                    </span>
                  </div>
                  <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
                    {(groupedByStatus[status] || []).length === 0 ? (
                      <p className="text-xs text-ink-muted text-center py-8">Empty</p>
                    ) : (
                      (groupedByStatus[status] || []).map((delivery) =>
                        renderDeliveryCard(delivery, true)
                      )
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-sm">
          <div className="glass-panel-strong rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto animate-scale-in shadow-2xl">
            <div className="p-5 border-b border-[color:var(--border-subtle)] flex items-center justify-between sticky top-0 glass-panel-strong z-10">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                  Create
                </p>
                <h2 className="text-lg font-bold text-ink">New delivery</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="h-10 w-10 rounded-xl hover:bg-surface-2 text-ink-muted hover:text-ink transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateDelivery} className="p-5 space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-red-500/10 text-red-700 dark:text-red-300 text-sm border border-red-500/20">
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Paid or credit sale</label>
                <select
                  value={form.saleId}
                  onChange={(e) => onSelectSale(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                  required
                >
                  <option value="">Choose a sale…</option>
                  {paidSales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.saleNo} — {s.customer?.name} — ₹{s.grandTotal.toFixed(0)}
                      {s.status === 'OPEN' ? ' (credit)' : ''}
                    </option>
                  ))}
                </select>
                {loadingSales && <p className="text-xs text-ink-muted mt-1.5">Loading sales…</p>}
                {!loadingSales && paidSales.length === 0 && (
                  <p className="text-xs text-ink-muted mt-1.5">
                    No eligible sales (need customer, no delivery yet).
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-secondary mb-2">Fulfillment</p>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center justify-center cursor-pointer rounded-xl border py-3 transition ${
                      form.type === 'PICKUP'
                        ? 'border-brand-500 bg-brand-500/10 text-brand-800 dark:text-brand-200'
                        : 'border-[color:var(--border-subtle)] text-ink-secondary'
                    }`}
                  >
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
                    <span className="text-sm font-semibold">Pickup</span>
                  </label>
                  <label
                    className={`flex items-center justify-center cursor-pointer rounded-xl border py-3 transition ${
                      form.type === 'DELIVERY'
                        ? 'border-brand-500 bg-brand-500/10 text-brand-800 dark:text-brand-200'
                        : 'border-[color:var(--border-subtle)] text-ink-secondary'
                    }`}
                  >
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
                    <span className="text-sm font-semibold">Home delivery</span>
                  </label>
                </div>
              </div>
              {form.type === 'DELIVERY' && (
                <div>
                  <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Address</label>
                  {!createAddNewAddress ? (
                    <>
                      <select
                        value={form.addressId}
                        onChange={(e) => setForm((f) => ({ ...f, addressId: e.target.value }))}
                        className="w-full px-3 py-3 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                      >
                        <option value="">
                          {addresses.length ? 'Select saved address' : 'No saved address — add one'}
                        </option>
                        {addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}: {a.line1}, {a.city}
                          </option>
                        ))}
                      </select>
                      {form.addressId ? (
                        <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                          Filled from customer profile — change only if needed
                        </p>
                      ) : (
                        <p className="mt-1.5 text-xs text-ink-muted">
                          No address on this customer yet — add one below
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => setCreateAddNewAddress(true)}
                        className="mt-2 text-sm text-brand-700 dark:text-brand-300 font-semibold"
                      >
                        + Add new address
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      {(
                        [
                          ['label', 'Label', createNewAddress.label],
                          ['line1', 'Line 1 *', createNewAddress.line1],
                          ['line2', 'Line 2', createNewAddress.line2],
                        ] as const
                      ).map(([key, placeholder, value]) => (
                        <input
                          key={key}
                          type="text"
                          value={value}
                          onChange={(e) => setCreateNewAddress((a) => ({ ...a, [key]: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                          placeholder={placeholder}
                        />
                      ))}
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={createNewAddress.city}
                          onChange={(e) => setCreateNewAddress((a) => ({ ...a, city: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                          placeholder="City *"
                        />
                        <input
                          type="text"
                          value={createNewAddress.state}
                          onChange={(e) => setCreateNewAddress((a) => ({ ...a, state: e.target.value }))}
                          className="w-full px-3 py-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                          placeholder="State"
                        />
                      </div>
                      <input
                        type="text"
                        value={createNewAddress.zip}
                        onChange={(e) => setCreateNewAddress((a) => ({ ...a, zip: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                        placeholder="PIN"
                      />
                      <button
                        type="button"
                        onClick={() => setCreateAddNewAddress(false)}
                        className="text-xs font-medium text-ink-muted hover:text-ink"
                      >
                        Use saved address
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Delivery fee (₹)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.deliveryFee}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryFee: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-3 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-3 rounded-xl border border-[color:var(--border-strong)] font-semibold text-ink hover:bg-surface-2 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !form.saleId}
                  className="flex-1 py-3 rounded-xl bg-gradient-brand text-white font-semibold shadow-glow-brand hover:brightness-105 disabled:opacity-50 transition"
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-sm">
          <div className="glass-panel-strong rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto animate-scale-in shadow-2xl">
            <div className="p-5 border-b border-[color:var(--border-subtle)] flex items-center justify-between sticky top-0 glass-panel-strong">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                  Details
                </p>
                <h2 className="text-lg font-bold text-ink">Order {editingDelivery.sale.saleNo}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingDelivery(null)}
                className="h-10 w-10 rounded-xl hover:bg-surface-2 text-ink-muted hover:text-ink transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveDetails} className="p-5 space-y-4">
              {detailsError && (
                <div className="p-3 rounded-xl bg-red-500/10 text-red-700 dark:text-red-300 text-sm border border-red-500/20">
                  {detailsError}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Customer name</label>
                <input
                  type="text"
                  value={detailsForm.customerName}
                  onChange={(e) => setDetailsForm((f) => ({ ...f, customerName: e.target.value }))}
                  className="w-full px-3 py-3 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Phone</label>
                <input
                  type="text"
                  value={detailsForm.customerPhone}
                  onChange={(e) => setDetailsForm((f) => ({ ...f, customerPhone: e.target.value }))}
                  className="w-full px-3 py-3 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Address</label>
                {!addNewAddress ? (
                  <>
                    <select
                      value={detailsForm.addressId}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, addressId: e.target.value }))}
                      className="w-full px-3 py-3 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
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
                      className="mt-2 text-sm text-brand-700 dark:text-brand-300 font-semibold"
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
                      className="w-full px-3 py-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                      placeholder="Line 1"
                    />
                    <input
                      type="text"
                      value={detailsForm.newAddress.line2}
                      onChange={(e) =>
                        setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, line2: e.target.value } }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                      placeholder="Line 2"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={detailsForm.newAddress.city}
                        onChange={(e) =>
                          setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, city: e.target.value } }))
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                        placeholder="City"
                      />
                      <input
                        type="text"
                        value={detailsForm.newAddress.state}
                        onChange={(e) =>
                          setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, state: e.target.value } }))
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                        placeholder="State"
                      />
                    </div>
                    <input
                      type="text"
                      value={detailsForm.newAddress.zip}
                      onChange={(e) =>
                        setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, zip: e.target.value } }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                      placeholder="PIN"
                    />
                    <button
                      type="button"
                      onClick={() => setAddNewAddress(false)}
                      className="text-xs font-medium text-ink-muted hover:text-ink"
                    >
                      Pick saved address
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingDelivery(null)}
                  className="flex-1 py-3 rounded-xl border border-[color:var(--border-strong)] font-semibold text-ink hover:bg-surface-2 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={detailsSaving}
                  className="flex-1 py-3 rounded-xl bg-gradient-brand text-white font-semibold shadow-glow-brand disabled:opacity-50 transition"
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
