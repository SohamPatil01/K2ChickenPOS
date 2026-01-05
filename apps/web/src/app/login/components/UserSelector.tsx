'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface User {
  id: string;
  name: string;
  role: string;
}

interface UserSelectorProps {
  onUserSelect: (user: User) => void;
}

export default function UserSelector({ onUserSelect }: UserSelectorProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const storeId = process.env.NEXT_PUBLIC_STORE_ID || 'default-store-id';

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await api.get(`/api/v1/auth/store/${storeId}/users`);
        setUsers(response.data);

        if (response.data.length === 0) {
          setError('No active users found. Please contact administrator.');
        }
      } catch (err: any) {
        console.error('Failed to fetch users:', err);
        setError(
          err.response?.data?.error ||
          'Failed to load users. Please check your connection.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [storeId]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="bg-red-100 border-2 border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'OWNER': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'MANAGER': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'CASHIER': return 'bg-green-100 text-green-800 border-green-300';
      case 'DRIVER': return 'bg-orange-100 text-orange-800 border-orange-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div>
      <h2 className="text-lg sm:text-xl text-center mb-4 sm:mb-6 text-gray-600">
        Select Your Account
      </h2>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {users.map((user) => (
          <button
            key={user.id}
            onClick={() => onUserSelect(user)}
            className="w-full p-4 bg-white border-2 border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-all duration-200 text-left group"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-semibold text-lg text-gray-900 group-hover:text-primary-700">
                  {user.name}
                </div>
                <div className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium border ${getRoleBadgeColor(user.role)}`}>
                  {user.role}
                </div>
              </div>

              <svg
                className="w-6 h-6 text-gray-400 group-hover:text-primary-600 transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
