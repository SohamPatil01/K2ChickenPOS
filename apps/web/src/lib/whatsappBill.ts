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
      ? `Please find your bill attached — scan the UPI QR on it to pay now.`
      : `Please find your bill attached.`,
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

/** Open WhatsApp chat for this sale's customer (shop WhatsApp on this device). */
export function openCustomerWhatsAppChat(sale: WhatsAppBillSale): boolean {
  const phone = normalizeIndiaMobile(sale.customer?.phone);
  if (!phone) return false;
  const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(buildCaption(sale))}`;
  window.open(waUrl, "_blank", "noopener,noreferrer");
  return true;
}

/** Render bill photo + PDF and trigger browser downloads (for attach in WhatsApp). */
export async function downloadBillFilesForWhatsApp(
  sale: WhatsAppBillSale,
  store?: BillStoreInfo
): Promise<boolean> {
  try {
    const files = await renderCustomerBillFiles(sale, store);
    triggerBlobDownload(files.imageBlob, files.imageFileName);
    triggerBlobDownload(files.pdfBlob, files.pdfFileName);
    return true;
  } catch (err) {
    console.error("[WhatsApp bill] download failed:", err);
    return false;
  }
}

export type ShareBillResult =
  | { ok: true; mode: "whatsapp_chat"; downloadOk: boolean }
  | { ok: false; reason: "no_phone" };

/**
 * Open the customer's WhatsApp chat immediately, then download the bill
 * photo + PDF in the background for attaching.
 */
export async function shareBillOnWhatsApp(
  sale: WhatsAppBillSale,
  store?: BillStoreInfo
): Promise<ShareBillResult> {
  if (!openCustomerWhatsAppChat(sale)) {
    return { ok: false, reason: "no_phone" };
  }
  const downloadOk = await downloadBillFilesForWhatsApp(sale, store);
  return { ok: true, mode: "whatsapp_chat", downloadOk };
}
