import { getHQConsoleUrl } from "@/lib/hq";

export interface NavItem {
  label: string;
  href: string;
  /** Key into navIcons map (lucide icon). */
  icon: string;
  roles: string[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const getMenuSections = (): NavSection[] => [
  {
    title: "Main",
    items: [
      { label: "Dashboard", href: "/store", icon: "dashboard", roles: ["MANAGER", "DRIVER", "OWNER"] },
      { label: "POS", href: "/store/pos", icon: "pos", roles: ["CASHIER", "MANAGER", "OWNER"] },
      { label: "Cashier Console", href: "/store/cashier-console", icon: "cashier-console", roles: ["CASHIER"] },
      { label: "Cart", href: "/store/cart", icon: "cart", roles: ["CASHIER", "MANAGER", "OWNER"] },
      { label: "Customers", href: "/store/customers", icon: "customers", roles: ["CASHIER", "MANAGER", "OWNER"] },
    ],
  },
  {
    title: "Inventory",
    items: [
      { label: "Inventory", href: "/store/inventory", icon: "inventory", roles: ["MANAGER", "OWNER"] },
      { label: "Stock Ledger", href: "/store/stock-ledger", icon: "stock-ledger", roles: ["MANAGER", "OWNER"] },
      { label: "Stock reconciliation", href: "/store/inventory/reconciliation", icon: "reconciliation", roles: ["MANAGER", "OWNER"] },
      { label: "Wastage", href: "/store/wastage", icon: "wastage", roles: ["MANAGER", "OWNER"] },
      { label: "Yield Tracking", href: "/store/yield", icon: "yield", roles: ["MANAGER", "OWNER"] },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Delivery", href: "/store/delivery", icon: "delivery", roles: ["CASHIER", "MANAGER", "DRIVER", "OWNER"] },
      { label: "Daily Closing", href: "/store/daily-closing", icon: "daily-closing", roles: ["CASHIER", "MANAGER", "OWNER"] },
      { label: "Discount Approvals", href: "/store/discount-approvals", icon: "discount-approvals", roles: ["MANAGER", "OWNER"] },
      { label: "Orders", href: "/store/orders", icon: "orders", roles: ["MANAGER", "OWNER"] },
      { label: "Pending Payments", href: "/store/pending-payments", icon: "pending-payments", roles: ["MANAGER", "OWNER"] },
      { label: "Purchase Orders", href: "/po", icon: "purchase-orders", roles: ["MANAGER", "OWNER"] },
    ],
  },
  {
    title: "Reports & Settings",
    items: [
      { label: "Reports", href: "/store/reports", icon: "reports", roles: ["MANAGER", "OWNER"] },
      { label: "ITR / Tax", href: "/store/itr", icon: "itr", roles: ["MANAGER", "OWNER"] },
      { label: "Analytics", href: "/analytics", icon: "analytics", roles: ["OWNER"] },
      { label: "Advanced Analytics", href: "/store/analytics/advanced", icon: "advanced-analytics", roles: ["OWNER"] },
      { label: "HQ Dashboard", href: getHQConsoleUrl(), icon: "hq", roles: ["OWNER"] },
      { label: "Settings", href: "/store/settings", icon: "settings", roles: ["CASHIER", "MANAGER", "OWNER"] },
    ],
  },
];

/** Most specific matching route wins; /store (Dashboard) only matches exactly. */
export function getActiveItem(pathname: string | null, allVisibleItems: NavItem[]): NavItem | null {
  if (!pathname) return null;

  const exactMatch = allVisibleItems.find((item) => pathname === item.href);
  if (exactMatch) return exactMatch;

  const matches = allVisibleItems
    .filter((item) => {
      if (item.href === "/store") return false;
      return pathname.startsWith(item.href + "/") || pathname === item.href;
    })
    .sort((a, b) => b.href.length - a.href.length);

  return matches[0] || null;
}
