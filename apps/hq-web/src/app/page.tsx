'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash?.includes('accessToken')) {
      return;
    }
    if (isAuthenticated() && user?.role === 'OWNER') {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router, user, isAuthenticated]);

  if (typeof window !== 'undefined' && window.location.hash?.includes('accessToken')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Signing you in...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  );
}

