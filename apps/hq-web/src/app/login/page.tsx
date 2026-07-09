'use client';

import { APP_NAME_HQ } from '@azela-pos/shared';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isAuthenticated } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ phone: '', password: '' });

  useEffect(() => {
    if (isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/v1/auth/login', {
        phone: formData.phone.trim(),
        password: formData.password,
      });

      const { user, accessToken, refreshToken } = response.data;

      if (user.role !== 'OWNER') {
        setError('Access denied. Only HQ Owners can access this application.');
        setLoading(false);
        return;
      }

      setAuth(user, accessToken, refreshToken);
      router.push('/dashboard');
    } catch (err: any) {
      let errorMessage = 'Login failed. Please check your credentials.';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 mb-2">{APP_NAME_HQ}</h1>
          <p className="text-gray-600">Franchise Management System</p>
        </div>

        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter phone number"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Login to HQ Dashboard'}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-4">
          Only HQ Owners can access this application
        </p>
      </div>
    </div>
  );
}

