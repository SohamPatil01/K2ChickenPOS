'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import NumPad from '@/components/NumPad';

interface PinEntryProps {
  user: {
    id: string;
    name: string;
    role: string;
  };
  onBack: () => void;
}

export default function PinEntry({ user, onBack }: PinEntryProps) {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [pin, setPin] = useState('');
  const [showNumPad, setShowNumPad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePinSubmit = async () => {
    if (pin.length !== 6) {
      setError('PIN must be 6 digits');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/api/v1/auth/login/pin', {
        userId: user.id,
        pin: pin,
      });

      const { user: userData, accessToken, refreshToken } = response.data;

      setAuth(userData, accessToken, refreshToken);

      await new Promise(resolve => setTimeout(resolve, 200));

      window.location.href = '/store/pos';
    } catch (err: any) {
      let errorMessage = 'Invalid PIN. Please try again.';

      if (err.response?.status === 429) {
        errorMessage = 'Too many attempts. Please wait and try again.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }

      setError(errorMessage);
      setPin('');
      setLoading(false);
    }
  };

  const handlePinChange = (value: string) => {
    setPin(value);
    setError(null);

    // Auto-submit when 6 digits entered
    if (value.length === 6) {
      setShowNumPad(false);
      setTimeout(async () => {
        if (value.length !== 6) {
          setError('PIN must be 6 digits');
          return;
        }

        setLoading(true);
        setError(null);

        try {
          const response = await api.post('/api/v1/auth/login/pin', {
            userId: user.id,
            pin: value,
          });

          const { user: userData, accessToken, refreshToken } = response.data;

          setAuth(userData, accessToken, refreshToken);

          await new Promise(resolve => setTimeout(resolve, 200));

          window.location.href = '/store/pos';
        } catch (err: any) {
          let errorMessage = 'Invalid PIN. Please try again.';

          if (err.response?.status === 429) {
            errorMessage = 'Too many attempts. Please wait and try again.';
          } else if (err.response?.data?.error) {
            errorMessage = err.response.data.error;
          }

          setError(errorMessage);
          setPin('');
          setLoading(false);
        }
      }, 300);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">
          {user.name}
        </h2>
        <p className="text-sm text-gray-600">{user.role}</p>
      </div>

      {error && (
        <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-center">
          {error}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
          Enter Your PIN
        </label>
        <div
          onClick={() => !loading && setShowNumPad(true)}
          className="w-full px-4 py-4 text-center border-2 border-gray-300 rounded-md bg-gray-50 cursor-pointer hover:border-primary-500 transition-colors"
        >
          {pin ? (
            <div className="flex justify-center gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i < pin.length ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          ) : (
            <span className="text-gray-400">Tap to enter PIN</span>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={loading}
          className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handlePinSubmit}
          disabled={pin.length !== 6 || loading}
          className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </div>

      {showNumPad && (
        <NumPad
          value={pin}
          onChange={handlePinChange}
          onClose={() => setShowNumPad(false)}
          placeholder="Enter 6-digit PIN"
          maxLength={6}
        />
      )}
    </div>
  );
}
