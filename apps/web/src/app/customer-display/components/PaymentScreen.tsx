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
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-[#fffaf4] via-white to-[#fff1e6] px-6 py-4 text-slate-900 sm:px-10 sm:py-5">
      <div className="mx-auto flex h-full max-w-6xl flex-col">
        <div className="flex items-center justify-between border-b border-orange-100 pb-3">
          <BrandMark
            logoSizeClass="h-10 w-10 sm:h-12 sm:w-12"
            nameSizeClass="text-lg sm:text-xl"
            nameColorClass="text-slate-800"
            badgePadClass="p-1.5"
          />
          <div className="text-right">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#8f6758]">
              Payment
            </p>
            <p className="mt-1 text-sm font-medium text-slate-400">
              {data.invoiceNo ? `Bill ${data.invoiceNo}` : "Almost done"}
            </p>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 items-center gap-6 py-5 lg:grid-cols-[0.85fr_1.15fr]">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col items-center text-center lg:items-start lg:text-left"
          >
            <p className="text-lg font-semibold text-slate-500 sm:text-xl">
              Amount to pay
            </p>
            <motion.div
              key={data.grandTotal}
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              className="mt-1 text-6xl font-black tracking-tight text-[#61453d] sm:text-7xl"
            >
              {formatINR(data.grandTotal)}
            </motion.div>

            {payments.length > 0 ? (
              <div className="mt-6 w-full max-w-md space-y-2">
                <p className="text-left text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">
                  {isSplit ? "Split payment" : "Selected method"}
                </p>
                {payments.map((p, i) => {
                  const meta = methodMeta(p.method);
                  return (
                    <div
                      key={`${p.method}-${i}`}
                      className="flex items-center justify-between rounded-2xl border border-[#ead9cf] bg-white px-4 py-3 text-left shadow-sm"
                    >
                      <span className="flex items-center gap-3 text-lg font-bold text-slate-700">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff1e8] text-xl">
                          {meta.emoji}
                        </span>
                        {meta.label}
                      </span>
                      <span className="text-xl font-black text-slate-800">
                        {formatINR(p.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-[#ead9cf] bg-white px-5 py-4 text-left shadow-sm">
                <p className="font-bold text-slate-700">Payment at the counter</p>
                <p className="mt-1 text-sm text-slate-500">
                  Your cashier is selecting the payment method.
                </p>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35 }}
            className="flex min-h-0 items-center justify-center"
          >
            {hasQr ? (
              <div className="flex w-full max-w-md flex-col items-center rounded-[2rem] border border-[#ead9cf] bg-white px-5 py-4 shadow-lg shadow-[#8f6758]/10 sm:px-8 sm:py-5">
                <div className="rounded-full bg-[#edf5ef] px-4 py-1.5 text-base font-extrabold text-emerald-700">
                  Scan to pay {formatINR(upiAmount)} via UPI
                </div>
                <div className="mt-4 rounded-3xl border border-[#f0e3db] bg-white p-3 shadow-sm">
                  <QrCode value={data.upiQrString} size={238} alt="Scan to pay" />
                </div>
                <p className="mt-3 text-lg font-bold text-slate-700">
                  Scan with any UPI app
                </p>
                <p className="mt-1 text-sm font-medium text-slate-400">
                  GPay · PhonePe · Paytm · BHIM
                </p>
                {data.upiId && (
                  <p className="mt-2 font-mono text-xs text-slate-400">{data.upiId}</p>
                )}
                {nonUpiLines.length > 0 && (
                  <div className="mt-4 w-full rounded-xl bg-[#fffaf4] px-4 py-2 text-center text-sm font-semibold text-slate-600">
                    {nonUpiLines.map((p, i) => {
                      const meta = methodMeta(p.method);
                      return (
                        <p key={`${p.method}-note-${i}`}>
                          Also pay {formatINR(p.amount)} by {meta.label} at the counter
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : singleMethod ? (
              <PaymentInstruction method={singleMethod.method} amount={singleMethod.amount} />
            ) : (
              <PaymentInstruction method="COUNTER" amount={data.grandTotal} />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function PaymentInstruction({ method, amount }: { method: string; amount: number }) {
  const meta = methodMeta(method);
  const instruction =
    method === "CASH"
      ? "Please pay cash at the counter."
      : method === "CARD"
        ? "Please tap, insert, or swipe your card at the counter."
        : method === "CREDIT"
          ? "This amount will be added to your credit account."
          : method === "COUNTER"
            ? "Please complete payment at the counter."
            : "Please complete the payment at the counter.";

  return (
    <div className="w-full max-w-md rounded-[2rem] border border-[#ead9cf] bg-white px-6 py-8 text-center shadow-lg shadow-[#8f6758]/10 sm:px-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#fff1e8] text-4xl">
        {meta.emoji}
      </div>
      <p className="mt-5 text-2xl font-black text-slate-800">
        {meta.label}
      </p>
      <p className="mt-2 text-3xl font-black text-[#61453d]">
        {formatINR(amount)}
      </p>
      <p className="mt-4 text-lg font-medium leading-relaxed text-slate-500">
        {instruction}
      </p>
    </div>
  );
}
