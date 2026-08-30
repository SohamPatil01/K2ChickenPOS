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
  type CustomerFeedbackPayload,
  type CustomerSelectionPayload,
  type PaymentModePayload,
  type SuccessModePayload,
  type DisplayMode,
  type DraftFieldKey,
  type DraftFieldUpdatePayload,
} from "@/lib/customerDisplay/types";
import { decodeStoreIdFromSession } from "@/lib/customerDisplay/brand";
import api from "@/lib/api";
import { parseCustomerListResponse } from "@/lib/customers";
import IdleScreen from "./components/IdleScreen";
import BillingScreen from "./components/BillingScreen";
import PaymentScreen from "./components/PaymentScreen";
import SuccessScreen from "./components/SuccessScreen";
import ReviewScreen from "./components/ReviewScreen";
import CustomerJourneyModal, {
  type CustomerJourneyStep,
  type SelectedDisplayCustomer,
} from "./components/CustomerJourneyModal";
import FeedbackScreen from "./components/FeedbackScreen";
import PairingScreen from "./components/PairingScreen";
import type { CustomerInfoValues } from "./components/CustomerInfoPanel";
import NumPad from "@/components/NumPad";
import VirtualKeyboard from "@/components/VirtualKeyboard";

const EMPTY_PROFILE: CustomerInfoValues = { phone: "", name: "", line1: "", line2: "", city: "" };

const PREVIEW_BILL: BillUpdatePayload = {
  seq: 1,
  invoiceNo: null,
  customerName: null,
  items: [
    {
      name: "Delicious Ukad Masala",
      qtyKg: null,
      qtyPcs: 1,
      rate: 15,
      lineTotal: 15,
      taxRate: 0,
    },
    {
      name: "Crispy Chicken Burger",
      qtyKg: null,
      qtyPcs: 2,
      rate: 80,
      lineTotal: 160,
      taxRate: 0,
    },
  ],
  subTotal: 175,
  discount: 5,
  tax: 0,
  deliveryFee: 0,
  grandTotal: 170,
  loyaltyPointsEst: 2,
  loyaltyPointsAvailable: 0,
  loyaltyPointsRedeemed: 0,
  loyaltyDiscount: 0,
  savings: 5,
  hasFullAddress: false,
  profileRewardPending: false,
  profileRewardApplied: false,
  profileNudge: "add_phone",
};

function buildPreviewPayment(method: string): PaymentModePayload {
  const normalized = method.toUpperCase();
  const payments =
    normalized === "SPLIT"
      ? [
          { method: "UPI", amount: 100 },
          { method: "CASH", amount: 70 },
        ]
      : [{ method: normalized, amount: 170 }];
  const upiAmount = payments
    .filter((payment) => payment.method === "UPI" || payment.method === "ONLINE")
    .reduce((sum, payment) => sum + payment.amount, 0);

  return {
    seq: 1,
    grandTotal: 170,
    invoiceNo: "PREVIEW-001",
    payments,
    upiAmount,
    upiQrString:
      upiAmount > 0 ? "upi://pay?pa=preview@upi&pn=K2%20Chicken&am=100" : "",
    upiId: upiAmount > 0 ? "preview@upi" : "",
    payeeName: "K2 Chicken",
  };
}

