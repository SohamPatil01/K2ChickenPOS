'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

interface Delivery {
  id: string;
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

export default function StoreDeliveryPage() {
  const { user } = useAuthStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
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

  useEffect(() => {
    loadDeliveries();
  }, [statusFilter]);

  const loadDeliveries = async () => {
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const response = await api.get('/api/v1/delivery', { params });
      setDeliveries(response.data);
    } catch (error) {
      console.error('Failed to load deliveries:', error);
    }
  };

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
      const withoutDelivery = sales.filter((s: SaleOption) => !s.deliveryOrder);
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

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.post(`/api/v1/delivery/${id}/status`, { status });
      loadDeliveries();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update status');
    }
  };

  const openDetailsModal = async (delivery: Delivery) => {
    setEditingDelivery(delivery);
    setDetailsError(null);
    setDetailsForm({
      customerName: delivery.sale.customer?.name || '',
      customerPhone: delivery.sale.customer?.phone || '',
      addressId: (delivery.address as any)?.id || '',
      newAddress: { label: 'Home', line1: '', line2: '', city: '', state: '', zip: '' },
    });
    setAddNewAddress(false);
    const customerId = (delivery.sale as any).customerId || delivery.sale.customer?.id;
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
      const customerId = (editingDelivery.sale as any).customerId || editingDelivery.sale.customer?.id;
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

  const groupedByStatus = deliveries.reduce((acc, delivery) => {
    if (!acc[delivery.status]) acc[delivery.status] = [];
    acc[delivery.status].push(delivery);
    return acc;
  }, {} as Record<string, Delivery[]>);

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-3 sm:gap-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold dark:text-white">Delivery Management</h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Create delivery
          </button>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md w-full sm:w-auto text-sm sm:text-base touch-target"
          >
            <option value="">All Status</option>
            <option value="CREATED">Created</option>
            <option value="READY">Ready</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
            <option value="DELIVERED">Delivered</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {['CREATED', 'READY', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED'].map((status) => (
          <div key={status} className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4 min-h-[200px] dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)]">
            <h2 className="font-bold mb-3 sm:mb-4 text-xs sm:text-sm lg:text-base text-center sm:text-left break-words dark:text-white">
              {status.replace(/_/g, ' ')}
            </h2>
            <div className="space-y-2">
              {(groupedByStatus[status] || []).length === 0 ? (
                <div className="text-center text-gray-400 dark:text-gray-500 text-xs sm:text-sm py-4">
                  No deliveries
                </div>
              ) : (
                (groupedByStatus[status] || []).map((delivery) => (
                  <div key={delivery.id} className="border border-gray-200 dark:border-gray-700 rounded p-2 sm:p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <div className="font-semibold text-xs sm:text-sm truncate dark:text-white" title={delivery.sale.saleNo}>
                      {delivery.sale.saleNo}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate" title={delivery.sale.customer?.name || 'Walk-in'}>
                      {delivery.sale.customer?.name || 'Walk-in'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">₹{delivery.sale.grandTotal.toFixed(2)}</div>
                    {delivery.address && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2" title={`${delivery.address.line1}, ${delivery.address.city}`}>
                        {delivery.address.line1}, {delivery.address.city}
                      </div>
                    )}
                    {delivery.assignedDriver && (
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Driver: {delivery.assignedDriver.name}
                      </div>
                    )}
                    {user?.role !== 'DRIVER' && delivery.status === 'ASSIGNED' && (
                      <button
                        onClick={() => updateStatus(delivery.id, 'OUT_FOR_DELIVERY')}
                        className="mt-2 w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors touch-target"
                      >
                        Mark Out
                      </button>
                    )}
                    {user?.role === 'DRIVER' && delivery.status === 'OUT_FOR_DELIVERY' && (
                      <button
                        onClick={() => {
                          const otp = prompt('Enter OTP:');
                          if (otp) {
                            api.post(`/api/v1/delivery/${delivery.id}/otp/verify`, { otp })
                              .then(() => loadDeliveries())
                              .catch((err) => alert(err.response?.data?.error || 'Invalid OTP'));
                          }
                        }}
                        className="mt-2 w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 bg-brand-500 text-white rounded hover:bg-brand-600 transition-colors touch-target"
                      >
                        Verify OTP
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openDetailsModal(delivery)}
                      className="mt-2 w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors touch-target"
                    >
                      {delivery.address ? 'Edit details' : 'Add address & details'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold dark:text-white">Create delivery</h2>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateDelivery} className="p-4 space-y-4">
              {createError && (
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                  {createError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sale</label>
                <select
                  value={form.saleId}
                  onChange={(e) => onSelectSale(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                  required
                >
                  <option value="">Select a paid sale</option>
                  {paidSales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.saleNo} — {s.customer?.name || 'Walk-in'} — ₹{s.grandTotal.toFixed(2)}
                    </option>
                  ))}
                </select>
                {loadingSales && <p className="text-xs text-gray-500 mt-1">Loading sales…</p>}
                {!loadingSales && paidSales.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">No paid sales without delivery in the last 30 days.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      checked={form.type === 'PICKUP'}
                      onChange={() => {
                        setForm((f) => ({ ...f, type: 'PICKUP', addressId: '' }));
                        setAddresses([]);
                        setCreateAddNewAddress(false);
                      }}
                      className="text-brand-600"
                    />
                    <span className="text-sm dark:text-white">Pickup</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      checked={form.type === 'DELIVERY'}
                      onChange={() => {
                        setForm((f) => ({ ...f, type: 'DELIVERY' }));
                        if (form.saleId) onSelectSale(form.saleId);
                      }}
                      className="text-brand-600"
                    />
                    <span className="text-sm dark:text-white">Delivery</span>
                  </label>
                </div>
              </div>
              {form.type === 'DELIVERY' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery address</label>
                  {!createAddNewAddress ? (
                    <>
                      <select
                        value={form.addressId}
                        onChange={(e) => setForm((f) => ({ ...f, addressId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                      >
                        <option value="">Select address</option>
                        {addresses.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}: {a.line1}, {a.city}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setCreateAddNewAddress(true)}
                        className="mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        + Add new address
                      </button>
                      {form.saleId && paidSales.find((s) => s.id === form.saleId)?.customerId && addresses.length === 0 && !loadingSales && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No addresses for this customer. Select above or add one below.</p>
                      )}
                      {form.saleId && !paidSales.find((s) => s.id === form.saleId)?.customerId && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Walk-in sale has no customer. Add customer in Customers to add an address.</p>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={createNewAddress.label}
                        onChange={(e) => setCreateNewAddress((a) => ({ ...a, label: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                        placeholder="Label (e.g. Home)"
                      />
                      <input
                        type="text"
                        value={createNewAddress.line1}
                        onChange={(e) => setCreateNewAddress((a) => ({ ...a, line1: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                        placeholder="Address line 1 *"
                      />
                      <input
                        type="text"
                        value={createNewAddress.line2}
                        onChange={(e) => setCreateNewAddress((a) => ({ ...a, line2: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                        placeholder="Line 2 (optional)"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={createNewAddress.city}
                          onChange={(e) => setCreateNewAddress((a) => ({ ...a, city: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                          placeholder="City *"
                        />
                        <input
                          type="text"
                          value={createNewAddress.state}
                          onChange={(e) => setCreateNewAddress((a) => ({ ...a, state: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                          placeholder="State"
                        />
                      </div>
                      <input
                        type="text"
                        value={createNewAddress.zip}
                        onChange={(e) => setCreateNewAddress((a) => ({ ...a, zip: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                        placeholder="ZIP"
                      />
                      <button
                        type="button"
                        onClick={() => setCreateAddNewAddress(false)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                      >
                        Use existing address
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery fee (₹)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.deliveryFee}
                  onChange={(e) => setForm((f) => ({ ...f, deliveryFee: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !form.saleId}
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold dark:text-white">Add address & details — {editingDelivery.sale.saleNo}</h2>
              <button
                type="button"
                onClick={() => setEditingDelivery(null)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveDetails} className="p-4 space-y-4">
              {detailsError && (
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
                  {detailsError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer name</label>
                <input
                  type="text"
                  value={detailsForm.customerName}
                  onChange={(e) => setDetailsForm((f) => ({ ...f, customerName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                  placeholder="Name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer phone</label>
                <input
                  type="text"
                  value={detailsForm.customerPhone}
                  onChange={(e) => setDetailsForm((f) => ({ ...f, customerPhone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                  placeholder="Phone"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery address</label>
                {!addNewAddress ? (
                  <>
                    <select
                      value={detailsForm.addressId}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, addressId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                    >
                      <option value="">Select address</option>
                      {detailsAddresses.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}: {a.line1}, {a.city}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setAddNewAddress(true)}
                      className="mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      + Add new address
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={detailsForm.newAddress.line1}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, line1: e.target.value } }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                      placeholder="Address line 1"
                    />
                    <input
                      type="text"
                      value={detailsForm.newAddress.line2}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, line2: e.target.value } }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                      placeholder="Line 2 (optional)"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={detailsForm.newAddress.city}
                        onChange={(e) => setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, city: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                        placeholder="City"
                      />
                      <input
                        type="text"
                        value={detailsForm.newAddress.state}
                        onChange={(e) => setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, state: e.target.value } }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                        placeholder="State"
                      />
                    </div>
                    <input
                      type="text"
                      value={detailsForm.newAddress.zip}
                      onChange={(e) => setDetailsForm((f) => ({ ...f, newAddress: { ...f.newAddress, zip: e.target.value } }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-sm"
                      placeholder="ZIP"
                    />
                    <button
                      type="button"
                      onClick={() => setAddNewAddress(false)}
                      className="text-xs text-gray-500 hover:underline"
                    >
                      Use existing address
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDelivery(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={detailsSaving}
                  className="flex-1 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
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

