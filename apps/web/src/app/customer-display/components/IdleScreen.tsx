"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BRAND, LOYALTY } from "@/lib/customerDisplay/brand";
import BrandMark from "@/components/customerDisplay/BrandMark";

export default function IdleScreen() {
  const [promoIndex, setPromoIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPromoIndex((i) => (i + 1) % BRAND.promos.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6 text-center sm:px-10">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-1/4 left-1/2 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-amber-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[40vh] w-[40vh] rounded-full bg-rose-500/10 blur-[120px]" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <BrandMark
            logoSizeClass="h-28 w-28 sm:h-36 sm:w-36"
            nameSizeClass="text-4xl sm:text-6xl"
            badgePadClass="p-4"
            className="drop-shadow-2xl"
          />
        </motion.div>
        <p className="mt-3 text-lg text-amber-200/80 sm:text-xl">{BRAND.tagline}</p>
      </motion.div>

      {/* Loyalty scheme advertisement */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.55, ease: "easeOut" }}
        className="relative mt-8 w-full max-w-4xl overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent p-5 shadow-2xl shadow-amber-950/40 backdrop-blur-md sm:mt-10 sm:p-7"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl" />

        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300/90 sm:text-sm">
          {LOYALTY.title}
        </p>
        <h2 className="mt-2 text-2xl font-black text-white sm:text-4xl">
          {LOYALTY.headline}
        </h2>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4">
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-left sm:px-5">
            <p className="text-3xl font-black text-amber-300 sm:text-4xl">
              {LOYALTY.earnPercentLabel}
            </p>
            <p className="mt-1 text-base font-medium text-white/90 sm:text-lg">
              {LOYALTY.earnDetail}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-left sm:px-5">
            <p className="text-3xl font-black text-amber-300 sm:text-4xl">
              {LOYALTY.redeemLabel}
            </p>
            <p className="mt-1 text-base font-medium text-white/90 sm:text-lg">
              {LOYALTY.redeemDetail}
            </p>
          </div>
        </div>

        <p className="mt-5 text-base font-semibold text-amber-100 sm:mt-6 sm:text-xl">
          {LOYALTY.howToJoin}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {LOYALTY.tips.map((tip) => (
            <span
              key={tip}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 sm:text-sm"
            >
              {tip}
            </span>
          ))}
        </div>
      </motion.div>

      <div className="mt-6 h-12 sm:mt-8 sm:h-14">
        <AnimatePresence mode="wait">
          <motion.div
            key={promoIndex}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.45 }}
            className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-base font-medium text-white/80 backdrop-blur sm:px-8 sm:text-lg"
          >
            {BRAND.promos[promoIndex]}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="absolute bottom-6 text-sm text-white/35 sm:bottom-8 sm:text-base">
        Welcome! Your order will appear here.
      </p>
    </div>
  );
}
