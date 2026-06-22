"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QrCodeProps {
  value: string;
  size?: number;
  /** Quiet zone / margin in modules. */
  margin?: number;
  className?: string;
  alt?: string;
}

/**
 * Renders a QR code as an <img> from a value string. Regenerates whenever the
 * value changes (e.g. UPI amount updates), so the displayed QR always matches
 * the current payable amount.
 */
export default function QrCode({
  value,
  size = 256,
  margin = 1,
  className,
  alt = "QR code",
}: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setDataUrl("");
      return;
    }
    QRCode.toDataURL(value, {
      width: size,
      margin,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [value, size, margin]);

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-label={alt}
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={alt}
      className={className}
    />
  );
}
