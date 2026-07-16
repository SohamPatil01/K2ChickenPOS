"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useMotionSafe } from "@/lib/motion";
import { navIcons } from "./navIcons";
import type { NavItem } from "./navConfig";

interface SidebarNavItemProps {
  item: NavItem;
  isActive: boolean;
  isCollapsed: boolean;
  onNavigate: () => void;
}

export default function SidebarNavItem({
  item,
  isActive,
  isCollapsed,
  onNavigate,
}: SidebarNavItemProps) {
  const motionSafe = useMotionSafe();
  const Icon = navIcons[item.icon];
  const isExternalHQ = item.href.startsWith("http");

  const className = cn(
    "sidebar-link flex items-center relative touch-target w-full group rounded-xl text-sm font-medium transition-colors py-1.5",
    isCollapsed ? "justify-center px-2" : "gap-3 px-3",
    isActive
      ? "sidebar-link-active text-brand-600 dark:text-brand-400"
      : "text-ink-secondary hover:bg-surface-2/60 hover:text-ink active:bg-surface-2"
  );

  const content = (
    <>
      {/* Active pill — animates between items via shared layoutId */}
      {isActive &&
        (motionSafe ? (
          <motion.span
            layoutId="nav-active"
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 rounded-xl bg-brand-500/10 border border-brand-500/20"
            aria-hidden
          />
        ) : (
          <span
            className="absolute inset-0 rounded-xl bg-brand-500/10 border border-brand-500/20"
            aria-hidden
          />
        ))}
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-gradient-brand"
          aria-hidden
        />
      )}
      {Icon && (
        <Icon
          className={cn(
            "relative h-[18px] w-[18px] flex-shrink-0",
            isActive ? "text-brand-500" : "text-ink-muted group-hover:text-ink-secondary"
          )}
          strokeWidth={isActive ? 2.2 : 1.8}
        />
      )}
      {!isCollapsed && <span className="relative truncate flex-1">{item.label}</span>}
      {isCollapsed && (
        <span className="absolute left-full ml-2 px-2 py-1 glass-panel-strong text-ink text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
          {item.label}
        </span>
      )}
    </>
  );

  // HQ external link: forward auth tokens via hash params (preserved behavior).
  const handleClick = (e: React.MouseEvent) => {
    if (isExternalHQ && typeof window !== "undefined") {
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      if (accessToken) {
        e.preventDefault();
        const params = new URLSearchParams({ accessToken, refreshToken: refreshToken || "" });
        window.location.href = `${item.href}#${params.toString()}`;
        return;
      }
    }
    onNavigate();
  };

  return isExternalHQ ? (
    <a
      href={item.href}
      onClick={handleClick}
      className={className}
      title={isCollapsed ? item.label : undefined}
    >
      {content}
    </a>
  ) : (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={className}
      title={isCollapsed ? item.label : undefined}
    >
      {content}
    </Link>
  );
}
