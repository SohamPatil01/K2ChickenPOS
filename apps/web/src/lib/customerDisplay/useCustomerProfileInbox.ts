"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth";
import { useCartStore } from "@/store/cart";
import { useNotificationStore } from "@/store/notification";
import api from "@/lib/api";
import { createCustomerProfileInbox } from "./ablyClient";
import { publishCustomerSelection } from "./publishHelpers";
import {
  DISPLAY_EVENTS,
  type CustomerFeedbackPayload,
  type CustomerLoyaltyChoicePayload,
  type CustomerProfileSubmitPayload,
  type CustomerSelectionPayload,
  type DraftFieldUpdatePayload,
} from "./types";

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("accessToken");
  } catch {
    return null;
  }
}

/**
 * Live keystroke updates (display→cashier) are only meaningful while the
 * cashier is actually looking at the cart page's phone/name fields, so
 * they're not applied to global state here. Instead the single app-wide
 * inbox connection (this file) forwards them to whichever component is
 * currently mounted and cares, via this tiny listener registry — avoiding a
 * second Ably connection just for cart/page.tsx.
 */
type DraftListener = (payload: DraftFieldUpdatePayload) => void;
const draftListeners = new Set<DraftListener>();
type CustomerSelectionListener = (payload: CustomerSelectionPayload) => void;
const customerSelectionListeners = new Set<CustomerSelectionListener>();
const profileSubmissionsInFlight = new Set<string>();

export function onCustomerDraftFieldUpdate(fn: DraftListener): () => void {
  draftListeners.add(fn);
  return () => {
    draftListeners.delete(fn);
  };
}

export function onCustomerSelection(fn: CustomerSelectionListener): () => void {
  customerSelectionListeners.add(fn);
  return () => {
    customerSelectionListeners.delete(fn);
  };
}

/**
 * Applies a profile the customer typed directly on the customer display.
 * Operates purely on the global cart store / API — no dependency on which
 * page is currently mounted, since the cashier may be anywhere in the app
 * (POS grid, cart, etc.) when the customer submits.
 */
async function applyCustomerSubmittedProfile(payload: CustomerProfileSubmitPayload): Promise<void> {
  const phone = payload.phone.trim();
  const name = payload.name.trim();
  if (phone.length < 10 || !name) return;
  const submissionKey = `${phone}|${name}|${payload.addressLine1 || ""}|${payload.city || ""}`;
  if (profileSubmissionsInFlight.has(submissionKey)) return;
  profileSubmissionsInFlight.add(submissionKey);

  try {
    const cart = useCartStore.getState();
    const existingId = cart.customerId;
    const body = { phone, name, area: cart.customerArea || undefined };
    const currentPhone = String(cart.customerPhone || "").replace(/\D/g, "");
    // A stale cart customer must never be renamed to another customer's phone.
    // Resolve the exact phone first, then update that record or create a new one.
    const lookup = await api.get("/api/v1/customers", { params: { phone } });
    const phoneOwner = lookup.data;
    const targetId =
      phoneOwner?.id ||
      (existingId && currentPhone === phone ? existingId : null);
    const response = targetId
      ? await api.put(`/api/v1/customers/${targetId}`, body)
      : await api.post("/api/v1/customers", body);
    const customer = response.data;
    if (!customer) return;

    useCartStore.getState().setCustomer(customer.id, customer.phone, customer.name, customer.area || null);
    useCartStore
      .getState()
      .setCustomerLoyaltyPoints(Number(customer.loyaltyPoints) || 0);
    const selection = {
      customerId: customer.id,
      phone: customer.phone,
      name: customer.name || "",
      loyaltyPoints: Math.max(0, Math.floor(Number(customer.loyaltyPoints) || 0)),
    };
    customerSelectionListeners.forEach((fn) => fn({ ...selection, seq: 0 }));
    publishCustomerSelection(selection);

    if (payload.addressLine1 && payload.city) {
      const addrPayload = {
        label: "Home",
        line1: payload.addressLine1.trim(),
        line2: payload.addressLine2?.trim() || undefined,
        city: payload.city.trim(),
      };
      const addrRes = await api.post(`/api/v1/customers/${customer.id}/addresses`, addrPayload);
      useCartStore
        .getState()
        .setCustomerAddress(addrRes.data.line1, addrRes.data.line2, addrRes.data.city, addrRes.data.id);
    }

    if (customer.profileReward) {
      useCartStore.getState().setProfileRewardPending(Boolean(customer.profileReward.pending));
    }

    useNotificationStore.getState().showNotification("Customer submitted their details from the display", "success");
  } catch (err: any) {
    console.error("[CustomerProfileInbox] Failed to apply customer-submitted profile:", err);
    useNotificationStore
      .getState()
      .showNotification("Failed to save customer details from display: " + (err.response?.data?.error || err.message), "error");
  } finally {
    profileSubmissionsInFlight.delete(submissionKey);
  }
}

