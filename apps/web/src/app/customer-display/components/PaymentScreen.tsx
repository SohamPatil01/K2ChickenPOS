"use client";

import { motion } from "framer-motion";
import QrCode from "@/components/customerDisplay/QrCode";
import BrandMark from "@/components/customerDisplay/BrandMark";
import { formatINR } from "@/lib/customerDisplay/brand";
import type { PaymentModePayload } from "@/lib/customerDisplay/types";

export default function PaymentScreen({ data }: { data: PaymentModePayload }) {
  const hasQr = !!data.upiQrString;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <BrandMark
          logoSizeClass="h-14 w-14"
          nameSizeClass="text-2xl sm:text-3xl"
          badgePadClass="p-2"
        />
      </motion.div>

      <p className="mt-6 text-xl text-white/60 sm:text-2xl">Amount to pay</p>
      <motion.div
        key={data.grandTotal}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className="mt-1 text-7xl font-black text-white sm:text-8xl"
      >
        {formatINR(data.grandTotal)}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="mt-8 flex flex-col items-center"
      >
        {hasQr ? (
          <>
            <div className="rounded-3xl bg-white p-5 shadow-2xl">
              <QrCode value={data.upiQrString} size={300} alt="Scan to pay" />
            </div>
            <div className="mt-5 flex items-center gap-3 text-lg text-white/70 sm:text-xl">
              <span>Scan with any UPI app</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-base text-white/50">
              <span>GPay</span>·<span>PhonePe</span>·<span>Paytm</span>·
              <span>BHIM</span>
            </div>
            {data.upiId && (
              <p className="mt-3 font-mono text-base text-white/40">
                {data.upiId}
              </p>
            )}
          </>
        ) : (
          <div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8">
            <p className="text-2xl font-semibold text-white">
              Please pay at the counter
            </p>
            <p className="mt-2 text-lg text-white/60">
              Cash / card accepted. UPI QR is not configured.
            </p>
          </div>
        )}
      </motion.div>

      {data.invoiceNo && (
        <p className="absolute bottom-8 text-base text-white/40 sm:text-lg">
          Bill {data.invoiceNo}
        </p>
      )}
    </div>
  );
}
