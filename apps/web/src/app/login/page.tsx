'use client';

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@azela-pos/shared';
import type { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
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
    
    if (token && hasUser && !loading) {
      window.location.href = '/pos';
    }
  }, [loading]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit: SubmitHandler<LoginFormData> = async (data) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/v1/auth/login', {
        phone: data.phone.trim(),
        password: data.password,
      });
      
      if (!response.data) {
        throw new Error('No data in response');
      }
      
      const { user, accessToken, refreshToken } = response.data;
      
      if (!user || !accessToken) {
        throw new Error('Invalid response from server');
      }
      
      setAuth(user, accessToken, refreshToken);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      window.location.href = '/pos';
      
    } catch (err: any) {
      let errorMessage = 'Login failed. Please check your credentials.';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      } else if (err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to server. Please check if the API server is running.';
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4 py-8 safe-top safe-bottom">
      <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-3 sm:mb-4 lg:mb-6">AzelaPOS</h1>
        <h2 className="text-lg sm:text-xl text-center mb-4 sm:mb-6 text-gray-600">Login</h2>

        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input
              type="text"
              {...register('phone')}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 touch-target"
              placeholder="Enter phone number"
              autoComplete="tel"
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">
                {errors.phone.message?.toString() || 'Invalid phone number'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              {...register('password')}
              className="w-full px-4 py-3 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 touch-target"
              placeholder="Enter password"
              autoComplete="current-password"
            />
            {errors.password && (
              <p className="text-red-500 text-sm mt-1">
                {errors.password.message?.toString() || 'Invalid password'}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-3 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed touch-target text-base font-semibold"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