/**
 * Session-level (not page-level) subscription for phone/name/address the
 * customer typed on the customer display. Mounted once for the whole
 * authenticated session (in StoreShell) so a submission isn't lost just
 * because the cashier isn't currently viewing the cart page.
 */
export function useCustomerProfileInbox(): void {
  const storeId = useAuthStore((s) => s.user?.storeId);
  const lastSubmitSeqRef = useRef(0);
  const lastDraftSeqRef = useRef(0);
  const lastSelectionSeqRef = useRef(0);
  const lastLoyaltySeqRef = useRef(0);
  const lastFeedbackSeqRef = useRef(0);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    let handle: { close: () => void } | null = null;

    void createCustomerProfileInbox({
      storeId,
      getAccessToken,
      onEvent: (name, data) => {
        if (name === DISPLAY_EVENTS.CUSTOMER_PROFILE_SUBMIT) {
          const payload = data as CustomerProfileSubmitPayload;
          if (payload.seq <= lastSubmitSeqRef.current) return;
          lastSubmitSeqRef.current = payload.seq;
          void applyCustomerSubmittedProfile(payload);
        } else if (name === DISPLAY_EVENTS.CUSTOMER_SELECTED) {
          const payload = data as CustomerSelectionPayload;
          if (payload.seq <= lastSelectionSeqRef.current) return;
          lastSelectionSeqRef.current = payload.seq;
          const cart = useCartStore.getState();
          cart.setCustomer(payload.customerId, payload.phone, payload.name);
          cart.setCustomerLoyaltyPoints(payload.loyaltyPoints);
          customerSelectionListeners.forEach((fn) => fn(payload));
          useNotificationStore
            .getState()
            .showNotification(`${payload.name || "Customer"} selected from display`, "success");
        } else if (name === DISPLAY_EVENTS.CUSTOMER_LOYALTY_CHOICE) {
          const payload = data as CustomerLoyaltyChoicePayload;
          if (payload.seq <= lastLoyaltySeqRef.current) return;
          lastLoyaltySeqRef.current = payload.seq;
          const cart = useCartStore.getState();
          if (cart.customerId !== payload.customerId) return;
          cart.setLoyaltyRedeemPoints(payload.points);
        } else if (name === DISPLAY_EVENTS.CUSTOMER_FEEDBACK) {
          const payload = data as CustomerFeedbackPayload;
          if (payload.seq <= lastFeedbackSeqRef.current) return;
          lastFeedbackSeqRef.current = payload.seq;
          void api
            .post(`/api/v1/sales/${payload.saleId}/feedback`, {
              rating: payload.rating,
              source: "customer_display",
            })
            .catch((error) => {
              console.error("[CustomerProfileInbox] Failed to save display feedback:", error);
            });
        } else if (name === DISPLAY_EVENTS.DRAFT_FIELD_UPDATE) {
          const payload = data as DraftFieldUpdatePayload;
          if (payload.seq <= lastDraftSeqRef.current) return;
          lastDraftSeqRef.current = payload.seq;
          draftListeners.forEach((fn) => fn(payload));
        }
      },
    }).then((h) => {
      if (cancelled) h.close();
      else handle = h;
    });

    return () => {
      cancelled = true;
      handle?.close();
    };
  }, [storeId]);
}
