"use client";

import { WifiOff, RefreshCw } from "lucide-react";

interface StatusPillsProps {
  isOffline: boolean;
  pendingSyncCount: number;
  syncBusy: boolean;
  canSync: boolean;
  onSyncNow: () => void;
}

export default function StatusPills({
  isOffline,
  pendingSyncCount,
  syncBusy,
  canSync,
  onSyncNow,
}: StatusPillsProps) {
  if (!isOffline && pendingSyncCount === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex max-w-[min(420px,calc(100vw-2rem))] flex-col items-end gap-2"
      aria-live="polite"
    >
      {isOffline && (
        <div className="glass-panel-strong flex items-center gap-1.5 sm:gap-2 rounded-full px-3.5 py-2 text-xs sm:text-sm font-medium text-yellow-700 dark:text-yellow-400 border-yellow-500/30">
          <WifiOff className="h-4 w-4" />
          <span className="hidden sm:inline">Offline Mode</span>
          <span className="sm:hidden">Offline</span>
        </div>
      )}
      {pendingSyncCount > 0 && (
        <div className="glass-panel-strong flex flex-wrap items-center justify-end gap-2 rounded-full px-3.5 py-2 text-xs sm:text-sm text-ink border-brand-500/30">
          <span className="flex items-center gap-1.5">
            <RefreshCw className={`h-4 w-4 text-brand-500 ${syncBusy ? "animate-spin" : ""}`} />
            Queued sync: <strong>{pendingSyncCount}</strong> bill
            {pendingSyncCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            disabled={syncBusy || !canSync}
            onClick={onSyncNow}
            className="rounded-full bg-gradient-brand px-3 py-1 text-xs font-medium text-white shadow-glow-brand hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncBusy ? "…" : "Sync now"}
          </button>
        </div>
      )}
    </div>
  );
}
