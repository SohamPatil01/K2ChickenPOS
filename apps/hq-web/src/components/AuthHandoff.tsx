'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

/**
 * When the user opens the HQ app from the main app (e.g. via the HQ link),
 * the main app can pass accessToken and refreshToken in the URL hash.
 * This component reads them, stores auth, fetches the user via /me, and cleans the URL.
 */
export default function AuthHandoff() {
  const router = useRouter();
  const { setAuth, isAuthenticated } = useAuthStore();
  const handled = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || handled.current) return;
    const hash = window.location.hash?.slice(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    if (!accessToken) return;

    handled.current = true;
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

    api
      .get('/api/v1/auth/me')
      .then((res) => {
        const user = res.data;
        if (user?.role !== 'OWNER') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          return;
        }
        setAuth(user, accessToken, refreshToken || '');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        router.replace('/dashboard');
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      });
  }, [setAuth, router]);

  return null;
}
