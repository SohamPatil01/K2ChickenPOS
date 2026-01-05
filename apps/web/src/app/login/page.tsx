'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import UserSelector from './components/UserSelector';
import PinEntry from './components/PinEntry';

type LoginStep = 'user-selection' | 'pin-entry';

interface SelectedUser {
  id: string;
  name: string;
  role: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [step, setStep] = useState<LoginStep>('user-selection');
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      window.location.href = '/store/pos';
    }
  }, [isAuthenticated]);

  const handleUserSelect = (user: SelectedUser) => {
    setSelectedUser(user);
    setStep('pin-entry');
  };

  const handleBackToUserSelection = () => {
    setSelectedUser(null);
    setStep('user-selection');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-4 py-8 safe-top safe-bottom">
      <div className="bg-white p-5 sm:p-6 lg:p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-3 sm:mb-4 lg:mb-6">
          AzelaPOS
        </h1>

        {step === 'user-selection' && (
          <UserSelector onUserSelect={handleUserSelect} />
        )}

        {step === 'pin-entry' && selectedUser && (
          <PinEntry
            user={selectedUser}
            onBack={handleBackToUserSelection}
          />
        )}
      </div>
    </div>
  );
}
