/** Branding for the customer-facing display. Mirrors the receipt branding. */
export const BRAND = {
  name: "K2 Chicken",
  tagline: "Fresh. Hygienic. Delivered with care.",
  phone: "8484978622",
  logoPath: "/k2-chicken-logo.svg",
  promos: [
    "Earn 1 loyalty point for every ₹10 spent",
    "Ask about today's fresh cuts & combos",
    "Home delivery available — ask the counter",
  ],
} as const;

export function formatINR(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return `₹${Math.round(safe).toLocaleString("en-IN")}`;
}

export function formatINR2(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return `₹${safe.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Decode a JWT payload without verifying (display only needs the storeId). */
export function decodeStoreIdFromSession(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob !== "undefined"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("utf-8");
    const payload = JSON.parse(json);
    return payload?.storeId ? String(payload.storeId) : null;
  } catch {
    return null;
  }
}
