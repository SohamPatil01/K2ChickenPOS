import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

/**
 * When `NEXT_PUBLIC_API_URL` is set (e.g. on Vercel), call the API directly. Browsers send
 * `Authorization` on that cross-origin request; CORS is enabled on the API. Using only
 * Next.js rewrites for `/api/*` can drop or omit auth headers on some deployments, which
 * surfaces as 401 on protected routes like GET /api/v1/products.
 * Local dev: leave unset and rely on `next.config.js` rewrites to localhost.
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** No interceptors — used only for /auth/refresh to avoid refresh loops */
const authApi = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshInFlight: Promise<string> | null = null;
let redirectingToLogin = false;

function isAuthRoute(url?: string) {
  if (!url) return false;
  return (
    url.includes('/auth/refresh') ||
    url.includes('/auth/login') ||
    url.includes('/auth/profiles')
  );
}

function clearAuthAndRedirect() {
  if (redirectingToLogin || typeof window === 'undefined') return;
  redirectingToLogin = true;

  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');

  try {
    const stored = localStorage.getItem('auth-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.state) {
        parsed.state.accessToken = null;
        parsed.state.refreshToken = null;
        parsed.state.user = null;
        localStorage.setItem('auth-storage', JSON.stringify(parsed));
      }
    }
  } catch {
    /* ignore */
  }

  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem('refreshToken')?.trim();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const { data } = await authApi.post<{ accessToken: string }>('/api/v1/auth/refresh', {
      refreshToken,
    });

    if (!data?.accessToken) {
      throw new Error('Refresh response missing accessToken');
    }

    localStorage.setItem('accessToken', data.accessToken);

    try {
      const stored = localStorage.getItem('auth-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.state) {
          parsed.state.accessToken = data.accessToken;
          localStorage.setItem('auth-storage', JSON.stringify(parsed));
        }
      }
    } catch {
      /* ignore */
    }

    return data.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  if (!isAuthRoute(config.url)) {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryConfig | undefined;
    const status = error.response?.status;
    const url = originalRequest?.url;

    if (status === 401 && isAuthRoute(url)) {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    const isDailyClosing404 =
      status === 404 && url?.includes('/daily-closing');

    if (
      !isDailyClosing404 &&
      !(status === 401 && url?.includes('/auth/refresh'))
    ) {
      console.error('API response error:', url, status, error.response?.data);
    }

    if (status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const accessToken = await refreshAccessToken();
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch {
      clearAuthAndRedirect();
      return Promise.reject(error);
    }
  }
);

export default api;
