'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if authenticated
    const token = localStorage.getItem('accessToken');
    const stored = localStorage.getItem('auth-storage');
    let hasUser = false;
    try {
      if (stored) {
        const parsed = JSON.parse(stored);
        hasUser = !!parsed.state?.user;
      }
    } catch (e) {
      // Ignore
    }

    if (token && hasUser) {
      router.push('/store/pos');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">AzelaPOS</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

