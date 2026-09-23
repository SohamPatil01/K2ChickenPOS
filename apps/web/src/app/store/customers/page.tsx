'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { parseCustomerListResponse } from '@/lib/customers';
import { useAuthStore } from '@/store/auth';

interface Customer {
  id: string;
  name: string;
  phone: string;
  area?: string | null;
  email?: string;
  loyaltyPoints?: number;
  loyaltyTier?: string;
  totalSpent?: number;
  addresses: Array<{
    id: string;
    label: string;
    line1: string;
    city: string;
    state?: string;
    zip?: string;
    line2?: string;
  }>;
  sales: Array<{
    id: string;
    saleNo: string;
    grandTotal: number;
    createdAt: string;
  }>;
}

interface CustomerListRow {
  id: string;
  name: string;
  phone: string;
  area?: string | null;
  email?: string;
  loyaltyPoints?: number;
  loyaltyTier?: string;
  totalSpent?: number;
  _count?: { sales: number; addresses?: number };
}

interface Customer360 {
  customer: {
    id: string;
    name: string;
    phone: string;
    area?: string | null;
    email?: string | null;
    loyaltyPoints: number;
    loyaltyTier: string;
    totalSpent: number;
    staffNotes?: string | null;
    createdAt: string;
  };
  summary: {
    lastVisitAt: string | null;
    daysSinceLastVisit: number | null;
    visitCount: number;
    lifetimeSpent: number;
    avgBill: number;
    openCreditAmount: number;
    openCreditOrders: number;
    compareDays: number;
  };
  periodCompare: {
    current: { start: string; end: string; visits: number; spent: number; avgBill: number };
    prior: { start: string; end: string; visits: number; spent: number; avgBill: number };
    visitsDelta: number;
    spentDelta: number;
    spentDeltaPct: number;
  };
  topProducts: Array<{
    productId: string;
    name: string;
    unitType: string;
    revenue: number;
    qtyKg: number;
    qtyPcs: number;
    timesBought: number;
  }>;
  addresses: Array<{
    id: string;
    label: string;
    line1: string;
    line2?: string | null;
    city: string;
  }>;
  lastDelivery: {
    id: string;
    status: string;
    type: string;
    createdAt: string;
    deliveredAt?: string | null;
    saleNo: string;
    address?: { line1: string; city: string; label?: string } | null;
  } | null;
  recentSales: Array<{
    id: string;
    saleNo: string;
    grandTotal: number;
    status: string;
    createdAt: string;
    hasCredit: boolean;
  }>;
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(n || 0));
}

function formatVisitLabel(iso: string | null, daysSince: number | null) {
  if (!iso) return 'Never bought (with this phone)';
  const d = new Date(iso);
  const when = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (daysSince == null) return when;
  if (daysSince === 0) return `Today · ${when}`;
  if (daysSince === 1) return `Yesterday · ${when}`;
  return `${daysSince} days ago · ${when}`;
}

function deliveryStatusLabel(status: string) {
  if (status === 'DELIVERED') return 'Delivered';
  if (status === 'OUT_FOR_DELIVERY') return 'On the way';
  if (status === 'FAILED' || status === 'RETURNED') return 'Failed';
  return 'Open';
}

const STAFF_NOTE_PROMPTS: Array<{ q: string; answers: string[] }> = [
  {
    q: 'Preferred cut?',
    answers: ['Prefers breast', 'Prefers curry cut', 'Prefers whole bird', 'Mixed cuts'],
  },
  {
    q: 'Chili?',
    answers: ['Less chili', 'Normal spice', 'Extra chili'],
  },
  {
    q: 'Payment?',
    answers: ['Usually UPI', 'Usually cash', 'Often credit — pays Fridays', 'Pays on delivery'],
  },
  {
    q: 'Delivery?',
    answers: ['Prefers home delivery', 'Usually pickup', 'Call before delivery'],
  },
];

const easeOutSoft = [0.22, 1, 0.36, 1] as const;

const panelFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.28, ease: easeOutSoft },
};

const cardUnfold = {
  initial: {
    opacity: 0,
    rotateX: -18,
    scaleY: 0.88,
    y: -14,
    filter: 'blur(4px)',
  },
  animate: {
    opacity: 1,
    rotateX: 0,
    scaleY: 1,
    y: 0,
    filter: 'blur(0px)',
  },
  exit: {
    opacity: 0,
    rotateX: 10,
    scaleY: 0.94,
    y: 8,
    filter: 'blur(2px)',
  },
  transition: { duration: 0.48, ease: easeOutSoft },
};

const bodyStagger = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.055, delayChildren: 0.06 },
  },
};

const bodyItem = {
  hidden: { opacity: 0, y: 12, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.38, ease: easeOutSoft },
  },
};

function appendNoteLine(existing: string, line: string) {
  const trimmed = existing.trim();
  if (!trimmed) return line;
  if (trimmed.toLowerCase().includes(line.toLowerCase())) return trimmed;
  return `${trimmed}\n${line}`;
}

function nameLetter(name: string) {
  const ch = (name || '').trim().charAt(0).toUpperCase();
  return ch >= 'A' && ch <= 'Z' ? ch : '#';
}

interface PurchaseHistorySale {
  id: string;
  saleNo: string;
  grandTotal: number;
  discountTotal: number;
  taxTotal: number;
  createdAt: string;
  items: Array<{
    id: string;
    product: {
      id: string;
      name: string;
      unitType: string;
    };
    qtyKg?: number;
    qtyPcs?: number;
    rate: number;
    lineTotal: number;
  }>;
  payments: Array<{
    method: string;
    amount: number;
  }>;
}

interface LoyaltyTransaction {
  id: string;
  type: string;
  points: number;
  balance: number;
  description?: string;
  createdAt: string;
  sale?: {
    id: string;
    saleNo: string;
    grandTotal: number;
    createdAt: string;
  };
}

