"use client";

import { BRAND } from "@/lib/customerDisplay/brand";

interface BrandMarkProps {
  /** Tailwind size classes for the logo image, e.g. "h-20 w-20". */
  logoSizeClass?: string;
  /** Tailwind size classes for the name text, e.g. "text-2xl". */
  nameSizeClass?: string;
  /** Tailwind color class for the name text. */
  nameColorClass?: string;
  /** Padding inside the white logo badge. */
  badgePadClass?: string;
  /** Hide the "K2 Chicken" name when only the logo is wanted. */
  showName?: boolean;
  /** Extra classes for the outer wrapper. */
  className?: string;
}

/**
 * Shared brand lockup for the customer display: the Chicken Vicken logo on a
 * clean white badge (the logo art has a white background, so the badge keeps it
 * crisp on dark screens) with the "K2 Chicken" name beneath it.
 */
export default function BrandMark({
  logoSizeClass = "h-20 w-20",
  nameSizeClass = "text-2xl",
  nameColorClass = "text-white",
  badgePadClass = "p-3",
  showName = true,
  className = "",
}: BrandMarkProps) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className={`rounded-2xl bg-white shadow-lg ${badgePadClass}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BRAND.logoPath}
          alt={BRAND.name}
          className={`${logoSizeClass} object-contain`}
        />
      </div>
      {showName && (
        <span
          className={`mt-2 font-black leading-tight tracking-tight ${nameSizeClass} ${nameColorClass}`}
        >
          {BRAND.name}
        </span>
      )}
    </div>
  );
}
