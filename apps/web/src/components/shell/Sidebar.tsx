"use client";

import Link from "next/link";
import { ChevronsLeft } from "lucide-react";
import { APP_NAME } from "@azela-pos/shared";
import { cn } from "@/lib/utils";
import SidebarNavItem from "./SidebarNavItem";
import UserFooter from "./UserFooter";
import type { NavItem, NavSection } from "./navConfig";

interface SidebarProps {
  sections: NavSection[];
  activeItem: NavItem | null;
  isMenuOpen: boolean;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate: () => void;
  userName?: string;
  userRole?: string;
  onLogout: () => void;
}

export default function Sidebar({
  sections,
  activeItem,
  isMenuOpen,
  isCollapsed,
  onToggleCollapsed,
  onNavigate,
  userName,
  userRole,
  onLogout,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        isMenuOpen ? "translate-x-0" : "-translate-x-full",
        "lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50",
        isCollapsed ? "w-14 sm:w-16" : "w-56 sm:w-64 md:w-72",
        "glass-panel !rounded-none border-y-0 border-l-0 border-r border-glass",
        "transition-all duration-300 ease-in-out lg:transition-all flex flex-col overflow-hidden"
      )}
    >
      {/* Header / wordmark */}
      <div className="p-2 sm:p-3 md:p-4 border-b border-subtle flex-shrink-0 flex items-center justify-between">
        {!isCollapsed ? (
          <Link href="/store" className="flex items-center gap-2 min-w-0">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-white text-base font-bold shadow-glow-brand">
              A
            </span>
            <span className="text-lg font-bold text-gradient-brand truncate">
              {APP_NAME || "AzeelaAiPos"}
            </span>
          </Link>
        ) : (
          <Link href="/store" className="flex items-center justify-center w-full">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-brand text-white text-base font-bold shadow-glow-brand">
              A
            </span>
          </Link>
        )}
        <button
          onClick={onToggleCollapsed}
          className="hidden lg:flex p-1.5 rounded-lg text-ink-muted hover:bg-surface-2/70 hover:text-ink-secondary transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronsLeft
            className={cn(
              "w-5 h-5 transition-transform duration-300",
              isCollapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-1">
        <nav className="px-2">
          {sections.map((section) => (
            <div key={section.title} className="mb-2">
              {!isCollapsed && (
                <h3 className="px-3 mb-1 mt-2 text-[11px] font-semibold text-ink-muted uppercase tracking-widest">
                  {section.title}
                </h3>
              )}
              <div className="flex flex-col space-y-0.5">
                {section.items.map((item) => (
                  <SidebarNavItem
                    key={item.href}
                    item={item}
                    isActive={activeItem?.href === item.href}
                    isCollapsed={isCollapsed}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <UserFooter
        isCollapsed={isCollapsed}
        userName={userName}
        userRole={userRole}
        onLogout={onLogout}
      />
    </aside>
  );
}
