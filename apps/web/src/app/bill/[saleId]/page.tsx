"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getApiBaseUrl } from "@/lib/apiBaseUrl";
import BrandMark from "@/components/customerDisplay/BrandMark";
import { BRAND, formatINR2 } from "@/lib/customerDisplay/brand";

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
  grandTotal: number;
  payments: Array<{ method: string; amount: number }>;
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

  const dateStr = bill
    ? new Date(bill.createdAt).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f6f1] to-[#e7ede4] px-3 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/5">
        {/* Header */}
        <div className="flex flex-col items-center bg-[#14532d] px-6 py-7 text-center text-white">
          <div className="rounded-2xl bg-white p-2 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.logoPath}
              alt={BRAND.name}
              className="h-16 w-16 object-contain"
            />
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight">{BRAND.name}</h1>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.2em] text-emerald-200">
            Fresh • Pure • Trusted
          </p>
          <div className="mt-3 space-y-0.5 text-[11px] leading-snug text-emerald-50/90">
            <p>📞 {BRAND.phone}</p>
            <p>🌐 {BRAND.website}</p>
            <p className="px-2">{BRAND.address}</p>
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
            {bill.status === "VOID" && (
              <div className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-600 ring-1 ring-red-200">
                This bill has been cancelled
              </div>
            )}

            {/* Meta */}
            <div className="mb-5 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-400">Bill No.</span>
                <p className="font-semibold text-gray-900">{bill.saleNo}</p>
              </div>
              <div className="text-right">
                <span className="text-gray-400">Date</span>
                <p className="font-semibold text-gray-900">{dateStr}</p>
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

            {/* Items */}
            <div className="overflow-hidden rounded-xl ring-1 ring-gray-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-[#14532d] text-[11px] uppercase tracking-wide text-white">
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

            {/* Totals */}
            <div className="mt-4 space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatINR2(bill.subTotal)} />
              {bill.discountTotal > 0 && (
                <Row
                  label="Discount"
                  value={`− ${formatINR2(bill.discountTotal)}`}
                  valueClass="text-green-600"
                />
              )}
              {bill.taxTotal > 0 && (
                <Row label="Tax" value={formatINR2(bill.taxTotal)} />
              )}
              <div className="mt-2 flex items-center justify-between rounded-xl bg-[#14532d] px-4 py-3 text-white">
                <span className="text-base font-bold">Total</span>
                <span className="text-xl font-black">
                  {formatINR2(bill.grandTotal)}
                </span>
              </div>
            </div>

            {/* Payment */}
            {bill.payments.length > 0 && (
              <div className="mt-3 text-center text-xs text-gray-500">
                Paid via{" "}
                <span className="font-semibold text-gray-700">
                  {bill.payments.map((p) => p.method).join(", ")}
                </span>
              </div>
            )}

            {/* Loyalty */}
            {(bill.loyaltyEarned > 0 || bill.loyaltyBalance !== null) && (
              <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
                {bill.loyaltyEarned > 0 && (
                  <p className="text-sm font-semibold text-amber-700">
                    ⭐ You earned {bill.loyaltyEarned} loyalty points on this bill
                  </p>
                )}
                {bill.loyaltyBalance !== null && (
                  <p className="mt-0.5 text-xs text-amber-600">
                    Current balance: {bill.loyaltyBalance} points
                  </p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex flex-col items-center text-center">
              <BrandMark
                logoSizeClass="h-10 w-10"
                badgePadClass="p-1.5"
                showName={false}
              />
              <p className="mt-2 text-sm font-bold text-[#14532d]">
                Thank you for shopping with {BRAND.name}!
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Freshness You Can Taste, Quality You Can Trust.
              </p>
            </div>
          </div>
        )}
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
