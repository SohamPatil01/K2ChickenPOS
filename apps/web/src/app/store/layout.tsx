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
  const { user } = useAuthStore();

  useEffect(() => {
    if (user === undefined) {
      return; // Still loading
    }

    if (!user) {
      router.push('/login');
      return;
    }

    // Drivers: delivery console only — no POS, dashboard, inventory, etc.
    if (user.role === 'DRIVER' && pathname && !pathname.startsWith('/store/delivery')) {
      router.replace('/store/delivery');
      return;
    }

    // Allow OWNER to access store features (for testing/managing)
    // Only redirect if user has no store or invalid store type
    if (user.store && user.store.type !== 'FRANCHISE' && user.store.type !== 'OWNER') {
      router.push('/store');
      return;
    }
  }, [user, router, pathname]);

  // Show loading state while checking user
  if (user === undefined) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return <StoreLayout>{children}</StoreLayout>;
}

