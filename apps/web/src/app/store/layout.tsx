'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import StoreLayout from '@/components/StoreLayout';

export default function StoreLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    // Drivers: delivery console only — no POS, dashboard, inventory, etc.
    if (user.role === 'DRIVER' && pathname && !pathname.startsWith('/store/delivery')) {
      router.replace('/store/delivery');
      return;
    }

    // Only redirect if user has no store or invalid store type
    if (user.store && user.store.type !== 'FRANCHISE' && user.store.type !== 'OWNER') {
      router.replace('/store');
    }
  }, [user, router, pathname, hasHydrated]);

  // Wait for persist rehydrate — redirecting on null user before this causes full-app flicker
  if (!hasHydrated) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <p className="text-sm text-ink-muted">Redirecting…</p>
      </div>
    );
  }

  return <StoreLayout>{children}</StoreLayout>;
}
