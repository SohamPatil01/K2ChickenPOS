'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

type DatePreset = 'today' | 'yesterday' | 'last7' | 'thisWeek' | 'thisMonth' | 'custom';
type QueueTab = 'active' | 'done';
type StageFilter =
  | 'ALL_ACTIVE'
  | 'CREATED'
  | 'READY'
  | 'ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED';

const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  thisWeek: 'This week',
  thisMonth: 'This month',
  custom: 'Custom',
};

const ACTIVE_STATUSES = ['CREATED', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY'] as const;
const DONE_STATUSES = ['DELIVERED', 'FAILED', 'RETURNED'] as const;

const easeOutSoft = [0.22, 1, 0.36, 1] as const;

const listContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } },
};

const listItem = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.32, ease: easeOutSoft },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.18, ease: easeOutSoft },
  },
};

const modalBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

const modalPanel = {
  initial: { opacity: 0, y: 28, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 16, scale: 0.98 },
  transition: { duration: 0.28, ease: easeOutSoft },
};

function isOpenStatus(status: string) {
  return !['DELIVERED', 'FAILED', 'RETURNED'].includes(status);
}

function statusBadgeClass(status: string): string {
  if (status === 'DELIVERED') return 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200';
  if (status === 'FAILED' || status === 'RETURNED') return 'bg-red-500/12 text-red-800 dark:text-red-200';
  if (status === 'OUT_FOR_DELIVERY') return 'bg-sky-500/12 text-sky-800 dark:text-sky-200';
  if (status === 'ASSIGNED') return 'bg-violet-500/12 text-violet-800 dark:text-violet-200';
  if (status === 'READY') return 'bg-amber-500/12 text-amber-900 dark:text-amber-200';
  return 'bg-surface-2 text-ink-secondary';
}

function statusAccentClass(status: string): string {
  if (status === 'DELIVERED') return 'bg-emerald-500';
  if (status === 'FAILED' || status === 'RETURNED') return 'bg-red-500';
  if (status === 'OUT_FOR_DELIVERY') return 'bg-sky-500';
  if (status === 'ASSIGNED') return 'bg-violet-500';
  if (status === 'READY') return 'bg-amber-500';
  return 'bg-brand-500';
}

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
    default:
      return status;
  }
}

function phoneDigits(phone?: string | null) {
  return String(phone || '').replace(/\D/g, '');
}

