"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import { BRAND, LOYALTY, formatINR2 } from "@/lib/customerDisplay/brand";
import { getUpiConfig, buildUpiString } from "@/lib/customerDisplay/upi";
import QrCode from "@/components/customerDisplay/QrCode";

interface BillItem {
  name: string;
  qtyLabel: string;
  rate: number;
  lineTotal: number;
  taxRate: number;
}

interface PublicBill {
  saleNo: string;
  status: string;
  createdAt: string;
  storeName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  items: BillItem[];
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  deliveryFee?: number;
  grandTotal: number;
  payments: Array<{ method: string; amount: number }>;
  paidAmount?: number;
  pendingAmount?: number;
  loyaltyEarned: number;
  loyaltyBalance: number | null;
}

export default function DigitalBillPage() {
  const params = useParams();
  const saleId = String(params?.saleId || "");
  const [bill, setBill] = useState<PublicBill | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">(
    "loading"
  );

  useEffect(() => {
    let cancelled = false;
    if (!saleId) {
      setStatus("notfound");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/public/bill/${saleId}`);
        if (res.status === 404) {
          if (!cancelled) setStatus("notfound");
          return;
        }
        if (!res.ok) {
          if (!cancelled) setStatus("error");
          return;
        }
        const data = (await res.json()) as PublicBill;
        if (!cancelled) {
          setBill(data);
          setStatus("ready");
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  const paid = useMemo(() => {
    if (!bill) return 0;
    if (typeof bill.paidAmount === "number") return bill.paidAmount;
    return (bill.payments || [])
      .filter((p) => String(p.method).toUpperCase() !== "CREDIT")
      .reduce((s, p) => s + Number(p.amount || 0), 0);
  }, [bill]);

  const pending = useMemo(() => {
    if (!bill) return 0;
    if (typeof bill.pendingAmount === "number") return bill.pendingAmount;
    return Math.max(0, Math.round(bill.grandTotal - paid));
  }, [bill, paid]);

  const isPending =
    !!bill &&
    pending > 0 &&
    String(bill.status).toUpperCase() !== "VOID";

  const upiQr = useMemo(() => {
    if (!isPending || pending <= 0) return "";
    const cfg = getUpiConfig();
    if (!cfg) return "";
    return buildUpiString({
      upiId: cfg.upiId,
      payeeName: cfg.payeeName,
      amount: pending,
      note: bill?.saleNo,
    });
  }, [isPending, pending, bill?.saleNo]);

  const dateStr = bill
    ? new Date(bill.createdAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const statusLabel =
    bill && String(bill.status).toUpperCase() === "VOID"
      ? "CANCELLED"
      : isPending
        ? "PENDING"
        : bill
          ? String(bill.status).toUpperCase()
          : "";

  return (
    <div className="min-h-screen bg-[#e8eaed] px-3 py-6 sm:py-10">
      <div className="relative mx-auto w-full max-w-md overflow-hidden rounded border border-gray-300 bg-[#fafafa] shadow-sm">
        {/* Watermark */}
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BRAND.logoPath}
            alt=""
            className="h-72 w-72 object-contain opacity-[0.045] grayscale"
          />
        </div>

        <div className="relative z-10">
          <div className="border-b border-gray-200 bg-gray-100 px-5 py-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl border border-gray-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND.logoPath}
                alt={BRAND.name}
                className="h-10 w-10 object-contain"
              />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">
              {BRAND.name}
            </h1>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
              Fresh · Pure · Trusted
            </p>
            <div className="mt-3 space-y-0.5 text-[11px] leading-snug text-gray-600">
              <p>WhatsApp / Call {BRAND.whatsappDisplay}</p>
              <p>GSTIN: {BRAND.gstin}</p>
              <p className="px-1">{BRAND.address}</p>
            </div>
          </div>

          {status === "loading" && (
            <div className="px-6 py-16 text-center text-gray-500">Loading your bill…</div>
          )}

          {status === "notfound" && (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-semibold text-gray-800">Bill not found</p>
              <p className="mt-2 text-sm text-gray-500">
                This bill link is invalid or has expired.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="px-6 py-16 text-center">
              <p className="text-lg font-semibold text-gray-800">Couldn’t load the bill</p>
              <p className="mt-2 text-sm text-gray-500">
                Please check your connection and try again.
              </p>
            </div>
          )}

          {status === "ready" && bill && (
            <div className="px-5 py-6">
              {String(bill.status).toUpperCase() === "VOID" && (
                <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-700">
                  This bill has been cancelled
                </div>
              )}

              {isPending && (
                <div className="mb-4 flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Pending / Credit bill
                    </p>
                    <p className="text-xs text-amber-700">Balance still due</p>
                  </div>
                  <p className="text-xl font-extrabold text-amber-800">
                    {formatINR2(pending)}
                  </p>
                </div>
              )}

              <div className="mb-5 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400">Bill No.</span>
                  <p className="font-semibold text-gray-900">{bill.saleNo}</p>
                </div>
                <div className="text-right">
                  <span className="text-gray-400">Date</span>
                  <p className="font-semibold text-gray-900">{dateStr}</p>
                </div>
                <div className="col-span-2">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                      isPending
                        ? "border border-amber-300 bg-amber-50 text-amber-800"
                        : "border border-gray-200 bg-gray-100 text-gray-700"
                    }`}
                  >
                    {statusLabel}
                  </span>
                </div>
                {bill.customerName && (
                  <div className="col-span-2">
                    <span className="text-gray-400">Bill to</span>
                    <p className="font-semibold text-gray-900">
                      {bill.customerName}
                      {bill.customerPhone ? ` · ${bill.customerPhone}` : ""}
                    </p>
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded border border-gray-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-[11px] uppercase tracking-wide text-gray-600">
                      <th className="px-3 py-2 font-semibold">Item</th>
                      <th className="px-2 py-2 text-right font-semibold">Qty</th>
                      <th className="px-2 py-2 text-right font-semibold">Rate</th>
                      <th className="px-3 py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bill.items.map((it, idx) => (
                      <tr key={idx} className="text-gray-800">
                        <td className="px-3 py-2 font-medium">{it.name}</td>
                        <td className="px-2 py-2 text-right text-gray-600">
                          {it.qtyLabel}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-600">
                          {formatINR2(it.rate)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {formatINR2(it.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-1.5 text-sm">
                <Row label="Subtotal" value={formatINR2(bill.subTotal)} />
                {bill.discountTotal > 0 && (
                  <Row label="Discount" value={`− ${formatINR2(bill.discountTotal)}`} />
                )}
                {bill.taxTotal > 0 && (
                  <Row label="Tax" value={formatINR2(bill.taxTotal)} />
                )}
                {(bill.deliveryFee ?? 0) > 0 && (
                  <Row label="Delivery" value={formatINR2(bill.deliveryFee!)} />
                )}
                <div className="mt-2 flex items-center justify-between rounded bg-gray-900 px-4 py-3 text-white">
                  <span className="text-base font-bold">Grand Total</span>
                  <span className="text-xl font-black">
                    {formatINR2(bill.grandTotal)}
                  </span>
                </div>
                {paid > 0 && <Row label="Paid" value={formatINR2(paid)} />}
                {isPending && (
                  <Row
                    label="Pending amount"
                    value={formatINR2(pending)}
                    valueClass="font-bold text-amber-800"
                  />
                )}
              </div>

              {isPending && upiQr && (
                <div className="mt-5 rounded border border-gray-200 bg-white px-4 py-5 text-center">
                  <p className="text-sm font-bold text-gray-900">
                    Scan to pay pending {formatINR2(pending)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    GPay · PhonePe · Paytm · BHIM
                  </p>
                  <div className="mt-3 inline-block rounded border border-gray-100 p-2">
                    <QrCode value={upiQr} size={180} alt="Scan to pay" />
                  </div>
                </div>
              )}

              {(bill.loyaltyEarned > 0 || bill.loyaltyBalance !== null) && (
                <div className="mt-4 rounded border border-gray-200 bg-white px-4 py-3">
                  {bill.loyaltyEarned > 0 && (
                    <p className="text-sm font-semibold text-gray-800">
                      You earned {bill.loyaltyEarned} loyalty points on this bill
                    </p>
                  )}
                  {bill.loyaltyBalance !== null && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      Current balance: {bill.loyaltyBalance} points
                    </p>
                  )}
                </div>
              )}

              <div className="mt-6 border-t border-gray-200 pt-4 text-center text-xs text-gray-500">
                <p className="font-bold text-gray-900">
                  Thank you for shopping with {BRAND.name}
                </p>
                <p className="mt-1">
                  Loyalty: {LOYALTY.portalUrl.replace(/^https?:\/\//, "")} ·{" "}
                  {BRAND.website}
                </p>
                <p className="mt-0.5">WhatsApp: {BRAND.whatsappDisplay}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass = "text-gray-900",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}
