"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BRAND, formatINR } from "@/lib/customerDisplay/brand";
import BrandMark from "@/components/customerDisplay/BrandMark";
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
      {/* Soft ambient glow — no flash */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[140px]" />

      {/* Calm ripple rings */}
      <div className="relative mb-2 flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
        {[0, 1].map((i) => (
          <motion.div
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-full border border-emerald-400/50"
            initial={{ scale: 0.45, opacity: 0 }}
            animate={{ scale: 1.55, opacity: [0, 0.45, 0] }}
            transition={{
              duration: 1.4,
              delay: 0.08 + i * 0.22,
              ease: "easeOut",
            }}
          />
        ))}

        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500/90 shadow-lg shadow-emerald-900/30 sm:h-32 sm:w-32"
        >
          <motion.svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth={2.5}
            className="h-14 w-14 sm:h-16 sm:w-16"
          >
            <motion.path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.45, ease: "easeOut" }}
            />
          </motion.svg>
        </motion.div>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4, ease: "easeOut" }}
        className="mt-4 text-5xl font-black text-white sm:text-6xl"
      >
        Payment Successful
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mt-3 text-3xl font-bold text-emerald-300 sm:text-4xl"
      >
        {formatINR(data.amountPaid)} paid
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.35 }}
        className="mt-8 flex flex-col items-center gap-3"
      >
        {data.loyaltyPointsEarned > 0 && (
          <span className="rounded-full bg-amber-500/15 px-6 py-2.5 text-xl font-semibold text-amber-200/90 sm:text-2xl">
            ⭐ {data.loyaltyPointsEarned} loyalty points earned
          </span>
        )}
        {data.invoiceNo && (
          <p className="text-lg text-white/45">Bill {data.invoiceNo}</p>
        )}
      </motion.div>

      {billUrl && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.4 }}
          className="mt-8 flex flex-col items-center"
        >
          <div className="rounded-2xl bg-white p-4 shadow-xl">
            <QrCode
              value={billUrl}
              size={300}
              alt="Scan to view your digital bill"
              className="h-40 w-40 sm:h-48 sm:w-48"
            />
          </div>
          <p className="mt-3 text-lg font-semibold text-white/90 sm:text-xl">
            📱 Scan for your digital bill
          </p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.4 }}
        className="mt-10 flex flex-col items-center"
      >
        <BrandMark
          logoSizeClass="h-12 w-12"
          badgePadClass="p-2"
          showName={false}
        />
        <p className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
          Thank you for shopping at {BRAND.name}!
        </p>
        <p className="mt-1 text-lg text-white/45">Please visit again soon.</p>
      </motion.div>
    </div>
  );
}
