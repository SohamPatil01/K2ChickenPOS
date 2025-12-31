'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
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
      
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          hasUser = !!parsed.state?.user;
        } catch (e) {
          console.error('Error parsing auth storage:', e);
        }
      }

      setRedirecting(true);

      if (token && hasUser) {
        router.push('/store/pos');
      } else {
        router.push('/login');
      }
    } catch (error) {
      console.error('Redirect error:', error);
      // Fallback to login if there's an error
      router.push('/login');
    }
  }, [router, mounted, redirecting]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">AzelaPOS</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

