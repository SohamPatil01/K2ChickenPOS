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

/** Trim trailing near-white rows so the PDF has no empty band under the footer. */
function trimCanvasWhitespace(source: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = source.getContext("2d");
  if (!ctx) return source;
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
  if (trimH >= height - 2) return source;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = trimH;
  const octx = out.getContext("2d");
  if (!octx) return source;
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, width, trimH);
  octx.drawImage(source, 0, y0, width, trimH, 0, 0, width, trimH);
  return out;
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

  const statusBg =
    isPending ? "#fff7ed" : statusLabel === "CANCELLED" ? "#fef2f2" : "#f1f5f9";
  const statusFg =
    isPending ? "#9a3412" : statusLabel === "CANCELLED" ? "#991b1b" : "#334155";
  const statusBd =
    isPending ? "#fdba74" : statusLabel === "CANCELLED" ? "#fecaca" : "#e2e8f0";

  const itemRows = sale.items
    .map(
      (item, i) => `
    <tr>
      <td class="c-muted">${i + 1}</td>
      <td class="c-item">${escapeHtml(item.product.name)}</td>
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
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap" rel="stylesheet"/>
  <style>
    @page { size: A4; margin: 10mm; }
    @media print {
      body { background: #fff !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .bill { box-shadow: none !important; border: none !important; }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background: #e2e8f0;
      color: #0f172a;
      -webkit-font-smoothing: antialiased;
    }
    .bill {
      position: relative;
      max-width: 680px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      overflow: hidden;
    }
    .wm {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      pointer-events: none; z-index: 0; overflow: hidden;
    }
    .wm img { width: 220px; height: 220px; object-fit: contain; opacity: 0.045; }
    .inner { position: relative; z-index: 1; }
    .hdr {
      display: flex; justify-content: space-between; align-items: flex-start;
      gap: 14px; padding: 16px 18px 12px;
      border-bottom: 2px solid #0f172a;
    }
    .brand-row { display: flex; align-items: center; gap: 10px; }
    .brand-row img {
      width: 52px; height: 52px; object-fit: contain; flex-shrink: 0;
      border: 1px solid #e2e8f0; background: #fff; padding: 3px;
    }
    .brand-name {
      font-family: "Libre Baskerville", Georgia, serif;
      font-size: 22px; font-weight: 700; line-height: 1.15; color: #0f172a;
      letter-spacing: -0.01em;
    }
    .brand-tag {
      margin-top: 3px; font-size: 10px; color: #64748b;
      letter-spacing: 0.14em; text-transform: uppercase; font-weight: 500;
    }
    .meta {
      margin-top: 8px; font-size: 11px; line-height: 1.45; color: #475569; max-width: 340px;
    }
    .inv { text-align: right; flex-shrink: 0; }
    .inv-label {
      font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; color: #0f172a;
    }
    .inv-no { margin-top: 6px; font-size: 14px; font-weight: 700; color: #0f172a; }
    .inv-dt { margin-top: 3px; font-size: 11px; color: #64748b; }
    .badge {
      display: inline-block; margin-top: 8px; padding: 2px 8px;
      font-size: 9px; font-weight: 700; letter-spacing: 0.08em;
      border: 1px solid ${statusBd}; background: ${statusBg}; color: ${statusFg};
    }
    .body { padding: 12px 18px 8px; }
    .alert {
      display: flex; justify-content: space-between; align-items: center; gap: 10px;
      margin-bottom: 10px; padding: 8px 12px;
      border: 1px solid #fdba74; background: #fff7ed;
    }
    .alert-l { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #9a3412; font-weight: 700; }
    .alert-s { font-size: 11px; color: #c2410c; margin-top: 1px; }
    .alert-amt { font-family: "Libre Baskerville", Georgia, serif; font-size: 18px; font-weight: 700; color: #9a3412; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
    .card { border: 1px solid #e2e8f0; padding: 8px 10px; background: #fff; }
    .card-l { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; margin-bottom: 3px; font-weight: 600; }
    .card-t { font-size: 13px; font-weight: 700; color: #0f172a; }
    .card-s { font-size: 11px; color: #64748b; margin-top: 2px; }
    table.items { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.items th {
      background: #0f172a; color: #f8fafc; font-size: 9px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.08em;
      padding: 7px 6px; text-align: left;
    }
    table.items th.r { text-align: right; }
    table.items td {
      padding: 7px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top;
    }
    .c-muted { color: #94a3b8; width: 28px; }
    .c-item { font-weight: 500; color: #0f172a; }
    .c-num { text-align: right; font-variant-numeric: tabular-nums; color: #334155; }
    .c-strong { font-weight: 700; color: #0f172a; }
    .totals { margin: 10px 0 4px; display: flex; justify-content: flex-end; }
    .totals-box { width: 240px; }
    .t-row {
      display: flex; justify-content: space-between; padding: 2px 0;
      font-size: 12px; color: #475569;
    }
    .t-grand {
      margin-top: 6px; padding: 8px 10px;
      background: #0f172a; color: #fff;
      display: flex; justify-content: space-between; align-items: center;
      font-size: 12px; font-weight: 600;
    }
    .t-grand span:last-child {
      font-family: "Libre Baskerville", Georgia, serif;
      font-size: 16px; font-weight: 700;
    }
    .pay {
      margin: 10px 0 4px; padding: 8px 10px; border: 1px solid #e2e8f0;
    }
    .pay-l {
      font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em;
      color: #94a3b8; margin-bottom: 6px; font-weight: 600;
    }
    .pay-row {
      display: flex; justify-content: space-between; font-size: 12px;
      padding: 2px 0; color: #334155;
    }
    .pay-total {
      display: flex; justify-content: space-between; font-size: 12px;
      margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-weight: 600;
    }
    .pay-due {
      display: flex; justify-content: space-between; font-size: 12px;
      margin-top: 4px; font-weight: 700; color: #9a3412;
    }
    .qr {
      margin: 8px 0 6px; padding: 10px; border: 1px solid #e2e8f0; text-align: center;
    }
    .qr-t { font-size: 12px; font-weight: 700; color: #0f172a; }
    .qr-s { font-size: 10px; color: #64748b; margin: 2px 0 8px; }
    .qr img {
      width: 128px; height: 128px; background: #fff; padding: 4px;
      border: 1px solid #f1f5f9;
    }
    .ftr {
      border-top: 1px solid #e2e8f0; padding: 10px 18px 12px;
      text-align: center; font-size: 10.5px; color: #64748b; line-height: 1.45;
      background: #f8fafc;
    }
    .ftr-t {
      font-family: "Libre Baskerville", Georgia, serif;
      font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 2px;
    }
    .ftr strong { color: #0f172a; font-weight: 600; }
  </style>
</head>
<body>
  <div class="bill" id="k2-bill">
    <div class="wm"><img src="${logo}" alt=""/></div>
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
    <button onclick="window.print()" style="padding:9px 20px;background:#0f172a;color:#fff;border:none;font-family:IBM Plex Sans,sans-serif;font-size:13px;font-weight:600;cursor:pointer;">Print / Save as PDF</button>
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
  const html = await buildCustomerBillHtml(sale, store);
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

    // Wait for logo / QR + web fonts so PDF text looks professional.
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
    try {
      const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts;
      if (fonts?.ready) await Promise.race([fonts.ready, new Promise((r) => setTimeout(r, 1500))]);
    } catch {
      // ignore
    }

    const billEl = doc.getElementById("k2-bill");
    if (!billEl) throw new Error("Bill element missing");

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
    const canvas = trimCanvasWhitespace(canvasRaw);

    const pageW = 210; // mm
    const maxPageH = 297;
    const margin = 8;
    const usableW = pageW - margin * 2;
    const maxContentH = maxPageH - margin * 2;
    let drawW = usableW;
    let drawH = (canvas.height * drawW) / canvas.width;

    // If only a sliver would spill (footer orphan), scale the whole bill onto one page.
    const orphanThreshold = maxContentH * 1.12; // up to ~12% over → squeeze onto 1 page
    if (drawH > maxContentH && drawH <= orphanThreshold) {
      const scale = maxContentH / drawH;
      drawW *= scale;
      drawH = maxContentH;
    }

    const imgData = canvas.toDataURL("image/jpeg", 0.93);

    if (drawH <= maxContentH) {
      // Custom page height = content (no blank A4 bottom); never taller than A4.
      const pageH = Math.min(maxPageH, Math.max(drawH + margin * 2, 80));
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pageW, pageH],
        compress: true,
      });
      const x = margin + (usableW - drawW) / 2;
      pdf.addImage(imgData, "JPEG", x, margin, drawW, drawH);
      pdf.save(`K2-Bill-${sale.saleNo}.pdf`);
      return;
    }

    // Truly long bills (many line items) — paginate without tiny orphan pages.
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    const pxPerMm = canvas.width / drawW;
    let offsetMm = 0;
    let page = 0;
    while (offsetMm < drawH - 0.5) {
      let sliceH = Math.min(maxContentH, drawH - offsetMm);
      // If the leftover after this slice is a tiny footer band, absorb it now.
      const leftover = drawH - offsetMm - sliceH;
      if (leftover > 0 && leftover < 28) {
        sliceH = drawH - offsetMm;
      }
      const slicePx = Math.max(1, Math.round(sliceH * pxPerMm));
      const srcY = Math.round(offsetMm * pxPerMm);
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
      // Last short page: shrink page height so we don't leave a blank band.
      if (page > 0 && offsetMm + sliceDrawH >= drawH - 0.5 && sliceDrawH < maxContentH) {
        // keep A4 for print consistency on multi-page
      }
      pdf.addImage(
        pageCanvas.toDataURL("image/jpeg", 0.93),
        "JPEG",
        margin,
        margin,
        drawW,
        sliceDrawH
      );
      offsetMm += sliceDrawH;
      page += 1;
      if (page > 20) break;
    }
    pdf.save(`K2-Bill-${sale.saleNo}.pdf`);
  } catch (err) {
    console.error("PDF bill download failed, opening print view:", err);
    await printCustomerBill(sale, store);
  } finally {
    document.body.removeChild(iframe);
  }
}
