"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useNotificationStore } from "@/store/notification";
import api from "@/lib/api";
import GlobalBarcodeScanner from "../GlobalBarcodeScanner";
import Notification from "../Notification";
import { flushPendingPosSync, getPendingSyncCount } from "@/lib/posSync";
import { refreshOfflineCatalog } from "@/lib/offlineBootstrap";
import { useCustomerDisplayPublisher } from "@/lib/customerDisplay/useCustomerDisplayPublisher";
import Sidebar from "./Sidebar";
import StatusPills from "./StatusPills";
import { getMenuSections, getActiveItem } from "./navConfig";

interface StoreShellProps {
  children: React.ReactNode;
}

export default function StoreShell({ children }: StoreShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { notifications, removeNotification } = useNotificationStore();
  const [isOffline, setIsOffline] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncBusy, setSyncBusy] = useState(false);

  // Mirror the cashier's live cart to the (optional) customer display. Passive:
  // no-op unless the cashier has enabled it, never touches billing state.
  useCustomerDisplayPublisher();

  const refreshPendingSync = useCallback(async () => {
    try {
      const n = await getPendingSyncCount();
      setPendingSyncCount(n);
    } catch {
      setPendingSyncCount(0);
    }
  }, []);

  useEffect(() => {
    // Check online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    void refreshPendingSync();
    const id = window.setInterval(() => void refreshPendingSync(), 30000);
    const onPending = () => void refreshPendingSync();
    window.addEventListener("pos-pending-sync-changed", onPending);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pos-pending-sync-changed", onPending);
    };
  }, [refreshPendingSync]);

  useEffect(() => {
    const onOnlineFlush = async () => {
      setIsOffline(false);
      await flushPendingPosSync();
      await refreshOfflineCatalog({ force: true });
      await refreshPendingSync();
    };
    window.addEventListener("online", onOnlineFlush);
    return () => window.removeEventListener("online", onOnlineFlush);
  }, [refreshPendingSync]);

  useEffect(() => {
    if (!user || isOffline) return;
    void refreshOfflineCatalog();
  }, [user, isOffline]);

  // Enter key: ensure form submit works across entire POS/store (keyboard-friendly)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        const form = (target as HTMLInputElement).form;
        if (form && typeof form.requestSubmit === "function") {
          e.preventDefault();
          form.requestSubmit();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  const handleLogout = async () => {
    try {
      await api.post("/api/v1/auth/logout", {}, {
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    logout();
    router.push("/login");
  };

  const handleSyncNow = async () => {
    setSyncBusy(true);
    try {
      const r = await flushPendingPosSync();
      await refreshPendingSync();
      if (!r.ok && r.error) {
        useNotificationStore.getState().showNotification(r.error, "error", 5000);
      } else if (r.acked > 0) {
        useNotificationStore
          .getState()
          .showNotification(`Synced ${r.acked} queued bill(s)`, "success", 4000);
      }
    } finally {
      setSyncBusy(false);
    }
  };

  // Filter items by role and sections that have visible items
  const visibleSections = getMenuSections()
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => user?.role && item.roles.includes(user.role)
      ),
    }))
    .filter((section) => section.items.length > 0);

  const allVisibleItems = visibleSections.flatMap((section) => section.items);
  const activeItem = getActiveItem(pathname, allVisibleItems);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Living gradient wash + brand glow — decorative only, hidden in print */}
      <div
        className="app-gradient-wash pointer-events-none fixed inset-0 -z-10 print:hidden"
        aria-hidden
      />
      <div
        className="app-glow-layer pointer-events-none fixed inset-0 -z-10 bg-app-glow print:hidden"
        aria-hidden
      />

      {/* Global Barcode Scanner */}
      <GlobalBarcodeScanner />

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-2 sm:right-4 z-[9999] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-1rem)] sm:max-w-sm">
          {notifications.map((notification) => (
            <div key={notification.id} className="pointer-events-auto">
              <Notification
                message={notification.message}
                type={notification.type}
                duration={notification.duration}
                onClose={() => removeNotification(notification.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Mobile Menu Toggle Button - Floating */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 glass-panel-strong rounded-xl hover:shadow-glow-brand touch-target transition-shadow"
        aria-label="Toggle menu"
      >
        <Menu className="h-6 w-6 text-ink-secondary" />
      </button>

      {/* Offline + queued sync */}
      <StatusPills
        isOffline={isOffline}
        pendingSyncCount={pendingSyncCount}
        syncBusy={syncBusy}
        canSync={!isOffline && !!user}
        onSyncNow={handleSyncNow}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          sections={visibleSections}
          activeItem={activeItem}
          isMenuOpen={isMenuOpen}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapsed={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onNavigate={() => setIsMenuOpen(false)}
          userName={user?.name}
          userRole={user?.role}
          onLogout={handleLogout}
        />

        {/* Overlay for mobile menu */}
        {isMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setIsMenuOpen(false)}
          />
        )}

        {/* Main Content — flex/overflow chain unchanged (POS depends on it) */}
        <main className="flex-1 overflow-x-hidden min-h-0 w-full lg:w-auto">
          <div className="h-full w-full p-2 sm:p-3 md:p-4 lg:p-5 xl:p-6 overflow-y-auto min-h-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
