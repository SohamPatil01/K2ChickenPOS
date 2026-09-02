import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import { useAuthStore } from '@/store/auth';

let refreshInFlight: Promise<string | null> | null = null;

function decodeJwtExpiryMs(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True when the access token is missing or within `skewMs` of expiry. */
export function isAccessTokenExpired(skewMs = 60_000): boolean {
  if (typeof window === 'undefined') return true;
  const token = localStorage.getItem('accessToken');
  if (!token) return true;
  const exp = decodeJwtExpiryMs(token);
  if (!exp) return false;
  return exp <= Date.now() + skewMs;
}

/** Refresh using a plain axios call so the auth interceptor cannot recurse. */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    const base = getApiBaseUrl();
    const url = base ? `${base}/api/v1/auth/refresh` : '/api/v1/auth/refresh';

    try {
      const { data } = await axios.post(
        url,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const accessToken = data?.accessToken;
      if (!accessToken || typeof accessToken !== 'string') return null;
      localStorage.setItem('accessToken', accessToken);
      useAuthStore.setState({ accessToken });
      return accessToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Ensure a usable access token exists; refresh proactively when near expiry. */
export async function ensureAccessToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const existing = localStorage.getItem('accessToken');
  if (existing && !isAccessTokenExpired()) return true;
  const refreshed = await refreshAccessToken();
  return !!refreshed;
}

export function clearSessionAndRedirectToLogin(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  useAuthStore.getState().logout();
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}
