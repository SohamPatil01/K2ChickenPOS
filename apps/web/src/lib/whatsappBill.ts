import { BRAND, formatINR } from "@/lib/customerDisplay/brand";
import {
  renderCustomerBillFiles,
  type BillSale,
  type BillStoreInfo,
} from "@/lib/customerBill";

/** Last 10 digits for Indian mobile; returns null if unusable. */
export function normalizeIndiaMobile(phone: string | null | undefined): string | null {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  if (!/^[6-9]\d{9}$/.test(last10)) return null;
  return last10;
}

export type WhatsAppBillSale = BillSale;

function buildCaption(sale: WhatsAppBillSale): string {
  const name = (sale.customer?.name || "").trim();
  const greeting = name ? `Hi ${name},` : "Hi,";
  const amount = formatINR(sale.grandTotal);
  const paid = (sale.payments || [])
    .filter((p) => String(p.method || "").toUpperCase() !== "CREDIT")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const balance = Math.max(0, Math.round(Number(sale.grandTotal) - paid));
  const isDue = balance > 0 && String(sale.status).toUpperCase() !== "VOID";

  return [
    greeting,
    ``,
    `Thank you for ordering from ${BRAND.name}!`,
    ``,
    `Bill: #${sale.saleNo}`,
    `Amount: ${amount}`,
    isDue ? `Due: ${formatINR(balance)}` : null,
    ``,
    isDue
      ? `Your bill photo is attached — scan the UPI QR on it to pay now.`
      : `Your bill photo is attached.`,
    ``,
    `Questions? WhatsApp us on ${BRAND.whatsappDisplay}`,
  ]
    .filter((line) => line != null)
    .join("\n");
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

export type ShareBillResult =
  | { ok: true; mode: "share_sheet" }
  | { ok: true; mode: "whatsapp_attach" }
  | { ok: false; reason: "no_phone" | "render_failed" | "cancelled" };

/**
 * Share the bill as a photo (JPEG) / PDF on WhatsApp — no web link.
 *
 * 1) Prefer the system share sheet with the bill image attached (mobile / supported browsers).
 * 2) Otherwise download the bill photo + PDF and open the customer's WhatsApp chat
 *    so staff can attach the downloaded file and tap Send.
 */
export async function shareBillOnWhatsApp(
  sale: WhatsAppBillSale,
  store?: BillStoreInfo
): Promise<ShareBillResult> {
  const phone = normalizeIndiaMobile(sale.customer?.phone);
  if (!phone) return { ok: false, reason: "no_phone" };

  let files;
  try {
    files = await renderCustomerBillFiles(sale, store);
  } catch (err) {
    console.error("[WhatsApp bill] render failed:", err);
    return { ok: false, reason: "render_failed" };
  }

  const caption = buildCaption(sale);
  const imageFile = new File([files.imageBlob], files.imageFileName, {
    type: "image/jpeg",
  });
  const pdfFile = new File([files.pdfBlob], files.pdfFileName, {
    type: "application/pdf",
  });

  const nav = typeof navigator !== "undefined" ? navigator : null;
  const shareDataImage: ShareData = {
    files: [imageFile],
    title: `${BRAND.name} bill #${sale.saleNo}`,
    text: caption,
  };
  const shareDataPdf: ShareData = {
    files: [pdfFile],
    title: `${BRAND.name} bill #${sale.saleNo}`,
    text: caption,
  };

  try {
    if (nav?.canShare?.(shareDataImage)) {
      await nav.share(shareDataImage);
      return { ok: true, mode: "share_sheet" };
    }
    if (nav?.canShare?.(shareDataPdf)) {
      await nav.share(shareDataPdf);
      return { ok: true, mode: "share_sheet" };
    }
  } catch (err: any) {
    // User dismissed the sheet — don't fall through to downloads.
    if (err?.name === "AbortError") {
      return { ok: false, reason: "cancelled" };
    }
    console.warn("[WhatsApp bill] share sheet failed, using attach fallback:", err);
  }

  // Desktop / unsupported: download photo + PDF, open chat to customer.
  triggerBlobDownload(files.imageBlob, files.imageFileName);
  triggerBlobDownload(files.pdfBlob, files.pdfFileName);
  const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(caption)}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
  return { ok: true, mode: "whatsapp_attach" };
}
