"use client";

import { motion } from "framer-motion";
import QrCode from "@/components/customerDisplay/QrCode";
import { BRAND, REVIEW, getReviewUrl } from "@/lib/customerDisplay/brand";

const FLOATING_HEARTS = [
  { left: "8%", top: "18%", size: 28, delay: 0 },
  { left: "16%", top: "70%", size: 20, delay: 0.6 },
  { left: "86%", top: "24%", size: 24, delay: 1.1 },
  { left: "78%", top: "78%", size: 18, delay: 0.3 },
  { left: "46%", top: "10%", size: 16, delay: 0.9 },
];

function Heart({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 21s-7.5-4.9-10-9.3C.4 8.4 2 5 5.3 5c2 0 3.4 1.2 4.2 2.4C10.3 6.2 11.7 5 13.7 5 17 5 18.6 8.4 17 11.7 14.5 16.1 12 21 12 21z" />
    </svg>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9a1b1b]/10 text-[#9a1b1b]">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-sm font-semibold uppercase tracking-wide text-[#7a1414] sm:text-base">
        {label}
      </span>
    </div>
  );
}

/**
 * Shown a few seconds after the "Payment Successful" animation. Invites the
 * customer to scan and leave a Google review while they're still at the
 * counter. Styled after the in-store review poster.
 */
export default function ReviewScreen() {
  const reviewUrl = getReviewUrl();

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#7d1212] via-[#9a1b1b] to-[#5e0d0d] px-4 py-6">
      {/* soft glows */}
      <div className="pointer-events-none absolute -left-24 top-1/4 h-[60vh] w-[60vh] rounded-full bg-amber-400/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-[60vh] w-[60vh] rounded-full bg-rose-500/10 blur-[120px]" />

      {/* floating hearts */}
      {FLOATING_HEARTS.map((h, i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute text-white/15"
          style={{ left: h.left, top: h.top }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: [0.1, 0.35, 0.1], y: [-6, 6, -6] }}
          transition={{ duration: 4, delay: h.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          <Heart className="" />
          <div style={{ width: h.size, height: h.size }} />
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140, damping: 18 }}
        className="relative z-10 flex w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] bg-[#fff8f1] shadow-2xl ring-1 ring-black/5 lg:flex-row"
      >
        {/* LEFT: message + incentive + badges */}
        <div className="flex flex-1 flex-col items-center px-7 py-8 text-center lg:items-start lg:px-10 lg:text-left">
          <div className="flex items-center gap-3">
            <img src={BRAND.logoPath} alt={BRAND.name} className="h-11 w-11 object-contain" />
            <div className="leading-tight">
              <p className="text-2xl font-black text-[#9a1b1b] sm:text-3xl">{BRAND.name}</p>
              <p className="text-xs font-medium text-[#9a1b1b]/60 sm:text-sm">{BRAND.tagline}</p>
            </div>
          </div>

          <div className="mt-6">
            <h1 className="font-serif text-4xl italic text-slate-900 sm:text-5xl">
              {REVIEW.heading}
            </h1>
            <div className="mt-2 flex items-center justify-center gap-2 lg:justify-start">
              <span className="text-[#9a1b1b]">
                <Heart className="h-4 w-4" />
              </span>
              <p className="text-lg font-extrabold uppercase tracking-wider text-[#9a1b1b] sm:text-2xl">
                {REVIEW.subheading}
              </p>
            </div>
          </div>

          <p className="mt-4 max-w-md text-base text-slate-600 sm:text-lg">
            Your review helps us serve you better. It only takes a few seconds!
          </p>

          {/* incentive ribbon */}
          <div className="mt-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-[#9a1b1b] to-[#7a1414] px-6 py-4 shadow-lg">
            <span className="text-5xl font-black leading-none text-amber-300 sm:text-6xl">
              {REVIEW.incentivePercent}
            </span>
            <div className="text-left">
              <p className="text-lg font-extrabold uppercase tracking-wide text-white sm:text-xl">
                {REVIEW.incentiveTitle}
              </p>
              <p className="text-sm uppercase tracking-wide text-amber-100/80 sm:text-base">
                {REVIEW.incentiveSub}
              </p>
            </div>
          </div>

          {/* trust badges */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
            {REVIEW.badges.map((b) => (
              <Badge key={b} label={b} />
            ))}
          </div>
        </div>

        {/* RIGHT: QR */}
        <div className="flex flex-col items-center justify-center gap-4 bg-[#9a1b1b] px-8 py-8 lg:w-[40%]">
          <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-amber-200 sm:text-base">
            {REVIEW.cta}
          </p>
          {reviewUrl ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 16 }}
              className="rounded-3xl bg-white p-5 shadow-2xl"
            >
              <QrCode
                value={reviewUrl}
                size={420}
                alt="Scan to leave a review"
                className="h-60 w-60 sm:h-64 sm:w-64 lg:h-72 lg:w-72"
              />
            </motion.div>
          ) : (
            <div className="rounded-2xl border border-white/20 bg-white/10 px-6 py-8 text-center text-white/80">
              Review link not configured.
            </div>
          )}
          <p className="flex items-center gap-2 text-center text-sm text-amber-100/80 sm:text-base">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <rect x="3" y="5" width="18" height="14" rx="3" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Open your camera & point at the code
          </p>
        </div>
      </motion.div>
    </div>
  );
}
