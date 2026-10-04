'use client';

import { useEffect, type ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';
import WelcomeSplash from './WelcomeSplash';
import { useCustomerProfileInbox } from '@/lib/customerDisplay/useCustomerProfileInbox';
import DeliveryCompletionAlerts from './delivery/DeliveryCompletionAlerts';
import { useAuthStore } from '@/store/auth';

export default function RootWrapper({ children }: { children: ReactNode }) {
  // Receive phone/name/address the customer typed on the customer display.
  // Mounted here (not in StoreShell) so it's live for every authenticated
  // route — Owner/Manager console pages (inventory, settings, reports, …)
  // use a different shell than the cashier's POS/cart pages, and a
  // submission shouldn't be lost just because whoever's logged in is on one
  // shell instead of the other. No-ops when there's no logged-in user.
  useCustomerProfileInbox();

  // Safety: if persist rehydrate callback is delayed, unblock auth gates
  useEffect(() => {
    const { hasHydrated, setHasHydrated } = useAuthStore.getState();
    if (hasHydrated) return;
    const t = window.setTimeout(() => {
      if (!useAuthStore.getState().hasHydrated) setHasHydrated(true);
    }, 50);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <ErrorBoundary>
      <WelcomeSplash />
      {/* Manager/Owner: toast when a driver marks Delivered (any console / HQ) */}
      <DeliveryCompletionAlerts />
      {children}
    </ErrorBoundary>
  );
}
