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

// Hold the "Payment Successful" celebration, then invite a review, then idle.
const SUCCESS_HOLD_MS = 3000;
const REVIEW_HOLD_MS = 120000;

export default function CustomerDisplayPage() {
  const [phase, setPhase] = useState<Phase>("init");
  const [storeId, setStoreId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  const [mode, setMode] = useState<DisplayMode>("idle");
  const [bill, setBill] = useState<BillUpdatePayload | null>(null);
  const [payment, setPayment] = useState<PaymentModePayload | null>(null);
  const [success, setSuccess] = useState<SuccessModePayload | null>(null);

  const lastSeqRef = useRef(0);

  // Resolve the pairing token (from ?pair= or stored session) on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
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
      case DISPLAY_EVENTS.BILL_UPDATE:
        setBill(data as BillUpdatePayload);
        setMode("billing");
        break;
      case DISPLAY_EVENTS.MODE_PAYMENT:
        setPayment(data as PaymentModePayload);
        setMode("payment");
        break;
      case DISPLAY_EVENTS.MODE_SUCCESS:
        setSuccess(data as SuccessModePayload);
        setMode("success");
        break;
      case DISPLAY_EVENTS.MODE_IDLE:
        // The cashier publishes idle right after the sale completes, but we want
        // the success + review sequence to run its full course on the display.
        // A real new transaction (bill.update / payment) still interrupts.
        setMode((m) => (m === "success" || m === "review" ? m : "idle"));
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
    phase === "connected" && (status === "reconnecting" || status === "failed");

  return (
    <div className="fixed inset-0 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white">
      {phase === "pairing" ? (
        <PairingScreen />
      ) : phase === "init" ? (
        <div className="flex h-full items-center justify-center text-2xl text-white/50">
          Loading…
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="h-full w-full"
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
