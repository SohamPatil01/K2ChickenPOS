"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  createDisplaySubscriber,
  type ConnectionStatus,
  type DisplaySubscriberHandle,
} from "@/lib/customerDisplay/ablyClient";
import {
  DISPLAY_EVENTS,
  loadDisplaySession,
  saveDisplaySession,
  clearDisplaySession,
  type BillUpdatePayload,
  type PaymentModePayload,
  type SuccessModePayload,
  type DisplayMode,
} from "@/lib/customerDisplay/types";
import { decodeStoreIdFromSession } from "@/lib/customerDisplay/brand";
import IdleScreen from "./components/IdleScreen";
import BillingScreen from "./components/BillingScreen";
import PaymentScreen from "./components/PaymentScreen";
import SuccessScreen from "./components/SuccessScreen";
import ReviewScreen from "./components/ReviewScreen";
import PairingScreen from "./components/PairingScreen";

type Phase = "init" | "pairing" | "connected";

// Show "Payment Successful" briefly, then invite a review, then idle.
const SUCCESS_HOLD_MS = 4000;
/** Long enough to scan the review QR; was 120s and felt "stuck". */
const REVIEW_HOLD_MS = 20000;
/**
 * Ignore stray mode.idle for a short window after a live bill. Empty POS tabs
 * (other browser profiles) can still publish idle over the shared Ably channel.
 */
const IGNORE_IDLE_AFTER_BILL_MS = 12000;

