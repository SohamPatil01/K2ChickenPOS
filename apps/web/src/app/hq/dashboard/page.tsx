'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuthStore } from '@/store/auth';

export default function HQDashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    // Wait for user to load from localStorage
    if (user === undefined) {
      return; // Still loading
    }

    // If no user, redirect to login
    if (!user) {
      console.log('[HQ Dashboard] No user found, redirecting to login');
      router.push('/login');
      return;
    }

    // Check user role
    console.log('[HQ Dashboard] User role:', user.role, 'User:', user);
    
    if (user.role !== 'OWNER') {
      console.log('[HQ Dashboard] User is not OWNER, redirecting to console');
      router.push('/console');
      return;
    }

    // User is OWNER, redirect to dedicated HQ app dashboard
    console.log('[HQ Dashboard] Redirecting to dedicated HQ app dashboard at port 3002');
    window.location.href = 'http://localhost:3002/dashboard';
  }, [user?.role, router]);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto py-12">
        <div className="text-center">
          {user === undefined && (
            <p className="text-gray-500">Checking authentication...</p>
          )}
          {user && user.role !== 'OWNER' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <p className="text-yellow-800">
                Access denied. Your role is {user.role}. Only OWNER can access HQ dashboard.
              </p>
            </div>
          )}
          {user && user.role === 'OWNER' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="text-4xl mb-4">📊</div>
              <h2 className="text-2xl font-bold mb-2">Redirecting to HQ Dashboard...</h2>
              <p className="text-gray-600 mb-4">
                You are being redirected to the dedicated HQ dashboard.
              </p>
              <p className="text-sm text-gray-500">
                If you are not redirected automatically,{' '}
                <a 
                  href="http://localhost:3002/dashboard" 
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  click here
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
