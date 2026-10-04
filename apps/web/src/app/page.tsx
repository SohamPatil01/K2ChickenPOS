'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { APP_NAME } from '@azela-pos/shared';
import { homePathForRole } from '@/lib/homePath';

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || redirectedRef.current) return;
    redirectedRef.current = true;

    if (user || useAuthStore.getState().isAuthenticated()) {
      const role = user?.role || useAuthStore.getState().user?.role;
      router.replace(homePathForRole(role));
    } else {
      router.replace('/login');
    }
  }, [hasHydrated, user, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4 text-gray-900">
          {APP_NAME || 'AzeelaAiPos'}
        </h1>
        <p className="text-sm sm:text-base text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
