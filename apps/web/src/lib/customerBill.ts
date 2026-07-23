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
  octx.fillStyle = "#fafafa";
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
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111827", light: "#ffffff" },
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

  const itemRows = sale.items
    .map(
      (item, i) => `
    <tr>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${i + 1}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;font-weight:500;">${escapeHtml(item.product.name)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${formatQty(item)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;text-align:right;">${formatMoney(item.rate)}</td>
      <td style="padding:10px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;">${formatMoney(item.lineTotal)}</td>
    </tr>`
    )
    .join("");

  const paymentRows = (sale.payments || [])
    .filter((p) => Number(p.amount) > 0)
    .map(
      (p) => `
    <div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:#374151;">
      <span>${escapeHtml(String(p.method || "").toUpperCase())}</span>
      <span>${formatMoney(p.amount)}</span>
    </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Bill ${escapeHtml(sale.saleNo)} — ${escapeHtml(BRAND.name)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    @media print {
      body { background: #fff !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .bill { box-shadow: none !important; border: none !important; }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 24px;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: #e8eaed; color: #1a1a1a;
    }
  </style>
</head>
<body>
  <div class="bill" id="k2-bill" style="position:relative;max-width:720px;margin:0 auto;background:#fafafa;border:1px solid #d1d5db;border-radius:4px;overflow:hidden;">
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0;overflow:hidden;">
      <img src="${logo}" alt="" style="width:280px;height:280px;object-fit:contain;opacity:0.06;"/>
    </div>
    <div style="position:relative;z-index:1;">
      <div style="background:#f3f4f6;border-bottom:1px solid #e5e7eb;padding:20px 24px 16px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
        <div style="min-width:0;flex:1;">
          <div style="display:flex;align-items:center;gap:12px;">
            <img src="${logo}" alt="${escapeHtml(BRAND.name)}" style="width:72px;height:72px;object-fit:contain;flex-shrink:0;border-radius:12px;background:#fff;border:1px solid #e5e7eb;padding:4px;"/>
            <div style="min-width:0;">
              <div style="font-size:26px;font-weight:800;color:#111827;letter-spacing:-0.02em;line-height:1.1;">${escapeHtml(BRAND.name)}</div>
              <div style="margin-top:4px;font-size:11px;color:#6b7280;letter-spacing:.12em;text-transform:uppercase;">Fresh · Pure · Trusted</div>
            </div>
          </div>
          <div style="margin-top:12px;font-size:11.5px;line-height:1.55;color:#4b5563;max-width:380px;">
            WhatsApp / Call ${escapeHtml(BRAND.whatsappDisplay)}<br/>
            GSTIN: ${escapeHtml(BRAND.gstin)}<br/>
            ${escapeHtml(BRAND.address)}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:13px;font-weight:700;color:#374151;letter-spacing:.08em;text-transform:uppercase;">Tax Invoice</div>
          <div style="margin-top:8px;font-size:15px;font-weight:700;color:#111827;">${escapeHtml(sale.saleNo)}</div>
          <div style="margin-top:4px;font-size:12px;color:#6b7280;">${formatDateTime(sale.createdAt)}</div>
          <div style="margin-top:10px;">
            <span style="display:inline-block;padding:3px 10px;border-radius:4px;background:${isPending ? "#fef3c7" : statusLabel === "CANCELLED" ? "#fee2e2" : "#f3f4f6"};color:${isPending ? "#92400e" : statusLabel === "CANCELLED" ? "#991b1b" : "#374151"};font-size:10px;font-weight:800;letter-spacing:.06em;border:1px solid ${isPending ? "#fcd34d" : statusLabel === "CANCELLED" ? "#fecaca" : "#e5e7eb"};">${statusLabel}</span>
          </div>
        </div>
      </div>

      <div style="padding:18px 24px 4px;">
        ${
          isPending
            ? `<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;">
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#92400e;font-weight:700;">Pending / Credit bill</div>
            <div style="font-size:12px;color:#a16207;margin-top:2px;">Balance still due on this invoice</div>
          </div>
          <div style="font-size:22px;font-weight:800;color:#92400e;">${formatMoney(balance)}</div>
        </div>`
            : ""
        }

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:18px;">
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:4px;">Bill to</div>
            <div style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(sale.customer?.name || "Walk-in Customer")}</div>
            ${sale.customer?.phone ? `<div style="font-size:12px;color:#6b7280;margin-top:3px;">Phone: ${escapeHtml(sale.customer.phone)}</div>` : ""}
            ${sale.customer?.area ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">Area: ${escapeHtml(sale.customer.area)}</div>` : ""}
          </div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:12px 14px;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:4px;">Store</div>
            <div style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(storeName)}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:3px;">Tel: ${escapeHtml(storePhone)}</div>
            ${sale.createdBy?.name ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">Cashier: ${escapeHtml(sale.createdBy.name)}</div>` : ""}
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;">
          <thead>
            <tr>
              <th style="background:#f3f4f6;color:#4b5563;font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:10px 8px;text-align:left;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;width:36px;">#</th>
              <th style="background:#f3f4f6;color:#4b5563;font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:10px 8px;text-align:left;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">Item</th>
              <th style="background:#f3f4f6;color:#4b5563;font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:10px 8px;text-align:right;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">Qty</th>
              <th style="background:#f3f4f6;color:#4b5563;font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:10px 8px;text-align:right;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">Rate</th>
              <th style="background:#f3f4f6;color:#4b5563;font-size:10px;text-transform:uppercase;letter-spacing:.06em;padding:10px 8px;text-align:right;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div style="margin:16px 0 8px;display:flex;justify-content:flex-end;">
          <div style="width:260px;">
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#4b5563;"><span>Subtotal</span><span>${formatMoney(sale.subTotal)}</span></div>
            ${
              sale.discountTotal > 0
                ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#4b5563;"><span>Discount</span><span>- ${formatMoney(sale.discountTotal)}</span></div>`
                : ""
            }
            ${
              sale.taxTotal > 0
                ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#4b5563;"><span>Tax</span><span>${formatMoney(sale.taxTotal)}</span></div>`
                : ""
            }
            ${
              (sale.deliveryFee ?? 0) > 0
                ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#4b5563;"><span>Delivery Fee</span><span>${formatMoney(sale.deliveryFee!)}</span></div>`
                : ""
            }
            <div style="margin-top:8px;padding:12px 14px;border-radius:6px;background:#111827;color:#fff;display:flex;justify-content:space-between;align-items:center;">
              <span>Grand Total</span><span style="font-size:18px;font-weight:800;">${formatMoney(sale.grandTotal)}</span>
            </div>
          </div>
        </div>

        ${
          (sale.payments || []).some((p) => Number(p.amount) > 0)
            ? `<div style="margin:16px 0;padding:14px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#9ca3af;margin-bottom:8px;">Payment details</div>
          ${paymentRows}
          ${
            paid > 0
              ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:8px;padding-top:8px;border-top:1px dashed #d1d5db;font-weight:600;"><span>Total paid</span><span>${formatMoney(paid)}</span></div>`
              : ""
          }
          ${
            isPending
              ? `<div style="display:flex;justify-content:space-between;font-size:13px;margin-top:6px;font-weight:700;color:#92400e;"><span>Pending amount</span><span>${formatMoney(balance)}</span></div>`
              : ""
          }
        </div>`
            : ""
        }

        ${
          isPending && qrDataUrl
            ? `<div style="margin:8px 0 20px;padding:18px;border-radius:6px;background:#fff;border:1px solid #e5e7eb;text-align:center;">
          <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:4px;">Scan to pay pending ${formatMoney(balance)}</div>
          <div style="font-size:12px;color:#6b7280;margin-bottom:14px;">GPay · PhonePe · Paytm · BHIM</div>
          <img src="${qrDataUrl}" alt="Scan to pay" style="width:168px;height:168px;background:#fff;padding:8px;border:1px solid #f3f4f6;border-radius:6px;"/>
        </div>`
            : ""
        }
      </div>

      <div style="border-top:1px solid #e5e7eb;padding:14px 24px 16px;text-align:center;font-size:11.5px;color:#6b7280;line-height:1.55;background:#f9fafb;">
        <div style="font-weight:700;color:#111827;">Thank you for shopping with ${escapeHtml(BRAND.name)}</div>
        <div>Freshness you can taste · Quality you can trust</div>
        <div style="margin-top:6px;">
          Loyalty: <strong style="color:#111827;">${escapeHtml(LOYALTY.portalUrl.replace(/^https?:\/\//, ""))}</strong>
          · Website: <strong style="color:#111827;">${escapeHtml(BRAND.website)}</strong><br/>
          WhatsApp: <strong style="color:#111827;">${escapeHtml(BRAND.whatsappDisplay)}</strong>
          · Redeem points in shop only<br/>
          Computer-generated tax invoice
        </div>
      </div>
    </div>
  </div>

  <div class="no-print" style="text-align:center;margin-top:16px;">
    <button onclick="window.print()" style="padding:10px 24px;background:#111827;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;">Print / Save as PDF</button>
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
    "position:fixed;left:-10000px;top:0;width:820px;height:1200px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("No iframe document");
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for logo / QR images
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

    const billEl = doc.getElementById("k2-bill");
    if (!billEl) throw new Error("Bill element missing");

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvasRaw = await html2canvas(billEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#fafafa",
      logging: false,
      windowWidth: 820,
    });
    const canvas = trimCanvasWhitespace(canvasRaw);

    // Page height follows the bill — no empty A4 band under short invoices.
    const pageW = 210; // mm (A4 width)
    const margin = 6;
    const usableW = pageW - margin * 2;
    const imgH = (canvas.height * usableW) / canvas.width;
    const maxPageH = 297; // A4 height
    const contentPageH = Math.min(maxPageH, Math.max(imgH + margin * 2, 60));

    if (imgH + margin * 2 <= maxPageH) {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pageW, contentPageH],
        compress: true,
      });
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.92),
        "JPEG",
        margin,
        margin,
        usableW,
        imgH
      );
      pdf.save(`K2-Bill-${sale.saleNo}.pdf`);
    } else {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });
      const usableH = maxPageH - margin * 2;
      const pxPerMm = canvas.width / usableW;
      let offsetMm = 0;
      let page = 0;
      while (offsetMm < imgH - 0.5) {
        const sliceH = Math.min(usableH, imgH - offsetMm);
        const slicePx = Math.max(1, Math.round(sliceH * pxPerMm));
        const srcY = Math.round(offsetMm * pxPerMm);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = slicePx;
        const ctx = pageCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#fafafa";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            srcY,
            canvas.width,
            slicePx,
            0,
            0,
            canvas.width,
            slicePx
          );
        }
        if (page > 0) pdf.addPage();
        pdf.addImage(
          pageCanvas.toDataURL("image/jpeg", 0.92),
          "JPEG",
          margin,
          margin,
          usableW,
          sliceH
        );
        offsetMm += sliceH;
        page += 1;
      }
      pdf.save(`K2-Bill-${sale.saleNo}.pdf`);
    }
  } catch (err) {
    console.error("PDF bill download failed, opening print view:", err);
    await printCustomerBill(sale, store);
  } finally {
    document.body.removeChild(iframe);
  }
}
