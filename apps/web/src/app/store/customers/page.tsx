'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [detailLoading, setDetailLoading] = useState(false);

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

  const showSearchDropdown = searchFocused && debouncedSearch.length > 0;

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setListLoading(true);
    setListError(null);
    try {
      const response = await api.get('/api/v1/customers');
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
      const res = await api.get(`/api/v1/customers/${id}`);
      return res.data;
    } catch {
      return null;
    }
  }, []);

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
    setDetailLoading(true);
    const full = await fetchCustomerDetail(row.id);
    setDetailLoading(false);
    if (full) {
      setSelectedCustomer(full);
    } else {
      setSelectedCustomer({
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        loyaltyPoints: row.loyaltyPoints,
        loyaltyTier: row.loyaltyTier,
        totalSpent: row.totalSpent,
        addresses: [],
        sales: [],
      });
    }
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
    <div className="w-full max-w-7xl mx-auto min-h-0 flex flex-col gap-4 pb-10">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white p-5 sm:p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Customers</h1>
            <p className="text-white/85 text-sm mt-1 max-w-xl">
              Search by name or phone — suggestions appear as you type. View loyalty, addresses, and purchase
              history in one place.
            </p>
            <p className="text-white/70 text-xs mt-2 font-medium">
              {customerTotal > 0
                ? `${customerTotal.toLocaleString()} customers on file`
                : `${allCustomers.length} customers on file`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {user?.role === 'OWNER' && (
              <button
                type="button"
                onClick={handleRecalcLoyalty}
                disabled={recalcRunning}
                title="Recompute every customer's loyalty points from their purchase history (1.25%, net of redemptions)"
                className="px-4 py-2.5 rounded-xl bg-white/15 text-white font-semibold text-sm ring-1 ring-white/30 hover:bg-white/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {recalcRunning ? 'Recalculating…' : 'Recalculate points'}
              </button>
            )}
            <button
              type="button"
              onClick={openNewCustomer}
              className="px-5 py-2.5 rounded-xl bg-white text-brand-700 font-semibold text-sm shadow-md hover:bg-white/95 transition-colors"
            >
              + Add customer
            </button>
          </div>
        </div>
      </div>

      {/* Search combobox */}
      <div ref={searchWrapRef} className="relative z-20">
        <label htmlFor="customer-search" className="sr-only">
          Search customers
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
            🔍
          </span>
          <input
            id="customer-search"
            ref={searchInputRef}
            type="search"
            autoComplete="off"
            placeholder="Start typing a name or phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={onSearchKeyDown}
            role="combobox"
            aria-expanded={showSearchDropdown}
            aria-controls="customer-search-listbox"
            aria-autocomplete="list"
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-base"
          />
          {searchQuery && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
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

        {showSearchDropdown && (
          <div
            id="customer-search-listbox"
            role="listbox"
            className="absolute left-0 right-0 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
          >
            {searchLoading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                <span className="inline-block animate-pulse">Searching…</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No matches for &ldquo;{debouncedSearch}&rdquo;
              </div>
            ) : (
              <ul className="py-2">
                {searchResults.map((row, idx) => (
                  <li key={row.id} role="option" aria-selected={highlightIndex === idx}>
                    <button
                      type="button"
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                        highlightIndex === idx
                          ? 'bg-brand-50 dark:bg-brand-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/80'
                      }`}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      onClick={() => void pickCustomer(row)}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 text-sm font-bold">
                        {initials(row.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900 dark:text-white truncate">{row.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {row.phone}
                          {row.area ? ` · ${row.area}` : ''}
                        </div>
                      </div>
                      {row._count != null && (
                        <div className="shrink-0 text-xs text-gray-400 dark:text-gray-500 text-right">
                          {row._count.sales ?? 0} orders
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0 flex-1">
        {/* Directory */}
        <div className="lg:col-span-2 flex flex-col min-h-0 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Directory</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tap a customer to open details</p>
          </div>
          <div className="flex-1 overflow-y-auto min-h-[280px] max-h-[calc(100vh-320px)]">
            {listLoading ? (
              <p className="text-center py-12 text-sm text-gray-500 dark:text-gray-400 px-4">
                Loading customers…
              </p>
            ) : listError ? (
              <div className="text-center py-10 px-4">
                <p className="text-sm text-red-600 dark:text-red-400">{listError}</p>
                <button
                  type="button"
                  onClick={() => void loadCustomers()}
                  className="mt-3 text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : allCustomers.length === 0 ? (
              <p className="text-center py-12 text-sm text-gray-500 dark:text-gray-400 px-4">
                No customers yet. Add one to get started.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {allCustomers.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => void pickCustomer(row)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        selectedCustomer?.id === row.id
                          ? 'bg-brand-50 dark:bg-brand-900/25 border-l-4 border-brand-500'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold">
                        {initials(row.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 dark:text-white truncate">{row.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {row.phone}
                          {row.area ? ` · ${row.area}` : ''}
                        </div>
                      </div>
                      {row._count != null && (
                        <span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 shrink-0">
                          {row._count.sales} ord
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3 min-h-[320px]">
          {detailLoading ? (
            <div className="h-full min-h-[320px] rounded-2xl border border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400">
              Loading customer…
            </div>
          ) : !selectedCustomer ? (
            <div className="h-full min-h-[320px] rounded-2xl border border-dashed border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center text-center p-8 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-3 opacity-40">👤</div>
              <p className="font-medium text-gray-700 dark:text-gray-300">Select a customer</p>
              <p className="text-sm mt-1 max-w-xs">
                Use search above or pick from the directory to see profile, addresses, and loyalty.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900/50 dark:to-gray-800">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white text-xl font-bold shadow-md">
                    {initials(selectedCustomer.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                          {selectedCustomer.name}
                        </h2>
                        <p className="text-brand-600 dark:text-brand-400 font-medium">{selectedCustomer.phone}</p>
                        {selectedCustomer.area && (
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                            <span className="text-gray-500 dark:text-gray-400">Area:</span> {selectedCustomer.area}
                          </p>
                        )}
                        {selectedCustomer.email && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{selectedCustomer.email}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openEditCustomer(selectedCustomer)}
                          className="px-3 py-1.5 text-sm rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors font-medium"
                        >
                          Edit
                        </button>
                        {user?.role === 'OWNER' && (
                          <button
                            type="button"
                            onClick={handleDeleteCustomer}
                            className="px-3 py-1.5 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors font-medium"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                        ⭐ {Math.round(selectedCustomer.loyaltyPoints ?? 0)} pts
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 capitalize">
                        {selectedCustomer.loyaltyTier || 'BRONZE'}
                      </span>
                      {selectedCustomer.totalSpent !== undefined && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">
                          ₹{selectedCustomer.totalSpent.toFixed(0)} spent
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-6">
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                      Addresses
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddressModal(true)}
                      className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      + Add address
                    </button>
                  </div>
                  {selectedCustomer.addresses &&
                  selectedCustomer.addresses.filter((a) => a.label !== 'Area').length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selectedCustomer.addresses
                        .filter((a) => a.label !== 'Area')
                        .map((addr) => (
                        <div
                          key={addr.id}
                          className="rounded-xl border border-gray-100 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40 p-3"
                        >
                          <div className="text-xs font-semibold text-brand-600 dark:text-brand-400">{addr.label}</div>
                          <p className="text-sm text-gray-700 dark:text-gray-200 mt-1">
                            {addr.line1}
                            {addr.city ? `, ${addr.city}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No saved addresses</p>
                  )}
                </section>

                <section className="rounded-xl border border-orange-200/80 dark:border-orange-800/50 bg-gradient-to-br from-orange-50/90 to-amber-50/50 dark:from-orange-950/30 dark:to-amber-950/20 p-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Loyalty</h3>
                    <button
                      type="button"
                      onClick={() => void loadLoyaltyInfo()}
                      disabled={loadingLoyalty}
                      className="text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline disabled:opacity-50"
                    >
                      {loadingLoyalty ? 'Loading…' : 'View details'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Points</div>
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {Math.round(selectedCustomer.loyaltyPoints ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Tier</div>
                      <div className="text-lg font-semibold capitalize text-orange-700 dark:text-orange-300">
                        {selectedCustomer.loyaltyTier || 'BRONZE'}
                      </div>
                    </div>
                  </div>
                </section>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={loadPurchaseHistory}
                    disabled={loadingHistory}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors disabled:opacity-50"
                  >
                    {loadingHistory ? 'Loading…' : 'Purchase history'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoyaltyAction('redeem');
                      setLoyaltyForm({ points: 0, description: '' });
                      void loadLoyaltyInfo();
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
                  >
                    Redeem points
                  </button>
                </div>

                {selectedCustomer.sales && selectedCustomer.sales.length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Recent purchases</h3>
                    <ul className="space-y-2">
                      {selectedCustomer.sales.slice(0, 5).map((sale) => (
                        <li
                          key={sale.id}
                          className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-900/50 px-3 py-2"
                        >
                          <div>
                            <div className="font-medium text-sm text-gray-900 dark:text-white">{sale.saleNo}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(sale.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="font-semibold text-sm text-gray-900 dark:text-white">
                            ₹{sale.grandTotal.toFixed(2)}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className={modalBackdrop}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold dark:text-white mb-4">
              {editingCustomer ? 'Edit customer' : 'Add customer'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Customer name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="Phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  placeholder="optional@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-700">
            <h2 className="text-xl font-bold dark:text-white mb-4">Add address</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Label *</label>
                <input
                  type="text"
                  value={addressForm.label}
                  onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500"
                  placeholder="Home, Office…"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City *</label>
                  <input
                    type="text"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PIN / ZIP</label>
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
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">Purchase history — {selectedCustomer.name}</h2>
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
              <p className="text-gray-500 dark:text-gray-400">No purchase history found</p>
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
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(sale.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold dark:text-white">₹{sale.grandTotal.toFixed(2)}</div>
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
                          className="px-2 py-1 bg-white dark:bg-gray-800 rounded-lg dark:text-white border border-gray-200 dark:border-gray-600"
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold dark:text-white">Loyalty</h2>
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
              <div className="py-16 text-center text-gray-500 dark:text-gray-400">Loading loyalty…</div>
            ) : !loyaltyInfo ? (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">Could not load loyalty data.</div>
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
                  <div className="text-sm text-gray-600 dark:text-gray-400">
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
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700"
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
                    <div className="text-sm text-gray-600 dark:text-gray-400">Points</div>
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                      {loyaltyInfo.customer?.loyaltyPoints || loyaltyInfo.points || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Tier</div>
                    <div className="text-xl font-semibold capitalize text-orange-600 dark:text-orange-400">
                      {loyaltyInfo.customer?.loyaltyTier || loyaltyInfo.tier || 'BRONZE'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total spent</div>
                    <div className="text-xl font-semibold dark:text-white">
                      ₹{(loyaltyInfo.customer?.totalSpent || loyaltyInfo.totalSpent || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold dark:text-white">Transactions</h3>
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">No transactions yet</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {loyaltyInfo.transactions.map((tx: LoyaltyTransaction) => (
                        <div
                          key={tx.id}
                          className="p-3 bg-gray-50 dark:bg-gray-700 rounded-xl flex justify-between items-center"
                        >
                          <div>
                            <div className="font-medium dark:text-white">{tx.description || tx.type}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {new Date(tx.createdAt).toLocaleString()}
                            </div>
                            {tx.sale && (
                              <div className="text-xs text-gray-500">Sale: {tx.sale.saleNo}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div
                              className={`font-semibold ${
                                tx.points > 0
                                  ? 'text-green-600 dark:text-green-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {tx.points > 0 ? '+' : ''}
                              {tx.points}
                            </div>
                            {tx.balance !== undefined && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">Bal: {tx.balance}</div>
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
