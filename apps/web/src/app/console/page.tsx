'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export default function ConsolePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    // Redirect to store dashboard (which now contains console functionality)
    if (user === undefined) {
      return; // Still loading
    }

    if (!user) {
      router.push('/login');
      return;
    }

    // Redirect to store dashboard
    router.push('/store');
  }, [user, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <p className="text-gray-500 dark:text-gray-400">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
