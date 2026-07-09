'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { APP_NAME } from '@azela-pos/shared';

export default function Home() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || redirecting) return;

    try {
      // Check if authenticated
      const token = localStorage.getItem('accessToken');
      const stored = localStorage.getItem('auth-storage');
      let hasUser = false;
      let userRole = null;
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          hasUser = !!parsed.state?.user;
          userRole = parsed.state?.user?.role;
        } catch (e) {
          console.error('Error parsing auth storage:', e);
        }
      }

      // Also check from auth store if available
      const currentUser = user || (hasUser && userRole ? { role: userRole } : null);

      setRedirecting(true);

      if (token && hasUser) {
        // Redirect OWNER users to HQ dashboard
        if (currentUser?.role === 'OWNER') {
          router.push('/hq');
        } else {
          router.push('/store/pos');
        }
      } else {
        router.push('/login');
      }
    } catch (error) {
      console.error('Redirect error:', error);
      // Fallback to login if there's an error
      router.push('/login');
    }
  }, [router, mounted, redirecting, user]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4 text-gray-900">{APP_NAME}</h1>
        <p className="text-sm sm:text-base text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

