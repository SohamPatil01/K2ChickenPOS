"use client";

import { motion, AnimatePresence } from "framer-motion";
import { BRAND, formatINR, formatINR2 } from "@/lib/customerDisplay/brand";
import type { BillUpdatePayload, DisplayLineItem } from "@/lib/customerDisplay/types";

function qtyLabel(item: DisplayLineItem): string {
  if (item.qtyKg != null && item.qtyKg > 0) return `${item.qtyKg.toFixed(2)} kg`;
  if (item.qtyPcs != null && item.qtyPcs > 0)
    return `${item.qtyPcs} pc${item.qtyPcs === 1 ? "" : "s"}`;
  return "-";
}

function lineKey(item: DisplayLineItem, i: number): string {
  return `${item.name}-${item.rate}-${i}`;
}

export default function BillingScreen({ bill }: { bill: BillUpdatePayload }) {
  const hasItems = bill.items.length > 0;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-8 py-5">
        <div className="flex items-center gap-4">
          <img
            src={BRAND.logoPath}
            alt={BRAND.name}
            className="h-12 w-12 object-contain sm:h-14 sm:w-14"
          />
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              {BRAND.name}
            </h1>
            <p className="text-sm text-white/50">Your order</p>
          </div>
        </div>
        <div className="text-right">
          {bill.customerName ? (
            <p className="text-lg font-semibold text-amber-200 sm:text-xl">
              {bill.customerName}
            </p>
          ) : (
            <p className="text-base text-white/40">Walk-in customer</p>
          )}
          <p className="text-sm text-white/40">
            {bill.invoiceNo ? `Bill ${bill.invoiceNo}` : "New bill"}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-hidden px-8 py-4">
        {!hasItems ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <motion.img
              src={BRAND.logoPath}
              alt={BRAND.name}
              className="mb-6 h-28 w-28 object-contain opacity-60"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <p className="text-2xl font-medium text-white/70">
              Scanning your items…
            </p>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Column heads */}
            <div className="grid grid-cols-12 gap-2 border-b border-white/10 pb-2 text-sm font-semibold uppercase tracking-wide text-white/40">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence initial={false}>
                {bill.items.map((item, i) => (
                  <motion.div
                    key={lineKey(item, i)}
                    layout
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.25 }}
                    className="grid grid-cols-12 items-center gap-2 border-b border-white/5 py-3 text-white"
                  >
                    <div className="col-span-6 truncate text-xl font-medium sm:text-2xl">
                      {item.name}
                    </div>
                    <div className="col-span-2 text-right text-lg text-white/80 sm:text-xl">
                      {qtyLabel(item)}
                    </div>
                    <div className="col-span-2 text-right text-lg text-white/80 sm:text-xl">
                      {formatINR(item.rate)}
                    </div>
                    <div className="col-span-2 text-right text-xl font-semibold sm:text-2xl">
                      {formatINR(item.lineTotal)}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-white/10 bg-black/30 px-8 py-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
          <Row label="Subtotal" value={formatINR2(bill.subTotal)} muted />
          {bill.tax > 0 && (
            <Row label="Tax" value={formatINR2(bill.tax)} muted />
          )}
          {bill.deliveryFee > 0 && (
            <Row label="Delivery" value={formatINR2(bill.deliveryFee)} muted />
          )}
          {bill.discount > 0 && (
            <Row
              label="Discount"
              value={`- ${formatINR2(bill.discount)}`}
              highlight="text-emerald-400"
            />
          )}
          <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-3xl font-bold text-white sm:text-4xl">
              Total
            </span>
            <motion.span
              key={bill.grandTotal}
              initial={{ scale: 1.15, color: "#fbbf24" }}
              animate={{ scale: 1, color: "#ffffff" }}
              transition={{ duration: 0.35 }}
              className="text-4xl font-black sm:text-5xl"
            >
              {formatINR(bill.grandTotal)}
            </motion.span>
          </div>
          <div className="mt-2 flex items-center justify-between text-base sm:text-lg">
            {bill.savings > 0 ? (
              <span className="rounded-full bg-emerald-500/15 px-4 py-1.5 font-semibold text-emerald-300">
                You saved {formatINR(bill.savings)}
              </span>
            ) : (
              <span />
            )}
            <span className="rounded-full bg-amber-500/15 px-4 py-1.5 font-semibold text-amber-300">
              + {bill.loyaltyPointsEst} loyalty points
            </span>
          </div>
        </div>
      </div>
    </div>
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
    <div className="flex items-center justify-between text-xl sm:text-2xl">
      <span className={muted ? "text-white/50" : "text-white/80"}>{label}</span>
      <span className={highlight || "text-white/90"}>{value}</span>
    </div>
  );
}
