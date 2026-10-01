'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '@/lib/api';
import { Button, Card } from '@/components/ui';
import { useCartStore } from '@/store/cart';
import { useNotificationStore } from '@/store/notification';

export type PreOrderRow = {
  id: string;
  trackingCode?: string;
  customerName: string;
  customerPhone: string;
  customerId: string | null;
  fulfillment: string;
  readyAt: string;
  status: string;
  source: string;
  notes: string | null;
  cancelReason?: string | null;
  events?: Array<{ id: string; message: string; createdAt: string; kind: string }>;
  items: Array<{
    id: string;
    productId: string | null;
    productName: string;
    unitType: 'KG' | 'PCS';
    qtyKg: number | null;
    qtyPcs: number | null;
    pricePerUnit: number | null;
    product: {
      id: string;
      name: string;
      unitType: string;
      taxRate: number;
      imageUrl?: string | null;
    } | null;
  }>;
};

function fmtReady(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function defaultReadyLocal(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PosPreOrders({
  products,
}: {
  products: Array<{
    id: string;
    name: string;
    unitType: 'KG' | 'PCS';
    taxRate: number;
    pricePerUnit: number;
    imageUrl?: string | null;
  }>;
}) {
  const { showNotification } = useNotificationStore();
  const addItem = useCartStore((s) => s.addItem);
  const setCustomer = useCartStore((s) => s.setCustomer);
  const loadCart = useCartStore((s) => s.loadCart);

  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [items, setItems] = useState<PreOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create form
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cReady, setCReady] = useState(defaultReadyLocal);
  const [cNotes, setCNotes] = useState('');
  const [cSource, setCSource] = useState<'PHONE_CALL' | 'WHATSAPP' | 'WALK_IN'>('PHONE_CALL');
  const [cProductId, setCProductId] = useState('');
  const [cQty, setCQty] = useState('1');
  const [cLines, setCLines] = useState<
    Array<{ productId: string; productName: string; unitType: 'KG' | 'PCS'; qty: number }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [actionPo, setActionPo] = useState<PreOrderRow | null>(null);
  const [actionMode, setActionMode] = useState<'message' | 'cancel' | null>(null);
  const [actionText, setActionText] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/pre-orders');
      setItems(res.data?.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // Light poll while panel open
  useEffect(() => {
    if (!open) return;
    const t = setInterval(refresh, 45000);
    return () => clearInterval(t);
  }, [open, refresh]);

  const loadToCart = async (po: PreOrderRow) => {
    setBusyId(po.id);
    try {
      for (const it of po.items) {
        const product = it.product || products.find((p) => p.id === it.productId);
        const rate =
          it.pricePerUnit ??
          (product as any)?.pricePerUnit ??
          products.find((p) => p.id === it.productId)?.pricePerUnit ??
          0;
        const taxRate = product?.taxRate ?? 0;
        const unitType = (it.unitType || product?.unitType || 'KG') as 'KG' | 'PCS';
        const qtyKg = unitType === 'KG' ? Number(it.qtyKg) || 0 : undefined;
        const qtyPcs = unitType === 'PCS' ? Number(it.qtyPcs) || 0 : undefined;
        const qty = unitType === 'KG' ? qtyKg || 0 : qtyPcs || 0;
        if (!it.productId || qty <= 0) continue;
        const lineTotal = Math.round(qty * rate * 100) / 100;
        await addItem({
          productId: it.productId,
          productName: it.productName || product?.name || 'Item',
          qtyKg,
          qtyPcs,
          rate,
          taxRate,
          lineTotal,
          metaJson: {
            preOrderId: po.id,
            preOrderItemId: it.id,
            unitType,
            imageUrl: product?.imageUrl || null,
          },
        });
      }
      if (po.customerId || po.customerPhone) {
        setCustomer(
          po.customerId || null,
          po.customerPhone,
          po.customerName,
          null
        );
      }
      await loadCart();
      await api.patch(`/api/v1/pre-orders/${po.id}`, { status: 'CONFIRMED' });
      showNotification(
        `Loaded ${po.customerName}'s pre-order — adjust weight then bill`,
        'success',
        4500
      );
      await refresh();
      setOpen(false);
    } catch (e: any) {
      showNotification(e.response?.data?.error || 'Could not load pre-order', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (
    id: string,
    status: string,
    extra?: { cancelReason?: string; customerMessage?: string }
  ) => {
    setBusyId(id);
    try {
      await api.patch(`/api/v1/pre-orders/${id}`, { status, ...extra });
      await refresh();
    } catch (e: any) {
      showNotification(e.response?.data?.error || 'Update failed', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const submitAction = async () => {
    if (!actionPo || !actionMode) return;
    const text = actionText.trim();
    if (!text) {
      showNotification(
        actionMode === 'cancel' ? 'Enter why you are cancelling (customer will see it)' : 'Enter a message',
        'warning'
      );
      return;
    }
    setActionBusy(true);
    try {
      if (actionMode === 'cancel') {
        await api.patch(`/api/v1/pre-orders/${actionPo.id}`, {
          status: 'CANCELLED',
          cancelReason: text,
          customerMessage: text,
        });
        showNotification('Pre-order cancelled — customer can see it on tracker', 'success');
      } else {
        const res = await api.post(`/api/v1/pre-orders/${actionPo.id}/messages`, {
          message: text,
          visibleToCustomer: true,
        });
        showNotification('Message posted to live tracker', 'success');
        if (res.data?.whatsappUrl) {
          window.open(res.data.whatsappUrl, '_blank', 'noopener,noreferrer');
        }
      }
      setActionPo(null);
      setActionMode(null);
      setActionText('');
      await refresh();
    } catch (e: any) {
      showNotification(e.response?.data?.error || 'Failed', 'error');
    } finally {
      setActionBusy(false);
    }
  };

  const addCreateLine = () => {
    const p = products.find((x) => x.id === cProductId);
    if (!p) return;
    const qty = Number(cQty);
    if (!(qty > 0)) return;
    setCLines((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        unitType: p.unitType,
        qty,
      },
    ]);
    setCProductId('');
    setCQty('1');
  };

  const submitCreate = async () => {
    if (!cName.trim() || cPhone.replace(/\D/g, '').length < 10) {
      showNotification('Name and 10-digit phone required', 'warning');
      return;
    }
    if (cLines.length === 0) {
      showNotification('Add at least one item', 'warning');
      return;
    }
    setSaving(true);
    try {
      await api.post('/api/v1/pre-orders', {
        storeId: 'ignored',
        customerName: cName.trim(),
        customerPhone: cPhone,
        fulfillment: 'PICKUP',
        readyAt: cReady,
        notes: cNotes.trim() || null,
        source: cSource,
        items: cLines.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          unitType: l.unitType,
          qtyKg: l.unitType === 'KG' ? l.qty : null,
          qtyPcs: l.unitType === 'PCS' ? Math.round(l.qty) : null,
        })),
      });
      showNotification('Pre-order saved from call', 'success');
      setShowCreate(false);
      setCName('');
      setCPhone('');
      setCNotes('');
      setCLines([]);
      setCReady(defaultReadyLocal());
      await refresh();
      setOpen(true);
    } catch (e: any) {
      showNotification(e.response?.data?.error || 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = items.length;
  const canPortal = typeof document !== 'undefined';

  const overlays =
    canPortal &&
    createPortal(
      <>
        {open && (
          <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <Card className="w-full sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl">
              <div className="p-4 border-b flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold">Today&apos;s pre-orders</h2>
                  <p className="text-xs text-gray-500">Load to cart, then bill as usual</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="!py-1 !px-2 text-sm" onClick={refresh}>
                    Refresh
                  </Button>
                  <Button variant="ghost" className="!py-1 !px-2 text-sm" onClick={() => setOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
              <div className="overflow-y-auto p-3 space-y-2 flex-1">
                {loading && items.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Loading…</p>
                ) : items.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No pending bookings for today.
                    <br />
                    <button
                      type="button"
                      className="text-orange-700 underline mt-2"
                      onClick={() => {
                        setOpen(false);
                        setShowCreate(true);
                      }}
                    >
                      Book one from a phone call
                    </button>
                  </p>
                ) : (
                  items.map((po) => (
                    <div key={po.id} className="rounded-xl border p-3 space-y-2 bg-white/90">
                      <div className="flex justify-between gap-2">
                        <div>
                          <div className="font-semibold">{po.customerName}</div>
                          <div className="text-sm text-gray-600">{po.customerPhone}</div>
                          {po.trackingCode && (
                            <div className="text-xs font-mono text-orange-800 mt-0.5">
                              Track: {po.trackingCode}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-medium">{fmtReady(po.readyAt)}</div>
                          <div className="text-xs text-gray-500">
                            {po.source.replace('_', ' ')} · {po.status}
                          </div>
                        </div>
                      </div>
                      <ul className="text-sm text-gray-700 space-y-0.5">
                        {po.items.map((it) => (
                          <li key={it.id}>
                            {it.productName} —{' '}
                            {it.unitType === 'KG'
                              ? `${it.qtyKg} kg`
                              : `${it.qtyPcs} pcs`}
                          </li>
                        ))}
                      </ul>
                      {po.notes && (
                        <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-2 py-1">
                          {po.notes}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          className="!py-1 !px-3 text-sm"
                          disabled={busyId === po.id}
                          onClick={() => loadToCart(po)}
                        >
                          Load to cart
                        </Button>
                        <Button
                          variant="secondary"
                          className="!py-1 !px-3 text-sm"
                          disabled={busyId === po.id}
                          onClick={() => setStatus(po.id, 'CONFIRMED')}
                        >
                          Confirm
                        </Button>
                        <Button
                          variant="secondary"
                          className="!py-1 !px-3 text-sm"
                          disabled={busyId === po.id}
                          onClick={() => setStatus(po.id, 'READY')}
                        >
                          Mark ready
                        </Button>
                        <Button
                          variant="ghost"
                          className="!py-1 !px-3 text-sm"
                          disabled={busyId === po.id}
                          onClick={() => {
                            setActionPo(po);
                            setActionMode('message');
                            setActionText('');
                          }}
                        >
                          Message
                        </Button>
                        <Button
                          variant="ghost"
                          className="!py-1 !px-3 text-sm text-red-700"
                          disabled={busyId === po.id}
                          onClick={() => {
                            setActionPo(po);
                            setActionMode('cancel');
                            setActionText(
                              'Stock not available today — sorry for the inconvenience.'
                            );
                          }}
                        >
                          Cancel (no stock)
                        </Button>
                        <Button
                          variant="ghost"
                          className="!py-1 !px-3 text-sm"
                          disabled={busyId === po.id}
                          onClick={() => setStatus(po.id, 'NO_SHOW')}
                        >
                          No-show
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {actionPo && actionMode && (
          <div className="fixed inset-0 z-[10001] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-md space-y-3 p-4 shadow-2xl">
              <h3 className="text-lg font-bold">
                {actionMode === 'cancel' ? 'Cancel pre-order' : 'Message customer'}
              </h3>
              <p className="text-sm text-gray-600">
                {actionPo.customerName} · {actionPo.trackingCode || actionPo.id.slice(0, 8)}
              </p>
              <p className="text-xs text-gray-500">
                {actionMode === 'cancel'
                  ? 'Customer will see this reason on the live tracker. Use when stock is not available.'
                  : 'Posted on the live tracker. WhatsApp will open with the same text if possible.'}
              </p>
              <textarea
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder={
                  actionMode === 'cancel'
                    ? 'e.g. Curry cut finished for today — please try tomorrow'
                    : 'e.g. Running 20 min late due to rush — thank you for waiting'
                }
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setActionPo(null);
                    setActionMode(null);
                  }}
                >
                  Back
                </Button>
                <Button
                  variant={actionMode === 'cancel' ? 'danger' : 'primary'}
                  onClick={submitAction}
                  disabled={actionBusy}
                >
                  {actionBusy
                    ? 'Saving…'
                    : actionMode === 'cancel'
                      ? 'Cancel order'
                      : 'Send update'}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {showCreate && (
          <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto space-y-3 p-4 shadow-2xl">
              <h2 className="text-lg font-bold">Book from call / WhatsApp</h2>
              <p className="text-xs text-gray-500">
                Use your staff login. Customer does not need an account.
              </p>
              <div className="flex gap-2 text-sm">
                {(['PHONE_CALL', 'WHATSAPP', 'WALK_IN'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setCSource(s)}
                    className={`flex-1 py-1.5 rounded-lg border ${
                      cSource === s ? 'bg-orange-100 border-orange-400' : ''
                    }`}
                  >
                    {s === 'PHONE_CALL' ? 'Phone' : s === 'WHATSAPP' ? 'WhatsApp' : 'Walk-in'}
                  </button>
                ))}
              </div>
              <input
                placeholder="Customer name"
                value={cName}
                onChange={(e) => setCName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <input
                placeholder="Phone"
                inputMode="numeric"
                value={cPhone}
                onChange={(e) => setCPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <div>
                <label className="text-sm font-medium">Ready by</label>
                <input
                  type="datetime-local"
                  value={cReady}
                  onChange={(e) => setCReady(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg mt-1"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={cProductId}
                  onChange={(e) => setCProductId(e.target.value)}
                  className="flex-1 px-2 py-2 border rounded-lg text-sm"
                >
                  <option value="">Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={cQty}
                  onChange={(e) => setCQty(e.target.value)}
                  className="w-20 px-2 py-2 border rounded-lg"
                />
                <Button type="button" variant="secondary" onClick={addCreateLine}>
                  Add
                </Button>
              </div>
              {cLines.length > 0 && (
                <ul className="text-sm space-y-1">
                  {cLines.map((l, i) => (
                    <li key={`${l.productId}-${i}`} className="flex justify-between">
                      <span>
                        {l.productName} · {l.qty} {l.unitType === 'KG' ? 'kg' : 'pcs'}
                      </span>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => setCLines((prev) => prev.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <textarea
                placeholder="Notes"
                value={cNotes}
                onChange={(e) => setCNotes(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                rows={2}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button onClick={submitCreate} disabled={saving}>
                  {saving ? 'Saving…' : 'Save pre-order'}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </>,
      document.body
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative px-2.5 py-2 sm:px-3 rounded-xl bg-orange-100 text-orange-900 text-xs sm:text-sm font-medium hover:bg-orange-200"
      >
        Pre-orders
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center">
            {pendingCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          setShowCreate(true);
          setOpen(false);
        }}
        className="px-2.5 py-2 sm:px-3 rounded-xl bg-white/80 border text-xs sm:text-sm font-medium hover:bg-white"
      >
        Book from call
      </button>
      {overlays}
    </>
  );
}
