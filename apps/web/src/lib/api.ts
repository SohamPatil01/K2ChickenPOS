import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log('API request with token:', config.url);
  } else {
    console.warn('API request without token:', config.url);
  }
  return config;
});

// Handle token refresh
api.interceptors.response.use(
  (response) => {
    console.log('API response success:', response.config.url, response.status);
    return response;
  },
  async (error) => {
    // Enhanced error logging
    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      console.error('Network Error - API may be down or URL incorrect:', {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        apiUrl: process.env.NEXT_PUBLIC_API_URL,
        message: 'Check if API server is running and NEXT_PUBLIC_API_URL is set correctly',
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
          const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
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

