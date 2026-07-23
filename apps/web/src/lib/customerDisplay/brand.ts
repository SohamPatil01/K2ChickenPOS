/** Branding for the customer-facing display. Mirrors the receipt branding. */
export const BRAND = {
  name: "K2 Chicken",
  tagline: "Fresh. Hygienic. Delivered with care.",
  /** Idle-screen header line (light Fresh Market edition). */
  displayTagline: "Fresh every morning · Cut to order",
  openPill: "Open now · Home delivery",
  phone: "8484978622",
  phoneDisplay: "+91 84849 78622",
  whatsapp: "918484978622",
  whatsappDisplay: "+91 84849 78622",
  gstin:
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_GSTIN || "").trim()) ||
    "27ATGPP7842L1Z0",
  website: "www.k2chicken.com",
  address:
    "Shop No. 4, 24K Glitterati, New DP Rd, Kolte Patil, Vishal Nagar, Pimple Nilakh, Pimpri-Chinchwad, Maharashtra 411027",
  logoPath: "/chicken-vicken-logo.png",
  promos: [
    "Ask about today's fresh cuts & combos",
    "Home delivery available — ask the counter",
    "Share your phone to earn points on every bill",
    "Invite a friend — both get 50 points free",
  ],
} as const;

/**
 * Loyalty scheme advertised on the customer display.
 * Keep these in sync with:
 * - apps/api/src/routes/sales.ts (earn rate 1.25%)
 * - packages/shared/src/schemas.ts (LOYALTY_POINT_VALUE = ₹1)
 */
export const LOYALTY = {
  title: "K2 Rewards",
  /** Full line shown on the idle loyalty slide. */
  headline: "Every bill pays you back",
  /** Substring of headline highlighted in brand orange. */
  headlineAccent: "pays you back",
  subhead:
    "Points on every order, spent like cash. No app, no card — just your phone number.",
  earnPercent: 1.25,
  earnPercentLabel: "1.25%",
  earnDetail: "back on every bill",
  redeemLabel: "1 pt = ₹1",
  redeemDetail: "off your next order",
  howToJoin: "Just share your mobile number at the counter — free to join",
  /** Customer portal (not POS). Override with NEXT_PUBLIC_LOYALTY_PORTAL_URL. */
  portalUrl:
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_LOYALTY_PORTAL_URL || "").trim()) ||
    "https://points.k2chicken.com",
  portalHint: "Scan to check your balance",
  websiteUrl: "https://www.k2chicken.com",
  tips: [
    "📱 Just your number",
    "🏪 Redeem in shop",
    "⭐ Silver · Gold · Platinum",
  ],
} as const;

/**
 * Referral pitch on the idle customer display.
 * Keep bonus in sync with packages/shared REFERRAL_BONUS_POINTS (= 50).
 */
export const REFERRAL = {
  title: "Bring a friend",
  /** Full line shown on the idle referral slide. */
  headline: "Invite Friends. Earn Together.",
  /** Substring of headline highlighted in brand green. */
  headlineAccent: "Earn Together.",
  subhead:
    "Every friend who places their first order rewards both of you.",
  bonusPoints: 50,
  bonusLabel: "₹50",
  youLabel: "for You",
  friendLabel: "for Your Friend",
  howItWorks: [
    "Share your code or number",
    "They order once & pay",
    "You both get 50 points instantly",
  ],
  cta: "Get your code at points.k2chicken.com — or tell them your number here",
  portalHint: "Scan to grab your invite code",
  /** QR target for invite flow (falls back to portal root). */
  inviteUrl:
    ((typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_LOYALTY_PORTAL_URL || "").trim()) ||
      "https://points.k2chicken.com") + "/invite",
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
