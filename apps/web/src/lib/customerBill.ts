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

/**
 * Original line-art rooster mark — a weathervane-style silhouette, drawn
 * for this invoice specifically (not stock art). `ROOSTER_MARK` is the bare
 * silhouette for small crisp use (e.g. the footer sign-off); `ROOSTER_BADGE`
 * wraps it in a ring with wheat-sprig flourishes for use as a large,
 * low-opacity background watermark.
 */
const ROOSTER_MARK = `<g fill="currentColor">
  <path d="M118 108 C 150 95, 168 62, 160 28 C 158 60, 142 82, 116 100 C 118 103, 118 106, 118 108 Z"/>
  <path d="M112 112 C 138 88, 148 52, 132 20 C 136 52, 128 80, 104 104 C 107 108, 110 110, 112 112 Z"/>
  <path d="M104 114 C 120 84, 120 48, 100 22 C 110 50, 108 78, 92 106 C 96 109, 100 112, 104 114 Z"/>
  <path d="M60 118 C 58 100, 72 86, 92 86 C 112 86, 126 98, 128 116 C 130 132, 120 148, 98 150 C 76 152, 62 138, 60 118 Z"/>
  <path d="M64 100 C 56 88, 50 74, 54 60 C 58 66, 62 72, 68 76 C 66 84, 66 92, 68 100 Z"/>
  <circle cx="52" cy="54" r="13"/>
  <path d="M44 44 C 42 39, 46 36, 49 40 C 50 35, 56 35, 56 40 C 59 36, 64 39, 61 44 C 58 47, 47 47, 44 44 Z"/>
  <path d="M40 58 L 27 55 L 40 51 Z"/>
  <path d="M42 62 C 39 65, 39 70, 43 71 C 45 67, 44 64, 42 62 Z"/>
  <path d="M92 148 L 90 172" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M90 172 L 78 178 M90 172 L 90 180 M90 172 L 100 177" stroke="currentColor" stroke-width="3.5" fill="none" stroke-linecap="round"/>
</g>
<ellipse cx="90" cy="181" rx="20" ry="3" fill="currentColor" opacity="0.3"/>`;