const FIELD_TO_PROFILE_KEY: Record<DraftFieldKey, keyof CustomerInfoValues> = {
  phone: "phone",
  name: "name",
  line1: "line1",
  line2: "line2",
  city: "city",
};

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
  /** `?preview=1` shows idle; `?preview=billing` shows a sample order. */
  const [previewIdle, setPreviewIdle] = useState(false);

  const [mode, setMode] = useState<DisplayMode>("idle");
  const [bill, setBill] = useState<BillUpdatePayload | null>(null);
  const [payment, setPayment] = useState<PaymentModePayload | null>(null);
  const [success, setSuccess] = useState<SuccessModePayload | null>(null);
  /** Current values for phone/name/address — kept live via both the cashier's
   * own cart-page fields and taps here, whichever side types. */
  const [profile, setProfile] = useState<CustomerInfoValues>(EMPTY_PROFILE);
  /** Which field currently has an open editor (NumPad/VirtualKeyboard). */
  const [draftField, setDraftField] = useState<DraftFieldKey | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "sent" | "error">("idle");
  const [customerPromptOpen, setCustomerPromptOpen] = useState(false);
  const [customerJourneyStep, setCustomerJourneyStep] =
    useState<CustomerJourneyStep>("identify");
  const [selectedCustomer, setSelectedCustomer] =
    useState<SelectedDisplayCustomer | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSaleId, setFeedbackSaleId] = useState<string | null>(null);
  /** Matching customers (4+ digits typed) — tap to fill instead of retyping. */
  const [phoneMatches, setPhoneMatches] = useState<
    Array<{ id: string; name: string; phone: string; area?: string; loyaltyPoints?: number }>
  >([]);
  const phoneSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneSearchRequestRef = useRef(0);

  const lastSeqRef = useRef(0);
  const profileSeqRef = useRef(0);
  const loyaltySeqRef = useRef(0);
  const draftSeqRef = useRef(0);
  /** Timestamp of our own most recent local keystroke per field — lets the
   * inbound handler below ignore a stale/in-flight remote echo that would
   * otherwise stomp on what the customer just typed here. */
  const lastLocalDraftEditRef = useRef<Partial<Record<DraftFieldKey, number>>>({});
  const subscriberRef = useRef<DisplaySubscriberHandle | null>(null);
  const modeRef = useRef<DisplayMode>("idle");
  const draftFieldRef = useRef<DraftFieldKey | null>(null);
  const selectedCustomerRef = useRef<SelectedDisplayCustomer | null>(null);
  const customerPromptDismissedRef = useRef(false);
  const cashierCustomerEditingRef = useRef(false);
  const feedbackSeqRef = useRef(0);
  const registrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Don't let a rogue idle wipe a bill that just arrived. */
  const ignoreIdleUntilRef = useRef(0);
  const logoTapRef = useRef({ count: 0, timer: null as ReturnType<typeof setTimeout> | null });
  const resetCustomerJourney = useCallback(() => {
    if (registrationTimerRef.current) {
      clearTimeout(registrationTimerRef.current);
      registrationTimerRef.current = null;
    }
    setProfile(EMPTY_PROFILE);
    setDraftField(null);
    setSaveState("idle");
    setCustomerPromptOpen(false);
    setCustomerJourneyStep("identify");
    setSelectedCustomer(null);
    selectedCustomerRef.current = null;
    customerPromptDismissedRef.current = false;
    cashierCustomerEditingRef.current = false;
    setFeedbackSent(false);
    setFeedbackSaleId(null);
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    draftFieldRef.current = draftField;
  }, [draftField]);
  useEffect(() => {
    selectedCustomerRef.current = selectedCustomer;
  }, [selectedCustomer]);

  // Server typeahead once the phone editor is open and 3+ digits are in —
  // mirrors the same dropdown the cashier sees on the cart page.
  useEffect(() => {
    if (draftField !== "phone") {
      phoneSearchRequestRef.current += 1;
      setPhoneMatches([]);
      return;
    }
    const digits = profile.phone.replace(/\D/g, "");
    if (phoneSearchTimerRef.current) clearTimeout(phoneSearchTimerRef.current);
    if (digits.length < 3 || !sessionToken) {
      phoneSearchRequestRef.current += 1;
      setPhoneMatches([]);
      return;
    }
    const requestId = ++phoneSearchRequestRef.current;
    phoneSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get("/api/v1/customer-display/customers", {
          params: { q: digits, t: sessionToken },
        });
        if (requestId !== phoneSearchRequestRef.current) return;
        const { customers } = parseCustomerListResponse<{
          id: string;
          name: string;
          phone: string;
          area?: string;
          loyaltyPoints?: number;
        }>(res.data);
        setPhoneMatches(customers.slice(0, 6));
      } catch (error) {
        if (requestId !== phoneSearchRequestRef.current) return;
        console.error("Failed to match customers by phone:", error);
      }
    }, 250);
    return () => {
      if (phoneSearchTimerRef.current) clearTimeout(phoneSearchTimerRef.current);
    };
  }, [draftField, profile.phone, sessionToken]);

  /** Customer taps a suggested match — fills phone + name in one go. */
  const handleSelectPhoneMatch = useCallback(
    (customer: { id: string; name: string; phone: string; loyaltyPoints?: number }) => {
      lastLocalDraftEditRef.current.phone = Date.now();
      lastLocalDraftEditRef.current.name = Date.now();
      const selected: SelectedDisplayCustomer = {
        id: customer.id,
        phone: customer.phone,
        name: customer.name || "",
        loyaltyPoints: Math.max(0, Math.floor(Number((customer as any).loyaltyPoints) || 0)),
      };
      setSelectedCustomer(selected);
      selectedCustomerRef.current = selected;
      setCustomerJourneyStep("loyalty");
      setCustomerPromptOpen(true);
      setProfile((p) => ({ ...p, phone: customer.phone, name: customer.name || p.name }));
      setPhoneMatches([]);
      subscriberRef.current?.publishCustomerSelection({
        seq: ++profileSeqRef.current,
        customerId: selected.id,
        phone: selected.phone,
        name: selected.name,
        loyaltyPoints: selected.loyaltyPoints,
      });
      draftSeqRef.current += 1;
      subscriberRef.current?.publishDraft({
        field: "phone",
        value: customer.phone,
        open: false,
        seq: draftSeqRef.current,
      });
      draftSeqRef.current += 1;
      subscriberRef.current?.publishDraft({
        field: "name",
        value: customer.name || "",
        open: false,
        seq: draftSeqRef.current,
      });
      setDraftField(null);
    },
    []
  );

  // Seed the name from whatever the bill already knows once billing starts.
  useEffect(() => {
    if (mode === "billing" && bill?.customerName) {
      setProfile((p) => (p.name ? p : { ...p, name: bill.customerName || "" }));
    }
  }, [mode, bill]);

  // Fresh customer / new bill after a save — reset the panel for the next person.
  useEffect(() => {
    if (mode === "idle") {
      resetCustomerJourney();
    }
  }, [mode, resetCustomerJourney]);
  useEffect(() => {
    return () => {
      if (registrationTimerRef.current) clearTimeout(registrationTimerRef.current);
    };
  }, []);

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
    if (params.get("preview") === "billing") {
      setPreviewIdle(true);
      setBill(PREVIEW_BILL);
      setMode("billing");
      setPhase("connected");
      return;
    }
    if (params.get("preview") === "payment") {
      setPreviewIdle(true);
      setPayment(buildPreviewPayment(params.get("method") || "UPI"));
      setMode("payment");
      setPhase("connected");
      return;
    }
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
        if (cur === "success" || cur === "feedback" || cur === "review") {
          resetCustomerJourney();
        }
        setBill(payload);
        setMode("billing");
        if (!customerPromptDismissedRef.current && !selectedCustomerRef.current) {
          setCustomerJourneyStep("identify");
          setCustomerPromptOpen(true);
        }
        break;
      }
      case DISPLAY_EVENTS.MODE_PAYMENT:
        ignoreIdleUntilRef.current = Date.now() + IGNORE_IDLE_AFTER_BILL_MS;
        setPayment(data as PaymentModePayload);
        setMode("payment");
        break;
      case DISPLAY_EVENTS.MODE_SUCCESS:
        ignoreIdleUntilRef.current = 0;
        resetCustomerJourney();
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
      case DISPLAY_EVENTS.DRAFT_FIELD_UPDATE: {
        // Cashier's own field, mirrored here. Never publish back — that
        // would ping-pong the same update between the two sides forever.
        const payload = data as DraftFieldUpdatePayload;
        const key = FIELD_TO_PROFILE_KEY[payload.field];
        const cashierIsTakingOver =
          payload.open && (payload.field === "phone" || payload.field === "name");
        if (cashierIsTakingOver) {
          // Hide the customer journey as soon as the cashier starts editing.
          setCustomerPromptOpen(false);
          customerPromptDismissedRef.current = true;
          cashierCustomerEditingRef.current = true;
          setCustomerJourneyStep("identify");
          setSelectedCustomer(null);
          selectedCustomerRef.current = null;
          setDraftField(null);
        }
        // A remote update landing just after we typed locally is almost
        // always a stale/in-flight echo, not a genuine cashier edit —
        // applying it would snap the field back mid-keystroke.
        const DRAFT_LOCAL_EDIT_GRACE_MS = 700;
        const editedLocallyRecently =
          Date.now() - (lastLocalDraftEditRef.current[payload.field] || 0) < DRAFT_LOCAL_EDIT_GRACE_MS;
        if (!editedLocallyRecently) {
          setProfile((p) => ({ ...p, [key]: payload.value }));
        }
        if (payload.open && !cashierIsTakingOver) {
          setDraftField(payload.field);
        } else if (draftFieldRef.current === payload.field) {
          setDraftField(null);
        }
        break;
      }
      case DISPLAY_EVENTS.CUSTOMER_SELECTED: {
        const payload = data as CustomerSelectionPayload;
        const keepJourneyHidden = cashierCustomerEditingRef.current;
        const customer: SelectedDisplayCustomer = {
          id: payload.customerId,
          phone: payload.phone,
          name: payload.name,
          loyaltyPoints: Math.max(0, Math.floor(Number(payload.loyaltyPoints) || 0)),
        };
        setSelectedCustomer(customer);
        selectedCustomerRef.current = customer;
        setProfile((p) => ({ ...p, phone: customer.phone, name: customer.name }));
        setPhoneMatches([]);
        if (keepJourneyHidden) {
          setCustomerPromptOpen(false);
          customerPromptDismissedRef.current = true;
        } else {
          setCustomerJourneyStep("loyalty");
          setCustomerPromptOpen(true);
          customerPromptDismissedRef.current = false;
        }
        setSaveState("idle");
        if (registrationTimerRef.current) {
          clearTimeout(registrationTimerRef.current);
          registrationTimerRef.current = null;
        }
        break;
      }
      default:
        break;
    }
  }, [resetCustomerJourney]);

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
      else {
        handle = h;
        subscriberRef.current = h;
      }
    });

    return () => {
      cancelled = true;
      subscriberRef.current = null;
      handle?.close();
    };
  }, [phase, storeId, sessionToken, handleEvent]);

  /** Customer taps a field row here — opens its editor and tells the cashier. */
  const handleTapField = useCallback((field: DraftFieldKey) => {
    setDraftField(field);
    setProfile((p) => {
      draftSeqRef.current += 1;
      subscriberRef.current?.publishDraft({
        field,
        value: p[FIELD_TO_PROFILE_KEY[field]],
        open: true,
        seq: draftSeqRef.current,
      });
      return p;
    });
  }, []);

  /** Customer types into the open editor here — live keystrokes to the cashier. */
  const handleDraftChange = useCallback((field: DraftFieldKey, value: string) => {
    lastLocalDraftEditRef.current[field] = Date.now();
    setProfile((p) => ({ ...p, [FIELD_TO_PROFILE_KEY[field]]: value }));
    draftSeqRef.current += 1;
    subscriberRef.current?.publishDraft({ field, value, open: true, seq: draftSeqRef.current });
  }, []);

  /** Customer closes the editor here. */
  const handleCloseField = useCallback(() => {
    const field = draftFieldRef.current;
    if (!field) return;
    setDraftField(null);
    setProfile((p) => {
      draftSeqRef.current += 1;
      subscriberRef.current?.publishDraft({
        field,
        value: p[FIELD_TO_PROFILE_KEY[field]],
        open: false,
        seq: draftSeqRef.current,
      });
      return p;
    });
  }, []);

  const handleSave = useCallback(() => {
    setProfile((p) => {
      const phone = p.phone.trim();
      const name = p.name.trim();
      const line1 = p.line1.trim();
      const city = p.city.trim();
      if (phone.length < 10 || !name) {
        setSaveState("error");
        return p;
      }
      profileSeqRef.current += 1;
      subscriberRef.current?.publishProfile({
        seq: profileSeqRef.current,
        phone,
        name,
        addressLine1: line1 || undefined,
        addressLine2: p.line2.trim() || undefined,
        city: city || undefined,
      });
      setSaveState("sent");
      if (registrationTimerRef.current) clearTimeout(registrationTimerRef.current);
      registrationTimerRef.current = setTimeout(() => {
        setSaveState((state) => (state === "sent" ? "error" : state));
      }, 8000);
      return p;
    });
  }, []);

  const closeCustomerPrompt = useCallback(() => {
    setCustomerPromptOpen(false);
    customerPromptDismissedRef.current = true;
    setDraftField(null);
  }, []);

  const handleStartRegistration = useCallback(() => {
    if (profile.phone.replace(/\D/g, "").length < 10) return;
    setCustomerJourneyStep("register");
    setSaveState("idle");
  }, [profile.phone]);

  const handleRegisterCustomer = useCallback(() => {
    handleSave();
  }, [handleSave]);

  const handleKeepPoints = useCallback(() => {
    const customer = selectedCustomerRef.current;
    if (!customer) return;
    subscriberRef.current?.publishLoyaltyChoice({
      seq: ++loyaltySeqRef.current,
      customerId: customer.id,
      points: 0,
    });
    closeCustomerPrompt();
  }, [closeCustomerPrompt]);

  const handleRedeemPoints = useCallback(() => {
    const customer = selectedCustomerRef.current;
    if (!customer || !bill) return;
    const points = Math.max(
      0,
      Math.min(customer.loyaltyPoints, Math.floor(Math.max(0, bill.grandTotal)))
    );
    subscriberRef.current?.publishLoyaltyChoice({
      seq: ++loyaltySeqRef.current,
      customerId: customer.id,
      points,
    });
    closeCustomerPrompt();
  }, [bill, closeCustomerPrompt]);

  // After the success celebration, advance to the review invitation.
  useEffect(() => {
    if (mode !== "success") return;
    const id = setTimeout(() => {
      setFeedbackSaleId(success?.saleId || null);
      setFeedbackSent(false);
      setMode("feedback");
    }, SUCCESS_HOLD_MS);
    return () => clearTimeout(id);
  }, [mode, success]);

  // Give the customer a short, one-tap feedback screen before the review QR.
  useEffect(() => {
    if (mode !== "feedback") return;
    const id = setTimeout(() => setMode("review"), 12000);
    return () => clearTimeout(id);
  }, [mode]);

  const handleFeedback = useCallback((rating: 1 | 2 | 3 | 4 | 5) => {
    if (feedbackSent) return;
    setFeedbackSent(true);
    if (feedbackSaleId) {
      const payload: CustomerFeedbackPayload = {
        seq: ++feedbackSeqRef.current,
        saleId: feedbackSaleId,
        rating,
      };
      subscriberRef.current?.publishFeedback(payload);
    }
  }, [feedbackSaleId, feedbackSent]);

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
                <BillingScreen
                  bill={bill}
                  customerInfo={profile}
                  activeField={draftField}
                  onTapField={handleTapField}
                  onSaveCustomerInfo={handleSave}
                  saveState={saveState}
                />
              ) : mode === "payment" && payment ? (
                <PaymentScreen data={payment} />
              ) : mode === "success" && success ? (
                <SuccessScreen data={success} />
              ) : mode === "feedback" ? (
                <FeedbackScreen submitted={feedbackSent} onSelect={handleFeedback} />
              ) : mode === "review" ? (
                <ReviewScreen />
              ) : (
                <IdleScreen />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {customerPromptOpen && mode === "billing" && bill?.items?.length ? (
        <CustomerJourneyModal
          step={customerJourneyStep}
          phone={profile.phone}
          name={profile.name}
          matches={phoneMatches}
          customer={selectedCustomer}
          billTotal={bill.grandTotal}
          earnedEstimate={bill.loyaltyPointsEst}
          redeemablePoints={Math.max(
            0,
            Math.min(
              selectedCustomer?.loyaltyPoints || 0,
              Math.floor(Math.max(0, bill.grandTotal))
            )
          )}
          saveState={saveState}
          onTapPhone={() => handleTapField("phone")}
          onTapName={() => handleTapField("name")}
          onSelectMatch={handleSelectPhoneMatch}
          onRegister={handleRegisterCustomer}
          onRedeem={handleRedeemPoints}
          onKeep={handleKeepPoints}
          onNewCustomer={handleStartRegistration}
          onSkip={closeCustomerPrompt}
        />
      ) : null}

      {/* Field editor — mirrors whichever side (cashier or customer) opened it. */}
      {draftField === "phone" && (
        <NumPad
          value={profile.phone}
          onChange={(v) => handleDraftChange("phone", v.replace(/\D/g, "").slice(0, 12))}
          onClose={handleCloseField}
          onSubmit={handleCloseField}
          placeholder="Phone number"
          maxLength={12}
          matches={phoneMatches.map((c) => ({
            id: c.id,
            title: c.name || "No name",
            subtitle: c.area ? `${c.phone} • ${c.area}` : c.phone,
          }))}
          onSelectMatch={(match) => {
            const customer = phoneMatches.find((c) => c.id === match.id);
            if (customer) handleSelectPhoneMatch(customer);
          }}
        />
      )}
      {draftField && draftField !== "phone" && (
        <VirtualKeyboard
          value={profile[FIELD_TO_PROFILE_KEY[draftField]]}
          onChange={(v) => handleDraftChange(draftField, v)}
          onClose={handleCloseField}
          onSubmit={handleCloseField}
          placeholder={
            draftField === "name"
              ? "Your name"
              : draftField === "line1"
                ? "House / street"
                : draftField === "line2"
                  ? "Landmark, area"
                  : "City"
          }
        />
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
