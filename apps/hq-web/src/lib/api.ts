import axios from 'axios';

// Use same-origin so requests go through Next.js rewrite proxy (no cross-origin, no CORS preflight)
const API_BASE = '';

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

// Handle token refresh and network errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isNetworkError = !error.response && (error.code === 'ERR_NETWORK' || error.message === 'Network Error');

    if (isNetworkError) {
      (error as any).isNetworkError = true;
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await api.post('/api/v1/auth/refresh', {
            refreshToken,
          });
          const { accessToken } = response.data;
          localStorage.setItem('accessToken', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError: any) {
        if (refreshError?.code === 'ERR_NETWORK' || refreshError?.message === 'Network Error') {
          (refreshError as any).isNetworkError = true;
          return Promise.reject(refreshError);
        }
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