function roosterBadgeSvg(opts: {
  size: number;
  color: string;
  opacity?: number;
  rotate?: number;
  ring?: boolean;
}): string {
  const { size, color, opacity = 1, rotate = 0, ring = true } = opts;
  return `<svg width="${size}" height="${size}" viewBox="0 0 240 240" style="color:${color};opacity:${opacity};transform:rotate(${rotate}deg)">
    ${ring ? `<circle cx="120" cy="122" r="100" fill="none" stroke="currentColor" stroke-width="2"/>` : ""}
    <g transform="translate(30,20)">${ROOSTER_MARK}</g>
    ${
      ring
        ? `<g stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round">
      <path d="M40 190 Q30 150 45 105"/>
      <path d="M43 175 L32 170 M45 162 L33 158 M47 149 L35 146 M49 136 L37 134 M51 123 L40 122 M53 111 L42 111"/>
      <path d="M200 190 Q210 150 195 105"/>
      <path d="M197 175 L208 170 M195 162 L207 158 M193 149 L205 146 M191 136 L203 134 M189 123 L200 122 M187 111 L198 111"/>
    </g>`
        : ""
    }
  </svg>`;
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
    "table.items tbody tr, table tbody tr, .card, .pay, .qr, .alert, .totals, .grid2";
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
    return await QRCode.toDataURL(upi, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  } catch {
    return "";
  }
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

  const statusLabel =
    String(sale.status).toUpperCase() === "VOID"
      ? "CANCELLED"
      : isPending
        ? "PENDING"
        : String(sale.status).toUpperCase();

  // Paid = confirmed green, Pending = brand amber, Cancelled = red — a
  // filled pill reads as a real status at a glance instead of a grey chip.
  const statusBg =
    isPending ? "#fb923c" : statusLabel === "CANCELLED" ? "#ef4444" : "#16a34a";

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
    /*
     * Font stack is intentionally system-only — no Google Fonts. Two reasons:
     * 1) this is rendered inside an offscreen hidden iframe for the PDF/canvas
     *    capture, where webfont loading is a real, hard-to-debug race;
     * 2) IBM Plex Sans's served subsets don't cover U+20B9 (₹), so the rupee
     *    sign silently fell back to a different font than the digits next to
     *    it on every single price. A system-ui stack loads instantly and has
     *    full glyph coverage, so every amount renders in one consistent face.
     */
    @page { size: A4; margin: 10mm; }
    @media print {
      body { background: #fff !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .bill { box-shadow: none !important; border: none !important; }
      .bill { animation: none !important; opacity: 1 !important; transform: none !important; }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #eef0f2;
      color: #16181c;
      -webkit-font-smoothing: antialiased;
    }
    /* On-screen only — settles well before the PDF/canvas capture reads the
       page, and is force-disabled under @media print above regardless. */
    @keyframes billIn {
      from { opacity: 0; transform: translateY(10px) scale(0.99); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .bill {
      position: relative;
      max-width: 680px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e4e7eb;
      overflow: hidden;
      animation: billIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .topbar { height: 4px; background: #E65C00; }
    .wm {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none; z-index: 0; overflow: hidden;
    }
    .inner { position: relative; z-index: 1; }
    .hdr {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 16px; padding: 24px 28px 20px;
      border-bottom: 2px solid #16181c;
    }
    .brand-row { display: flex; align-items: center; gap: 12px; }
    .brand-row img {
      width: 46px; height: 46px; object-fit: contain; flex-shrink: 0;
      border: 1px solid #e4e7eb; background: #fff; padding: 3px;
    }
    .brand-name {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 22px; font-weight: 700; line-height: 1.2; color: #16181c;
      letter-spacing: -0.01em;
    }
    .brand-tag {
      margin-top: 2px; font-size: 9.5px; color: #E65C00;
      letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700;
    }
    .meta {
      margin-top: 10px; font-size: 10.5px; line-height: 1.6; color: #5c6470; max-width: 320px;
    }
    .inv { text-align: right; flex-shrink: 0; }
    .inv-label {
      font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; color: #5c6470;
    }
    .inv-no { margin-top: 6px; font-size: 16px; font-weight: 700; color: #16181c; font-variant-numeric: tabular-nums; }
    .inv-dt { margin-top: 3px; font-size: 10.5px; color: #5c6470; }
    .badge {
      display: inline-block; margin-top: 10px; padding: 3px 10px;
      border-radius: 3px;
      font-size: 9px; font-weight: 700; letter-spacing: 0.1em;
      background: ${statusBg}; color: #ffffff;
    }
    .body { padding: 20px 28px 8px; }
    .alert {
      display: flex; justify-content: space-between; align-items: center; gap: 10px;
      margin-bottom: 16px; padding: 12px 16px;
      border: 1px solid #fdba74; border-left: 3px solid #ea580c; background: #fff7ed;
    }
    .alert-l { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #9a3412; font-weight: 700; }
    .alert-s { font-size: 11px; color: #c2410c; margin-top: 1px; }
    .alert-amt { font-size: 19px; font-weight: 700; color: #9a3412; font-variant-numeric: tabular-nums; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 20px; border: 1px solid #e4e7eb; }
    .card { padding: 12px 16px; }
    .card + .card { border-left: 1px solid #e4e7eb; }
    .card-l { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #8a919c; margin-bottom: 4px; font-weight: 700; }
    .card-t { font-size: 13px; font-weight: 700; color: #16181c; }
    .card-s { font-size: 11px; color: #5c6470; margin-top: 2px; }
    table.items { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.items th {
      background: #16181c; color: #fff; font-size: 9px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.08em;
      padding: 9px 8px; text-align: left;
    }
    table.items th.r { text-align: right; }
    table.items td {
      padding: 9px 8px; border-bottom: 1px solid #e4e7eb; vertical-align: top;
    }
    table.items tbody tr:nth-child(even) td { background: #f8f9fa; }
    .c-muted { color: #b2b8c2; width: 28px; }
    .c-item { font-weight: 500; color: #16181c; }
    .c-num { text-align: right; font-variant-numeric: tabular-nums; color: #5c6470; }
    .c-strong { font-weight: 700; color: #16181c; }
    .totals { margin: 14px 0 4px; display: flex; justify-content: flex-end; }
    .totals-box { width: 240px; }
    .t-row {
      display: flex; justify-content: space-between; padding: 3px 0;
      font-size: 12px; color: #5c6470;
    }
    .t-row span:last-child { font-variant-numeric: tabular-nums; }
    .t-grand {
      margin-top: 8px; padding: 11px 14px;
      background: #E65C00;
      color: #fff;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 12px; font-weight: 600;
    }
    .t-grand span:last-child {
      font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .pay {
      margin: 16px 0 4px; padding: 12px 16px; border: 1px solid #e4e7eb;
    }
    .pay-l {
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em;
      color: #8a919c; margin-bottom: 6px; font-weight: 700;
    }
    .pay-row {
      display: flex; justify-content: space-between; font-size: 12px;
      padding: 3px 0; color: #33383f;
    }
    .pay-row span:last-child, .pay-total span:last-child, .pay-due span:last-child { font-variant-numeric: tabular-nums; }
    .pay-total {
      display: flex; justify-content: space-between; font-size: 12px;
      margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd2d9; font-weight: 600;
    }
    .pay-due {
      display: flex; justify-content: space-between; font-size: 12px;
      margin-top: 4px; font-weight: 700; color: #9a3412;
    }
    .qr {
      margin: 12px 0 6px; padding: 14px; border: 1px solid #e4e7eb; text-align: center;
    }
    .qr-t { font-size: 12px; font-weight: 700; color: #16181c; }
    .qr-s { font-size: 10px; color: #5c6470; margin: 2px 0 8px; }
    .qr img {
      width: 128px; height: 128px; background: #fff; padding: 4px;
      border: 1px solid #e4e7eb;
    }
    .ftr {
      border-top: 1px solid #e4e7eb; padding: 16px 28px 18px;
      text-align: center; font-size: 10.5px; color: #5c6470; line-height: 1.6;
      background: #fafbfc;
    }
    .ftr-badge { display: flex; justify-content: center; margin-bottom: 6px; }
    .ftr-t {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 13px; font-weight: 700; color: #16181c; margin-bottom: 3px;
    }
    .ftr strong { color: #C04A00; font-weight: 600; }
  </style>
</head>
<body>
  <div class="bill" id="k2-bill">
    <div class="topbar"></div>
    <div class="wm">${roosterBadgeSvg({ size: 380, color: "#E65C00", opacity: 0.1, rotate: -6 })}</div>
    <div class="inner">
      <div class="hdr">
        <div>
          <div class="brand-row">
            <img src="${logo}" alt="${escapeHtml(BRAND.name)}"/>
            <div>
              <div class="brand-name">${escapeHtml(BRAND.name)}</div>
              <div class="brand-tag">Fresh · Pure · Trusted</div>
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
            <div class="alert-l">Pending / Credit bill</div>
            <div class="alert-s">Balance still due on this invoice</div>
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
              ? `<div class="pay-due"><span>Pending amount</span><span>${formatMoney(balance)}</span></div>`
              : ""
          }
        </div>`
            : ""
        }

        ${
          isPending && qrDataUrl
            ? `<div class="qr">
          <div class="qr-t">Scan to pay pending ${formatMoney(balance)}</div>
          <div class="qr-s">GPay · PhonePe · Paytm · BHIM</div>
          <img src="${qrDataUrl}" alt="Scan to pay"/>
        </div>`
            : ""
        }
      </div>

      <div class="ftr">
        <div class="ftr-badge">${roosterBadgeSvg({ size: 40, color: "#C04A00", ring: false })}</div>
        <div class="ftr-t">Thank you for shopping with ${escapeHtml(BRAND.name)}</div>
        <div>Freshness you can taste · Quality you can trust</div>
        <div style="margin-top:4px;">
          Loyalty <strong>${escapeHtml(loyaltyHost)}</strong>
          · <strong>${escapeHtml(BRAND.website)}</strong>
          · WhatsApp <strong>${escapeHtml(BRAND.whatsappDisplay)}</strong>
          · Redeem in shop · Computer-generated tax invoice
        </div>
      </div>
    </div>
  </div>

  <div class="no-print" style="text-align:center;margin-top:14px;">
    <button onclick="window.print()" style="padding:10px 22px;border-radius:4px;background:#E65C00;color:#fff;border:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Print / Save as PDF</button>
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

/** Download the branded bill as a PDF file. */
export async function downloadCustomerBill(
  sale: BillSale,
  store?: BillStoreInfo
) {
  try {
    const html = await buildCustomerBillHtml(sale, store);
    await downloadHtmlRootAsPdf(html, "k2-bill", `K2-Bill-${sale.saleNo}.pdf`);
  } catch (err) {
    console.error("PDF bill download failed, opening print view:", err);
    await printCustomerBill(sale, store);
  }
}

/**
 * Render an HTML document (with a known root id) to a paginated PDF.
 * Shared by single bills and pending statements.
 */
export async function downloadHtmlRootAsPdf(
  html: string,
  rootId: string,
  filename: string
) {
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

    if (drawH <= maxContentH) {
      const pageH = Math.min(maxPageH, Math.max(drawH + margin * 2, 80));
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pageW, pageH],
        compress: true,
      });
      const x = margin + (usableW - drawW) / 2;
      pdf.addImage(imgData, "JPEG", x, margin, drawW, drawH);
      pdf.save(filename);
      return;
    }

    const scaleRatio = canvasRaw.width / billEl.getBoundingClientRect().width;
    const safeBreaksPx = safeBreaksCss
      .map((y) => Math.min(canvas.height, Math.round(y * scaleRatio) - topOffset + 3))
      .filter((y) => y > 0)
      .sort((a, b) => a - b);

    const pdf = new jsPDF({
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
    pdf.save(filename);
  } finally {
    document.body.removeChild(iframe);
  }
}
