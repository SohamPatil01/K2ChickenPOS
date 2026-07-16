import axios from 'axios';
import { getApiBaseUrl } from './apiBaseUrl';

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
    // Enhanced error logging
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('Network Error - API may be down or proxy incorrect:', {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        message: 'Check if API server is running and Next.js rewrite proxy (next.config.js) can reach it',
      });
    } else {
      // Don't log 404 errors for daily-closing endpoints as they're expected when no closing exists
      const isDailyClosing404 = error.response?.status === 404 && 
                                 error.config?.url?.includes('/daily-closing/');
      
      if (!isDailyClosing404) {
        console.error('API response error:', error.config?.url, error.response?.status, error.response?.data);
      }
    }
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      console.log('Attempting token refresh...');

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await api.post('/api/v1/auth/refresh', {
            refreshToken,
          });
          const { accessToken } = response.data;
          localStorage.setItem('accessToken', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          console.log('Token refreshed, retrying request');
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed, redirecting to login');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

