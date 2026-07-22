'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { publishPaymentMode } from '@/lib/customerDisplay/publishHelpers';
import type { PendingSettlementLine } from '@/lib/pendingCreditCheckout';

export interface CartPaymentModalProps {
  /** Amount to collect (cart + optional pending credit). */
  grandTotal: number;
  /** Today's cart-only total — shown as a line when pending credit is included. */
  cartGrandTotal?: number;
  pendingSettlementLines?: PendingSettlementLine[];
  subTotal: number;
  taxTotal: number;
  discountTotal: number;
  deliveryFee: number;
  setDeliveryFee: (fee: number) => void;
  fulfillmentType: 'PICKUP' | 'DELIVERY';
  setFulfillmentType: (t: 'PICKUP' | 'DELIVERY') => void;
  customerId: string | null;
  onClose: () => void;
  onPay: (payments: Array<{ method: string; amount: number }>) => void;
  isProcessing?: boolean;
}

export default function CartPaymentModal({
  grandTotal,
  cartGrandTotal,
  pendingSettlementLines = [],
  subTotal,
  taxTotal,
  discountTotal,
  deliveryFee,
  setDeliveryFee,
  fulfillmentType,
  setFulfillmentType,
  customerId,
  onClose,
  onPay,
  isProcessing = false,
}: CartPaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState('CASH');
  const selectedMethodRef = useRef(selectedMethod);
  selectedMethodRef.current = selectedMethod;
  const [amountPaid, setAmountPaid] = useState(grandTotal.toString());
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState<Array<{ method: string; amount: number }>>([]);
  const [splitError, setSplitError] = useState<string | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const payingRef = useRef(false);

  const roundMoney = (n: number) => Math.round(n * 100) / 100;

  useEffect(() => {
    if (!isProcessing) {
      payingRef.current = false;
    }
  }, [isProcessing]);

  useEffect(() => {
    if (!isSplitPayment) {
      setAmountPaid(grandTotal.toString());
    }
  }, [grandTotal, isSplitPayment]);

  const change = parseFloat(amountPaid) - grandTotal;
  const splitTotal = roundMoney(splitPayments.reduce((sum, p) => sum + p.amount, 0));
  const splitRemaining = roundMoney(Math.max(0, grandTotal - splitTotal));
  const splitIsComplete =
    splitPayments.length > 0 && Math.abs(splitTotal - grandTotal) <= 0.05;

  // Drive customer display: cash/card/credit = no UPI QR; UPI = QR; split = UPI portion only.
  useEffect(() => {
    if (isSplitPayment) {
      publishPaymentMode(grandTotal, null, {
        payments: splitPayments.length > 0 ? splitPayments : undefined,
      });
      return;
    }
    const amount =
      selectedMethod === 'CREDIT'
        ? grandTotal
        : Math.min(parseFloat(amountPaid) || grandTotal, grandTotal);
    publishPaymentMode(grandTotal, null, {
      payments: [{ method: selectedMethod, amount: amount > 0 ? amount : grandTotal }],
    });
  }, [grandTotal, selectedMethod, isSplitPayment, splitPayments, amountPaid]);

  const paymentMethods = [
    { value: 'CASH', label: 'Cash', icon: '💵', key: '1' },
    { value: 'CARD', label: 'Card', icon: '💳', key: '2' },
    { value: 'UPI', label: 'UPI', icon: '📱', key: '3' },
    { value: 'CREDIT', label: 'Credit', icon: '📝', key: '4' },
    { value: 'ONLINE', label: 'Online', icon: '🌐', key: '5' },
  ];

  const handlePayment = useCallback(() => {
    if (isProcessing || payingRef.current) return;

    if (isSplitPayment) {
      if (splitPayments.length === 0) {
        setSplitError('Add each payment method and amount, then pay');
        return;
      }
      if (!splitIsComplete) {
        setSplitError(
          `Split is ₹${splitTotal.toFixed(2)} — must equal bill ₹${grandTotal.toFixed(2)} (remaining ₹${splitRemaining.toFixed(2)})`
        );
        return;
      }
      setSplitError(null);
      payingRef.current = true;
      onPay(splitPayments.map((p) => ({ method: p.method, amount: roundMoney(p.amount) })));
      return;
    }

    const method = selectedMethodRef.current;
    payingRef.current = true;
    onPay([
      {
        method,
        amount:
          method === 'CREDIT' ? grandTotal : parseFloat(amountPaid) || grandTotal,
      },
    ]);
  }, [
    isProcessing,
    isSplitPayment,
    splitIsComplete,
    splitTotal,
    splitRemaining,
    grandTotal,
    splitPayments,
    amountPaid,
    onPay,
  ]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if ((e.target as HTMLElement).tagName === 'SELECT') return;

      if (e.key === 'Escape') {
        if (!isProcessing) onClose();
      } else if (e.key === 'Enter') {
        if (!isProcessing) handlePayment();
      } else if (e.key >= '1' && e.key <= '5') {
        const methods = ['CASH', 'CARD', 'UPI', 'CREDIT', 'ONLINE'];
        const next = methods[parseInt(e.key, 10) - 1];
        selectedMethodRef.current = next;
        setSelectedMethod(next);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isProcessing, onClose, handlePayment]);

  const quickAmounts = [
    { label: 'Exact', value: grandTotal },
    { label: `₹${Math.ceil(grandTotal / 100) * 100}`, value: Math.ceil(grandTotal / 100) * 100 },
    { label: '₹100', value: 100 },
    { label: '₹500', value: 500 },
    { label: '₹1000', value: 1000 },
    { label: '₹2000', value: 2000 },
  ];

  const handleQuickAmount = (amount: number) => {
    setAmountPaid(amount.toString());
    amountInputRef.current?.focus();
  };

  const toggleSplitPayment = () => {
    const next = !isSplitPayment;
    setIsSplitPayment(next);
    setSplitPayments([]);
    setSplitError(null);
    // Empty amount in split mode so the first "Add" does not take the full bill.
    setAmountPaid(next ? '' : grandTotal.toString());
    if (next) {
      setTimeout(() => amountInputRef.current?.focus(), 50);
    }
  };

  const addSplitPayment = () => {
    setSplitError(null);
    if (splitRemaining <= 0.01) {
      setSplitError('Bill is already fully split');
      return;
    }
    const parsed = parseFloat(amountPaid);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setSplitError('Enter how much for this method, then tap Add');
      amountInputRef.current?.focus();
      return;
    }
    const amount = roundMoney(Math.min(parsed, splitRemaining));
    if (amount <= 0) {
      setSplitError('Amount must be greater than zero');
      return;
    }
    const next = [...splitPayments, { method: selectedMethod, amount }];
    setSplitPayments(next);
    const remaining = roundMoney(grandTotal - next.reduce((s, p) => s + p.amount, 0));
    // Prefill remaining for the next method (cashier can edit).
    setAmountPaid(remaining > 0.01 ? remaining.toFixed(2) : '');
    amountInputRef.current?.focus();
  };

  const addSplitRemaining = () => {
    if (splitRemaining <= 0.01) return;
    setSplitError(null);
    const amount = splitRemaining;
    const next = [...splitPayments, { method: selectedMethod, amount }];
    setSplitPayments(next);
    setAmountPaid('');
  };

  const removeSplitPayment = (index: number) => {
    const next = splitPayments.filter((_, i) => i !== index);
    setSplitPayments(next);
    setSplitError(null);
    const remaining = roundMoney(grandTotal - next.reduce((s, p) => s + p.amount, 0));
    setAmountPaid(remaining > 0.01 ? remaining.toFixed(2) : '');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[95vh] overflow-y-auto border border-gray-200/50 dark:border-gray-700/50 animate-scale-in">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-5 py-4 flex items-center justify-between z-10 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Checkout</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Press 1-5 for method • Enter to confirm</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 disabled:opacity-50 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider">Fulfillment</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setFulfillmentType('PICKUP')}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 touch-target ${
                fulfillmentType === 'PICKUP'
                  ? 'bg-brand-600 text-white shadow-lg scale-[1.02]'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Pickup
            </button>
            <button
              type="button"
              onClick={() => customerId && setFulfillmentType('DELIVERY')}
              disabled={!customerId}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 touch-target disabled:opacity-50 disabled:cursor-not-allowed ${
                fulfillmentType === 'DELIVERY'
                  ? 'bg-brand-600 text-white shadow-lg scale-[1.02]'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={!customerId ? 'Select a customer for delivery' : ''}
            >
              Delivery
            </button>
          </div>
          {!customerId && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5">
              Walk-in orders are pickup only. Select a customer for delivery.
            </p>
          )}
          {fulfillmentType === 'DELIVERY' && customerId && (
            <>
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Delivery fee (₹)
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={deliveryFee || ''}
                  onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                  disabled={isProcessing}
                  className="w-full px-3 py-2 text-sm font-semibold border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-right focus:ring-2 focus:ring-brand-500"
                  placeholder="0"
                />
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
                Fee is included in the total. Add address in Delivery after checkout.
              </p>
            </>
          )}
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-gradient-to-br from-brand-50 to-brand-100/50 dark:from-brand-900/20 dark:to-brand-800/10 border border-brand-200/50 dark:border-brand-800/30 rounded-xl p-4 transition-all duration-200">
            {(cartGrandTotal != null && cartGrandTotal !== grandTotal) || pendingSettlementLines.some((l) => l.selected && l.amount > 0) ? (
              <div className="space-y-1.5 mb-3 pb-3 border-b border-brand-200/60 dark:border-brand-800/40">
                {cartGrandTotal != null && (
                  <div className="flex justify-between text-xs text-gray-700 dark:text-gray-300">
                    <span>Today&apos;s items</span>
                    <span className="font-semibold">₹{cartGrandTotal}</span>
                  </div>
                )}
                {pendingSettlementLines
                  .filter((l) => l.selected && l.amount > 0)
                  .map((l) => (
                    <div key={l.saleId} className="flex justify-between text-xs text-amber-800 dark:text-amber-300">
                      <span>Credit bill #{l.saleNo}</span>
                      <span className="font-semibold">₹{Math.round(l.amount)}</span>
                    </div>
                  ))}
              </div>
            ) : null}
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">Total</span>
              <span className="text-2xl font-bold text-brand-600 dark:text-brand-400">₹{grandTotal}</span>
            </div>
            <div className={`grid gap-1.5 text-[10px] ${deliveryFee > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <div className="text-center p-1.5 bg-white/50 dark:bg-gray-800/50 rounded">
                <div className="text-gray-500 dark:text-gray-400">Sub</div>
                <div className="font-semibold text-xs">₹{Math.round(subTotal)}</div>
              </div>
              <div className="text-center p-1.5 bg-white/50 dark:bg-gray-800/50 rounded">
                <div className="text-gray-500 dark:text-gray-400">Tax</div>
                <div className="font-semibold text-xs">₹{Math.round(taxTotal)}</div>
              </div>
              <div className="text-center p-1.5 bg-white/50 dark:bg-gray-800/50 rounded">
                <div className="text-gray-500 dark:text-gray-400">Disc</div>
                <div className="font-semibold text-xs text-red-600">-₹{Math.round(discountTotal)}</div>
              </div>
              {deliveryFee > 0 && (
                <div className="text-center p-1.5 bg-white/50 dark:bg-gray-800/50 rounded">
                  <div className="text-gray-500 dark:text-gray-400">Del</div>
                  <div className="font-semibold text-xs">₹{Math.round(deliveryFee)}</div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Split Payment</span>
              {isSplitPayment && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  Add each method + amount (e.g. Cash ₹500, then UPI rest)
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={toggleSplitPayment}
              disabled={isProcessing}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                isSplitPayment ? 'bg-brand-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  isSplitPayment ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {!isSplitPayment && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-5 gap-2">
                {paymentMethods.map((method) => (
                  <button
                    type="button"
                    key={method.value}
                    onClick={() => {
                      selectedMethodRef.current = method.value;
                      setSelectedMethod(method.value);
                    }}
                    disabled={isProcessing}
                    className={`relative p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105 active:scale-95 ${
                      selectedMethod === method.value
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-lg scale-105'
                        : 'border-gray-200 dark:border-gray-600 hover:border-brand-300 dark:hover:border-brand-700'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xl">{method.icon}</span>
                      <span className="font-semibold text-[10px] text-gray-900 dark:text-white leading-tight">
                        {method.label}
                      </span>
                      <span className="absolute top-0.5 right-0.5 text-[8px] font-mono bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">
                        {method.key}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSplitPayment && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Add Payment
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={selectedMethod}
                    onChange={(e) => setSelectedMethod(e.target.value)}
                    disabled={isProcessing || splitRemaining <= 0.01}
                    className="flex-1 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg"
                  >
                    {paymentMethods.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.icon} {m.label}
                      </option>
                    ))}
                  </select>
                  <input
                    ref={amountInputRef}
                    type="number"
                    value={amountPaid}
                    onChange={(e) => {
                      setAmountPaid(e.target.value);
                      setSplitError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSplitPayment();
                      }
                    }}
                    placeholder={`₹${splitRemaining.toFixed(2)}`}
                    disabled={isProcessing || splitRemaining <= 0.01}
                    className="w-28 px-2 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg text-right font-semibold"
                    min={0}
                    step="0.01"
                  />
                  <button
                    type="button"
                    onClick={addSplitPayment}
                    disabled={isProcessing || splitRemaining <= 0.01}
                    className="px-3 py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                {splitRemaining > 0.01 && (
                  <button
                    type="button"
                    onClick={addSplitRemaining}
                    disabled={isProcessing}
                    className="mt-1.5 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    Add remaining ₹{splitRemaining.toFixed(2)} as {selectedMethod}
                  </button>
                )}
              </div>

              {splitError && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  {splitError}
                </div>
              )}

              {splitPayments.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2 space-y-1.5 max-h-32 overflow-y-auto">
                  {splitPayments.map((payment, index) => (
                    <div
                      key={`${payment.method}-${index}`}
                      className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {paymentMethods.find((m) => m.value === payment.method)?.icon}
                        </span>
                        <div>
                          <div className="font-semibold text-xs text-gray-900 dark:text-white">{payment.method}</div>
                          <div className="text-[10px] text-gray-500">₹{payment.amount.toFixed(2)}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSplitPayment(index)}
                        disabled={isProcessing}
                        className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-1.5 border-t border-gray-200 dark:border-gray-600">
                    <span className="text-xs font-semibold">
                      {splitIsComplete ? 'Ready to pay' : 'Remaining:'}
                    </span>
                    <span
                      className={`text-base font-bold ${splitRemaining > 0.01 ? 'text-orange-600' : 'text-green-600'}`}
                    >
                      {splitIsComplete ? `₹${splitTotal.toFixed(2)}` : `₹${splitRemaining.toFixed(2)}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isSplitPayment && selectedMethod !== 'CREDIT' && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Amount Paid
                </label>
                <input
                  ref={amountInputRef}
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full px-3 py-2.5 text-xl font-bold border-2 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-right"
                  step="0.01"
                  min="0"
                  placeholder={grandTotal.toString()}
                  autoFocus
                />
              </div>

              <div>
                <div className="grid grid-cols-6 gap-1.5">
                  {quickAmounts.map((quick, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => handleQuickAmount(quick.value)}
                      className="px-2 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-brand-100 dark:hover:bg-brand-900/30 rounded text-[10px] font-semibold transition-colors"
                    >
                      {quick.label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedMethod !== 'CREDIT' && (
                <>
                  {change >= 0 ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-green-800 dark:text-green-300">Change</span>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">
                          ₹{Math.round(change)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-red-800 dark:text-red-300">Short</span>
                        <span className="text-lg font-bold text-red-600 dark:text-red-400">
                          ₹{Math.round(Math.abs(change))}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!isSplitPayment && selectedMethod === 'CREDIT' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">Credit</span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">₹{Math.round(grandTotal)}</span>
              </div>
              <p className="text-[10px] text-blue-600 dark:text-blue-400">Customer will pay later</p>
              {!customerId && (
                <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-2 font-medium">
                  Add customer (phone & name) before placing a credit bill.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 text-sm border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white font-semibold transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePayment}
              disabled={
                isProcessing ||
                (isSplitPayment && !splitIsComplete) ||
                (!isSplitPayment && selectedMethod !== 'CREDIT' && change < 0) ||
                (!isSplitPayment && selectedMethod === 'CREDIT' && !customerId)
              }
              className="flex-2 px-6 py-3 text-sm bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isProcessing ? (
                <span>Processing...</span>
              ) : isSplitPayment ? (
                <span>
                  {splitIsComplete
                    ? `Pay split ₹${splitTotal.toFixed(2)}`
                    : `Add ₹${splitRemaining.toFixed(2)} more`}
                </span>
              ) : selectedMethod === 'CREDIT' ? (
                <span>Credit ₹{grandTotal}</span>
              ) : (
                <span>Pay ₹{Math.round(parseFloat(amountPaid) || grandTotal)}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
