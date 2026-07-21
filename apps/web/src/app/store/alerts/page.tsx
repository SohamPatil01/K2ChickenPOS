'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import Skeleton from '@/components/ui/Skeleton';
import { getErrorMessage } from '@/lib/errorHandler';

interface Alert {
  id: string;
  type: 'inventory' | 'sales' | 'cash' | 'wastage' | 'performance' | 'system';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  data?: any;
}

export default function AlertsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    loadAlerts();

    // 5GB Neon budget: no timed poll — refresh when tab is focused
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadAlerts();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, router]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v1/analytics/alerts');
      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    if (filterType !== 'all' && alert.type !== filterType) return false;
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
      case 'warning':
        return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200';
      case 'info':
        return 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'inventory': return '📦';
      case 'sales': return '💰';
      case 'cash': return '💵';
      case 'wastage': return '🗑️';
      case 'performance': return '📊';
      case 'system': return '⚙️';
      default: return '🔔';
    }
  };

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const infoCount = alerts.filter(a => a.severity === 'info').length;

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">System Alerts</h1>
          <p className="text-sm text-ink-secondary mt-1">
            Real-time operational alerts and notifications
          </p>
        </div>

        <button
          onClick={loadAlerts}
          className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors font-medium text-sm border border-blue-200 dark:border-blue-800"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-lg p-6 border border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Critical</h3>
              <p className="text-3xl font-bold text-red-900 dark:text-red-100">{criticalCount}</p>
            </div>
            <span className="text-4xl">🚨</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-lg p-6 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-2">Warnings</h3>
              <p className="text-3xl font-bold text-yellow-900 dark:text-yellow-100">{warningCount}</p>
            </div>
            <span className="text-4xl">⚠️</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Info</h3>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{infoCount}</p>
            </div>
            <span className="text-4xl">ℹ️</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-ink-secondary mb-2">
              Alert Type
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
            >
              <option value="all">All Types</option>
              <option value="inventory">📦 Inventory</option>
              <option value="sales">💰 Sales</option>
              <option value="cash">💵 Cash</option>
              <option value="wastage">🗑️ Wastage</option>
              <option value="performance">📊 Performance</option>
              <option value="system">⚙️ System</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-sm font-medium text-ink-secondary mb-2">
              Severity
            </label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-md dark:[color-scheme:dark]"
            >
              <option value="all">All Severities</option>
              <option value="critical">🚨 Critical</option>
              <option value="warning">⚠️ Warning</option>
              <option value="info">ℹ️ Info</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <span className="text-6xl mb-4 block">✅</span>
            <h3 className="text-xl font-semibold text-ink mb-2">
              All Clear!
            </h3>
            <p className="text-ink-secondary">
              No alerts to display. Everything is running smoothly.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-lg p-4 border ${getSeverityColor(alert.severity)} transition-all hover:shadow-md`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{getTypeIcon(alert.type)}</span>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-sm sm:text-base">
                      {alert.title}
                    </h3>
                    <span className="text-xs px-2 py-1 rounded-full capitalize whitespace-nowrap flex-shrink-0 opacity-75">
                      {alert.severity}
                    </span>
                  </div>
                  
                  <p className="text-sm mb-2">
                    {alert.message}
                  </p>
                  
                  {alert.data && (
                    <details className="text-xs opacity-75 mt-2">
                      <summary className="cursor-pointer hover:opacity-100">Details</summary>
                      <pre className="mt-2 p-2 bg-black/10 dark:bg-white/10 rounded overflow-x-auto">
                        {JSON.stringify(alert.data, null, 2)}
                      </pre>
                    </details>
                  )}
                  
                  <p className="text-xs opacity-60 mt-2">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

