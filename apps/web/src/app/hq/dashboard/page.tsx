'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export default function HQDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    // Simply redirect to /hq which now has the actual dashboard
    if (user === undefined) {
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'OWNER') {
      router.push('/store');
      return;
    }

    router.push('/hq');
  }, [user, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500">Redirecting to HQ Dashboard...</p>
      </div>
    </div>
  );
}
