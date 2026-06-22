"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BRAND } from "@/lib/customerDisplay/brand";

export default function IdleScreen() {
  const [promoIndex, setPromoIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPromoIndex((i) => (i + 1) % BRAND.promos.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden text-center">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-1/4 left-1/2 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-amber-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[40vh] w-[40vh] rounded-full bg-rose-500/10 blur-[120px]" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <motion.img
          src={BRAND.logoPath}
          alt={BRAND.name}
          className="mb-8 h-40 w-40 object-contain drop-shadow-2xl sm:h-52 sm:w-52"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <h1 className="text-5xl font-black tracking-tight text-white sm:text-7xl">
          {BRAND.name}
        </h1>
        <p className="mt-4 text-xl text-amber-200/80 sm:text-2xl">
          {BRAND.tagline}
        </p>
      </motion.div>

      <div className="mt-16 h-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={promoIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="rounded-full border border-white/10 bg-white/5 px-8 py-4 text-lg font-medium text-white/90 backdrop-blur sm:text-2xl"
          >
            {BRAND.promos[promoIndex]}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="absolute bottom-8 text-base text-white/40 sm:text-lg">
        Welcome! Your order will appear here.
      </p>
    </div>
  );
}