interface Address {
  id?: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

export default function StoreCustomersPage() {
  const { user } = useAuthStore();
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [allCustomers, setAllCustomers] = useState<CustomerListRow[]>([]);
  const [customerTotal, setCustomerTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerListRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customer360, setCustomer360] = useState<Customer360 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [staffNotesDraft, setStaffNotesDraft] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSavedFlash, setNotesSavedFlash] = useState(false);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    area: '',
  });
  const [addressForm, setAddressForm] = useState<Address>({
    label: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    zip: '',
  });
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistorySale[]>([]);
  const [loyaltyInfo, setLoyaltyInfo] = useState<any>(null);
  const [showPurchaseHistory, setShowPurchaseHistory] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [loyaltyAction, setLoyaltyAction] = useState<'redeem' | 'adjust' | null>(null);
  const [loyaltyForm, setLoyaltyForm] = useState({ points: 0, description: '' });
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);
  const [recalcRunning, setRecalcRunning] = useState(false);
  const directoryScrollRef = useRef<HTMLDivElement>(null);

  const showSearchDropdown = searchFocused && debouncedSearch.length > 0;

  const directoryGroups = useMemo(() => {
    const sorted = [...allCustomers].sort((a, b) =>
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
    );
    const map = new Map<string, CustomerListRow[]>();
    for (const row of sorted) {
      const letter = nameLetter(row.name);
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(row);
    }
    return Array.from(map.entries());
  }, [allCustomers]);

  const letterKeys = useMemo(
    () => directoryGroups.map(([letter]) => letter),
    [directoryGroups]
  );

  const scrollToLetter = (letter: string) => {
    const el = directoryScrollRef.current?.querySelector(`[data-letter="${letter}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await api.get('/api/v1/customers', {
        params: { limit: 2000, includeCounts: 1 },
      });
      const totalHeader =
        response.headers['x-customer-total'] ?? response.headers['X-Customer-Total'];
      const { customers, total } = parseCustomerListResponse<CustomerListRow>(
        response.data,
        totalHeader
      );
      setAllCustomers(customers);
      setCustomerTotal(total);
    } catch (error: unknown) {
      console.error('Failed to load customers:', error);
      const err = error as { response?: { data?: { error?: string; details?: string } } };
      const msg =
        err.response?.data?.details ||
        err.response?.data?.error ||
        'Could not load customers. Check your connection and try again.';
      setListError(msg);
      setAllCustomers([]);
      setCustomerTotal(0);
    } finally {
      setListLoading(false);
    }
  };

  // OWNER-only: recompute every customer's loyalty balance from purchase
  // history at 1.25% (net of redemptions). Previews via dry-run, then applies.
  const handleRecalcLoyalty = async () => {
    if (recalcRunning) return;
    try {
      setRecalcRunning(true);
      const preview = await api.post('/api/v1/customers/loyalty/backfill', { dryRun: true });
      const d = preview.data;
      if (!d || d.changedCount === 0) {
        window.alert('Loyalty points are already up to date — no changes needed.');
        return;
      }
      const sign = d.totals.deltaSum >= 0 ? '+' : '';
      const ok = window.confirm(
        `Recalculate loyalty points across ${d.totalCustomers} customers?\n\n` +
          `${d.changedCount} customer(s) will change.\n` +
          `Total points: ${d.totals.oldPointsSum} → ${d.totals.newPointsSum} (net ${sign}${d.totals.deltaSum}).\n\n` +
          `Each balance becomes 1.25% of their non-voided purchases, minus points already redeemed. Continue?`
      );
      if (!ok) return;
      const res = await api.post('/api/v1/customers/loyalty/backfill', { dryRun: false });
      window.alert(`Done. Updated ${res.data.changedCount} customer(s).`);
      await loadCustomers();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error || e?.message || 'Failed to recalculate loyalty points';
      window.alert(msg);
    } finally {
      setRecalcRunning(false);
    }
  };

  const fetchCustomerDetail = useCallback(async (id: string): Promise<Customer | null> => {
    try {
      const res = await api.get(`/api/v1/customers/${id}`, {
        params: { includeSales: 1 },
      });
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const loadCustomer360 = useCallback(async (id: string) => {
    try {
      const res = await api.get(`/api/v1/customers/${id}/360`, { params: { days: 30 } });
      setCustomer360(res.data || null);
      setStaffNotesDraft(res.data?.customer?.staffNotes || '');
    } catch (e) {
      console.error('Failed to load customer 360:', e);
      setCustomer360(null);
    }
  }, []);

  const saveStaffNotes = async () => {
    if (!selectedCustomer) return;
    setNotesSaving(true);
    try {
      await api.patch(`/api/v1/customers/${selectedCustomer.id}/staff-notes`, {
        notes: staffNotesDraft,
      });
      setCustomer360((prev) =>
        prev
          ? {
              ...prev,
              customer: { ...prev.customer, staffNotes: staffNotesDraft.trim() || null },
            }
          : prev
      );
      setNotesSavedFlash(true);
      setTimeout(() => setNotesSavedFlash(false), 1800);
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Could not save notes');
    } finally {
      setNotesSaving(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 180);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (debouncedSearch.length === 0) {
      setSearchResults([]);
      setSearchLoading(false);
      setHighlightIndex(-1);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setHighlightIndex(-1);

    api
      .get('/api/v1/customers', { params: { q: debouncedSearch } })
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        setSearchResults(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  const pickCustomer = async (row: CustomerListRow) => {
    setSearchFocused(false);
    setSearchQuery('');
    setDebouncedSearch('');
    setSearchResults([]);
    setHighlightIndex(-1);
    // Show the card shell immediately so the unfold starts on click
    setSelectedCustomer({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      area: row.area,
      loyaltyPoints: row.loyaltyPoints,
      loyaltyTier: row.loyaltyTier,
      totalSpent: row.totalSpent,
      addresses: [],
      sales: [],
    });
    setCustomer360(null);
    setDetailLoading(true);
    const [full] = await Promise.all([fetchCustomerDetail(row.id), loadCustomer360(row.id)]);
    setDetailLoading(false);
    if (full) setSelectedCustomer(full);
  };

  const handleCreateCustomer = async () => {
    if (!customerForm.name || !customerForm.phone) {
      alert('Please fill in name and phone');
      return;
    }

    try {
      const response = await api.post('/api/v1/customers', {
        name: customerForm.name,
        phone: customerForm.phone,
        email: customerForm.email || undefined,
        area: customerForm.area.trim() || undefined,
      });
      await loadCustomers();
      setShowCustomerModal(false);
      setCustomerForm({ name: '', phone: '', email: '', area: '' });
      const full = await fetchCustomerDetail(response.data?.id);
      if (full) setSelectedCustomer(full);
      alert('Customer added successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create customer');
    }
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer || !customerForm.name || !customerForm.phone) {
      alert('Please fill in name and phone');
      return;
    }

    try {
      await api.put(`/api/v1/customers/${editingCustomer.id}`, {
        name: customerForm.name,
        phone: customerForm.phone,
        email: customerForm.email || undefined,
        area: customerForm.area.trim() || undefined,
      });
      await loadCustomers();
      setShowCustomerModal(false);
      setEditingCustomer(null);
      setCustomerForm({ name: '', phone: '', email: '', area: '' });
      const full = await fetchCustomerDetail(editingCustomer.id);
      if (full) setSelectedCustomer(full);
      await loadCustomer360(editingCustomer.id);
      alert('Customer updated successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update customer');
    }
  };

  const handleAddAddress = async () => {
    if (!selectedCustomer) {
      alert('Please select a customer first');
      return;
    }

    if (!addressForm.label?.trim() || !addressForm.line1?.trim() || !addressForm.city?.trim()) {
      alert('Please fill in label, address line 1, and city');
      return;
    }

    try {
      await api.post(`/api/v1/customers/${selectedCustomer.id}/addresses`, {
        label: addressForm.label.trim() || 'Home',
        line1: addressForm.line1.trim(),
        line2: addressForm.line2?.trim() || undefined,
        city: addressForm.city.trim(),
        state: addressForm.state?.trim(),
        zip: addressForm.zip?.trim(),
      });
      await loadCustomers();
      const full = await fetchCustomerDetail(selectedCustomer.id);
      if (full) setSelectedCustomer(full);
      await loadCustomer360(selectedCustomer.id);
      setShowAddressModal(false);
      setAddressForm({ label: '', line1: '', line2: '', city: '', state: '', zip: '' });
      alert('Address added successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add address');
    }
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      area: customer.area || '',
    });
    setShowCustomerModal(true);
  };

  const openNewCustomer = () => {
    setEditingCustomer(null);
    setCustomerForm({ name: '', phone: '', email: '', area: '' });
    setShowCustomerModal(true);
  };

  const loadPurchaseHistory = async () => {
    if (!selectedCustomer) return;
    setLoadingHistory(true);
    try {
      const response = await api.get(`/api/v1/customers/${selectedCustomer.id}/purchase-history`);
      setPurchaseHistory(response.data.sales || response.data || []);
      setShowPurchaseHistory(true);
    } catch (error: any) {
      console.error('Failed to load purchase history:', error);
      alert(error.response?.data?.error || 'Failed to load purchase history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadLoyaltyInfo = async (opts?: { keepClosed?: boolean }) => {
    if (!selectedCustomer) return;
    if (!opts?.keepClosed) setShowLoyaltyModal(true);
    setLoadingLoyalty(true);
    try {
      const response = await api.get(`/api/v1/customers/${selectedCustomer.id}/loyalty`);
      setLoyaltyInfo(response.data);
    } catch (error: any) {
      console.error('Failed to load loyalty info:', error);
      if (!opts?.keepClosed) setShowLoyaltyModal(false);
      alert(error.response?.data?.error || 'Failed to load loyalty information');
    } finally {
      setLoadingLoyalty(false);
    }
  };

  const handleRedeemPoints = async () => {
    if (!selectedCustomer || !loyaltyForm.points || !loyaltyForm.description) {
      alert('Please fill in points and description');
      return;
    }

    try {
      await api.post(`/api/v1/customers/${selectedCustomer.id}/loyalty/redeem`, {
        points: loyaltyForm.points,
        description: loyaltyForm.description,
      });
      alert('Points redeemed successfully!');
      setLoyaltyForm({ points: 0, description: '' });
      setLoyaltyAction(null);
      await loadLoyaltyInfo({ keepClosed: true });
      const full = await fetchCustomerDetail(selectedCustomer.id);
      if (full) setSelectedCustomer(full);
      await loadCustomers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to redeem points');
    }
  };

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete customer "${selectedCustomer.name}" (${selectedCustomer.phone})?\n\nThis action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      await api.delete(`/api/v1/customers/${selectedCustomer.id}`);
      setAllCustomers((prev) => prev.filter((c) => c.id !== selectedCustomer.id));
      setSelectedCustomer(null);
      setCustomer360(null);
      alert('Customer deleted successfully');
    } catch (error: any) {
      console.error('Failed to delete customer:', error);
      alert(error.response?.data?.error || 'Failed to delete customer');
    }
  };

  const handleAdjustPoints = async () => {
    if (!selectedCustomer || !loyaltyForm.description) {
      alert('Please fill in description');
      return;
    }

    try {
      await api.post(`/api/v1/customers/${selectedCustomer.id}/loyalty/adjust`, {
        points: loyaltyForm.points,
        description: loyaltyForm.description,
      });
      alert('Points adjusted successfully!');
      setLoyaltyForm({ points: 0, description: '' });
      setLoyaltyAction(null);
      await loadLoyaltyInfo({ keepClosed: true });
      const full = await fetchCustomerDetail(selectedCustomer.id);
      if (full) setSelectedCustomer(full);
      await loadCustomers();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to adjust points');
    }
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSearchDropdown || debouncedSearch.length === 0) {
      if (e.key === 'Escape') setSearchFocused(false);
      return;
    }

    const list = searchResults;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (list.length === 0 ? -1 : i < list.length - 1 ? i + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (list.length === 0 ? -1 : i <= 0 ? list.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      const idx = highlightIndex >= 0 ? highlightIndex : 0;
      if (list[idx]) {
        e.preventDefault();
        void pickCustomer(list[idx]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setSearchFocused(false);
    }
  };

  const modalBackdrop =
    'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm';

  return (
    <div className="w-full max-w-7xl mx-auto min-h-0 flex flex-col gap-3 pb-8">
      {/* Classic directory header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-stone-300/80 dark:border-gray-700 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500 dark:text-gray-400">
            Store book
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-white tracking-tight">
            Customer directory
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-0.5">
            {(customerTotal || allCustomers.length).toLocaleString('en-IN')} names · find, open, note
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user?.role === 'OWNER' && (
            <button
              type="button"
              onClick={handleRecalcLoyalty}
              disabled={recalcRunning}
              className="min-h-10 px-3 rounded-md border border-stone-300 dark:border-gray-600 text-sm text-stone-700 dark:text-gray-200 hover:bg-stone-100 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              {recalcRunning ? 'Recalculating…' : 'Recalc points'}
            </button>
          )}
          <button
            type="button"
            onClick={openNewCustomer}
            className="min-h-10 px-4 rounded-md bg-stone-900 dark:bg-white text-white dark:text-stone-900 text-sm font-semibold hover:opacity-90"
          >
            + New entry
          </button>
        </div>
      </header>

      {/* Search strip */}
      <div ref={searchWrapRef} className="relative z-20">
        <label htmlFor="customer-search" className="sr-only">
          Search directory
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
            Find
          </span>
          <input
            id="customer-search"
            ref={searchInputRef}
            type="search"
            autoComplete="off"
            placeholder="Name or phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={onSearchKeyDown}
            role="combobox"
            aria-expanded={showSearchDropdown}
            aria-controls="customer-search-listbox"
            aria-autocomplete="list"
            className="w-full pl-14 pr-20 py-2.5 rounded-md border border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-ink placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/50 text-[15px]"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-gray-200 px-2 py-1"
              onClick={() => {
                setSearchQuery('');
                setDebouncedSearch('');
                setSearchResults([]);
                searchInputRef.current?.focus();
              }}
            >
              Clear
            </button>
          )}
        </div>

        <AnimatePresence>
          {showSearchDropdown && (
            <motion.div
              id="customer-search-listbox"
              role="listbox"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16 }}
              className="absolute left-0 right-0 mt-1.5 max-h-72 overflow-y-auto rounded-md border border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-900 shadow-lg"
            >
              {searchLoading ? (
                <div className="px-4 py-6 text-center text-sm text-stone-500">Searching…</div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-stone-500">
                  No matches for “{debouncedSearch}”
                </div>
              ) : (
                <ul className="py-1">
                  {searchResults.map((row, idx) => (
                    <li key={row.id} role="option" aria-selected={highlightIndex === idx}>
                      <button
                        type="button"
                        className={`w-full text-left px-4 py-2.5 flex items-baseline justify-between gap-3 ${
                          highlightIndex === idx
                            ? 'bg-stone-100 dark:bg-gray-800'
                            : 'hover:bg-stone-50 dark:hover:bg-gray-800/80'
                        }`}
                        onMouseEnter={() => setHighlightIndex(idx)}
                        onClick={() => void pickCustomer(row)}
                      >
                        <span>
                          <span className="font-medium text-stone-900 dark:text-white">{row.name}</span>
                          <span className="text-sm text-stone-500 ml-2">
                            {row.phone}
                            {row.area ? ` · ${row.area}` : ''}
                          </span>
                        </span>
                        {row._count != null && (
                          <span className="text-xs text-stone-400 tabular-nums">
                            {row._count.sales ?? 0}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 flex-1">
        {/* A–Z directory */}
        <div className="lg:col-span-5 flex min-h-0 rounded-md border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-950 overflow-hidden">
          <div className="hidden sm:flex flex-col items-center py-2 px-1 border-r border-stone-200 dark:border-gray-800 bg-stone-50 dark:bg-gray-900/80 shrink-0">
            {letterKeys.length === 0 ? (
              <span className="text-[10px] text-stone-400 px-1">—</span>
            ) : (
              letterKeys.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  onClick={() => scrollToLetter(letter)}
                  className="w-6 h-6 text-[11px] font-semibold text-stone-500 hover:text-stone-900 dark:hover:text-white rounded"
                  title={`Jump to ${letter}`}
                >
                  {letter}
                </button>
              ))
            )}
          </div>
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-3 py-2 border-b border-stone-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                Directory
              </h2>
              <span className="text-[11px] text-stone-400">A–Z</span>
            </div>
            <div
              ref={directoryScrollRef}
              className="flex-1 overflow-y-auto min-h-[300px] max-h-[calc(100vh-300px)]"
            >
              {listLoading ? (
                <p className="text-center py-12 text-sm text-stone-500">Loading directory…</p>
              ) : listError ? (
                <div className="text-center py-10 px-4">
                  <p className="text-sm text-red-600">{listError}</p>
                  <button
                    type="button"
                    onClick={() => void loadCustomers()}
                    className="mt-3 text-sm font-medium text-stone-800 dark:text-gray-200 underline"
                  >
                    Retry
                  </button>
                </div>
              ) : directoryGroups.length === 0 ? (
                <p className="text-center py-12 text-sm text-stone-500 px-4">
                  No entries yet. Add a customer to start the book.
                </p>
              ) : (
                directoryGroups.map(([letter, rows]) => (
                  <div key={letter} data-letter={letter}>
                    <div className="sticky top-0 z-[1] px-3 py-1 bg-stone-100/95 dark:bg-gray-900/95 border-y border-stone-200 dark:border-gray-800 text-[11px] font-bold tracking-widest text-stone-600 dark:text-gray-300">
                      {letter}
                    </div>
                    <ul>
                      {rows.map((row) => {
                        const active = selectedCustomer?.id === row.id;
                        return (
                          <li key={row.id}>
                            <button
                              type="button"
                              onClick={() => void pickCustomer(row)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-stone-100 dark:border-gray-800/80 transition-colors ${
                                active
                                  ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                                  : 'hover:bg-stone-50 dark:hover:bg-gray-900'
                              }`}
                            >
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  active
                                    ? 'bg-white/15 dark:bg-stone-900/10'
                                    : 'bg-stone-100 dark:bg-gray-800 text-stone-600 dark:text-gray-300'
                                }`}
                              >
                                {initials(row.name)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className={`font-medium truncate ${active ? '' : 'text-ink'}`}>
                                  {row.name}
                                </div>
                                <div
                                  className={`text-xs truncate ${
                                    active ? 'text-white/70 dark:text-stone-600' : 'text-stone-500'
                                  }`}
                                >
                                  {row.phone}
                                  {row.area ? ` · ${row.area}` : ''}
                                </div>
                              </div>
                              {row._count != null && (
                                <span
                                  className={`text-[10px] tabular-nums shrink-0 ${
                                    active ? 'text-white/60 dark:text-stone-500' : 'text-stone-400'
                                  }`}
                                >
                                  {row._count.sales}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Card / profile */}
        <div className="lg:col-span-7 min-h-[320px]" style={{ perspective: 1200 }}>
          <AnimatePresence mode="wait">
            {!selectedCustomer ? (
              <motion.div
                key="empty"
                {...panelFade}
                className="h-full min-h-[320px] rounded-md border border-dashed border-stone-300 dark:border-gray-700 flex flex-col items-center justify-center text-center p-8"
              >
                <p className="text-lg font-medium text-stone-700 dark:text-gray-200">
                  Select a name
                </p>
                <p className="text-sm text-stone-500 mt-1 max-w-xs">
                  Like an old phone book — pick from the list or search above.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={selectedCustomer.id}
                initial={cardUnfold.initial}
                animate={cardUnfold.animate}
                exit={cardUnfold.exit}
                transition={cardUnfold.transition}
                style={{ transformOrigin: 'top center', transformStyle: 'preserve-3d' }}
                className="rounded-md border border-stone-300 dark:border-gray-700 bg-white dark:bg-gray-950 overflow-hidden shadow-sm will-change-transform"
              >
                <div className="px-5 py-4 border-b border-stone-200 dark:border-gray-800 bg-stone-50/80 dark:bg-gray-900/50">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <motion.div
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.12, duration: 0.35, ease: easeOutSoft }}
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-stone-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-lg font-semibold text-stone-800 dark:text-gray-100"
                    >
                      {initials(selectedCustomer.name)}
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="text-xl font-semibold text-stone-900 dark:text-white truncate">
                            {selectedCustomer.name}
                          </h2>
                          <p className="text-sm mt-0.5">
                            <a
                              href={`tel:${selectedCustomer.phone}`}
                              className="font-medium text-stone-800 dark:text-gray-200 hover:underline"
                            >
                              {selectedCustomer.phone}
                            </a>
                            {selectedCustomer.phone.replace(/\D/g, '').length >= 10 && (
                              <>
                                <span className="text-stone-400 mx-1.5">·</span>
                                <a
                                  href={`https://wa.me/91${selectedCustomer.phone.replace(/\D/g, '').slice(-10)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-stone-600 dark:text-gray-300 hover:underline"
                                >
                                  WhatsApp
                                </a>
                              </>
                            )}
                          </p>
                          {(selectedCustomer.area || customer360?.customer.area) && (
                            <p className="text-sm text-stone-500 mt-0.5">
                              {selectedCustomer.area || customer360?.customer.area}
                            </p>
                          )}
                          <AnimatePresence mode="wait">
                            {customer360 ? (
                              <motion.p
                                key="visit"
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3, ease: easeOutSoft }}
                                className="text-sm text-stone-600 dark:text-gray-300 mt-2"
                              >
                                Last visit:{' '}
                                <span className="font-medium text-stone-900 dark:text-white">
                                  {formatVisitLabel(
                                    customer360.summary.lastVisitAt,
                                    customer360.summary.daysSinceLastVisit
                                  )}
                                </span>
                              </motion.p>
                            ) : (
                              <motion.div
                                key="visit-skel"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="mt-2 h-4 w-40 rounded bg-stone-200/80 dark:bg-gray-800 animate-pulse"
                              />
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditCustomer(selectedCustomer)}
                            className="px-3 py-1.5 text-sm rounded-md border border-stone-300 dark:border-gray-600 font-medium text-stone-800 dark:text-gray-100 hover:bg-stone-100 dark:hover:bg-gray-800"
                          >
                            Edit
                          </button>
                          {user?.role === 'OWNER' && (
                            <button
                              type="button"
                              onClick={handleDeleteCustomer}
                              className="px-3 py-1.5 text-sm rounded-md border border-red-200 text-red-700 dark:border-red-900 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 max-h-[calc(100vh-280px)] overflow-y-auto">
                  <AnimatePresence mode="wait">
                    {detailLoading || !customer360 ? (
                      <motion.div
                        key="body-loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25, ease: easeOutSoft }}
                        className="space-y-4"
                      >
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[0, 1, 2, 3].map((i) => (
                            <div
                              key={i}
                              className="h-16 rounded-md border border-stone-200 dark:border-gray-800 bg-stone-100/80 dark:bg-gray-900 animate-pulse"
                              style={{ animationDelay: `${i * 80}ms` }}
                            />
                          ))}
                        </div>
                        <div className="h-24 rounded-md border border-stone-200 dark:border-gray-800 bg-stone-100/60 dark:bg-gray-900 animate-pulse" />
                        <div className="h-32 rounded-md border border-stone-200 dark:border-gray-800 bg-stone-100/60 dark:bg-gray-900 animate-pulse" />
                        <p className="text-center text-xs text-stone-400 pt-1">Unfolding card…</p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="body-ready"
                        variants={bodyStagger}
                        initial="hidden"
                        animate="show"
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        className="space-y-5"
                      >
                        <motion.div
                          variants={bodyItem}
                          className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-stone-200 dark:bg-gray-800 rounded-md overflow-hidden border border-stone-200 dark:border-gray-800"
                        >
                          {[
                            { label: 'Visits', value: String(customer360.summary.visitCount) },
                            {
                              label: 'Total spent',
                              value: formatINR(customer360.summary.lifetimeSpent),
                            },
                            { label: 'Avg bill', value: formatINR(customer360.summary.avgBill) },
                            {
                              label: 'Open credit',
                              value: formatINR(customer360.summary.openCreditAmount),
                              warn: customer360.summary.openCreditAmount > 0,
                            },
                          ].map((cell) => (
                            <div
                              key={cell.label}
                              className={`bg-white dark:bg-gray-950 p-3 ${
                                cell.warn ? 'bg-amber-50 dark:bg-amber-950/20' : ''
                              }`}
                            >
                              <p className="text-[10px] uppercase tracking-wide text-stone-500">
                                {cell.label}
                              </p>
                              <p className="text-lg font-semibold text-stone-900 dark:text-white mt-0.5 tabular-nums">
                                {cell.value}
                              </p>
                            </div>
                          ))}
                        </motion.div>

                        <motion.div variants={bodyItem} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="px-2.5 py-1 rounded border border-stone-200 dark:border-gray-700 text-stone-700 dark:text-gray-200">
                            {customer360.customer.loyaltyPoints} pts · {customer360.customer.loyaltyTier}
                          </span>
                          <button
                            type="button"
                            onClick={() => void loadLoyaltyInfo()}
                            className="text-stone-600 dark:text-gray-300 underline-offset-2 hover:underline"
                          >
                            Loyalty
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLoyaltyAction('redeem');
                              setLoyaltyForm({ points: 0, description: '' });
                              void loadLoyaltyInfo();
                            }}
                            className="text-stone-600 dark:text-gray-300 underline-offset-2 hover:underline"
                          >
                            Redeem
                          </button>
                        </motion.div>

                        <motion.section
                          variants={bodyItem}
                          className="rounded-md border border-stone-200 dark:border-gray-800 p-3"
                        >
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
                            Last {customer360.summary.compareDays} days vs before
                          </h3>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <p className="text-stone-500 text-xs">This period</p>
                              <p className="font-semibold text-stone-900 dark:text-white">
                                {customer360.periodCompare.current.visits} visits ·{' '}
                                {formatINR(customer360.periodCompare.current.spent)}
                              </p>
                            </div>
                            <div>
                              <p className="text-stone-500 text-xs">Previous</p>
                              <p className="font-semibold text-stone-900 dark:text-white">
                                {customer360.periodCompare.prior.visits} visits ·{' '}
                                {formatINR(customer360.periodCompare.prior.spent)}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-stone-600 dark:text-gray-400 mt-2">
                            Spend{' '}
                            <span
                              className={
                                customer360.periodCompare.spentDelta >= 0
                                  ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                  : 'text-red-600 dark:text-red-400 font-semibold'
                              }
                            >
                              {customer360.periodCompare.spentDelta >= 0 ? '+' : ''}
                              {formatINR(customer360.periodCompare.spentDelta)} (
                              {customer360.periodCompare.spentDeltaPct >= 0 ? '+' : ''}
                              {customer360.periodCompare.spentDeltaPct}%)
                            </span>
                            {' · '}Visits{' '}
                            <span className="font-semibold">
                              {customer360.periodCompare.visitsDelta >= 0 ? '+' : ''}
                              {customer360.periodCompare.visitsDelta}
                            </span>
                          </p>
                        </motion.section>

                        <motion.section variants={bodyItem}>
                          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
                            Buys most
                          </h3>
                          {customer360.topProducts.length > 0 ? (
                            <ol className="divide-y divide-stone-100 dark:divide-gray-800 border border-stone-200 dark:border-gray-800 rounded-md">
                              {customer360.topProducts.map((p, i) => (
                                <li
                                  key={p.productId}
                                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                                >
                                  <span className="text-stone-400 w-5">{i + 1}.</span>
                                  <span className="flex-1 font-medium text-stone-900 dark:text-white truncate">
                                    {p.name}
                                  </span>
                                  <span className="text-stone-500 shrink-0 tabular-nums">
                                    {p.unitType === 'KG' && p.qtyKg > 0
                                      ? `${p.qtyKg} kg`
                                      : p.qtyPcs > 0
                                        ? `${p.qtyPcs} pcs`
                                        : `${p.timesBought}×`}
                                    {' · '}
                                    {formatINR(p.revenue)}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <p className="text-sm text-stone-500">No purchases yet</p>
                          )}
                        </motion.section>

                        <motion.section
                          variants={bodyItem}
                          className="rounded-md border border-stone-200 dark:border-gray-800 p-3"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                              Staff notes
                            </h3>
                            {notesSavedFlash && (
                              <motion.span
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-xs text-emerald-600"
                              >
                                Saved
                              </motion.span>
                            )}
                          </div>
                          <p className="text-xs text-stone-500 mb-2">
                            Tap an answer, then save — only staff see this.
                          </p>
                          <div className="space-y-2.5 mb-3">
                            {STAFF_NOTE_PROMPTS.map((prompt) => (
                              <div key={prompt.q}>
                                <p className="text-xs font-medium text-stone-700 dark:text-gray-300 mb-1">
                                  {prompt.q}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {prompt.answers.map((answer) => (
                                    <button
                                      key={answer}
                                      type="button"
                                      onClick={() =>
                                        setStaffNotesDraft((prev) => appendNoteLine(prev, answer))
                                      }
                                      className="text-xs px-2.5 py-1 rounded-full border border-stone-300 dark:border-gray-600 text-stone-700 dark:text-gray-200 hover:bg-stone-100 dark:hover:bg-gray-800"
                                    >
                                      {answer}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          <textarea
                            value={staffNotesDraft}
                            onChange={(e) => setStaffNotesDraft(e.target.value)}
                            rows={3}
                            maxLength={2000}
                            placeholder="Or type a free note…"
                            className="w-full rounded-md border border-stone-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => void saveStaffNotes()}
                            disabled={
                              notesSaving ||
                              staffNotesDraft.trim() ===
                                (customer360.customer.staffNotes || '').trim()
                            }
                            className="mt-2 min-h-9 px-4 rounded-md bg-stone-900 dark:bg-white text-white dark:text-stone-900 text-sm font-medium disabled:opacity-40"
                          >
                            {notesSaving ? 'Saving…' : 'Save notes'}
                          </button>
                        </motion.section>

                        <motion.section variants={bodyItem}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                              Addresses & delivery
                            </h3>
                            <button
                              type="button"
                              onClick={() => setShowAddressModal(true)}
                              className="text-sm text-stone-700 dark:text-gray-300 hover:underline"
                            >
                              + Address
                            </button>
                          </div>
                          {customer360.lastDelivery && (
                            <div className="mb-2 rounded-md border border-stone-200 dark:border-gray-800 px-3 py-2 text-sm bg-stone-50 dark:bg-gray-900/40">
                              <p className="font-medium text-stone-900 dark:text-white">
                                Last delivery ·{' '}
                                {deliveryStatusLabel(customer360.lastDelivery.status)}
                              </p>
                              <p className="text-xs text-stone-500 mt-0.5">
                                {customer360.lastDelivery.saleNo} ·{' '}
                                {new Date(customer360.lastDelivery.createdAt).toLocaleDateString(
                                  'en-IN'
                                )}
                                {customer360.lastDelivery.address
                                  ? ` · ${customer360.lastDelivery.address.line1}${
                                      customer360.lastDelivery.address.city
                                        ? `, ${customer360.lastDelivery.address.city}`
                                        : ''
                                    }`
                                  : ''}
                              </p>
                            </div>
                          )}
                          {customer360.addresses.length > 0 ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {customer360.addresses.map((addr) => (
                                <div
                                  key={addr.id}
                                  className="rounded-md border border-stone-200 dark:border-gray-800 p-3"
                                >
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                                    {addr.label}
                                  </div>
                                  <p className="text-sm text-stone-800 dark:text-gray-200 mt-1">
                                    {addr.line1}
                                    {addr.city ? `, ${addr.city}` : ''}
                                  </p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-stone-500">No saved addresses</p>
                          )}
                        </motion.section>

                        <motion.section variants={bodyItem}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                              Recent bills
                            </h3>
                            <button
                              type="button"
                              onClick={loadPurchaseHistory}
                              disabled={loadingHistory}
                              className="text-sm text-stone-700 dark:text-gray-300 hover:underline disabled:opacity-50"
                            >
                              {loadingHistory ? 'Loading…' : 'Full history'}
                            </button>
                          </div>
                          {customer360.recentSales.length > 0 ? (
                            <ul className="divide-y divide-stone-100 dark:divide-gray-800 border border-stone-200 dark:border-gray-800 rounded-md">
                              {customer360.recentSales.map((sale) => (
                                <li
                                  key={sale.id}
                                  className="flex items-center justify-between px-3 py-2"
                                >
                                  <div>
                                    <div className="font-medium text-sm text-stone-900 dark:text-white">
                                      {sale.saleNo}
                                    </div>
                                    <div className="text-xs text-stone-500">
                                      {new Date(sale.createdAt).toLocaleDateString('en-IN')}
                                      {sale.hasCredit ? ' · Credit' : ''}
                                    </div>
                                  </div>
                                  <div className="font-semibold text-sm tabular-nums text-stone-900 dark:text-white">
                                    {formatINR(sale.grandTotal)}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-stone-500">No bills yet</p>
                          )}
                        </motion.section>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className={modalBackdrop}>
          <div className="glass-panel-strong rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <h2 className="text-xl font-bold text-ink mb-4">
              {editingCustomer ? 'Edit customer' : 'Add customer'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">Name *</label>
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Customer name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">Phone *</label>
                <input
                  type="tel"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">Email</label>
                <input
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="optional@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">
                  Area / Locality
                </label>
                <input
                  type="text"
                  value={customerForm.area}
                  onChange={(e) => setCustomerForm({ ...customerForm, area: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="e.g. Kothrud, Baner"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomerModal(false);
                    setEditingCustomer(null);
                    setCustomerForm({ name: '', phone: '', email: '', area: '' });
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:text-white hover:bg-brand-100/30 dark:hover:bg-brand-900/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={editingCustomer ? handleUpdateCustomer : handleCreateCustomer}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 text-white font-medium hover:bg-brand-600"
                >
                  {editingCustomer ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Address Modal */}
      {showAddressModal && (
        <div className={modalBackdrop}>
          <div className="glass-panel-strong rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
            <h2 className="text-xl font-bold text-ink mb-4">Add address</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">Label *</label>
                <input
                  type="text"
                  value={addressForm.label}
                  onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500"
                  placeholder="Home, Office…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">
                  Address line 1 *
                </label>
                <input
                  type="text"
                  value={addressForm.line1}
                  onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">
                  Address line 2
                </label>
                <input
                  type="text"
                  value={addressForm.line2}
                  onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">City *</label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink-secondary mb-1">State</label>
                  <input
                    type="text"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">PIN / ZIP</label>
                <input
                  type="text"
                  value={addressForm.zip}
                  onChange={(e) => setAddressForm({ ...addressForm, zip: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500"
                  placeholder="Optional"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddressModal(false);
                    setAddressForm({ label: '', line1: '', line2: '', city: '', state: '', zip: '' });
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:text-white hover:bg-brand-100/30 dark:hover:bg-brand-900/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddAddress}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 text-white font-medium hover:bg-brand-600"
                >
                  Save address
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase History Modal */}
      {showPurchaseHistory && selectedCustomer && (
        <div className={modalBackdrop}>
          <div className="glass-panel-strong rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-ink">Purchase history — {selectedCustomer.name}</h2>
              <button
                type="button"
                onClick={() => setShowPurchaseHistory(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl leading-none p-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {purchaseHistory.length === 0 ? (
              <p className="text-ink-muted">No purchase history found</p>
            ) : (
              <div className="space-y-4">
                {purchaseHistory.map((sale) => (
                  <div
                    key={sale.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50/50 dark:bg-gray-900/30"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-semibold text-lg dark:text-white">{sale.saleNo}</div>
                        <div className="text-sm text-ink-secondary">
                          {new Date(sale.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-ink">₹{sale.grandTotal.toFixed(2)}</div>
                        {sale.discountTotal > 0 && (
                          <div className="text-sm text-green-600 dark:text-green-400">
                            Discount: ₹{sale.discountTotal.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mb-3">
                      <div className="font-medium mb-2 dark:text-white text-sm">Items</div>
                      <div className="space-y-1">
                        {sale.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm dark:text-gray-300">
                            <span>
                              {item.product.name} ×{' '}
                              {item.qtyKg ? `${item.qtyKg} kg` : `${item.qtyPcs} pcs`}
                            </span>
                            <span className="font-medium">₹{item.lineTotal.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 text-sm flex-wrap">
                      {sale.payments.map((payment, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 glass-panel rounded-2xl dark:text-white border border-gray-200 dark:border-gray-600"
                        >
                          {payment.method}: ₹{payment.amount.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loyalty Modal */}
      {showLoyaltyModal && (
        <div className={modalBackdrop}>
          <div className="glass-panel-strong rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-ink">Loyalty</h2>
              <button
                type="button"
                onClick={() => {
                  setShowLoyaltyModal(false);
                  setLoyaltyAction(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 text-2xl leading-none p-1"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {loadingLoyalty && !loyaltyInfo ? (
              <div className="py-16 text-center text-ink-muted">Loading loyalty…</div>
            ) : !loyaltyInfo ? (
              <div className="py-12 text-center text-ink-muted">Could not load loyalty data.</div>
            ) : loyaltyAction ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold capitalize dark:text-white">
                  {loyaltyAction === 'redeem' ? 'Redeem points' : 'Adjust points'}
                </h3>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">
                    Points {loyaltyAction === 'redeem' ? 'to redeem' : 'adjustment'} *
                  </label>
                  <input
                    type="number"
                    value={loyaltyForm.points || ''}
                    onChange={(e) =>
                      setLoyaltyForm({ ...loyaltyForm, points: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500"
                    placeholder="Enter points"
                    min={loyaltyAction === 'redeem' ? 1 : undefined}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-gray-300">Description *</label>
                  <textarea
                    value={loyaltyForm.description}
                    onChange={(e) => setLoyaltyForm({ ...loyaltyForm, description: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500"
                    rows={3}
                  />
                </div>
                {loyaltyAction === 'redeem' && (
                  <div className="text-sm text-ink-secondary">
                    Current balance: {loyaltyInfo.customer?.loyaltyPoints || loyaltyInfo.points || 0} points
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLoyaltyAction(null);
                      setLoyaltyForm({ points: 0, description: '' });
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:text-white hover:bg-brand-100/30 dark:hover:bg-brand-900/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={loyaltyAction === 'redeem' ? handleRedeemPoints : handleAdjustPoints}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 text-white font-medium hover:bg-brand-600"
                  >
                    {loyaltyAction === 'redeem' ? 'Redeem' : 'Adjust'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6 p-4 rounded-xl bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20">
                  <div>
                    <div className="text-sm text-ink-secondary">Points</div>
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                      {loyaltyInfo.customer?.loyaltyPoints || loyaltyInfo.points || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-ink-secondary">Tier</div>
                    <div className="text-xl font-semibold capitalize text-orange-600 dark:text-orange-400">
                      {loyaltyInfo.customer?.loyaltyTier || loyaltyInfo.tier || 'BRONZE'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-ink-secondary">Total spent</div>
                    <div className="text-xl font-semibold text-ink">
                      ₹{(loyaltyInfo.customer?.totalSpent || loyaltyInfo.totalSpent || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-ink">Transactions</h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLoyaltyAction('redeem');
                          setLoyaltyForm({ points: 0, description: '' });
                        }}
                        className="px-3 py-1.5 text-sm rounded-lg bg-orange-500 text-white hover:bg-orange-600"
                      >
                        Redeem
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLoyaltyAction('adjust');
                          setLoyaltyForm({ points: 0, description: '' });
                        }}
                        className="px-3 py-1.5 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600"
                      >
                        Adjust
                      </button>
                    </div>
                  </div>
                  {!loyaltyInfo.transactions || loyaltyInfo.transactions.length === 0 ? (
                    <p className="text-sm text-ink-muted">No transactions yet</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {loyaltyInfo.transactions.map((tx: LoyaltyTransaction) => (
                        <div
                          key={tx.id}
                          className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl flex justify-between items-center"
                        >
                          <div>
                            <div className="font-medium dark:text-white">{tx.description || tx.type}</div>
                            <div className="text-sm text-ink-secondary">
                              {new Date(tx.createdAt).toLocaleString()}
                            </div>
                            {tx.sale && (
                              <div className="text-xs text-gray-500">Sale: {tx.sale.saleNo}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div
                              className={`font-semibold ${ tx.points > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' }`}
                            >
                              {tx.points > 0 ? '+' : ''}
                              {tx.points}
                            </div>
                            {tx.balance !== undefined && (
                              <div className="text-xs text-ink-muted">Bal: {tx.balance}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
