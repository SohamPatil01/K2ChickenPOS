'use client';

import { useState, useEffect } from 'react';
import { resolveSaleDeliveryFee } from '@azela-pos/shared';
import type { Sale } from '../hooks/useCashierSales';

export interface SaleEditPayload {
  items: Array<{
    productId: string;
    qtyKg?: number;
    qtyPcs?: number;
    rate: number;
    taxRate: number;
  }>;
  discountTotal: number;
  subTotal: number;
  taxTotal: number;
  grandTotal: number;
}

interface SaleDetailPanelProps {
  sale: Sale;
  products: any[];
  mode: 'view' | 'edit';
  onSave: (payload: SaleEditPayload) => Promise<void>;
  onClose: () => void;
  onSwitchToEdit?: () => void;
  saving?: boolean;
}

interface EditItem {
  id: string;
  productId: string;
  productName: string;
  qtyKg?: number;
  qtyPcs?: number;
  rate: number;
  taxRate: number;
}

function calculateTotals(
  items: EditItem[],
  discountTotal: number,
  deliveryFee: number = 0
): { subTotal: number; taxTotal: number; grandTotal: number } {
  let subTotal = 0;
  let taxTotal = 0;
  items.forEach((item) => {
    const qty = item.qtyKg ?? item.qtyPcs ?? 0;
    const lineTotal = qty * item.rate;
    subTotal += lineTotal;
    taxTotal += lineTotal * (item.taxRate / 100);
  });
  subTotal = Math.round(subTotal * 100) / 100;
  taxTotal = Math.round(taxTotal * 100) / 100;
  const discount = Number(discountTotal) || 0;
  const grandTotal = Math.round((subTotal + taxTotal - discount + deliveryFee) * 100) / 100;
  return { subTotal, taxTotal, grandTotal: Math.round(grandTotal) };
}

