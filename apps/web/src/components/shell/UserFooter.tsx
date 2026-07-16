"use client";

import { LogOut } from "lucide-react";

interface UserFooterProps {
  isCollapsed: boolean;
  userName?: string;
  userRole?: string;
  onLogout: () => void;
}

export default function UserFooter({
  isCollapsed,
  userName,
  userRole,
  onLogout,
}: UserFooterProps) {
  return (
    <div className="mt-auto border-t border-subtle p-3">
      {!isCollapsed ? (
        <>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 flex-shrink-0 rounded-full bg-gradient-brand flex items-center justify-center text-white font-semibold text-sm shadow-glow-brand">
              {userName?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{userName}</p>
              <p className="text-xs text-ink-muted">{userRole}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-2/70 hover:text-ink rounded-xl touch-target transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-white font-semibold text-sm shadow-glow-brand">
            {userName?.charAt(0).toUpperCase() || "U"}
          </div>
          <button
            onClick={onLogout}
            className="w-full px-2 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-2/70 hover:text-ink rounded-xl touch-target transition-colors flex items-center justify-center"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
