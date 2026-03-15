'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import { useNotificationStore } from '@/store/notification';
import { useCashierSales } from '@/app/store/dashboard/hooks/useCashierSales';
import CashierStats from '@/app/store/dashboard/components/CashierStats';
import SaleList from '@/app/store/dashboard/components/SaleList';
import SaleDetailPanel, { type SaleEditPayload } from '@/app/store/dashboard/components/SaleDetailPanel';
import type { Sale } from '@/app/store/dashboard/hooks/useCashierSales';
import { SkeletonCard } from '@/components/ui';

type PanelMode = 'view' | 'edit' | null;

export default function CashierConsolePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showNotification } = useNotificationStore();
  const { sales, stats, products, loading, refetch } = useCashierSales({ user: user ?? null });

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user === undefined) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (user.role !== 'CASHIER') {
      router.push('/store/pos');
      return;
    }
    refetch();
  }, [user, router]);

  useEffect(() => {
    if (!user?.id) return;
    const onEvent = () => refetch();
    window.addEventListener('sale-created', onEvent);
    window.addEventListener('sale-updated', onEvent);
    window.addEventListener('sale-deleted', onEvent);
    return () => {
      window.removeEventListener('sale-created', onEvent);
      window.removeEventListener('sale-updated', onEvent);
      window.removeEventListener('sale-deleted', onEvent);
    };
  }, [user?.id, refetch]);

  const handleSave = useCallback(
    async (payload: SaleEditPayload) => {
      if (!selectedSale) return;
      setSaving(true);
      try {
        await api.put(`/api/v1/sales/${selectedSale.id}`, payload);
        showNotification('Bill updated successfully', 'success');
        refetch();
        setSelectedSale(null);
        setPanelMode(null);
        window.dispatchEvent(new CustomEvent('sale-updated', { detail: { saleId: selectedSale.id } }));
      } catch (err: any) {
        showNotification(err.response?.data?.error || 'Failed to update bill', 'error');
      } finally {
        setSaving(false);
      }
    },
    [selectedSale, refetch, showNotification]
  );

  if (!user) return null;

  if (loading && sales.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto h-full flex flex-col p-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
          <SkeletonCard className="h-24" />
        </div>
        <SkeletonCard className="flex-1 min-h-[200px]" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto h-full min-h-0 flex flex-col relative">
      <header className="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold dark:text-white">Cashier Console</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your bills today</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={loading}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium text-sm sm:text-base disabled:opacity-50"
          >
            Refresh
          </button>
          <Link
            href="/store/pos"
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors font-medium text-sm sm:text-base"
          >
            New Sale →
          </Link>
        </div>
      </header>

      <div className="mb-6">
        <CashierStats stats={stats} />
      </div>

      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-4">
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SaleList
            sales={sales}
            onView={(sale) => {
              setSelectedSale(sale);
              setPanelMode('view');
            }}
            onEdit={(sale) => {
              setSelectedSale(sale);
              setPanelMode('edit');
            }}
          />
        </div>
      </div>

      {selectedSale && panelMode && (
        <>
          <button
            type="button"
            aria-label="Close panel"
            className="fixed inset-0 z-40 bg-black/40 md:bg-black/30 backdrop-blur-[1px]"
            onClick={() => {
              setSelectedSale(null);
              setPanelMode(null);
            }}
          />
          <SaleDetailPanel
            sale={selectedSale}
            products={products}
            mode={panelMode}
            onSave={handleSave}
            onClose={() => {
              setSelectedSale(null);
              setPanelMode(null);
            }}
            onSwitchToEdit={panelMode === 'view' ? () => setPanelMode('edit') : undefined}
            saving={saving}
          />
        </>
      )}
    </div>
  );
}