export default function SaleDetailPanel({
  sale,
  products,
  mode,
  onSave,
  onClose,
  onSwitchToEdit,
  saving = false,
}: SaleDetailPanelProps) {
  const [editForm, setEditForm] = useState({
    discountTotal: '0',
    items: [] as EditItem[],
  });

  useEffect(() => {
    if (mode === 'edit') {
      setEditForm({
        discountTotal: String(sale.discountTotal ?? 0),
        items: sale.items.map((item) => ({
          id: item.id,
          productId: item.product.id,
          productName: item.product.name,
          qtyKg: item.qtyKg,
          qtyPcs: item.qtyPcs,
          rate: item.rate,
          taxRate: item.taxRate,
        })),
      });
    }
  }, [mode, sale]);

  const handleAddItem = () => {
    setEditForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: '',
          productId: '',
          productName: '',
          qtyKg: undefined,
          qtyPcs: undefined,
          rate: 0,
          taxRate: 0,
        },
      ],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateItem = (index: number, field: string, value: string | number) => {
    setEditForm((prev) => {
      const newItems = [...prev.items];
      if (field === 'productId') {
        const product = products.find((p: any) => p.id === value);
        newItems[index] = {
          ...newItems[index],
          productId: String(value),
          productName: product?.name || '',
          rate: product?.pricePerUnit || 0,
          taxRate: product?.taxRate || 0,
        };
      } else {
        (newItems[index] as any)[field] = value;
      }
      return { ...prev, items: newItems };
    });
  };

  const handleSubmit = async () => {
    const invalid = editForm.items.filter(
      (item) => !item.productId || ((item.qtyKg == null || item.qtyKg === 0) && (item.qtyPcs == null || item.qtyPcs === 0)) || item.rate <= 0
    );
    if (invalid.length > 0) return;
    const { subTotal, taxTotal, grandTotal } = calculateTotals(
      editForm.items,
      parseFloat(editForm.discountTotal) || 0
    );
    await onSave({
      items: editForm.items.map((item) => ({
        productId: item.productId,
        qtyKg: item.qtyKg,
        qtyPcs: item.qtyPcs,
        rate: item.rate,
        taxRate: item.taxRate,
      })),
      discountTotal: parseFloat(editForm.discountTotal) || 0,
      subTotal,
      taxTotal,
      grandTotal,
    });
  };

  const panelClass =
    'fixed inset-0 md:inset-y-0 md:right-0 md:left-auto w-full md:w-[400px] max-w-full z-50 flex flex-col bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700';

  if (mode === 'view') {
    return (
      <div className={panelClass}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-semibold dark:text-white">Bill - {sale.saleNo}</h3>
          <div className="flex items-center gap-2">
            {onSwitchToEdit && (
              <button
                type="button"
                onClick={onSwitchToEdit}
                className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Customer</p>
            <p className="font-medium dark:text-white">{sale.customer?.name || 'Walk-in'}</p>
            {sale.customer?.phone && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{sale.customer.phone}</p>
            )}
            {sale.customer?.area && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Area: {sale.customer.area}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Items</p>
            <div className="space-y-2">
              {sale.items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="flex justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium dark:text-white">{item.product.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {item.qtyKg != null ? `${item.qtyKg} kg` : `${item.qtyPcs ?? 0} pcs`} × ₹{item.rate}
                    </p>
                  </div>
                  <p className="font-medium dark:text-white">₹{item.lineTotal.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
          {(sale.payments?.length ?? 0) > 0 && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Payments</p>
              <div className="space-y-1">
                {sale.payments!.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">{p.method}</span>
                    <span className="dark:text-white">₹{p.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
              <span className="font-medium dark:text-white">₹{sale.subTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Tax</span>
              <span className="font-medium dark:text-white">₹{sale.taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Discount</span>
              <span className="font-medium dark:text-white">₹{sale.discountTotal.toFixed(2)}</span>
            </div>
            {(() => {
              const fee = resolveSaleDeliveryFee(sale);
              return fee > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Delivery fee</span>
                  <span className="font-medium dark:text-white">₹{fee.toFixed(2)}</span>
                </div>
              ) : null;
            })()}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="dark:text-white">Total</span>
              <span className="dark:text-white">₹{sale.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const saleDeliveryFee = resolveSaleDeliveryFee(sale);
  const { subTotal, taxTotal, grandTotal } = calculateTotals(
    editForm.items,
    parseFloat(editForm.discountTotal) || 0,
    saleDeliveryFee
  );

  return (
    <div className={panelClass}>
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
        <h3 className="text-lg font-semibold dark:text-white">Edit Bill - {sale.saleNo}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Items</label>
          <div className="space-y-3">
            {editForm.items.map((item, index) => (
              <div
                key={index}
                className="flex flex-col sm:flex-row gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <select
                  value={item.productId}
                  onChange={(e) => handleUpdateItem(index, 'productId', e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">Select product</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {products.find((p: any) => p.id === item.productId)?.unitType === 'KG' ? (
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Kg"
                    value={item.qtyKg ?? ''}
                    onChange={(e) => handleUpdateItem(index, 'qtyKg', parseFloat(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  />
                ) : (
                  <input
                    type="number"
                    placeholder="Pcs"
                    value={item.qtyPcs ?? ''}
                    onChange={(e) => handleUpdateItem(index, 'qtyPcs', parseInt(e.target.value, 10) || 0)}
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  />
                )}
                <input
                  type="number"
                  step="0.01"
                  placeholder="Rate"
                  value={item.rate}
                  onChange={(e) => handleUpdateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddItem}
              className="w-full px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-brand-500 hover:text-brand-600 dark:hover:text-brand-400 text-sm font-medium"
            >
              + Add item
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Discount</label>
          <input
            type="number"
            step="0.01"
            value={editForm.discountTotal}
            onChange={(e) => setEditForm((prev) => ({ ...prev, discountTotal: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
            <span className="font-medium dark:text-white">₹{subTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Tax</span>
            <span className="font-medium dark:text-white">₹{taxTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Discount</span>
            <span className="font-medium dark:text-white">₹{(parseFloat(editForm.discountTotal) || 0).toFixed(2)}</span>
          </div>
          {saleDeliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Delivery fee</span>
              <span className="font-medium dark:text-white">₹{saleDeliveryFee.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-300 dark:border-gray-600">
            <span className="dark:text-white">Total</span>
            <span className="dark:text-white">₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || editForm.items.length === 0}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
