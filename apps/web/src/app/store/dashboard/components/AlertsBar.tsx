'use client';

import type { DashboardAlert, DashboardStats } from '../hooks/useDashboardStats';

interface AlertsBarProps {
  stats: DashboardStats;
  userRole: string;
}

// Rules and thresholds live in the API (apps/api/src/services/dashboardAlerts.ts).
const SEVERITY_TEXT: Record<DashboardAlert['severity'], string> = {
  critical: 'text-red-800 dark:text-red-300',
  warning: 'text-orange-800 dark:text-orange-300',
  info: 'text-orange-800 dark:text-orange-300',
  success: 'text-green-800 dark:text-green-300',
};

const ICON: Record<string, string> = {
  'stock-mismatch': '📦',
  'no-sales': '🚨',
  'great-day': '🎉',
  'revenue-drop': '📉',
  'cash-heavy': '💵',
};

export default function AlertsBar({ stats, userRole }: AlertsBarProps) {
  if (userRole !== 'MANAGER' && userRole !== 'OWNER') return null;

  const alerts = stats.alerts ?? [];

  return (
    <div className="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-800 rounded-2xl p-4 mb-4 sm:mb-6">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div className="flex-1">
          <h3 className="font-bold text-orange-900 dark:text-orange-200 mb-2">Alerts & Notifications</h3>
          <div className="space-y-2">
            {alerts.length === 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">✓ No alerts right now.</div>
            )}
            {alerts.map((alert) => (
              <div
                key={alert.key}
                className={`text-sm flex items-center gap-2 ${SEVERITY_TEXT[alert.severity]}`}
              >
                <span className="font-semibold">
                  {ICON[alert.key] ?? '•'} {alert.title}:
                </span>
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
