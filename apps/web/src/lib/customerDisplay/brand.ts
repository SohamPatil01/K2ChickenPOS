/** Branding for the customer-facing display. Mirrors the receipt branding. */
export const BRAND = {
  name: "K2 Chicken",
  tagline: "Fresh. Hygienic. Delivered with care.",
  phone: "8484978622",
  website: "www.k2chicken.com",
  address:
    "Shop No. 4, 24K Glitterati, New DP Rd, Kolte Patil, Vishal Nagar, Pimple Nilakh, Pimpri-Chinchwad, Maharashtra 411027",
  logoPath: "/chicken-vicken-logo.png",
  promos: [
    "Ask about today's fresh cuts & combos",
    "Home delivery available — ask the counter",
    "Share your phone number to start earning points",
  ],
} as const;

/**
 * Loyalty scheme advertised on the customer display.
 * Keep these in sync with:
 * - apps/api/src/routes/sales.ts (earn rate 1.25%)
 * - packages/shared/src/schemas.ts (LOYALTY_POINT_VALUE = ₹1)
 */
export const LOYALTY = {
  title: "K2 Loyalty Rewards",
  headline: "Earn points on every purchase",
  earnPercentLabel: "1.25%",
  earnDetail: "of your bill back as points",
  redeemLabel: "1 point = ₹1",
  redeemDetail: "off your next bill",
  howToJoin: "Share your mobile number at the counter to join — free",
  tips: [
    "Points credited when you pay with your linked number",
    "Redeem anytime at checkout",
    "Silver · Gold · Platinum as you spend more",
  ],
} as const;

/**
 * Post-payment "leave us a review" poster shown on the customer display.
 * The URL can be overridden per deployment with NEXT_PUBLIC_REVIEW_URL.
 */
export const REVIEW = {
  url:
    (process.env.NEXT_PUBLIC_REVIEW_URL || "").trim() ||
    "https://g.page/r/CTCzJHARt1JaEBM/review",
  heading: "Loved our Chicken?",
  subheading: "Let others know too!",
  cta: "Scan to leave a review",
  incentivePercent: "5%",
  incentiveTitle: "Instant discount",
  incentiveSub: "on your next order",
  badges: ["Cut Fresh", "Hygienic", "Delivered Fast"],
} as const;

/** Returns the configured review URL, or null if explicitly disabled. */
export function getReviewUrl(): string | null {
  const url = REVIEW.url.trim();
  return url ? url : null;
}

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
