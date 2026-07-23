"use client";

import { useEffect, useState } from "react";
import type { BillSale, BillStoreInfo } from "@/lib/customerBill";
import { paymentSummary } from "@/lib/customerBill";
import { BRAND, LOYALTY } from "@/lib/customerDisplay/brand";
import { getUpiConfig, buildUpiString } from "@/lib/customerDisplay/upi";
import QrCode from "@/components/customerDisplay/QrCode";

interface CustomerBillProps {
  sale: BillSale;
  store?: BillStoreInfo;
}

function formatMoney(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatQty(item: BillSale["items"][0]) {
  if (item.qtyKg != null && item.qtyKg > 0) return `${item.qtyKg.toFixed(2)} kg`;
  if (item.qtyPcs != null && item.qtyPcs > 0) return `${item.qtyPcs} pcs`;
  return "-";
}

export default function CustomerBill({ sale, store }: CustomerBillProps) {
  const storeName = store?.name || BRAND.name;
  const storePhone = store?.phone || BRAND.phoneDisplay;
  const { paid, balance, isPending } = paymentSummary(sale);
  const statusLabel =
    String(sale.status).toUpperCase() === "VOID"
      ? "CANCELLED"
      : isPending
        ? "PENDING"
        : String(sale.status).toUpperCase();

  const [upiQr, setUpiQr] = useState("");
  useEffect(() => {
    if (!isPending || balance <= 0) {
      setUpiQr("");
      return;
    }
    const cfg = getUpiConfig();
    if (!cfg) {
      setUpiQr("");
      return;
    }
    setUpiQr(
      buildUpiString({
        upiId: cfg.upiId,
        payeeName: cfg.payeeName,
        amount: balance,
        note: sale.saleNo,
      })
    );
  }, [isPending, balance, sale.saleNo]);

  return (
    <div
      className="customer-bill"
      style={{
        position: "relative",
        width: "210mm",
        maxWidth: "100%",
        margin: "0 auto",
        background: "#fafafa",
        color: "#111827",
        fontFamily: "system-ui, sans-serif",
        fontSize: "13px",
        border: "1px solid #d1d5db",
        overflow: "hidden",
      }}
    >
      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BRAND.logoPath}
          alt=""
          style={{
            width: 280,
            height: 280,
            objectFit: "contain",
            opacity: 0.06,
          }}
        />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            background: "#f3f4f6",
            borderBottom: "1px solid #e5e7eb",
            padding: "20px 24px 16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND.logoPath}
                alt={BRAND.name}
                style={{
                  width: 72,
                  height: 72,
                  objectFit: "contain",
                  flexShrink: 0,
                  borderRadius: 12,
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  padding: 4,
                }}
              />
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>
                  {BRAND.name}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#6b7280",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginTop: 4,
                  }}
                >
                  Fresh · Pure · Trusted
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 11.5,
                lineHeight: 1.55,
                color: "#4b5563",
                maxWidth: 340,
              }}
            >
              WhatsApp / Call {BRAND.whatsappDisplay}
              <br />
              GSTIN: {BRAND.gstin}
              <br />
              {BRAND.address}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#374151",
              }}
            >
              Tax Invoice
            </div>
            <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700 }}>
              {sale.saleNo}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
              {new Date(sale.createdAt).toLocaleString("en-IN")}
            </div>
            <div style={{ marginTop: 10 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 4,
                  background: isPending
                    ? "#fef3c7"
                    : statusLabel === "CANCELLED"
                      ? "#fee2e2"
                      : "#f3f4f6",
                  color: isPending
                    ? "#92400e"
                    : statusLabel === "CANCELLED"
                      ? "#991b1b"
                      : "#374151",
                  fontSize: 10,
                  fontWeight: 800,
                  border: `1px solid ${isPending ? "#fcd34d" : "#e5e7eb"}`,
                }}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {isPending && (
            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fcd34d",
                borderRadius: 6,
                padding: "12px 16px",
                marginBottom: 16,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#92400e",
                    fontWeight: 700,
                  }}
                >
                  Pending / Credit bill
                </div>
                <div style={{ fontSize: 12, color: "#a16207", marginTop: 2 }}>
                  Balance still due on this invoice
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#92400e" }}>
                {formatMoney(balance)}
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  color: "#9ca3af",
                  marginBottom: 4,
                }}
              >
                Bill To
              </div>
              <div style={{ fontWeight: 700 }}>
                {sale.customer?.name || "Walk-in Customer"}
              </div>
              {sale.customer?.phone && (
                <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                  Phone: {sale.customer.phone}
                </div>
              )}
              {sale.customer?.area && (
                <div style={{ marginTop: 2, fontSize: 12, color: "#6b7280" }}>
                  Area: {sale.customer.area}
                </div>
              )}
            </div>
            <div
              style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  textTransform: "uppercase",
                  color: "#9ca3af",
                  marginBottom: 4,
                }}
              >
                Store
              </div>
              <div style={{ fontWeight: 700 }}>{storeName}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                Tel: {storePhone}
              </div>
              {sale.createdBy?.name && (
                <div style={{ marginTop: 2, fontSize: 12, color: "#6b7280" }}>
                  Cashier: {sale.createdBy.name}
                </div>
              )}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
            <thead>
              <tr style={{ background: "#f3f4f6", borderBottom: "1px solid #e5e7eb" }}>
                <th style={{ padding: "8px 6px", textAlign: "left", width: 32, fontSize: 10 }}>
                  #
                </th>
                <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 10 }}>Item</th>
                <th style={{ padding: "8px 6px", textAlign: "right", fontSize: 10 }}>Qty</th>
                <th style={{ padding: "8px 6px", textAlign: "right", fontSize: 10 }}>Rate</th>
                <th style={{ padding: "8px 6px", textAlign: "right", fontSize: 10 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px 6px", color: "#6b7280" }}>{i + 1}</td>
                  <td style={{ padding: "8px 6px", fontWeight: 500 }}>{item.product.name}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>{formatQty(item)}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>
                    {formatMoney(item.rate)}
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right", fontWeight: 700 }}>
                    {formatMoney(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <div style={{ width: 260 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                <span>Subtotal</span>
                <span>{formatMoney(sale.subTotal)}</span>
              </div>
              {sale.discountTotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span>Discount</span>
                  <span>- {formatMoney(sale.discountTotal)}</span>
                </div>
              )}
              {sale.taxTotal > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span>Tax</span>
                  <span>{formatMoney(sale.taxTotal)}</span>
                </div>
              )}
              {(sale.deliveryFee ?? 0) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span>Delivery Fee</span>
                  <span>{formatMoney(sale.deliveryFee!)}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                  padding: "12px 14px",
                  borderRadius: 6,
                  background: "#111827",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 16,
                }}
              >
                <span>Grand Total</span>
                <span>{formatMoney(sale.grandTotal)}</span>
              </div>
              {paid > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "6px 0 0",
                    marginTop: 8,
                    fontSize: 13,
                  }}
                >
                  <span>Paid</span>
                  <span>{formatMoney(paid)}</span>
                </div>
              )}
              {isPending && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                    color: "#92400e",
                    fontWeight: 700,
                  }}
                >
                  <span>Pending amount</span>
                  <span>{formatMoney(balance)}</span>
                </div>
              )}
            </div>
          </div>

          {isPending && upiQr && (
            <div
              style={{
                marginTop: 20,
                padding: 18,
                borderRadius: 6,
                background: "#fff",
                border: "1px solid #e5e7eb",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                Scan to pay pending {formatMoney(balance)}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>
                GPay · PhonePe · Paytm · BHIM
              </div>
              <div style={{ display: "inline-block", padding: 8, border: "1px solid #f3f4f6" }}>
                <QrCode value={upiQr} size={168} alt="Scan to pay" />
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            textAlign: "center",
            padding: "16px 24px 24px",
            borderTop: "1px solid #e5e7eb",
            color: "#6b7280",
            fontSize: 12,
            background: "#f9fafb",
          }}
        >
          <div style={{ fontWeight: 700, color: "#111827", marginBottom: 4 }}>
            Thank you for shopping with {BRAND.name}
          </div>
          <div>
            Loyalty: {LOYALTY.portalUrl.replace(/^https?:\/\//, "")} · {BRAND.website}
          </div>
          <div style={{ marginTop: 4 }}>
            WhatsApp: {BRAND.whatsappDisplay} · Redeem points in shop only
          </div>
        </div>
      </div>
    </div>
  );
}
