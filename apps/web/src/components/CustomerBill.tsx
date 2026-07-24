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
    const id = "k2-bill-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap";
      document.head.appendChild(link);
    }
  }, []);
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

  const statusBg = isPending
    ? "#fff7ed"
    : statusLabel === "CANCELLED"
      ? "#fef2f2"
      : "#f1f5f9";
  const statusFg = isPending
    ? "#9a3412"
    : statusLabel === "CANCELLED"
      ? "#991b1b"
      : "#334155";
  const statusBd = isPending
    ? "#fdba74"
    : statusLabel === "CANCELLED"
      ? "#fecaca"
      : "#e2e8f0";

  return (
    <div
      className="customer-bill"
      style={{
        position: "relative",
        width: "210mm",
        maxWidth: "100%",
        margin: "0 auto",
        background: "#ffffff",
        color: "#0f172a",
        fontFamily: '"IBM Plex Sans", "Segoe UI", sans-serif',
        fontSize: "12px",
        border: "1px solid #cbd5e1",
        overflow: "hidden",
      }}
    >
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
          style={{ width: 220, height: 220, objectFit: "contain", opacity: 0.045 }}
        />
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            padding: "16px 18px 12px",
            borderBottom: "2px solid #0f172a",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND.logoPath}
                alt={BRAND.name}
                style={{
                  width: 52,
                  height: 52,
                  objectFit: "contain",
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  padding: 3,
                }}
              />
              <div>
                <div
                  style={{
                    fontFamily: '"Libre Baskerville", Georgia, serif',
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1.15,
                  }}
                >
                  {BRAND.name}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 10,
                    color: "#64748b",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                  }}
                >
                  Fresh · Pure · Trusted
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                lineHeight: 1.45,
                color: "#475569",
                maxWidth: 340,
              }}
            >
              WhatsApp / Call {BRAND.whatsappDisplay} · GSTIN {BRAND.gstin}
              <br />
              {BRAND.address}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Tax Invoice
            </div>
            <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700 }}>
              {sale.saleNo}
            </div>
            <div style={{ marginTop: 3, fontSize: 11, color: "#64748b" }}>
              {new Date(sale.createdAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div style={{ marginTop: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 8px",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  border: `1px solid ${statusBd}`,
                  background: statusBg,
                  color: statusFg,
                }}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 18px 8px" }}>
          {isPending && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
                padding: "8px 12px",
                border: "1px solid #fdba74",
                background: "#fff7ed",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 9,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#9a3412",
                    fontWeight: 700,
                  }}
                >
                  Pending / Credit bill
                </div>
                <div style={{ fontSize: 11, color: "#c2410c", marginTop: 1 }}>
                  Balance still due on this invoice
                </div>
              </div>
              <div
                style={{
                  fontFamily: '"Libre Baskerville", Georgia, serif',
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#9a3412",
                }}
              >
                {formatMoney(balance)}
              </div>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div style={{ border: "1px solid #e2e8f0", padding: "8px 10px" }}>
              <div
                style={{
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#94a3b8",
                  marginBottom: 3,
                  fontWeight: 600,
                }}
              >
                Bill to
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {sale.customer?.name || "Walk-in Customer"}
              </div>
              {sale.customer?.phone && (
                <div style={{ marginTop: 2, fontSize: 11, color: "#64748b" }}>
                  {sale.customer.phone}
                </div>
              )}
              {sale.customer?.area && (
                <div style={{ marginTop: 2, fontSize: 11, color: "#64748b" }}>
                  {sale.customer.area}
                </div>
              )}
            </div>
            <div style={{ border: "1px solid #e2e8f0", padding: "8px 10px" }}>
              <div
                style={{
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#94a3b8",
                  marginBottom: 3,
                  fontWeight: 600,
                }}
              >
                Store
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{storeName}</div>
              <div style={{ marginTop: 2, fontSize: 11, color: "#64748b" }}>
                {storePhone}
              </div>
              {sale.createdBy?.name && (
                <div style={{ marginTop: 2, fontSize: 11, color: "#64748b" }}>
                  Cashier: {sale.createdBy.name}
                </div>
              )}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0f172a", color: "#f8fafc" }}>
                {["#", "Item", "Qty", "Rate", "Amount"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: "7px 6px",
                      textAlign: i < 2 ? "left" : "right",
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      width: i === 0 ? 28 : undefined,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "7px 6px", color: "#94a3b8" }}>{i + 1}</td>
                  <td style={{ padding: "7px 6px", fontWeight: 500 }}>
                    {item.product.name}
                  </td>
                  <td style={{ padding: "7px 6px", textAlign: "right", color: "#334155" }}>
                    {formatQty(item)}
                  </td>
                  <td style={{ padding: "7px 6px", textAlign: "right", color: "#334155" }}>
                    {formatMoney(item.rate)}
                  </td>
                  <td
                    style={{
                      padding: "7px 6px",
                      textAlign: "right",
                      fontWeight: 700,
                    }}
                  >
                    {formatMoney(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <div style={{ width: 240 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "2px 0",
                  color: "#475569",
                }}
              >
                <span>Subtotal</span>
                <span>{formatMoney(sale.subTotal)}</span>
              </div>
              {sale.discountTotal > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px 0",
                    color: "#475569",
                  }}
                >
                  <span>Discount</span>
                  <span>- {formatMoney(sale.discountTotal)}</span>
                </div>
              )}
              {sale.taxTotal > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px 0",
                    color: "#475569",
                  }}
                >
                  <span>Tax</span>
                  <span>{formatMoney(sale.taxTotal)}</span>
                </div>
              )}
              {(sale.deliveryFee ?? 0) > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "2px 0",
                    color: "#475569",
                  }}
                >
                  <span>Delivery</span>
                  <span>{formatMoney(sale.deliveryFee!)}</span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 6,
                  padding: "8px 10px",
                  background: "#0f172a",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                <span>Grand Total</span>
                <span
                  style={{
                    fontFamily: '"Libre Baskerville", Georgia, serif',
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  {formatMoney(sale.grandTotal)}
                </span>
              </div>
              {paid > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 8,
                    fontSize: 12,
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
                    marginTop: 4,
                    color: "#9a3412",
                    fontWeight: 700,
                    fontSize: 12,
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
                marginTop: 10,
                padding: 10,
                border: "1px solid #e2e8f0",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12 }}>
                Scan to pay pending {formatMoney(balance)}
              </div>
              <div style={{ fontSize: 10, color: "#64748b", margin: "2px 0 8px" }}>
                GPay · PhonePe · Paytm · BHIM
              </div>
              <div style={{ display: "inline-block", padding: 4, border: "1px solid #f1f5f9" }}>
                <QrCode value={upiQr} size={128} alt="Scan to pay" />
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            textAlign: "center",
            padding: "10px 18px 12px",
            borderTop: "1px solid #e2e8f0",
            color: "#64748b",
            fontSize: 10.5,
            lineHeight: 1.45,
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              fontFamily: '"Libre Baskerville", Georgia, serif',
              fontSize: 12,
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: 2,
            }}
          >
            Thank you for shopping with {BRAND.name}
          </div>
          <div>Freshness you can taste · Quality you can trust</div>
          <div style={{ marginTop: 4 }}>
            Loyalty{" "}
            <strong style={{ color: "#0f172a", fontWeight: 600 }}>
              {LOYALTY.portalUrl.replace(/^https?:\/\//, "")}
            </strong>{" "}
            · <strong style={{ color: "#0f172a", fontWeight: 600 }}>{BRAND.website}</strong> ·
            WhatsApp{" "}
            <strong style={{ color: "#0f172a", fontWeight: 600 }}>
              {BRAND.whatsappDisplay}
            </strong>{" "}
            · Redeem in shop · Computer-generated tax invoice
          </div>
        </div>
      </div>
    </div>
  );
}
