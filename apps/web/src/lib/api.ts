import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';
import {
  clearSessionAndRedirectToLogin,
  refreshAccessToken,
} from './authSession';

/**
 * When `NEXT_PUBLIC_API_URL` is set (e.g. on Vercel), call the API directly. Browsers send
 * `Authorization` on that cross-origin request; CORS is enabled on the API. Using only
 * Next.js rewrites for `/api/*` can drop or omit auth headers on some deployments, which
 * surfaces as 401 on protected routes like GET /api/v1/products.
 * Local dev: leave unset and rely on `next.config.js` rewrites to localhost.
 */
const API_BASE = getApiBaseUrl();

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

function isAuthRoute(url?: string): boolean {
  return !!url && (url.includes('/auth/refresh') || url.includes('/auth/login'));
}

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url as string | undefined;
    const willRetryAuth =
      status === 401 &&
      !isAuthRoute(url) &&
      originalRequest &&
      !originalRequest._retry &&
      !!localStorage.getItem('refreshToken');

    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('Network Error - API may be down or proxy incorrect:', {
        url,
        baseURL: error.config?.baseURL,
        message: 'Check if API server is running and Next.js rewrite proxy (next.config.js) can reach it',
      });
    } else if (!willRetryAuth) {
      const isDailyClosing404 =
        status === 404 && url?.includes('/daily-closing/');
      if (!isDailyClosing404) {
        console.error('API response error:', url, status, error.response?.data);
      }
    }

    if (status === 401 && !isAuthRoute(url) && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      const accessToken = await refreshAccessToken();
      if (accessToken) {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      }

      clearSessionAndRedirectToLogin();
    }

    return Promise.reject(error);
  }
);

export default api;
