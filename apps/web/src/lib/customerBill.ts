import QRCode from "qrcode";
import { BRAND, LOYALTY } from "@/lib/customerDisplay/brand";
import { getUpiConfig, buildUpiString } from "@/lib/customerDisplay/upi";

export interface BillSale {
  id: string;
  saleNo: string;
  status: string;
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  deliveryFee?: number;
  grandTotal: number;
  createdAt: string;
  createdBy?: { name: string };
  customer?: {
    name: string;
    phone: string;
    area?: string | null;
  } | null;
  items: Array<{
    product: { name: string; unitType?: "KG" | "PCS" };
    qtyKg?: number;
    qtyPcs?: number;
    rate: number;
    lineTotal: number;
    taxRate?: number;
    taxAmount?: number;
  }>;
  payments?: Array<{ method: string; amount: number }>;
}

export interface BillStoreInfo {
  name?: string;
  phone?: string;
  tagline?: string;
}

function formatMoney(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatQty(item: BillSale["items"][0]) {
  if (item.qtyKg != null && item.qtyKg > 0) {
    return `${item.qtyKg.toFixed(2)} kg`;
  }
  if (item.qtyPcs != null && item.qtyPcs > 0) {
    return `${item.qtyPcs} pcs`;
  }
  return "-";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Cash/card/UPI count as paid; CREDIT is a promise, not money received. */
export function actualPayments(sale: BillSale) {
  return (sale.payments || []).filter(
    (p) => String(p.method || "").toUpperCase() !== "CREDIT"
  );
}

export function paymentSummary(sale: BillSale) {
  const paid = actualPayments(sale).reduce((s, p) => s + Number(p.amount || 0), 0);
  const methods = [
    ...new Set(actualPayments(sale).map((p) => String(p.method || "").toUpperCase())),
  ].join(", ") || "—";
  const balance = Math.max(0, Math.round(Number(sale.grandTotal) - paid));
  const isPending = balance > 0 && String(sale.status).toUpperCase() !== "VOID";
  return { paid, methods, balance, isPending };
}

function logoUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${BRAND.logoPath}`;
  }
  return BRAND.logoPath;
}

/** Embed logo as data-URL so PDF capture never misses/cors-breaks the image. */
async function embedLogoDataUrl(): Promise<string> {
  const fallback = logoUrl();
  if (typeof window === "undefined") return fallback;
  try {
    const res = await fetch(fallback, { cache: "force-cache" });
    if (!res.ok) return fallback;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || fallback));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return fallback;
  }
}

/**
 * Trim trailing near-white rows so the PDF has no empty band under the
 * footer. Returns the top offset trimmed off too, so callers that computed
 * DOM-relative pixel positions on the untrimmed canvas can re-align them.
 */
function trimCanvasWhitespace(
  source: HTMLCanvasElement
): { canvas: HTMLCanvasElement; topOffset: number } {
  const ctx = source.getContext("2d");
  if (!ctx) return { canvas: source, topOffset: 0 };
  const { width, height } = source;
  const { data } = ctx.getImageData(0, 0, width, height);
  const isBlank = (y: number) => {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      if (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248) return false;
    }
    return true;
  };
  let top = 0;
  let bottom = height - 1;
  while (top < bottom && isBlank(top)) top += 1;
  while (bottom > top && isBlank(bottom)) bottom -= 1;
  const pad = 4;
  const y0 = Math.max(0, top - pad);
  const y1 = Math.min(height - 1, bottom + pad);
  const trimH = y1 - y0 + 1;
  if (trimH >= height - 2) return { canvas: source, topOffset: 0 };
  const out = document.createElement("canvas");
  out.width = width;
  out.height = trimH;
  const octx = out.getContext("2d");
  if (!octx) return { canvas: source, topOffset: 0 };
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, width, trimH);
  octx.drawImage(source, 0, y0, width, trimH, 0, 0, width, trimH);
  return { canvas: out, topOffset: y0 };
}

/**
 * Bottom-edge Y offsets (in CSS px, relative to billEl's top) of every
 * "atomic" block that must never be sliced in half across a page break —
 * item rows and the boxed sections (bill-to/store cards, totals, payment,
 * QR, pending alert). Used to snap page breaks to a safe gap instead of an
 * arbitrary pixel height.
 */
function collectSafeBreakOffsets(billEl: HTMLElement): number[] {
  const billTop = billEl.getBoundingClientRect().top;
  const selector =
    "table.items tbody tr, table tbody tr, .card, .pay, .pay-scan, .thanks, .alert, .totals, .grid2";
  const offsets = Array.from(billEl.querySelectorAll(selector)).map(
    (el) => el.getBoundingClientRect().bottom - billTop
  );
  offsets.push(billEl.getBoundingClientRect().height);
  return Array.from(new Set(offsets.map((n) => Math.round(n)))).sort(
    (a, b) => a - b
  );
}

async function pendingQrDataUrl(
  amount: number,
  note?: string | null
): Promise<string> {
  const cfg = getUpiConfig();
  if (!cfg || !(amount > 0)) return "";
  const upi = buildUpiString({
    upiId: cfg.upiId,
    payeeName: cfg.payeeName,
    amount,
    note,
  });
  if (!upi) return "";
  try {
    // Larger QR so it scans cleanly from a WhatsApp bill photo.
    return await QRCode.toDataURL(upi, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1c1917", light: "#ffffff" },
    });
  } catch {
    return "";
  }
}

function loyaltyPointsForBill(grandTotal: number) {
  return Math.floor(Math.max(0, Number(grandTotal) || 0) * 0.0125);
}

export async function buildCustomerBillHtml(
  sale: BillSale,
  store?: BillStoreInfo
): Promise<string> {
  const storeName = store?.name || BRAND.name;
  const storePhone = store?.phone || BRAND.phoneDisplay;
  const { paid, balance, isPending } = paymentSummary(sale);
  const logo = await embedLogoDataUrl();
  const qrDataUrl = isPending
    ? await pendingQrDataUrl(balance, sale.saleNo)
    : "";

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
    statusLabel === "CANCELLED"
      ? "#dc2626"
      : isPending
        ? "#c2410c"
        : "#15803d";

  const pointsEarned = loyaltyPointsForBill(sale.grandTotal);
  const upiCfg = getUpiConfig();

  const itemRows = sale.items
    .map(
      (item, i) => `
    <tr>
      <td class="c-muted">${i + 1}</td>
      <td class="c-item">${escapeHtml(item.product?.name || "Item")}</td>
      <td class="c-num">${formatQty(item)}</td>
      <td class="c-num">${formatMoney(item.rate)}</td>
      <td class="c-num c-strong">${formatMoney(item.lineTotal)}</td>
    </tr>`
    )
    .join("");

  const paymentRows = (sale.payments || [])
    .filter((p) => Number(p.amount) > 0)
    .map(
      (p) => `
    <div class="pay-row">
      <span>${escapeHtml(String(p.method || "").toUpperCase())}</span>
      <span>${formatMoney(p.amount)}</span>
    </div>`
    )
    .join("");

  const loyaltyHost = LOYALTY.portalUrl.replace(/^https?:\/\//, "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Tax Invoice ${escapeHtml(sale.saleNo)} — ${escapeHtml(BRAND.name)}</title>
  <style>
    /* System fonts only — reliable ₹ glyphs + PDF iframe capture. */
    @page { size: A4; margin: 10mm; }
    @media print {
      body { background: #fff !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .bill { box-shadow: none !important; border: none !important; animation: none !important; }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #ebe4dc; color: #1c1917; -webkit-font-smoothing: antialiased;
    }
    .bill {
      position: relative; max-width: 680px; margin: 0 auto;
      background: #fbf7f2; border: 1px solid #e7ddd2; border-radius: 14px;
      overflow: hidden; box-shadow: 0 8px 28px rgba(28, 25, 23, 0.08);
    }
    .topbar {
      height: 5px;
      background: linear-gradient(90deg, #E65C00 0%, #f59e0b 55%, #E65C00 100%);
    }
    .inner { position: relative; z-index: 1; }
    .hdr {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 16px; padding: 22px 26px 18px;
      border-bottom: 1px solid #eadfd3;
      background: linear-gradient(180deg, #fffdfb 0%, #fbf7f2 100%);
    }
    .brand-row { display: flex; align-items: center; gap: 12px; }
    .brand-row img {
      width: 52px; height: 52px; object-fit: contain; flex-shrink: 0;
      border-radius: 12px; border: 1px solid #eadfd3; background: #fff; padding: 4px;
    }
    .brand-name {
      font-size: 22px; font-weight: 700; line-height: 1.15; color: #1c1917;
      letter-spacing: -0.02em;
    }
    .brand-tag {
      margin-top: 3px; font-size: 10px; color: #C04A00;
      letter-spacing: 0.06em; font-weight: 600;
    }
    .meta {
      margin-top: 10px; font-size: 10.5px; line-height: 1.55; color: #78716c; max-width: 340px;
    }
    .inv { text-align: right; flex-shrink: 0; }
    .inv-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: #a8a29e;
    }
    .inv-no { margin-top: 6px; font-size: 15px; font-weight: 700; color: #1c1917; font-variant-numeric: tabular-nums; }
    .inv-dt { margin-top: 3px; font-size: 10.5px; color: #78716c; }
    .badge {
      display: inline-block; margin-top: 10px; padding: 4px 11px;
      border-radius: 999px; font-size: 9px; font-weight: 700; letter-spacing: 0.08em;
      background: ${statusBg}; color: #ffffff;
    }
    .body { padding: 18px 26px 10px; }
    .alert {
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
      margin-bottom: 14px; padding: 12px 14px; border-radius: 12px;
      border: 1px solid #fdba74; background: #fff7ed;
    }
    .alert-l { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #9a3412; font-weight: 700; }
    .alert-s { font-size: 11px; color: #c2410c; margin-top: 2px; }
    .alert-amt { font-size: 20px; font-weight: 700; color: #9a3412; font-variant-numeric: tabular-nums; }
    .grid2 {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;
    }
    .card {
      padding: 12px 14px; border-radius: 12px;
      border: 1px solid #eadfd3; background: #fffdfb;
    }
    .card-l { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #a8a29e; margin-bottom: 5px; font-weight: 700; }
    .card-t { font-size: 13px; font-weight: 700; color: #1c1917; }
    .card-s { font-size: 11px; color: #78716c; margin-top: 2px; }
    table.items { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.items th {
      background: #292524; color: #fafaf9; font-size: 9px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.08em;
      padding: 10px 8px; text-align: left;
    }
    table.items th:first-child { border-radius: 8px 0 0 8px; }
    table.items th:last-child { border-radius: 0 8px 8px 0; text-align: right; }
    table.items th.r { text-align: right; }
    table.items td {
      padding: 10px 8px; border-bottom: 1px solid #efe6dc; vertical-align: top;
    }
    table.items tbody tr:nth-child(even) td { background: rgba(255,255,255,0.55); }
    .c-muted { color: #a8a29e; width: 28px; }
    .c-item { font-weight: 600; color: #1c1917; }
    .c-num { text-align: right; font-variant-numeric: tabular-nums; color: #57534e; }
    .c-strong { font-weight: 700; color: #1c1917; }
    .totals { margin: 14px 0 6px; display: flex; justify-content: flex-end; }
    .totals-box { width: 248px; }
    .t-row {
      display: flex; justify-content: space-between; padding: 3px 0;
      font-size: 12px; color: #57534e;
    }
    .t-row span:last-child { font-variant-numeric: tabular-nums; }
    .t-grand {
      margin-top: 8px; padding: 12px 14px; border-radius: 10px;
      background: #E65C00; color: #fff;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 12px; font-weight: 700;
    }
    .t-grand span:last-child {
      font-size: 19px; font-weight: 800; font-variant-numeric: tabular-nums;
    }
    .pay {
      margin: 14px 0 6px; padding: 12px 14px; border-radius: 12px;
      border: 1px solid #eadfd3; background: #fffdfb;
    }
    .pay-l {
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em;
      color: #a8a29e; margin-bottom: 6px; font-weight: 700;
    }
    .pay-row {
      display: flex; justify-content: space-between; font-size: 12px;
      padding: 3px 0; color: #44403c;
    }
    .pay-row span:last-child, .pay-total span:last-child, .pay-due span:last-child { font-variant-numeric: tabular-nums; }
    .pay-total {
      display: flex; justify-content: space-between; font-size: 12px;
      margin-top: 6px; padding-top: 6px; border-top: 1px dashed #d6d3d1; font-weight: 700;
    }
    .pay-due {
      display: flex; justify-content: space-between; font-size: 12px;
      margin-top: 4px; font-weight: 800; color: #9a3412;
    }
    /* Credit / pending: large pay-here scanner on the bill itself */
    .pay-scan {
      margin: 14px 0 8px; padding: 16px;
      border-radius: 14px; border: 1.5px solid #E65C00;
      background: linear-gradient(135deg, #fff8f1 0%, #ffffff 55%, #fff7ed 100%);
      display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: center;
    }
    .pay-scan-kicker {
      font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
      color: #C04A00; margin-bottom: 4px;
    }
    .pay-scan-title { font-size: 15px; font-weight: 700; color: #1c1917; line-height: 1.25; }
    .pay-scan-amt {
      margin-top: 8px; font-size: 26px; font-weight: 800; color: #C04A00;
      font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
    }
    .pay-scan-hint { margin-top: 6px; font-size: 11px; color: #78716c; line-height: 1.45; }
    .pay-scan-apps { margin-top: 8px; font-size: 10px; font-weight: 700; color: #57534e; }
    .pay-scan-qr {
      text-align: center; padding: 8px; border-radius: 12px;
      background: #fff; border: 1px solid #eadfd3;
    }
    .pay-scan-qr img {
      width: 148px; height: 148px; display: block; background: #fff;
    }
    .pay-scan-qr-cap {
      margin-top: 6px; font-size: 9px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: #a8a29e;
    }
    .pay-scan-missing {
      margin: 14px 0 8px; padding: 14px; border-radius: 12px;
      border: 1px dashed #fdba74; background: #fff7ed; text-align: center;
      font-size: 12px; color: #9a3412; font-weight: 600;
    }
    .thanks {
      margin: 12px 0 6px; padding: 12px 14px; border-radius: 12px;
      background: #ecfdf5; border: 1px solid #a7f3d0; text-align: center;
    }
    .thanks-t { font-size: 13px; font-weight: 700; color: #14532d; }
    .thanks-s { margin-top: 3px; font-size: 11px; color: #166534; }
    .ftr {
      border-top: 1px solid #eadfd3; padding: 14px 26px 16px;
      text-align: center; font-size: 10.5px; color: #78716c; line-height: 1.55;
      background: #f3ebe3;
    }
    .ftr-t { font-size: 12.5px; font-weight: 700; color: #1c1917; margin-bottom: 3px; }
    .ftr strong { color: #C04A00; font-weight: 700; }
  </style>
</head>
<body>
  <div class="bill" id="k2-bill">
    <div class="topbar"></div>
    <div class="inner">
      <div class="hdr">
        <div>
          <div class="brand-row">
            <img src="${logo}" alt="${escapeHtml(BRAND.name)}"/>
            <div>
              <div class="brand-name">${escapeHtml(BRAND.name)}</div>
              <div class="brand-tag">${escapeHtml(BRAND.tagline)}</div>
            </div>
          </div>
          <div class="meta">
            WhatsApp / Call ${escapeHtml(BRAND.whatsappDisplay)} · GSTIN ${escapeHtml(BRAND.gstin)}<br/>
            ${escapeHtml(BRAND.address)}
          </div>
        </div>
        <div class="inv">
          <div class="inv-label">Tax Invoice</div>
          <div class="inv-no">${escapeHtml(sale.saleNo)}</div>
          <div class="inv-dt">${formatDateTime(sale.createdAt)}</div>
          <div><span class="badge">${statusLabel}</span></div>
        </div>
      </div>

      <div class="body">
        ${
          isPending
            ? `<div class="alert">
          <div>
            <div class="alert-l">${hasCredit ? "Credit bill" : "Balance due"}</div>
            <div class="alert-s">Pay below with UPI — amount is pre-filled</div>
          </div>
          <div class="alert-amt">${formatMoney(balance)}</div>
        </div>`
            : ""
        }

        <div class="grid2">
          <div class="card">
            <div class="card-l">Bill to</div>
            <div class="card-t">${escapeHtml(sale.customer?.name || "Walk-in Customer")}</div>
            ${sale.customer?.phone ? `<div class="card-s">${escapeHtml(sale.customer.phone)}</div>` : ""}
            ${sale.customer?.area ? `<div class="card-s">${escapeHtml(sale.customer.area)}</div>` : ""}
          </div>
          <div class="card">
            <div class="card-l">Store</div>
            <div class="card-t">${escapeHtml(storeName)}</div>
            <div class="card-s">${escapeHtml(storePhone)}</div>
            ${sale.createdBy?.name ? `<div class="card-s">Cashier: ${escapeHtml(sale.createdBy.name)}</div>` : ""}
          </div>
        </div>

        <table class="items">
          <thead>
            <tr>
              <th style="width:28px">#</th>
              <th>Item</th>
              <th class="r">Qty</th>
              <th class="r">Rate</th>
              <th class="r">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div class="totals">
          <div class="totals-box">
            <div class="t-row"><span>Subtotal</span><span>${formatMoney(sale.subTotal)}</span></div>
            ${
              sale.discountTotal > 0
                ? `<div class="t-row"><span>Discount</span><span>- ${formatMoney(sale.discountTotal)}</span></div>`
                : ""
            }
            ${
              sale.taxTotal > 0
                ? `<div class="t-row"><span>Tax</span><span>${formatMoney(sale.taxTotal)}</span></div>`
                : ""
            }
            ${
              (sale.deliveryFee ?? 0) > 0
                ? `<div class="t-row"><span>Delivery</span><span>${formatMoney(sale.deliveryFee!)}</span></div>`
                : ""
            }
            <div class="t-grand"><span>Grand Total</span><span>${formatMoney(sale.grandTotal)}</span></div>
          </div>
        </div>

        ${
          (sale.payments || []).some((p) => Number(p.amount) > 0)
            ? `<div class="pay">
          <div class="pay-l">Payment details</div>
          ${paymentRows}
          ${
            paid > 0
              ? `<div class="pay-total"><span>Total paid</span><span>${formatMoney(paid)}</span></div>`
              : ""
          }
          ${
            isPending
              ? `<div class="pay-due"><span>Amount due</span><span>${formatMoney(balance)}</span></div>`
              : ""
          }
        </div>`
            : ""
        }

        ${
          isPending && qrDataUrl
            ? `<div class="pay-scan">
          <div>
            <div class="pay-scan-kicker">Pay now</div>
            <div class="pay-scan-title">Scan this QR to clear your bill</div>
            <div class="pay-scan-amt">${formatMoney(balance)}</div>
            <div class="pay-scan-hint">
              Open any UPI app and scan — amount for bill
              <strong>${escapeHtml(sale.saleNo)}</strong> is already filled.
              ${upiCfg ? `<br/>Pay to ${escapeHtml(upiCfg.payeeName)}` : ""}
            </div>
            <div class="pay-scan-apps">GPay · PhonePe · Paytm · BHIM</div>
          </div>
          <div class="pay-scan-qr">
            <img src="${qrDataUrl}" alt="Scan to pay ${formatMoney(balance)}"/>
            <div class="pay-scan-qr-cap">Scan to pay</div>
          </div>
        </div>`
            : isPending
              ? `<div class="pay-scan-missing">
          UPI QR unavailable — please pay ${formatMoney(balance)} via WhatsApp ${escapeHtml(BRAND.whatsappDisplay)} or at the counter.
        </div>`
              : ""
        }

        ${
          !isPending && statusLabel !== "CANCELLED"
            ? `<div class="thanks">
          <div class="thanks-t">Thank you for choosing ${escapeHtml(BRAND.name)}</div>
          ${
            pointsEarned > 0
              ? `<div class="thanks-s">You earned <strong>${pointsEarned}</strong> rewards points on this bill</div>`
              : `<div class="thanks-s">Fresh · Hygienic · Delivered with care</div>`
          }
        </div>`
            : ""
        }
      </div>

      <div class="ftr">
        <div class="ftr-t">${escapeHtml(BRAND.name)} · Tax Invoice</div>
        <div>
          Loyalty <strong>${escapeHtml(loyaltyHost)}</strong>
          · <strong>${escapeHtml(BRAND.website)}</strong>
          · WhatsApp <strong>${escapeHtml(BRAND.whatsappDisplay)}</strong>
        </div>
        <div style="margin-top:3px;">Computer-generated invoice · No signature required</div>
      </div>
    </div>
  </div>

  <div class="no-print" style="text-align:center;margin-top:14px;">
    <button onclick="window.print()" style="padding:10px 22px;border-radius:10px;background:#E65C00;color:#fff;border:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:700;cursor:pointer;">Print / Save as PDF</button>
  </div>
</body>
</html>`;
}

export async function printCustomerBill(sale: BillSale, store?: BillStoreInfo) {
  const html = await buildCustomerBillHtml(sale, store);
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) {
    alert("Please allow popups to print the bill");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    setTimeout(() => win.print(), 400);
  };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(header || "")?.[1] || "application/octet-stream";
  const binary = atob(data || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export type RenderedBillFiles = {
  /** Full invoice photo (JPEG) — best for WhatsApp attach. */
  imageBlob: Blob;
  imageFileName: string;
  /** Paginated A4 PDF. */
  pdfBlob: Blob;
  pdfFileName: string;
};

/**
 * Render bill HTML to JPEG + PDF blobs (no download).
 * Shared by Download and WhatsApp share.
 */
export async function renderHtmlRootAsBillFiles(
  html: string,
  rootId: string,
  baseName: string
): Promise<RenderedBillFiles> {
  const iframe = document.createElement("iframe");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:720px;height:1400px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("No iframe document");
    doc.open();
    doc.write(html);
    doc.close();

    await new Promise<void>((resolve) => {
      const imgs = Array.from(doc.images || []);
      if (imgs.length === 0) {
        resolve();
        return;
      }
      let left = imgs.length;
      const done = () => {
        left -= 1;
        if (left <= 0) resolve();
      };
      imgs.forEach((img) => {
        if (img.complete) done();
        else {
          img.onload = done;
          img.onerror = done;
        }
      });
      setTimeout(resolve, 2500);
    });

    const billEl = doc.getElementById(rootId);
    if (!billEl) throw new Error("Bill element missing");

    (billEl as HTMLElement).style.animation = "none";
    (billEl as HTMLElement).style.opacity = "1";
    (billEl as HTMLElement).style.transform = "none";

    const safeBreaksCss = collectSafeBreakOffsets(billEl);

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvasRaw = await html2canvas(billEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 720,
    });
    const { canvas, topOffset } = trimCanvasWhitespace(canvasRaw);

    const pageW = 210;
    const maxPageH = 297;
    const margin = 8;
    const usableW = pageW - margin * 2;
    const maxContentH = maxPageH - margin * 2;
    const drawW = usableW;
    const drawH = (canvas.height * drawW) / canvas.width;

    const imgData = canvas.toDataURL("image/jpeg", 0.93);
    const imageBlob = dataUrlToBlob(imgData);
    const imageFileName = `${baseName}.jpg`;

    let pdf: InstanceType<typeof jsPDF>;

    if (drawH <= maxContentH) {
      const pageH = Math.min(maxPageH, Math.max(drawH + margin * 2, 80));
      pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pageW, pageH],
        compress: true,
      });
      const x = margin + (usableW - drawW) / 2;
      pdf.addImage(imgData, "JPEG", x, margin, drawW, drawH);
    } else {
      const scaleRatio = canvasRaw.width / billEl.getBoundingClientRect().width;
      const safeBreaksPx = safeBreaksCss
        .map((y) => Math.min(canvas.height, Math.round(y * scaleRatio) - topOffset + 3))
        .filter((y) => y > 0)
        .sort((a, b) => a - b);

      pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      const pxPerMm = canvas.width / drawW;
      const minSlicePx = 20 * pxPerMm;
      let offsetPx = 0;
      let page = 0;
      while (offsetPx < canvas.height - 0.5) {
        const hardMaxPx = Math.min(canvas.height, offsetPx + maxContentH * pxPerMm);
        const safeEndPx = safeBreaksPx.reduce(
          (best, y) => (y > offsetPx + minSlicePx && y <= hardMaxPx ? y : best),
          0
        );
        const sliceEndPx = safeEndPx > 0 ? safeEndPx : hardMaxPx;
        const slicePx = Math.max(1, Math.round(sliceEndPx - offsetPx));
        const srcY = Math.round(offsetPx);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(slicePx, canvas.height - srcY);
        const ctx = pageCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            srcY,
            canvas.width,
            pageCanvas.height,
            0,
            0,
            canvas.width,
            pageCanvas.height
          );
        }
        const sliceDrawH = pageCanvas.height / pxPerMm;
        if (page > 0) pdf.addPage();
        pdf.addImage(
          pageCanvas.toDataURL("image/jpeg", 0.93),
          "JPEG",
          margin,
          margin,
          drawW,
          sliceDrawH
        );
        offsetPx += pageCanvas.height;
        page += 1;
        if (page > 20) break;
      }
    }

    const pdfBlob = pdf.output("blob");
    const pdfFileName = `${baseName}.pdf`;
    return { imageBlob, imageFileName, pdfBlob, pdfFileName };
  } finally {
    document.body.removeChild(iframe);
  }
}

