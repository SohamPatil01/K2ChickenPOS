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

function loyaltyPointsForBill(grandTotal: number) {
  return Math.floor(Math.max(0, Number(grandTotal) || 0) * 0.0125);
}

export default function CustomerBill({ sale, store }: CustomerBillProps) {
  const storeName = store?.name || BRAND.name;
  const storePhone = store?.phone || BRAND.phoneDisplay;
  const { paid, balance, isPending } = paymentSummary(sale);
  const hasCredit = (sale.payments || []).some(
    (p) => String(p.method || "").toUpperCase() === "CREDIT" && Number(p.amount) > 0
  );
  const statusLabel =
    String(sale.status).toUpperCase() === "VOID"
      ? "CANCELLED"
      : isPending
        ? hasCredit
          ? "CREDIT DUE"
          : "AMOUNT DUE"
        : String(sale.status).toUpperCase() === "PAID"
          ? "PAID"
          : String(sale.status).toUpperCase();

  const statusBg =
    statusLabel === "CANCELLED" ? "#dc2626" : isPending ? "#c2410c" : "#15803d";

  const pointsEarned = loyaltyPointsForBill(sale.grandTotal);
  const upiCfg = getUpiConfig();
  const loyaltyHost = LOYALTY.portalUrl.replace(/^https?:\/\//, "");

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
        background: "#fbf7f2",
        color: "#1c1917",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: "12px",
        border: "1px solid #e7ddd2",
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 5,
          background: "linear-gradient(90deg, #E65C00 0%, #f59e0b 55%, #E65C00 100%)",
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 14,
            padding: "22px 26px 18px",
            borderBottom: "1px solid #eadfd3",
            background: "linear-gradient(180deg, #fffdfb 0%, #fbf7f2 100%)",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND.logoPath}
                alt={BRAND.name}
                style={{
                  width: 52,
                  height: 52,
                  objectFit: "contain",
                  borderRadius: 12,
                  border: "1px solid #eadfd3",
                  background: "#fff",
                  padding: 4,
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {BRAND.name}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 10,
                    color: "#C04A00",
                    letterSpacing: "0.06em",
                    fontWeight: 600,
                  }}
                >
                  {BRAND.tagline}
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 10.5,
                lineHeight: 1.55,
                color: "#78716c",
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
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#a8a29e",
              }}
            >
              Tax Invoice
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 15,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {sale.saleNo}
            </div>
            <div style={{ marginTop: 3, fontSize: 10.5, color: "#78716c" }}>
              {new Date(sale.createdAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div style={{ marginTop: 10 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 11px",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  borderRadius: 999,
                  background: statusBg,
                  color: "#fff",
                }}
              >
                {statusLabel}
              </span>
            </div>
          </div>
        </div>

        <div style={{ padding: "18px 26px 10px" }}>
          {isPending && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
                padding: "12px 14px",
                borderRadius: 12,
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
                  {hasCredit ? "Credit bill" : "Balance due"}
                </div>
                <div style={{ fontSize: 11, color: "#c2410c", marginTop: 2 }}>
                  Pay below with UPI — amount is pre-filled
                </div>
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#9a3412",
                  fontVariantNumeric: "tabular-nums",
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
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                border: "1px solid #eadfd3",
                background: "#fffdfb",
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#a8a29e",
                  marginBottom: 5,
                  fontWeight: 700,
                }}
              >
                Bill to
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {sale.customer?.name || "Walk-in Customer"}
              </div>
              {sale.customer?.phone && (
                <div style={{ marginTop: 2, fontSize: 11, color: "#78716c" }}>
                  {sale.customer.phone}
                </div>
              )}
              {sale.customer?.area && (
                <div style={{ marginTop: 2, fontSize: 11, color: "#78716c" }}>
                  {sale.customer.area}
                </div>
              )}
            </div>
            <div
              style={{
                border: "1px solid #eadfd3",
                background: "#fffdfb",
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#a8a29e",
                  marginBottom: 5,
                  fontWeight: 700,
                }}
              >
                Store
              </div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{storeName}</div>
              <div style={{ marginTop: 2, fontSize: 11, color: "#78716c" }}>
                {storePhone}
              </div>
              {sale.createdBy?.name && (
                <div style={{ marginTop: 2, fontSize: 11, color: "#78716c" }}>
                  Cashier: {sale.createdBy.name}
                </div>
              )}
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#292524", color: "#fafaf9" }}>
                {["#", "Item", "Qty", "Rate", "Amount"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 8px",
                      textAlign: i < 2 ? "left" : "right",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      width: i === 0 ? 28 : undefined,
                      borderRadius:
                        i === 0 ? "8px 0 0 8px" : i === 4 ? "0 8px 8px 0" : 0,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, i) => (
                <tr
                  key={i}
                  style={{
                    borderBottom: "1px solid #efe6dc",
                    background: i % 2 === 1 ? "rgba(255,255,255,0.55)" : undefined,
                  }}
                >
                  <td style={{ padding: "10px 8px", color: "#a8a29e" }}>{i + 1}</td>
                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>
                    {item.product.name}
                  </td>
                  <td
                    style={{
                      padding: "10px 8px",
                      textAlign: "right",
                      color: "#57534e",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatQty(item)}
                  </td>
                  <td
                    style={{
                      padding: "10px 8px",
                      textAlign: "right",
                      color: "#57534e",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatMoney(item.rate)}
                  </td>
                  <td
                    style={{
                      padding: "10px 8px",
                      textAlign: "right",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatMoney(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <div style={{ width: 248 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "3px 0",
                  color: "#57534e",
                }}
              >
                <span>Subtotal</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatMoney(sale.subTotal)}
                </span>
              </div>
              {sale.discountTotal > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                    color: "#57534e",
                  }}
                >
                  <span>Discount</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    - {formatMoney(sale.discountTotal)}
                  </span>
                </div>
              )}
              {sale.taxTotal > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                    color: "#57534e",
                  }}
                >
                  <span>Tax</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatMoney(sale.taxTotal)}
                  </span>
                </div>
              )}
              {(sale.deliveryFee ?? 0) > 0 && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                    color: "#57534e",
                  }}
                >
                  <span>Delivery</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatMoney(sale.deliveryFee!)}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: 8,
                  padding: "12px 14px",
                  background: "#E65C00",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 12,
                  borderRadius: 10,
                }}
              >
                <span>Grand Total</span>
                <span
                  style={{
                    fontSize: 19,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
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
                    fontWeight: 700,
                  }}
                >
                  <span>Total paid</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatMoney(paid)}
                  </span>
                </div>
              )}
              {isPending && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                    color: "#9a3412",
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  <span>Amount due</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatMoney(balance)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {(sale.payments || []).some((p) => Number(p.amount) > 0) && (
            <div
              style={{
                marginTop: 14,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid #eadfd3",
                background: "#fffdfb",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#a8a29e",
                  marginBottom: 6,
                  fontWeight: 700,
                }}
              >
                Payment details
              </div>
              {(sale.payments || [])
                .filter((p) => Number(p.amount) > 0)
                .map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      padding: "3px 0",
                      color: "#44403c",
                    }}
                  >
                    <span>{String(p.method || "").toUpperCase()}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatMoney(p.amount)}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {isPending && upiQr && (
            <div
              style={{
                marginTop: 14,
                padding: 16,
                borderRadius: 14,
                border: "1.5px solid #E65C00",
                background:
                  "linear-gradient(135deg, #fff8f1 0%, #ffffff 55%, #fff7ed 100%)",
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#C04A00",
                    marginBottom: 4,
                  }}
                >
                  Pay now
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1c1917" }}>
                  Scan this QR to clear your bill
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 26,
                    fontWeight: 800,
                    color: "#C04A00",
                    fontVariantNumeric: "tabular-nums",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {formatMoney(balance)}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "#78716c",
                    lineHeight: 1.45,
                  }}
                >
                  Open any UPI app and scan — amount for bill{" "}
                  <strong>{sale.saleNo}</strong> is already filled.
                  {upiCfg ? (
                    <>
                      <br />
                      Pay to {upiCfg.payeeName}
                    </>
                  ) : null}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#57534e",
                  }}
                >
                  GPay · PhonePe · Paytm · BHIM
                </div>
              </div>
              <div
                style={{
                  textAlign: "center",
                  padding: 8,
                  borderRadius: 12,
                  background: "#fff",
                  border: "1px solid #eadfd3",
                }}
              >
                <QrCode value={upiQr} size={148} alt="Scan to pay" />
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#a8a29e",
                  }}
                >
                  Scan to pay
                </div>
              </div>
            </div>
          )}

          {isPending && !upiQr && (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 12,
                border: "1px dashed #fdba74",
                background: "#fff7ed",
                textAlign: "center",
                fontSize: 12,
                color: "#9a3412",
                fontWeight: 600,
              }}
            >
              UPI QR unavailable — please pay {formatMoney(balance)} via WhatsApp{" "}
              {BRAND.whatsappDisplay} or at the counter.
            </div>
          )}

          {!isPending && statusLabel !== "CANCELLED" && (
            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                borderRadius: 12,
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#14532d" }}>
                Thank you for choosing {BRAND.name}
              </div>
              <div style={{ marginTop: 3, fontSize: 11, color: "#166534" }}>
                {pointsEarned > 0
                  ? `You earned ${pointsEarned} rewards points on this bill`
                  : "Fresh · Hygienic · Delivered with care"}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            textAlign: "center",
            padding: "14px 26px 16px",
            borderTop: "1px solid #eadfd3",
            color: "#78716c",
            fontSize: 10.5,
            lineHeight: 1.55,
            background: "#f3ebe3",
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: "#1c1917",
              marginBottom: 3,
            }}
          >
            {BRAND.name} · Tax Invoice
          </div>
          <div>
            Loyalty{" "}
            <strong style={{ color: "#C04A00", fontWeight: 700 }}>{loyaltyHost}</strong> ·{" "}
            <strong style={{ color: "#C04A00", fontWeight: 700 }}>{BRAND.website}</strong> ·
            WhatsApp{" "}
            <strong style={{ color: "#C04A00", fontWeight: 700 }}>
              {BRAND.whatsappDisplay}
            </strong>
          </div>
          <div style={{ marginTop: 3 }}>
            Computer-generated invoice · No signature required
          </div>
        </div>
      </div>
    </div>
  );
}
