"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth";
import { useCartStore } from "@/store/cart";
import { useNotificationStore } from "@/store/notification";
import api from "@/lib/api";
import { createCustomerProfileInbox } from "./ablyClient";
import type { CustomerProfileSubmitPayload } from "./types";

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("accessToken");
  } catch {
    return null;
  }
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

  try {
    const cart = useCartStore.getState();
    const existingId = cart.customerId;
    const body = { phone, name, area: cart.customerArea || undefined };
    const response = existingId
      ? await api.put(`/api/v1/customers/${existingId}`, body)
      : await api.post("/api/v1/customers", body);
    const customer = response.data;
    if (!customer) return;

    useCartStore.getState().setCustomer(customer.id, customer.phone, customer.name, customer.area || null);

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
  const lastSeqRef = useRef(0);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    let handle: { close: () => void } | null = null;

    void createCustomerProfileInbox({
      storeId,
      getAccessToken,
      onSubmit: (payload) => {
        if (payload.seq <= lastSeqRef.current) return;
        lastSeqRef.current = payload.seq;
        void applyCustomerSubmittedProfile(payload);
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
