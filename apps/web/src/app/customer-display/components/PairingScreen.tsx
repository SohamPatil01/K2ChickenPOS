"use client";

import { motion } from "framer-motion";
import { BRAND } from "@/lib/customerDisplay/brand";

export default function PairingScreen() {
  const path =
    typeof window !== "undefined"
      ? `${window.location.origin}/customer-display`
      : "/customer-display";

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute -top-1/4 left-1/2 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-amber-500/15 blur-[120px]" />

      <motion.img
        src={BRAND.logoPath}
        alt={BRAND.name}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-8 h-32 w-32 object-contain drop-shadow-2xl"
      />
      <h1 className="text-4xl font-black text-white sm:text-5xl">
        {BRAND.name} Customer Display
      </h1>

      <div className="mt-10 max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur">
        <p className="text-2xl font-semibold text-white">Ready to pair</p>
        <ol className="mt-6 space-y-4 text-left text-lg text-white/70 sm:text-xl">
          <li className="flex gap-3">
            <span className="font-bold text-amber-300">1.</span>
            On the billing screen, tap{" "}
            <span className="font-semibold text-white">“Customer Display”</span>.
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-amber-300">2.</span>
            Turn it on and scan the QR code shown there with this device — or
            open the pairing link here.
          </li>
          <li className="flex gap-3">
            <span className="font-bold text-amber-300">3.</span>
            This screen will connect automatically and stay paired.
          </li>
        </ol>
      </div>

      <p className="mt-8 font-mono text-base text-white/40 sm:text-lg">{path}</p>
    </div>
  );
}
