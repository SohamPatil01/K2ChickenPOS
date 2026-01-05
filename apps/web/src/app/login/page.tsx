'use client';

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@azela-pos/shared';
import type { z } from 'zod';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import NumPad from '@/components/NumPad';

type LoginFormData = z.infer<typeof loginSchema>;

interface UserProfile {
  id: string;
  name: string;
  phone: string;
  role: 'OWNER' | 'MANAGER' | 'CASHIER' | 'DRIVER';
}

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'OWNER':
      return (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      );
    case 'MANAGER':
      return (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      );
    case 'CASHIER':
      return (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      );
    case 'DRIVER':
      return (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    default:
      return (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
  }
};

const getRoleColor = (role: string) => {
  switch (role) {
    case 'OWNER':
      return 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200';
    case 'MANAGER':
      return 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200';
    case 'CASHIER':
      return 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200';
    case 'DRIVER':
      return 'bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200';
  }
};

export default function LoginPage() {
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordPad, setShowPasswordPad] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  // Fetch user profiles
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const response = await api.get('/api/v1/auth/profiles');
        setProfiles(response.data || []);
      } catch (err: any) {
        console.error('Failed to fetch profiles:', err);
        setError('Failed to load user profiles');
      } finally {
        setLoadingProfiles(false);
      }
    };

    fetchProfiles();
  }, []);

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
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phone: '',
      password: '',
    },
  });

  // Sync form values with state
  useEffect(() => {
    if (selectedProfile) {
      setValue('phone', selectedProfile.phone);
    }
  }, [selectedProfile, setValue]);

  useEffect(() => {
    setValue('password', password);
  }, [password, setValue]);

  const handleProfileSelect = (profile: UserProfile) => {
    setSelectedProfile(profile);
    setPassword('');
    setError(null);
  };

  const handleBackToProfiles = () => {
    setSelectedProfile(null);
    setPassword('');
    setError(null);
  };

  const onSubmit: SubmitHandler<LoginFormData> = async (data) => {
    if (!selectedProfile) {
      setError('Please select a user profile');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/v1/auth/login', {
        phone: selectedProfile.phone,
        password: password || data.password,
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
      <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-lg shadow-md w-full max-w-4xl">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-3 sm:mb-4 lg:mb-6">AzelaPOS</h1>
        <h2 className="text-lg sm:text-xl text-center mb-4 sm:mb-6 text-gray-600">
          {selectedProfile ? 'Enter PIN' : 'Select User'}
        </h2>

        {error && (
          <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {!selectedProfile ? (
          // Profile Selection View
          <div>
            {loadingProfiles ? (
              <div className="flex justify-center items-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary-400/40 border-t-primary-500"></div>
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No users available. Please contact administrator.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => handleProfileSelect(profile)}
                    className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-200 touch-target ${getRoleColor(profile.role)}`}
                  >
                    <div className="mb-3">
                      {getRoleIcon(profile.role)}
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-base mb-1">{profile.name}</div>
                      <div className="text-xs opacity-75 capitalize">{profile.role.toLowerCase()}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          // PIN Entry View
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Selected Profile Display */}
            <div className="flex items-center justify-center mb-6">
              <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${getRoleColor(selectedProfile.role)}`}>
                <div>
                  {getRoleIcon(selectedProfile.role)}
                </div>
                <div>
                  <div className="font-semibold text-lg">{selectedProfile.name}</div>
                  <div className="text-sm opacity-75 capitalize">{selectedProfile.role.toLowerCase()}</div>
                </div>
                <button
                  type="button"
                  onClick={handleBackToProfiles}
                  className="ml-4 p-2 rounded-lg hover:bg-black/10 transition-colors"
                  aria-label="Back to profiles"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">PIN</label>
              <div className="relative">
                <input
                  type="password"
                  {...register('password')}
                  value={password}
                  readOnly
                  onClick={() => setShowPasswordPad(true)}
                  className="w-full px-4 py-4 text-2xl border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 touch-target cursor-pointer text-center font-semibold"
                  placeholder="Tap to enter PIN"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordPad(true)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
              {errors.password && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.password.message?.toString() || 'Invalid PIN'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-primary-600 text-white py-4 px-4 rounded-xl hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed touch-target text-lg font-semibold"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        )}

        {/* Password/PIN NumPad */}
        {showPasswordPad && (
          <NumPad
            value={password}
            onChange={(value) => setPassword(value)}
            onClose={() => setShowPasswordPad(false)}
            placeholder="Enter PIN"
            maxLength={20}
            maskValue={true}
          />
        )}
      </div>
    </div>
  );
}

