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
      className="relative flex h-full w-full flex-col overflow-hidden bg-gradient-to-br from-[#fffaf4] via-white to-[#fff1e6] px-5 py-4 text-slate-900 sm:px-10 sm:py-6"
    >
      <div className="pointer-events-none absolute -left-16 top-10 h-[45vh] w-[45vh] rounded-full bg-emerald-300/20 blur-[100px]" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-[50vh] w-[50vh] rounded-full bg-amber-300/25 blur-[110px]" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col">
        <div className="flex items-center justify-between border-b border-orange-100 pb-3">
          <BrandMark
            logoSizeClass="h-10 w-10 sm:h-12 sm:w-12"
            nameSizeClass="text-lg sm:text-xl"
            nameColorClass="text-slate-800"
            badgePadClass="p-1.5"
          />
          <div className="text-right">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">
              Paid
            </p>
            <p className="mt-1 text-sm font-medium text-slate-400">
              {data.invoiceNo ? `Bill ${data.invoiceNo}` : "Thank you"}
            </p>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 items-center gap-6 py-5 lg:grid-cols-[1fr_1fr]">
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center text-center lg:items-start lg:text-left"
          >
            <div className="relative mb-4 flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
              {[0, 1].map((i) => (
                <motion.div
                  key={i}
                  aria-hidden
                  className="absolute inset-0 rounded-full border-2 border-emerald-400/40"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1.45, opacity: [0, 0.5, 0] }}
                  transition={{
                    duration: 1.35,
                    delay: 0.05 + i * 0.2,
                    ease: "easeOut",
                  }}
                />
              ))}
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-700/20 sm:h-24 sm:w-24"
              >
                <motion.svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.5}
                  className="h-10 w-10 sm:h-12 sm:w-12"
                >
                  <motion.path
                    d="M5 13l4 4L19 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
                  />
                </motion.svg>
              </motion.div>
            </div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.35 }}
              className="text-4xl font-black tracking-tight text-slate-900 sm:text-5xl"
            >
              Payment successful
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.35 }}
              className="mt-2 text-5xl font-black tracking-tight text-[#61453d] sm:text-6xl"
            >
              {formatINR(data.amountPaid)}
            </motion.p>
            <p className="mt-1 text-base font-semibold text-slate-500 sm:text-lg">
              paid at the counter
            </p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.35 }}
              className="mt-6 flex w-full max-w-md flex-col gap-2"
            >
              {data.loyaltyPointsEarned > 0 && (
                <div className="flex items-center justify-between rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 shadow-sm">
                  <span className="text-sm font-bold text-slate-600">Points earned</span>
                  <span className="text-lg font-black text-amber-700">
                    +{data.loyaltyPointsEarned}
                  </span>
                </div>
              )}
              {data.loyaltyPointsRedeemed > 0 && (
                <div className="flex items-center justify-between rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 shadow-sm">
                  <span className="text-sm font-bold text-slate-600">Points redeemed</span>
                  <span className="text-lg font-black text-sky-700">
                    −{data.loyaltyPointsRedeemed}
                  </span>
                </div>
              )}
              {data.loyaltyPointsBalance != null && (
                <div className="flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50/80 px-4 py-3">
                  <span className="text-sm font-bold text-slate-600">New balance</span>
                  <span className="text-lg font-black text-[#a92e21]">
                    {data.loyaltyPointsBalance} pts
                  </span>
                </div>
              )}
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.35 }}
              className="mt-6 max-w-md text-lg font-semibold text-slate-600 sm:text-xl"
            >
              Thank you for shopping at {BRAND.name}!
            </motion.p>
            <p className="mt-1 text-sm font-medium text-slate-400 sm:text-base">
              Please visit again soon.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="flex min-h-0 items-center justify-center"
          >
            {billUrl ? (
              <div className="flex w-full max-w-md flex-col items-center rounded-[2rem] border border-[#ead9cf] bg-white px-5 py-6 shadow-lg shadow-[#8f6758]/10 sm:px-8 sm:py-8">
                <div className="rounded-full bg-[#edf5ef] px-4 py-1.5 text-sm font-extrabold uppercase tracking-wide text-emerald-700">
                  Digital bill
                </div>
                <div className="mt-4 rounded-3xl border border-[#f0e3db] bg-white p-3 shadow-sm">
                  <QrCode
                    value={billUrl}
                    size={300}
                    alt="Scan to view your digital bill"
                    className="h-44 w-44 sm:h-52 sm:w-52"
                  />
                </div>
                <p className="mt-4 text-lg font-bold text-slate-700">
                  Scan for your digital bill
                </p>
                <p className="mt-1 text-sm font-medium text-slate-400">
                  Keep a copy on your phone
                </p>
              </div>
            ) : (
              <div className="w-full max-w-md rounded-[2rem] border border-[#ead9cf] bg-white px-6 py-10 text-center shadow-lg shadow-[#8f6758]/10">
                <p className="text-xl font-black text-slate-800">You&apos;re all set</p>
                <p className="mt-2 text-base font-medium text-slate-500">
                  Ask the cashier if you need a printed receipt.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
