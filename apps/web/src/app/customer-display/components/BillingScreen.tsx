"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatINR, formatINR2 } from "@/lib/customerDisplay/brand";
import BrandMark from "@/components/customerDisplay/BrandMark";
import type { BillUpdatePayload, DisplayLineItem, DraftFieldKey } from "@/lib/customerDisplay/types";
import CustomerInfoPanel, { type CustomerInfoValues } from "./CustomerInfoPanel";

function qtyLabel(item: DisplayLineItem): string {
  if (item.qtyKg != null && item.qtyKg > 0) return `${item.qtyKg.toFixed(2)} kg`;
  if (item.qtyPcs != null && item.qtyPcs > 0)
    return `${item.qtyPcs} pc${item.qtyPcs === 1 ? "" : "s"}`;
  return "-";
}

function lineKey(item: DisplayLineItem, i: number): string {
  return `${item.name}-${item.rate}-${i}`;
}

export default function BillingScreen({
  bill,
  customerInfo,
  activeField,
  onTapField,
  onSaveCustomerInfo,
  saveState,
}: {
  bill: BillUpdatePayload;
  customerInfo: CustomerInfoValues;
  activeField: DraftFieldKey | null;
  onTapField: (field: DraftFieldKey) => void;
  onSaveCustomerInfo: () => void;
  saveState: "idle" | "sent" | "error";
}) {
  const hasItems = bill.items.length > 0;
  const [panelOpen, setPanelOpen] = useState(false);

  // Someone (either side) started editing a field — surface the panel so
  // the context is visible, instead of leaving it collapsed underneath.
  useEffect(() => {
    if (activeField) setPanelOpen(true);
  }, [activeField]);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-br from-[#fffaf4] via-white to-[#fff1e6] text-slate-900">
      {/* Header */}
      <div className="border-b border-orange-100 bg-white/75 px-8 py-4 backdrop-blur sm:px-10 sm:py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
        <BrandMark
          logoSizeClass="h-12 w-12 sm:h-14 sm:w-14"
          nameSizeClass="text-xl sm:text-2xl"
          badgePadClass="p-2"
          nameColorClass="text-slate-800"
        />
        <div className="text-right">
          {bill.customerName ? (
            <p className="text-lg font-extrabold text-slate-800 sm:text-xl">
              {bill.customerName}
            </p>
          ) : (
            <p className="text-base font-bold text-slate-600">New bill</p>
          )}
          <p className="mt-0.5 text-sm font-medium text-slate-400">
            {bill.invoiceNo ? `Bill ${bill.invoiceNo}` : "Your order"}
          </p>
        </div>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-hidden px-6 py-4 sm:px-10 sm:py-5">
        <div className="mx-auto flex h-full max-w-6xl flex-col">
        {!hasItems ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <motion.div
              className="mb-6"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <BrandMark
                logoSizeClass="h-24 w-24"
                badgePadClass="p-3"
                showName={false}
              />
            </motion.div>
            <p className="text-2xl font-bold text-slate-500">
              Your order will appear here
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Column heads */}
            <div className="grid grid-cols-12 gap-2 px-4 pb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400 sm:px-5">
              <div className="col-span-6">Your items</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {bill.items.map((item, i) => (
                  <motion.div
                    key={lineKey(item, i)}
                    layout
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.25 }}
                    className="grid grid-cols-12 items-center gap-2 rounded-2xl border border-orange-100 bg-white px-4 py-3.5 shadow-sm sm:px-5"
                  >
                    <div className="col-span-6 truncate text-lg font-extrabold text-slate-800 sm:text-xl">
                      {item.name}
                    </div>
                    <div className="col-span-2 text-right text-sm font-bold text-slate-600 sm:text-base">
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[#a92e21]">
                        {qtyLabel(item)}
                      </span>
                    </div>
                    <div className="col-span-2 text-right text-base font-semibold text-slate-500 sm:text-lg">
                      {formatINR(item.rate)}
                    </div>
                    <div className="col-span-2 text-right text-lg font-black text-slate-900 sm:text-xl">
                      {formatINR(item.lineTotal)}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Totals */}
      <div className="border-t border-orange-100 bg-white/90 px-6 py-4 shadow-[0_-8px_30px_rgba(154,27,27,0.06)] sm:px-10 sm:py-5">
        <div className="mx-auto grid max-w-6xl items-end gap-4 sm:grid-cols-[1fr_minmax(290px,360px)]">
          <div className="flex min-h-[68px] items-center justify-between gap-4 rounded-2xl border border-[#ead9cf] bg-[#fffaf6] px-4 py-3 sm:px-5">
            <div>
              <p className="text-base font-extrabold text-[#7a554a] sm:text-lg">
                Earn {bill.loyaltyPointsEst} loyalty {bill.loyaltyPointsEst === 1 ? "point" : "points"}
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-500">
                Add your mobile number to collect rewards
              </p>
            </div>
            <CustomerInfoTrigger bill={bill} customerInfo={customerInfo} onTap={() => setPanelOpen((v) => !v)} />
          </div>
          <div className="rounded-2xl border border-[#ead9cf] bg-[#f4e8e0] px-5 py-3.5 text-slate-800 shadow-lg shadow-[#8f6758]/10">
            <div className="flex items-center justify-between text-sm font-medium text-slate-500">
              <span>Subtotal</span>
              <span>{formatINR2(bill.subTotal)}</span>
            </div>
            {bill.tax > 0 && <Row label="Tax" value={formatINR2(bill.tax)} muted />}
            {bill.deliveryFee > 0 && <Row label="Delivery" value={formatINR2(bill.deliveryFee)} muted />}
            {bill.discount > 0 && (
              <Row label="Discount" value={`- ${formatINR2(bill.discount)}`} highlight="text-emerald-700" />
            )}
            {bill.loyaltyDiscount > 0 && (
              <Row label="Loyalty discount" value={`- ${formatINR2(bill.loyaltyDiscount)}`} highlight="text-emerald-700" />
            )}
            <div className="mt-2 flex items-center justify-between border-t border-[#ddc9bd] pt-2">
              <span className="text-xl font-extrabold text-[#61453d] sm:text-2xl">Total</span>
              <motion.span
                key={bill.grandTotal}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.35 }}
                className="text-3xl font-black text-[#61453d] sm:text-4xl"
              >
                {formatINR(bill.grandTotal)}
              </motion.span>
            </div>
            {bill.savings > 0 && (
                <p className="mt-1 text-right text-xs font-bold text-emerald-700">
                You saved {formatINR(bill.savings)}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Customer-info panel — collapsed pill by default, expands on tap
          (or automatically once either side starts editing a field). */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-28 right-8 z-30 w-[300px] sm:w-[340px]"
          >
            <CustomerInfoPanel
              values={customerInfo}
              activeField={activeField}
              onTapField={onTapField}
              onSave={onSaveCustomerInfo}
              saveState={saveState}
              onClose={() => setPanelOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CustomerInfoTrigger({
  bill,
  customerInfo,
  onTap,
}: {
  bill: BillUpdatePayload;
  customerInfo: CustomerInfoValues;
  onTap: () => void;
}) {
  const filled = Boolean(customerInfo.phone || customerInfo.name);

  if (filled) {
    return (
      <button
        type="button"
        onClick={onTap}
        className="shrink-0 rounded-xl border border-[#dec5b8] bg-white px-3 py-2 text-sm font-extrabold text-[#7a554a] shadow-sm transition active:scale-95"
      >
        {customerInfo.name || customerInfo.phone}
      </button>
    );
  }
  if (bill.profileNudge === "add_phone") {
    return (
      <button
        type="button"
        onClick={onTap}
        className="shrink-0 rounded-xl bg-[#b98269] px-3 py-2 text-sm font-extrabold text-white shadow-sm transition active:scale-95"
      >
        Add phone · earn {bill.loyaltyPointsEst} pts (1.25% back)
      </button>
    );
  }
  if (bill.profileNudge === "add_address") {
    return (
      <button
        type="button"
        onClick={onTap}
        className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-extrabold text-emerald-700 transition active:scale-95"
      >
        Add your address & get 10% off
      </button>
    );
  }
  if (bill.profileNudge === "reward_ready") {
    return (
      <button
        type="button"
        onClick={onTap}
        className="shrink-0 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-extrabold text-emerald-700 transition active:scale-95"
      >
        {bill.profileRewardApplied ? "10% off applied!" : "10% saved for your next visit"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onTap}
        className="shrink-0 rounded-xl border border-[#dec5b8] bg-white px-3 py-2 text-sm font-extrabold text-[#7a554a] transition active:scale-95"
    >
      + {bill.loyaltyPointsEst} loyalty points
    </button>
  );
}

function Row({
  label,
  value,
  muted,
  highlight,
}: {
  label: string;
  value: string;
  muted?: boolean;
  highlight?: string;
}) {
  return (
    <div className="mt-1 flex items-center justify-between text-xs sm:text-sm">
      <span className={muted ? "text-slate-500" : "text-slate-700"}>{label}</span>
      <span className={highlight || "text-slate-700"}>{value}</span>
    </div>
  );
}