/** Render a sale bill to JPEG + PDF blobs. */
export async function renderCustomerBillFiles(
  sale: BillSale,
  store?: BillStoreInfo
): Promise<RenderedBillFiles> {
  const html = await buildCustomerBillHtml(sale, store);
  const safeNo = String(sale.saleNo || sale.id).replace(/[^\w.-]+/g, "_");
  return renderHtmlRootAsBillFiles(html, "k2-bill", `K2-Bill-${safeNo}`);
}

/** Download the branded bill as a PDF file. */
export async function downloadCustomerBill(
  sale: BillSale,
  store?: BillStoreInfo
) {
  try {
    const files = await renderCustomerBillFiles(sale, store);
    triggerBlobDownload(files.pdfBlob, files.pdfFileName);
  } catch (err) {
    console.error("PDF bill download failed, opening print view:", err);
    await printCustomerBill(sale, store);
  }
}

/**
 * Render an HTML document (with a known root id) to a paginated PDF and download it.
 * Shared by pending statements.
 */
export async function downloadHtmlRootAsPdf(
  html: string,
  rootId: string,
  filename: string
) {
  const baseName = filename.replace(/\.pdf$/i, "");
  const files = await renderHtmlRootAsBillFiles(html, rootId, baseName);
  triggerBlobDownload(files.pdfBlob, files.pdfFileName);
}
