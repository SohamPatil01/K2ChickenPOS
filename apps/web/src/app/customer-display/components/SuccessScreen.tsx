"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BRAND, formatINR } from "@/lib/customerDisplay/brand";
import QrCode from "@/components/customerDisplay/QrCode";
import type { SuccessModePayload } from "@/lib/customerDisplay/types";

export default function SuccessScreen({ data }: { data: SuccessModePayload }) {
  const [billUrl, setBillUrl] = useState("");
  useEffect(() => {
    if (data.saleId && typeof window !== "undefined") {
      setBillUrl(`${window.location.origin}/bill/${data.saleId}`);
    } else {
      setBillUrl("");
    }
  }, [data.saleId]);

  const animKey = data.saleId || data.invoiceNo || String(data.amountPaid);

  return (
    <div
      key={animKey}
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6 text-center"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[80vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/15 blur-[120px]" />

      {/* Stamp pad area */}
      <div className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
        {/* Impact flash when stamp hits */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full bg-emerald-400/40 blur-2xl"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: [0, 0.85, 0], scale: [0.4, 1.2, 1.4] }}
          transition={{ duration: 0.45, delay: 0.72, ease: "easeOut" }}
        />

        {/* Expanding ring on press */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full border-[5px] border-emerald-400"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [0.5, 1.4], opacity: [0, 0.95, 0] }}
          transition={{ duration: 0.7, delay: 0.72, ease: "easeOut" }}
        />

        {/* Imprint left on the screen (stays after stamp lifts) */}
        <motion.div
          className="absolute z-10 flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.78, duration: 0.2 }}
        >
          <div className="rounded-3xl bg-white p-3 shadow-2xl ring-4 ring-emerald-400 sm:p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.logoPath}
              alt={BRAND.name}
              className="h-24 w-24 object-contain sm:h-28 sm:w-28"
            />
          </div>
          <motion.span
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.95, type: "spring", stiffness: 320, damping: 14 }}
            className="mt-3 rounded-full bg-emerald-500 px-5 py-1.5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg sm:text-base"
          >
            Paid
          </motion.span>
        </motion.div>

        {/* Physical stamp: flies in, presses, lifts away */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute z-20 flex flex-col items-center"
          initial={{
            x: 180,
            y: -280,
            rotate: -38,
            scale: 1.15,
            opacity: 0,
          }}
          animate={{
            x: [180, 20, 0, 0, 0, -40],
            y: [-280, -40, 8, 0, -12, -220],
            rotate: [-38, -12, 4, 0, -6, -28],
            scale: [1.15, 1.05, 0.92, 1, 1.02, 1.1],
            opacity: [0, 1, 1, 1, 1, 0],
          }}
          transition={{
            duration: 1.35,
            times: [0, 0.35, 0.52, 0.58, 0.68, 1],
            ease: ["easeIn", "easeOut", "easeIn", "easeOut", "easeIn"],
          }}
        >
          {/* Stamp handle */}
          <div className="mb-1 h-10 w-8 rounded-t-lg bg-gradient-to-b from-amber-700 to-amber-900 shadow-md sm:h-12 sm:w-10" />
          <div className="h-3 w-14 rounded-full bg-amber-800 shadow sm:w-16" />
          {/* Stamp face (mirror of imprint) */}
          <div className="mt-0.5 rounded-2xl border-4 border-emerald-600 bg-white p-2 shadow-2xl sm:p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.logoPath}
              alt=""
              className="h-16 w-16 object-contain opacity-90 sm:h-20 sm:w-20"
            />
          </div>
        </motion.div>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05, duration: 0.35 }}
        className="mt-4 text-5xl font-black text-white sm:text-6xl"
      >
        Payment Successful
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, scale: 0.88 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.15, type: "spring", stiffness: 200, damping: 16 }}
        className="mt-3 text-3xl font-bold text-emerald-300 sm:text-4xl"
      >
        {formatINR(data.amountPaid)} paid
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3 }}
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
          transition={{ delay: 1.4, type: "spring", stiffness: 180, damping: 16 }}
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
        transition={{ delay: 1.55 }}
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
