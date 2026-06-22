"use client";

import { motion } from "framer-motion";
import { BRAND, formatINR } from "@/lib/customerDisplay/brand";
import type { SuccessModePayload } from "@/lib/customerDisplay/types";

export default function SuccessScreen({ data }: { data: SuccessModePayload }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[80vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/20 blur-[120px]" />

      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 14 }}
        className="flex h-36 w-36 items-center justify-center rounded-full bg-emerald-500 shadow-2xl sm:h-44 sm:w-44"
      >
        <motion.svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth={3}
          className="h-20 w-20 sm:h-24 sm:w-24"
        >
          <motion.path
            d="M5 13l4 4L19 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          />
        </motion.svg>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 text-5xl font-black text-white sm:text-6xl"
      >
        Payment Successful
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45 }}
        className="mt-3 text-2xl text-emerald-300 sm:text-3xl"
      >
        {formatINR(data.amountPaid)} paid
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-8 flex flex-col items-center gap-3"
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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-12 flex flex-col items-center"
      >
        <img
          src={BRAND.logoPath}
          alt={BRAND.name}
          className="h-14 w-14 object-contain opacity-80"
        />
        <p className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
          Thank you for shopping at {BRAND.name}!
        </p>
        <p className="mt-1 text-lg text-white/50">Please visit again soon.</p>
      </motion.div>
    </div>
  );
}
