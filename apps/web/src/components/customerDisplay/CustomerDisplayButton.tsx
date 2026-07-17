"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useCustomerDisplayStore } from "@/lib/customerDisplay/controller";
import QrCode from "./QrCode";

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("accessToken");
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  disconnected: "Offline",
  failed: "Unavailable",
  disabled: "Off",
};

/**
 * Cashier control. Lets the operator turn the customer display on/off and shows
 * a pairing QR/link for the TV/tablet. Purely additive — it never touches the
 * billing or cart logic.
 */
export default function CustomerDisplayButton({
  className = "",
}: {
  className?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const active = useCustomerDisplayStore((s) => s.active);
  const status = useCustomerDisplayStore((s) => s.status);
  const displayConnected = useCustomerDisplayStore((s) => s.displayConnected);
  const enable = useCustomerDisplayStore((s) => s.enable);
  const disable = useCustomerDisplayStore((s) => s.disable);

  const [open, setOpen] = useState(false);
  const [pairUrl, setPairUrl] = useState<string>("");
  const [loadingPair, setLoadingPair] = useState(false);
  const [pairError, setPairError] = useState<string>("");
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [copied, setCopied] = useState(false);

  // The exact URL to open on the TV/tablet — resolved from the live origin so it
  // always matches the domain the POS is actually served from.
  const displayUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/customer-display`
      : "/customer-display";

  const fetchPairing = useCallback(async () => {
    setLoadingPair(true);
    setPairError("");
    try {
      const res = await api.get("/api/v1/customer-display/pairing");
      const { sessionToken, realtimeEnabled: rt } = res.data || {};
      setRealtimeEnabled(rt !== false);
      if (sessionToken && typeof window !== "undefined") {
        setPairUrl(
          `${window.location.origin}/customer-display?pair=${encodeURIComponent(
            sessionToken
          )}`
        );
      }
    } catch (e: any) {
      setPairError(
        e?.response?.data?.error ||
          "Could not generate a pairing link. Please try again."
      );
    } finally {
      setLoadingPair(false);
    }
  }, []);

  useEffect(() => {
    if (open && !pairUrl && !loadingPair) {
      void fetchPairing();
    }
  }, [open, pairUrl, loadingPair, fetchPairing]);

  const handleToggle = () => {
    if (active) {
      disable();
    } else if (user?.storeId) {
      enable(user.storeId, getAccessToken);
    }
  };

  const statusColor = !active
    ? "bg-gray-400"
    : status === "connected"
    ? "bg-green-500"
    : status === "failed" || status === "disabled"
    ? "bg-red-500"
    : "bg-yellow-500";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 ${className}`}
        title="Customer Display"
      >
        <span className="text-base leading-none">🖥️</span>
        <span className="hidden sm:inline">Customer Display</span>
        <span className={`h-2 w-2 rounded-full ${statusColor}`} />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="my-auto w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-gray-900"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Customer Display
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Enable / disable */}
            <div className="mb-4 flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Mirror live bill to display
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                  {active ? STATUS_LABEL[status] || status : "Disabled"}
                  {active && displayConnected && " · Display online"}
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
                }`}
                role="switch"
                aria-checked={active}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    active ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {!realtimeEnabled && (
              <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                Realtime is not configured on the server (ABLY_API_KEY missing).
                The display will not receive live updates until it is set.
              </div>
            )}

            {/* Pairing */}
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <p className="mb-3 text-sm font-medium text-gray-900 dark:text-white">
                Pair a new display
              </p>
              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                On the TV / tablet, open this URL and scan the code (or open the
                pairing link below):
              </p>
              <p className="mb-3 break-all rounded-md bg-gray-100 px-2 py-1.5 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {displayUrl}
              </p>

              {loadingPair ? (
                <div className="flex h-48 items-center justify-center text-sm text-gray-400">
                  Generating…
                </div>
              ) : pairError ? (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {pairError}
                </div>
              ) : pairUrl ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="rounded-xl bg-white p-3">
                    <QrCode value={pairUrl} size={196} alt="Pairing QR code" />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(pairUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch {
                        // ignore clipboard errors
                      }
                    }}
                    className="w-full rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {copied ? "Link copied ✓" : "Copy pairing link"}
                  </button>
                </div>
              ) : null}
            </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
