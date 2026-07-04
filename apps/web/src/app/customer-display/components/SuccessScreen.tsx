"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BRAND, formatINR } from "@/lib/customerDisplay/brand";
import QrCode from "@/components/customerDisplay/QrCode";
import type { SuccessModePayload } from "@/lib/customerDisplay/types";

export default function SuccessScreen({ data }: { data: SuccessModePayload }) {
  // Build the digital-bill link from the display's own origin (same web app
  // serves /bill/<id>). Computed after mount to avoid hydration mismatch.
  const [billUrl, setBillUrl] = useState("");
  useEffect(() => {
    if (data.saleId && typeof window !== "undefined") {
      setBillUrl(`${window.location.origin}/bill/${data.saleId}`);
    } else {
      setBillUrl("");
    }
  }, [data.saleId]);

  // Replay stamp animation for every new payment.
  const animKey = data.saleId || data.invoiceNo || String(data.amountPaid);

  return (
    <div
      key={animKey}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6 text-center"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[80vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />

      {/* K2 Chicken stamp: logo drops in, green ring expands */}
      <div className="relative flex h-44 w-44 items-center justify-center sm:h-52 sm:w-52">
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full border-[6px] border-emerald-400"
          initial={{ scale: 0.35, opacity: 0 }}
          animate={{ scale: 1.35, opacity: [0, 0.9, 0] }}
          transition={{ duration: 0.85, delay: 0.28, ease: "easeOut" }}
        />
        <motion.div
          aria-hidden
          className="absolute inset-2 rounded-full border-4 border-emerald-300/60"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1.15, opacity: [0, 0.7, 0] }}
          transition={{ duration: 0.7, delay: 0.38, ease: "easeOut" }}
        />

        <motion.div
          initial={{ scale: 2.4, y: -120, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 420,
            damping: 16,
            mass: 0.85,
          }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="rounded-3xl bg-white p-3 shadow-2xl ring-4 ring-emerald-400/80 sm:p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.logoPath}
              alt={BRAND.name}
              className="h-24 w-24 object-contain sm:h-28 sm:w-28"
            />
          </div>
          <motion.span
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 300, damping: 14 }}
            className="mt-3 rounded-full bg-emerald-500 px-5 py-1.5 text-sm font-black uppercase tracking-widest text-white shadow-lg sm:text-base"
          >
            Paid
          </motion.span>
        </motion.div>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.35 }}
        className="mt-6 text-5xl font-black text-white sm:text-6xl"
      >
        Payment Successful
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.55, type: "spring", stiffness: 200, damping: 16 }}
        className="mt-3 text-3xl font-bold text-emerald-300 sm:text-4xl"
      >
        {formatINR(data.amountPaid)} paid
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-6 flex flex-col items-center gap-3"
      >
        {data.loyaltyPointsEarned > 0 && (
          <span className="rounded-full bg-amber-500/20 px-6 py-2.5 text-xl font-semibold text-amber-300 sm:text-2xl">
            ⭐ {data.loyaltyPointsEarned} loyalty points earned
          </span>
        )}
        {data.invoiceNo && (
          <p className="text-lg text-white/50">Bill {data.invoiceNo}</p>
        )}
      </motion.div>

      {billUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.85, type: "spring", stiffness: 180, damping: 16 }}
          className="mt-8 flex flex-col items-center"
        >
          <div className="rounded-2xl bg-white p-4 shadow-2xl">
            <QrCode
              value={billUrl}
              size={300}
              alt="Scan to view your digital bill"
              className="h-40 w-40 sm:h-48 sm:w-48"
            />
          </div>
          <p className="mt-3 text-lg font-semibold text-white sm:text-xl">
            📱 Scan for your digital bill
          </p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-8 flex flex-col items-center"
      >
        <p className="text-2xl font-semibold text-white sm:text-3xl">
          Thank you for shopping at {BRAND.name}!
        </p>
        <p className="mt-1 text-lg text-white/50">Please visit again soon.</p>
      </motion.div>
    </div>
  );
}
