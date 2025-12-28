'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import HQLayout from '@/components/HQLayout';
import StoreRegionSwitcher from '@/components/StoreRegionSwitcher';

interface HQLayoutWrapperProps {
  children: React.ReactNode;
}

export default function HQLayoutWrapper({ children }: HQLayoutWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  useEffect(() => {
    // Protected routing - redirect to login if not authenticated
    if (pathname?.startsWith('/hq') && pathname !== '/hq/login') {
      if (!isAuthenticated() || user?.role !== 'OWNER') {
        router.push('/hq/login');
      }
    }
  }, [pathname, user, isAuthenticated, router]);

  // Don't show layout on login page
  if (pathname === '/hq/login') {
    return <>{children}</>;
  }

  return (
    <HQLayout
      selectedStoreId={selectedStoreId}
      selectedRegion={selectedRegion}
      onStoreChange={setSelectedStoreId}
      onRegionChange={setSelectedRegion}
    >
      {children}
    </HQLayout>
  );
}

