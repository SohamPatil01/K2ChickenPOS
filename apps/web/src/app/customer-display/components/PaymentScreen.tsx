"use client";

import { motion } from "framer-motion";
import QrCode from "@/components/customerDisplay/QrCode";
import BrandMark from "@/components/customerDisplay/BrandMark";
import { formatINR } from "@/lib/customerDisplay/brand";
import type { PaymentModePayload } from "@/lib/customerDisplay/types";

const METHOD_LABEL: Record<string, { label: string; emoji: string }> = {
  CASH: { label: "Cash", emoji: "💵" },
  UPI: { label: "UPI", emoji: "📱" },
  ONLINE: { label: "Online", emoji: "🌐" },
  CARD: { label: "Card", emoji: "💳" },
  CREDIT: { label: "Credit", emoji: "📝" },
};

function methodMeta(method: string) {
  return (
    METHOD_LABEL[method.toUpperCase()] || {
      label: method,
      emoji: "💳",
    }
  );
}

export default function PaymentScreen({ data }: { data: PaymentModePayload }) {
  const payments = data.payments || [];
  // Older publishers only sent upiQrString for the full total — keep that working.
  const upiAmount =
    data.upiAmount ?? (data.upiQrString ? data.grandTotal : 0);
  const hasQr = !!data.upiQrString && upiAmount > 0;
  const isSplit = payments.length > 1;
  const singleMethod = payments.length === 1 ? payments[0] : null;
  const nonUpiLines = payments.filter(
    (p) => p.method !== "UPI" && p.method !== "ONLINE"
  );

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

      {payments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 w-full max-w-md space-y-2"
        >
          {isSplit && (
            <p className="text-sm font-semibold uppercase tracking-wider text-white/50">
              Split payment
            </p>
          )}
          {payments.map((p, i) => {
            const meta = methodMeta(p.method);
            return (
              <div
                key={`${p.method}-${i}`}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-left"
              >
                <span className="flex items-center gap-3 text-xl text-white/90">
                  <span className="text-2xl">{meta.emoji}</span>
                  {meta.label}
                </span>
                <span className="text-2xl font-bold text-white">
                  {formatINR(p.amount)}
                </span>
              </div>
            );
          })}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="mt-8 flex flex-col items-center"
      >
        {hasQr ? (
          <>
            <div className="mb-3 rounded-full bg-emerald-500/20 px-4 py-1.5 text-lg font-semibold text-emerald-200">
              Pay {formatINR(upiAmount)} via UPI
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-2xl">
              <QrCode value={data.upiQrString} size={280} alt="Scan to pay" />
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
            {nonUpiLines.length > 0 && (
              <div className="mt-5 max-w-md rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-lg text-white/80">
                {nonUpiLines.map((p, i) => {
                  const meta = methodMeta(p.method);
                  return (
                    <p key={`${p.method}-note-${i}`}>
                      Also pay {formatINR(p.amount)} as {meta.label} at the
                      counter
                    </p>
                  );
                })}
              </div>
            )}
          </>
        ) : singleMethod ? (
          <div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8">
            <p className="text-3xl font-semibold text-white">
              {methodMeta(singleMethod.method).emoji}{" "}
              {methodMeta(singleMethod.method).label}
            </p>
            <p className="mt-3 text-2xl font-bold text-white">
              {formatINR(singleMethod.amount)}
            </p>
            <p className="mt-3 text-lg text-white/60">
              {singleMethod.method === "CASH"
                ? "Please pay cash at the counter"
                : singleMethod.method === "CARD"
                  ? "Please pay by card at the counter"
                  : singleMethod.method === "CREDIT"
                    ? "This bill is on credit"
                    : "Please pay at the counter"}
            </p>
          </div>
        ) : (
          <div className="max-w-lg rounded-2xl border border-white/10 bg-white/5 p-8">
            <p className="text-2xl font-semibold text-white">
              Please pay at the counter
            </p>
            <p className="mt-2 text-lg text-white/60">
              Cashier is selecting the payment method
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