export default function CustomerDisplayPage() {
  const [phase, setPhase] = useState<Phase>("init");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  /** `?preview=1` — show idle carousel without pairing (design preview only). */
  const [previewIdle, setPreviewIdle] = useState(false);

  const [mode, setMode] = useState<DisplayMode>("idle");
  const [bill, setBill] = useState<BillUpdatePayload | null>(null);
  const [payment, setPayment] = useState<PaymentModePayload | null>(null);
  const [success, setSuccess] = useState<SuccessModePayload | null>(null);

  const lastSeqRef = useRef(0);
  const modeRef = useRef<DisplayMode>("idle");
  /** Don't let a rogue idle wipe a bill that just arrived. */
  const ignoreIdleUntilRef = useRef(0);
  const logoTapRef = useRef({ count: 0, timer: null as ReturnType<typeof setTimeout> | null });
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  /** Emergency: tap the top bar 5× quickly to clear a frozen bill locally. */
  const forceLocalIdle = useCallback(() => {
    const taps = logoTapRef.current;
    taps.count += 1;
    if (taps.timer) clearTimeout(taps.timer);
    taps.timer = setTimeout(() => {
      taps.count = 0;
    }, 1200);
    if (taps.count >= 5) {
      taps.count = 0;
      setBill(null);
      setPayment(null);
      setSuccess(null);
      setMode("idle");
    }
  }, []);

  // Resolve the pairing token (from ?pair= or stored session) on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("preview") === "1" || params.get("preview") === "idle") {
      setPreviewIdle(true);
      setPhase("connected");
      return;
    }
    const pair = params.get("pair");
    let token = pair || loadDisplaySession();

    if (pair) {
      saveDisplaySession(pair);
      // Strip the token from the URL so it isn't left lying around.
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (!token) {
      setPhase("pairing");
      return;
    }
    const sid = decodeStoreIdFromSession(token);
    if (!sid) {
      clearDisplaySession();
      setPhase("pairing");
      return;
    }
    setSessionToken(token);
    setStoreId(sid);
    setPhase("connected");
  }, []);

  const handleEvent = useCallback((name: string, data: any) => {
    // Drop out-of-order / replayed events.
    if (data?.seq != null) {
      if (data.seq <= lastSeqRef.current) return;
      lastSeqRef.current = data.seq;
    }
    switch (name) {
      case DISPLAY_EVENTS.BILL_UPDATE: {
        const payload = data as BillUpdatePayload;
        const cur = modeRef.current;
        const empty = !payload.items || payload.items.length === 0;
        // Cart clear after a sale must not abort success → review.
        // A real next customer (items present) still takes over immediately.
        if ((cur === "success" || cur === "review") && empty) break;
        if (empty) {
          setBill(payload);
          setMode("idle");
          break;
        }
        ignoreIdleUntilRef.current = Date.now() + IGNORE_IDLE_AFTER_BILL_MS;
        setBill(payload);
        setMode("billing");
        break;
      }
      case DISPLAY_EVENTS.MODE_PAYMENT:
        ignoreIdleUntilRef.current = Date.now() + IGNORE_IDLE_AFTER_BILL_MS;
        setPayment(data as PaymentModePayload);
        setMode("payment");
        break;
      case DISPLAY_EVENTS.MODE_SUCCESS:
        ignoreIdleUntilRef.current = 0;
        setSuccess(data as SuccessModePayload);
        setMode("success");
        break;
      case DISPLAY_EVENTS.MODE_IDLE:
        // Cashier often publishes idle when the cart clears / success toast
        // ends. Always finish success → review; only an explicit Reset
        // (force) may cut the review short. A new bill/payment also interrupts.
        if (modeRef.current === "success") {
          break;
        }
        if (modeRef.current === "review" && !data?.force) {
          break;
        }
        if (
          !data?.force &&
          (modeRef.current === "billing" || modeRef.current === "payment") &&
          Date.now() < ignoreIdleUntilRef.current
        ) {
          break;
        }
        setBill(null);
        setPayment(null);
        setMode("idle");
        break;
      default:
        break;
    }
  }, []);

  // Subscribe to the store channel once paired.
  useEffect(() => {
    if (phase !== "connected" || !storeId || !sessionToken) return;
    let cancelled = false;
    let handle: DisplaySubscriberHandle | null = null;

    void createDisplaySubscriber({
      storeId,
      sessionToken,
      onStatus: setStatus,
      onEvent: handleEvent,
    }).then((h) => {
      if (cancelled) h.close();
      else handle = h;
    });

    return () => {
      cancelled = true;
      handle?.close();
    };
  }, [phase, storeId, sessionToken, handleEvent]);

  // After the success celebration, advance to the review invitation.
  useEffect(() => {
    if (mode !== "success") return;
    const id = setTimeout(() => setMode("review"), SUCCESS_HOLD_MS);
    return () => clearTimeout(id);
  }, [mode, success]);

  // After the review screen has been up a while, fall back to idle branding.
  useEffect(() => {
    if (mode !== "review") return;
    const id = setTimeout(() => setMode("idle"), REVIEW_HOLD_MS);
    return () => clearTimeout(id);
  }, [mode]);

  const showReconnecting =
    !previewIdle &&
    phase === "connected" &&
    (status === "reconnecting" || status === "failed");

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">
      {/* Invisible tap target — 5 quick taps force idle if the bill is frozen. */}
      <button
        type="button"
        aria-label="Reset display"
        onClick={forceLocalIdle}
        className="absolute left-0 top-0 z-50 h-16 w-24 cursor-default opacity-0"
      />
      {phase === "pairing" ? (
        <PairingScreen />
      ) : phase === "init" ? (
        <div className="flex h-full items-center justify-center text-2xl text-white/50">
          Loading…
        </div>
      ) : (
        // Crossfade (not wait): outgoing and incoming overlap so idle → bill →
        // pay → success never flashes through an empty frame.
        <div className="relative h-full w-full">
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={mode}
              initial={{ opacity: 0, scale: 0.988 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.008 }}
              transition={{
                duration: 0.55,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute inset-0 h-full w-full will-change-[opacity,transform]"
            >
              {mode === "billing" && bill ? (
                <BillingScreen bill={bill} />
              ) : mode === "payment" && payment ? (
                <PaymentScreen data={payment} />
              ) : mode === "success" && success ? (
                <SuccessScreen data={success} />
              ) : mode === "review" ? (
                <ReviewScreen />
              ) : (
                <IdleScreen />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Connection overlay */}
      <AnimatePresence>
        {showReconnecting && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full border border-amber-400/30 bg-amber-500/15 px-5 py-2 text-base font-medium text-amber-200 backdrop-blur"
          >
            <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            Reconnecting…
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