function addressDestination(address: Delivery['address']) {
  if (!address?.line1) return '';
  return [address.line1, address.line2, address.city, address.state, address.zip]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join(', ');
}

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

  if (creditAmt > 0 && collected < 1 && methods.every((m) => m === 'CREDIT' || byMethod[m] < 1)) {
    return { label: 'Credit', detail: `${fmt(creditAmt)} due`, tone: 'amber' };
  }
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
  if (paidSum > 0 && paidSum + 0.5 < total) {
    const parts = methods.map((m) => `${methodLabel(m)} ${fmt(byMethod[m])}`);
    return { label: 'Partial', detail: `${parts.join(' · ')} · of ${fmt(total)}`, tone: 'orange' };
  }
  if (methods.length === 0) return { label: 'Unknown', detail: '', tone: 'slate' };
  if (methods.length === 1) {
    const m = methods[0];
    return {
      label: methodLabel(m),
      detail: fmt(byMethod[m]),
      tone: m === 'CASH' ? 'emerald' : 'blue',
    };
  }
  return {
    label: 'Split',
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

const fieldClass =
  'w-full min-h-11 px-3 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30';
const btnSecondary =
  'min-h-11 px-4 rounded-xl border border-[color:var(--border-strong)] bg-surface text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-50 transition active:scale-[0.98]';
const btnPrimary =
  'min-h-11 px-5 rounded-xl bg-gradient-brand text-white text-sm font-semibold shadow-glow-brand hover:brightness-105 disabled:opacity-50 transition active:scale-[0.98]';

export default function StoreDeliveryPage() {
  const { user } = useAuthStore();
  const isDriverUser = user?.role === 'DRIVER';
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  // Default: today only — never dump the full history on open
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState(() => format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [queueTab, setQueueTab] = useState<QueueTab>('active');
  const [stageFilter, setStageFilter] = useState<StageFilter>('ALL_ACTIVE');
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      default:
        return { startDate: format(today, 'yyyy-MM-dd'), endDate: format(today, 'yyyy-MM-dd') };
    }
  }, [datePreset, customStart, customEnd]);

  const loadDeliveries = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params: Record<string, string> = {};
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
      setQueueTab('active');
      setStageFilter('ALL_ACTIVE');
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

  const queueCounts = useMemo(() => {
    let active = 0;
    let done = 0;
    const stages: Record<string, number> = {
      CREATED: 0,
      READY: 0,
      ASSIGNED: 0,
      OUT_FOR_DELIVERY: 0,
      DELIVERED: 0,
      FAILED: 0,
    };
    for (const d of searchedDeliveries) {
      if ((ACTIVE_STATUSES as readonly string[]).includes(d.status)) {
        active += 1;
        stages[d.status] = (stages[d.status] || 0) + 1;
      } else if ((DONE_STATUSES as readonly string[]).includes(d.status)) {
        done += 1;
        if (d.status === 'DELIVERED') stages.DELIVERED += 1;
        else stages.FAILED += 1;
      }
    }
    return { active, done, stages };
  }, [searchedDeliveries]);

  const filteredDeliveries = useMemo(() => {
    let list = searchedDeliveries;
    if (queueTab === 'active') {
      list = list.filter((d) => (ACTIVE_STATUSES as readonly string[]).includes(d.status));
    } else {
      list = list.filter((d) => (DONE_STATUSES as readonly string[]).includes(d.status));
    }
    if (stageFilter === 'ALL_ACTIVE') return list;
    if (stageFilter === 'FAILED') {
      return list.filter((d) => d.status === 'FAILED' || d.status === 'RETURNED');
    }
    return list.filter((d) => d.status === stageFilter);
  }, [searchedDeliveries, queueTab, stageFilter]);

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
          setCreateError(
            'This sale has no customer. Add an address in Customers first or select a sale with a customer.'
          );
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
      setDeliveries((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
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
            try {
              await api.patch(`/api/v1/delivery/${delivery.id}`, { addressId: autoId });
              loadDeliveries();
            } catch {
              /* keep selected in form */
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
  const presets: DatePreset[] = ['today', 'yesterday', 'last7', 'thisWeek', 'thisMonth', 'custom'];

  const periodLabel =
    datePreset === 'custom' && dateRangeParams
      ? `${dateRangeParams.startDate} → ${dateRangeParams.endDate}`
      : PRESET_LABELS[datePreset];

  const activeStageChips: { id: StageFilter; label: string; count: number }[] = [
    { id: 'ALL_ACTIVE', label: 'All open', count: queueCounts.active },
    { id: 'CREATED', label: 'Queued', count: queueCounts.stages.CREATED },
    { id: 'READY', label: 'Ready', count: queueCounts.stages.READY },
    { id: 'ASSIGNED', label: 'Assigned', count: queueCounts.stages.ASSIGNED },
    { id: 'OUT_FOR_DELIVERY', label: 'On the way', count: queueCounts.stages.OUT_FOR_DELIVERY },
  ];

  const doneStageChips: { id: StageFilter; label: string; count: number }[] = [
    { id: 'DELIVERED', label: 'Delivered', count: queueCounts.stages.DELIVERED },
    { id: 'FAILED', label: 'Failed', count: queueCounts.stages.FAILED },
  ];

  const renderDeliveryRow = (delivery: Delivery) => {
    const pay = paymentSummary(delivery.sale);
    const phone = phoneDigits(delivery.sale.customer?.phone);
    const open = isOpenStatus(delivery.status);
    const mapLink = mapsDirectionsUrl(delivery.address);
    const dest = addressDestination(delivery.address);
    const missingAddress = delivery.type === 'DELIVERY' && !delivery.address;
    const busy = busyId === delivery.id;
    const onTheWay = delivery.status === 'OUT_FOR_DELIVERY';

    return (
      <motion.article
        key={delivery.id}
        layout
        variants={listItem}
        className={`group relative overflow-hidden rounded-2xl border bg-surface transition-shadow hover:shadow-md ${
          missingAddress
            ? 'border-amber-400/55'
            : onTheWay
              ? 'border-sky-400/35'
              : 'border-[color:var(--border-subtle)]'
        }`}
      >
        <div className={`absolute inset-y-0 left-0 w-1 ${statusAccentClass(delivery.status)}`} aria-hidden />
        <div className="p-4 pl-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-[15px] font-bold tracking-tight text-ink">{delivery.sale.saleNo}</h3>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${statusBadgeClass(delivery.status)}`}
                >
                  {formatStatusLabel(delivery.status)}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-surface-2 text-ink-secondary">
                  {delivery.type === 'DELIVERY' ? 'Home' : 'Pickup'}
                </span>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${paymentBadgeClass(pay.tone)}`}
                  title={pay.detail}
                >
                  {pay.label}
                </span>
              </div>

              <div>
                <p className="text-sm font-semibold text-ink leading-snug">
                  {delivery.sale.customer?.name || 'Walk-in customer'}
                </p>
                <p className="text-xs text-ink-muted mt-0.5">
                  {formatOrderTime(delivery.createdAt)}
                  {phone.length >= 10 ? ` · ${phone.slice(-10)}` : ''}
                  {!isDriver && delivery.assignedDriver
                    ? ` · ${delivery.assignedDriver.name}`
                    : ''}
                </p>
              </div>

              {delivery.address ? (
                mapLink ? (
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-start gap-1.5 text-[13px] font-medium text-brand-700 dark:text-brand-400 hover:underline line-clamp-2"
                  >
                    <span className="mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
                    <span>{dest}</span>
                  </a>
                ) : (
                  <p className="text-[13px] text-ink-secondary line-clamp-2">{dest}</p>
                )
              ) : delivery.type === 'DELIVERY' ? (
                <p className="text-[13px] font-semibold text-amber-700 dark:text-amber-400">
                  Address missing — add before dispatch
                </p>
              ) : (
                <p className="text-[13px] text-ink-muted">Counter pickup</p>
              )}
            </div>

            <div className="shrink-0 sm:text-right">
              <p className="text-xl sm:text-2xl font-black tabular-nums text-ink tracking-tight">
                ₹{Math.round(delivery.sale.grandTotal).toLocaleString('en-IN')}
              </p>
              {delivery.deliveryFee > 0 && (
                <p className="text-[11px] text-ink-muted mt-0.5">
                  + ₹{Math.round(delivery.deliveryFee)} fee
                </p>
              )}
              {pay.detail && <p className="text-[11px] text-ink-muted mt-1 max-w-[11rem] sm:ml-auto">{pay.detail}</p>}
            </div>
          </div>

          <div className="mt-3.5 pt-3 border-t border-[color:var(--border-subtle)] flex flex-wrap gap-2">
            {(canManage || isDriver) && open && (
              <button
                type="button"
                disabled={busy}
                onClick={() => updateStatus(delivery.id, 'DELIVERED')}
                className="min-h-11 flex-1 sm:flex-none px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold shadow-sm hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 transition"
              >
                {busy ? 'Saving…' : 'Mark delivered'}
              </button>
            )}
            {mapLink && (
              <a
                href={mapLink}
                target="_blank"
                rel="noreferrer"
                className={`min-h-11 inline-flex items-center justify-center px-4 rounded-xl text-sm font-bold active:scale-[0.98] transition ${
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
                className="min-h-11 px-4 rounded-xl border border-brand-500/40 bg-brand-500/10 text-brand-800 dark:text-brand-200 text-sm font-bold hover:bg-brand-500/20 disabled:opacity-50 transition"
              >
                Start run
              </button>
            )}
            {phone.length >= 10 && (
              <a
                href={`tel:${phone}`}
                className="min-h-10 inline-flex items-center px-3 rounded-xl border border-[color:var(--border-subtle)] text-sm font-semibold text-ink hover:bg-surface-2 transition"
              >
                Call
              </a>
            )}
            {phone.length >= 10 && (
              <a
                href={`https://wa.me/91${phone.slice(-10)}`}
                target="_blank"
                rel="noreferrer"
                className="min-h-10 inline-flex items-center px-3 rounded-xl border border-[color:var(--border-subtle)] text-sm font-semibold text-ink hover:bg-surface-2 transition"
              >
                WhatsApp
              </a>
            )}
            {!isDriver && (
              <button
                type="button"
                onClick={() => openDetailsModal(delivery)}
                className="min-h-10 px-3 rounded-xl border border-[color:var(--border-subtle)] text-sm font-medium text-ink-secondary hover:text-ink hover:bg-surface-2 transition"
              >
                {delivery.address ? 'Edit' : 'Add address'}
              </button>
            )}
            {(canManage || isDriver) && open && (
              <button
                type="button"
                disabled={busy}
                onClick={() => updateStatus(delivery.id, 'FAILED')}
                className="min-h-10 px-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50 transition"
              >
                Failed
              </button>
            )}
          </div>
        </div>
      </motion.article>
    );
  };

  const addressFields = (
    values: { label?: string; line1: string; line2: string; city: string; state: string; zip: string },
    onChange: (key: string, value: string) => void,
    onBack: () => void,
    backLabel: string
  ) => (
    <div className="space-y-2">
      {(
        [
          ['label', 'Label', values.label || ''],
          ['line1', 'Line 1 *', values.line1],
          ['line2', 'Line 2', values.line2],
        ] as const
      ).map(([key, placeholder, value]) => (
        <input
          key={key}
          type="text"
          value={value}
          onChange={(e) => onChange(key, e.target.value)}
          className={fieldClass}
          placeholder={placeholder}
        />
      ))}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={values.city}
          onChange={(e) => onChange('city', e.target.value)}
          className={fieldClass}
          placeholder="City *"
        />
        <input
          type="text"
          value={values.state}
          onChange={(e) => onChange('state', e.target.value)}
          className={fieldClass}
          placeholder="State"
        />
      </div>
      <input
        type="text"
        value={values.zip}
        onChange={(e) => onChange('zip', e.target.value)}
        className={fieldClass}
        placeholder="PIN"
      />
      <button type="button" onClick={onBack} className="text-xs font-medium text-ink-muted hover:text-ink">
        {backLabel}
      </button>
    </div>
  );

  return (
    <div className="relative w-full max-w-5xl mx-auto min-h-0 flex flex-col gap-4 pb-10">
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: easeOutSoft }}
        className="rounded-2xl border border-[color:var(--border-subtle)] bg-surface px-4 py-4 sm:px-5 sm:py-4.5 shadow-card"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              {isDriver ? 'Driver' : 'Dispatch'}
            </p>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-ink mt-0.5">
              {isDriver ? 'My deliveries' : 'Delivery desk'}
            </h1>
            <p className="text-xs text-ink-muted mt-1">
              {periodLabel}
              <span className="mx-1.5 text-[color:var(--border-strong)]">·</span>
              {queueTab === 'active' ? `${queueCounts.active} open` : `${queueCounts.done} completed`}
              {search.trim() ? (
                <>
                  <span className="mx-1.5 text-[color:var(--border-strong)]">·</span>
                  filtered
                </>
              ) : null}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button type="button" onClick={() => loadDeliveries()} disabled={loading} className={btnSecondary}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            {!isDriver && (
              <>
                <button
                  type="button"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={`${btnSecondary} ${filtersOpen ? 'ring-2 ring-brand-500/25 border-brand-500/40' : ''}`}
                >
                  Filters
                </button>
                <button type="button" onClick={openCreateModal} className={btnPrimary}>
                  New delivery
                </button>
              </>
            )}
          </div>
        </div>
      </motion.header>

      {/* Queue mode */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.04, ease: easeOutSoft }}
        className="grid grid-cols-2 gap-2"
      >
        {(
          [
            { id: 'active' as const, label: 'Open queue', count: queueCounts.active, hint: 'Needs action' },
            { id: 'done' as const, label: 'Completed', count: queueCounts.done, hint: 'In this period' },
          ] as const
        ).map((tab) => {
          const active = queueTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setQueueTab(tab.id);
                setStageFilter(tab.id === 'active' ? 'ALL_ACTIVE' : 'DELIVERED');
              }}
              className={`relative overflow-hidden rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99] ${
                active
                  ? 'border-brand-500/35 bg-brand-500/10 shadow-sm'
                  : 'border-[color:var(--border-subtle)] bg-surface hover:bg-surface-2'
              }`}
            >
              <span
                className={`block text-2xl font-black tabular-nums leading-none ${
                  active ? 'text-brand-700 dark:text-brand-300' : 'text-ink'
                }`}
              >
                {tab.count}
              </span>
              <span className={`block text-xs font-bold mt-1.5 ${active ? 'text-brand-800 dark:text-brand-200' : 'text-ink'}`}>
                {tab.label}
              </span>
              <span className="block text-[11px] text-ink-muted mt-0.5">{tab.hint}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Stage filters + search */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08, ease: easeOutSoft }}
        className="rounded-2xl border border-[color:var(--border-subtle)] bg-surface p-3 sm:p-4 space-y-3"
      >
        <div className="relative">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, sale #, area…"
            className="w-full min-h-11 pl-4 pr-10 rounded-xl border border-[color:var(--border-subtle)] bg-surface-2/60 text-ink text-sm placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          {search.trim() && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg text-ink-muted hover:bg-surface hover:text-ink text-sm"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-thin">
          {(queueTab === 'active' ? activeStageChips : doneStageChips).map((chip) => {
            const active = stageFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setStageFilter(chip.id)}
                className={`shrink-0 min-h-9 px-3 rounded-full text-xs font-semibold transition active:scale-[0.98] ${
                  active
                    ? 'bg-ink text-white dark:bg-white dark:text-ink'
                    : 'bg-surface-2 text-ink-secondary hover:text-ink'
                }`}
              >
                {chip.label}
                <span className={`ml-1.5 tabular-nums ${active ? 'opacity-80' : 'text-ink-muted'}`}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        <AnimatePresence initial={false}>
          {filtersOpen && !isDriver && (
            <motion.div
              key="filters"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: easeOutSoft }}
              className="overflow-hidden"
            >
              <div className="pt-1 space-y-2.5 border-t border-[color:var(--border-subtle)]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted pt-2">Period</p>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setDatePreset(p)}
                      className={`min-h-8 px-3 rounded-lg text-xs font-semibold transition ${
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
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs font-medium text-ink-muted mb-1">From</label>
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="min-h-10 px-3 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-ink-muted mb-1">To</label>
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="min-h-10 px-3 rounded-xl border border-[color:var(--border-subtle)] bg-surface text-ink text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isDriver && (
          <p className="text-xs text-ink-muted">
            Showing today · open orders only. Switch to Completed to review finished drops.
          </p>
        )}
      </motion.div>

      {listError && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-800 dark:text-red-200"
          role="alert"
        >
          <strong className="font-semibold">Couldn’t load deliveries. </strong>
          {listError}
        </motion.div>
      )}

      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl bg-surface-2 animate-pulse border border-[color:var(--border-subtle)]"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: easeOutSoft }}
            className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-surface/70 px-6 py-14 text-center"
          >
            <div className="mx-auto mb-3 h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden />
            </div>
            <p className="text-base font-bold text-ink">
              {queueTab === 'active' && queueCounts.done > 0
                ? 'Open queue is clear'
                : queueTab === 'done' && queueCounts.active > 0
                  ? 'Nothing in this completed filter'
                  : 'No deliveries in this view'}
            </p>
            <p className="text-sm text-ink-muted mt-1.5 max-w-sm mx-auto leading-relaxed">
              {search.trim()
                ? 'No match for this search. Clear the search box.'
                : queueTab === 'active' && queueCounts.done > 0
                  ? `${queueCounts.done} finished ${queueCounts.done === 1 ? 'order is' : 'orders are'} under Completed.`
                  : datePreset !== 'today'
                    ? 'Try Today, or widen the period under Filters.'
                    : 'Only bills with a delivery row for today show here.'}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {queueTab === 'active' && queueCounts.done > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQueueTab('done');
                    setStageFilter('DELIVERED');
                  }}
                  className={btnPrimary}
                >
                  View completed
                </button>
              )}
              {datePreset !== 'today' && (
                <button type="button" onClick={() => setDatePreset('today')} className={btnSecondary}>
                  Back to today
                </button>
              )}
              {search.trim() && (
                <button type="button" onClick={() => setSearch('')} className={btnSecondary}>
                  Clear search
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`${queueTab}-${stageFilter}-${datePreset}-${search}`}
            variants={listContainer}
            initial="hidden"
            animate="show"
            className="space-y-2.5"
          >
            <AnimatePresence mode="popLayout">
              {filteredDeliveries.map((d) => renderDeliveryRow(d))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-sm"
            {...modalBackdrop}
          >
            <motion.div
              className="glass-panel-strong rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto shadow-2xl"
              {...modalPanel}
              onClick={(e) => e.stopPropagation()}
            >
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
                    className={fieldClass}
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
                    {(
                      [
                        ['PICKUP', 'Pickup'],
                        ['DELIVERY', 'Home delivery'],
                      ] as const
                    ).map(([value, label]) => (
                      <label
                        key={value}
                        className={`flex items-center justify-center cursor-pointer rounded-xl border py-3 transition ${
                          form.type === value
                            ? 'border-brand-500 bg-brand-500/10 text-brand-800 dark:text-brand-200'
                            : 'border-[color:var(--border-subtle)] text-ink-secondary'
                        }`}
                      >
                        <input
                          type="radio"
                          name="type"
                          checked={form.type === value}
                          onChange={() => {
                            if (value === 'PICKUP') {
                              setForm((f) => ({ ...f, type: 'PICKUP', addressId: '' }));
                              setAddresses([]);
                              setCreateAddNewAddress(false);
                            } else {
                              setForm((f) => ({ ...f, type: 'DELIVERY' }));
                              if (form.saleId) onSelectSale(form.saleId);
                            }
                          }}
                          className="sr-only"
                        />
                        <span className="text-sm font-semibold">{label}</span>
                      </label>
                    ))}
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
                          className={fieldClass}
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
                        <p className="mt-1.5 text-xs text-ink-muted">
                          {form.addressId
                            ? 'Filled from customer profile — change only if needed'
                            : 'No address on this customer yet — add one below'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setCreateAddNewAddress(true)}
                          className="mt-2 text-sm text-brand-700 dark:text-brand-300 font-semibold"
                        >
                          + Add new address
                        </button>
                      </>
                    ) : (
                      addressFields(
                        createNewAddress,
                        (key, value) => setCreateNewAddress((a) => ({ ...a, [key]: value })),
                        () => setCreateAddNewAddress(false),
                        'Use saved address'
                      )
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
                    className={fieldClass}
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowCreate(false)} className={`flex-1 ${btnSecondary}`}>
                    Cancel
                  </button>
                  <button type="submit" disabled={creating || !form.saleId} className={`flex-1 ${btnPrimary}`}>
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details modal */}
      <AnimatePresence>
        {editingDelivery && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-sm"
            {...modalBackdrop}
          >
            <motion.div
              className="glass-panel-strong rounded-t-3xl sm:rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto shadow-2xl"
              {...modalPanel}
            >
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
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Phone</label>
                  <input
                    type="text"
                    value={detailsForm.customerPhone}
                    onChange={(e) => setDetailsForm((f) => ({ ...f, customerPhone: e.target.value }))}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink-secondary mb-1.5">Address</label>
                  {!addNewAddress ? (
                    <>
                      <select
                        value={detailsForm.addressId}
                        onChange={(e) => setDetailsForm((f) => ({ ...f, addressId: e.target.value }))}
                        className={fieldClass}
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
                    addressFields(
                      detailsForm.newAddress,
                      (key, value) =>
                        setDetailsForm((f) => ({
                          ...f,
                          newAddress: { ...f.newAddress, [key]: value },
                        })),
                      () => setAddNewAddress(false),
                      'Pick saved address'
                    )
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingDelivery(null)}
                    className={`flex-1 ${btnSecondary}`}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={detailsSaving} className={`flex-1 ${btnPrimary}`}>
                    {detailsSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
