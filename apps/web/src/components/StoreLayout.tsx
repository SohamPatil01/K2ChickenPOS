"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useNotificationStore } from "@/store/notification";
import api from "@/lib/api";
import GlobalBarcodeScanner from "./GlobalBarcodeScanner";
import Notification from "./Notification";

interface StoreLayoutProps {
  children: React.ReactNode;
}

export default function StoreLayout({ children }: StoreLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { notifications, removeNotification } = useNotificationStore();
  const [isOffline, setIsOffline] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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

  const handleLogout = async () => {
    try {
      await api.post("/api/v1/auth/logout", {}, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
    }
    logout();
    router.push("/login");
  };

  const menuSections = [
    {
      title: "Main",
      items: [
        {
          label: "Dashboard",
          href: "/store",
          icon: "📊",
          roles: ["MANAGER", "DRIVER", "OWNER"],
        },
        {
          label: "POS",
          href: "/store/pos",
          icon: "🛒",
          roles: ["CASHIER", "MANAGER", "OWNER"],
        },
        {
          label: "Cashier Console",
          href: "/store/cashier-console",
          icon: "💼",
          roles: ["CASHIER"],
        },
        {
          label: "Cart",
          href: "/store/cart",
          icon: "🛒",
          roles: ["CASHIER", "MANAGER", "OWNER"],
        },
        {
          label: "Customers",
          href: "/store/customers",
          icon: "👥",
          roles: ["CASHIER", "MANAGER", "OWNER"],
        },
      ],
    },
    {
      title: "Inventory",
      items: [
        {
          label: "Inventory",
          href: "/store/inventory",
          icon: "📦",
          roles: ["MANAGER", "OWNER"],
        },
        {
          label: "Stock Ledger",
          href: "/store/stock-ledger",
          icon: "📋",
          roles: ["MANAGER", "OWNER"],
        },
        {
          label: "Wastage",
          href: "/store/wastage",
          icon: "🗑️",
          roles: ["MANAGER", "OWNER"],
        },
        {
          label: "Yield Tracking",
          href: "/store/yield",
          icon: "📊",
          roles: ["MANAGER", "OWNER"],
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          label: "Delivery",
          href: "/store/delivery",
          icon: "🚚",
          roles: ["CASHIER", "MANAGER", "DRIVER", "OWNER"],
        },
        {
          label: "Daily Closing",
          href: "/store/daily-closing",
          icon: "💰",
          roles: ["CASHIER", "MANAGER", "OWNER"],
        },
        {
          label: "Discount Approvals",
          href: "/store/discount-approvals",
          icon: "✅",
          roles: ["MANAGER", "OWNER"],
        },
        {
          label: "Orders",
          href: "/store/orders",
          icon: "📝",
          roles: ["OWNER"],
        },
        {
          label: "Pending Payments",
          href: "/store/pending-payments",
          icon: "💳",
          roles: ["MANAGER", "OWNER"],
        },
        {
          label: "Purchase Orders",
          href: "/po",
          icon: "📋",
          roles: ["MANAGER", "OWNER"],
        },
      ],
    },
    {
      title: "Reports & Settings",
      items: [
        {
          label: "Reports",
          href: "/store/reports",
          icon: "📈",
          roles: ["MANAGER", "OWNER"],
        },
        {
          label: "Analytics",
          href: "/analytics",
          icon: "📊",
          roles: ["OWNER"],
        },
        {
          label: "Advanced Analytics",
          href: "/store/analytics/advanced",
          icon: "🔬",
          roles: ["OWNER"],
        },
        {
          label: "HQ Dashboard",
          href: "/hq",
          icon: "🏢",
          roles: ["OWNER"],
        },
        {
          label: "Settings",
          href: "/store/settings",
          icon: "⚙️",
          roles: ["CASHIER", "MANAGER", "OWNER"],
        },
      ],
    },
  ];

  // Filter items by role and sections that have visible items
  const visibleSections = menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => user?.role && item.roles.includes(user.role)
      ),
    }))
    .filter((section) => section.items.length > 0);

  // Collect all visible items to determine the most specific active route
  const allVisibleItems = visibleSections.flatMap((section) => section.items);

  // Find the most specific matching route
  const getActiveItem = () => {
    if (!pathname) return null;

    // First, try exact matches
    const exactMatch = allVisibleItems.find((item) => pathname === item.href);
    if (exactMatch) return exactMatch;

    // Then, find the longest matching path (most specific)
    const matches = allVisibleItems
      .filter((item) => {
        if (item.href === "/store") return false; // Dashboard only matches exactly
        return pathname.startsWith(item.href + "/") || pathname === item.href;
      })
      .sort((a, b) => b.href.length - a.href.length); // Sort by length, longest first

    return matches[0] || null;
  };

  const activeItem = getActiveItem();

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
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
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 touch-target"
        aria-label="Toggle menu"
      >
        <svg
          className="h-6 w-6 text-gray-600 dark:text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Offline Indicator - Floating */}
      {isOffline && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400 rounded-lg shadow-lg text-xs sm:text-sm border border-yellow-200 dark:border-yellow-800">
          <span>🔴</span>
          <span className="hidden sm:inline">Offline Mode</span>
          <span className="sm:hidden">Offline</span>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar Menu */}
        <aside
          className={`${
            isMenuOpen ? "translate-x-0" : "-translate-x-full"
          } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 ${
            isSidebarCollapsed ? "w-14 sm:w-16" : "w-56 sm:w-64 md:w-72"
          } bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out lg:transition-all flex flex-col overflow-hidden`}
        >
          {/* Sidebar Header */}
          <div className="p-2 sm:p-3 md:p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
            {!isSidebarCollapsed && (
              <Link href="/store" className="flex items-center">
                <span className="text-xl font-bold text-brand-600 dark:text-brand-400">
                  AzelaPOS
                </span>
              </Link>
            )}
            {isSidebarCollapsed && (
              <Link
                href="/store"
                className="flex items-center justify-center w-full"
              >
                <span className="text-xl font-bold text-brand-600 dark:text-brand-400">
                  A
                </span>
              </Link>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden lg:flex p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label={
                isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
            >
              <svg
                className={`w-5 h-5 transition-transform duration-300 ${
                  isSidebarCollapsed ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            <nav className="px-2">
              {visibleSections.map((section) => (
                <div key={section.title} className="mb-2">
                  {!isSidebarCollapsed && (
                    <h3 className="px-3 mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {section.title}
                    </h3>
                  )}
                  <div className="flex flex-col space-y-0.5">
                    {section.items.map((item) => {
                      // Check if this item is the active one
                      const isActive = activeItem?.href === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          className={`flex items-center ${
                            isSidebarCollapsed
                              ? "justify-center px-2"
                              : "gap-3 px-3"
                          } py-1.5 rounded-md text-sm font-medium transition-colors touch-target w-full group relative ${
                            isActive
                              ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border-l-4 border-brand-500"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600"
                          }`}
                          title={isSidebarCollapsed ? item.label : undefined}
                        >
                          <span className="text-base flex-shrink-0 text-center">
                            {item.icon}
                          </span>
                          {!isSidebarCollapsed && (
                            <span className="truncate flex-1">
                              {item.label}
                            </span>
                          )}
                          {/* Tooltip for collapsed state */}
                          {isSidebarCollapsed && (
                            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                              {item.label}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          {/* User Info and Logout at Bottom */}
          <div className="mt-auto border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/50">
            {!isSidebarCollapsed ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {user?.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.role}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md touch-target transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-semibold text-sm">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full px-2 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md touch-target transition-colors flex items-center justify-center"
                  title="Logout"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Overlay for mobile menu */}
        {isMenuOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsMenuOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden min-h-0 w-full lg:w-auto">
          <div className="h-full w-full p-2 sm:p-3 md:p-4 lg:p-5 xl:p-6 overflow-y-auto min-h-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
