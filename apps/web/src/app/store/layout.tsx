'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import StoreLayout from '@/components/StoreLayout';

export default function StoreLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user === undefined) {
      return; // Still loading
    }

    if (!user) {
      router.push('/login');
      return;
    }

    // Allow OWNER to access store features (for testing/managing)
    // Only redirect if user has no store or invalid store type
    if (user.store && user.store.type !== 'FRANCHISE' && user.store.type !== 'OWNER') {
      router.push('/store');
      return;
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return <StoreLayout>{children}</StoreLayout>;
}

