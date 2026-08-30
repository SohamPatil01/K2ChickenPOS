"use client";

import { motion } from "framer-motion";
import BrandMark from "@/components/customerDisplay/BrandMark";

const RATINGS: Array<{ value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }> = [
  { value: 1, emoji: "😞", label: "Not great" },
  { value: 2, emoji: "🙁", label: "Could be better" },
  { value: 3, emoji: "😐", label: "It was okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😍", label: "Loved it" },
];

export default function FeedbackScreen({
  submitted,
  onSelect,
}: {
  submitted: boolean;
  onSelect: (rating: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#fff7ed] via-[#fffaf4] to-[#ffedd5] px-5">
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-3xl rounded-[2rem] bg-white px-6 py-10 text-center shadow-2xl ring-1 ring-orange-100 sm:px-12 sm:py-14"
      >
        <BrandMark
          logoSizeClass="h-14 w-14"
          nameSizeClass="text-2xl sm:text-3xl"
          nameColorClass="text-[#9a1b1b]"
          badgePadClass="p-2"
        />
        <h1 className="mt-8 text-4xl font-black text-slate-900 sm:text-5xl">
          {submitted ? "Thank you!" : "How was your experience?"}
        </h1>
        <p className="mt-3 text-lg text-slate-500 sm:text-xl">
          {submitted ? "Your feedback helps us serve you better." : "Tap one emoji to tell us."}
        </p>

        {!submitted && (
          <div className="mt-10 flex justify-center gap-2 sm:gap-5">
            {RATINGS.map((rating) => (
              <button
                type="button"
                key={rating.value}
                onClick={() => onSelect(rating.value)}
                aria-label={rating.label}
                className="flex h-16 w-14 flex-col items-center justify-center rounded-2xl border border-orange-100 bg-[#fffaf4] text-4xl transition hover:-translate-y-1 hover:border-orange-300 hover:bg-orange-50 active:scale-95 sm:h-24 sm:w-24 sm:text-6xl"
              >
                <span>{rating.emoji}</span>
              </button>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
