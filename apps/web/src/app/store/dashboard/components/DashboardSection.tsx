'use client';

import Link from 'next/link';

interface DashboardSectionProps {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
  className?: string;
}

export default function DashboardSection({
  title,
  actionHref,
  actionLabel,
  children,
  className = '',
}: DashboardSectionProps) {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg shadow-gray-200/50 dark:shadow-[0px_6px_20px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-700 overflow-hidden ${className}`}
    >
      <div className="flex justify-between items-center p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {actionHref && actionLabel && (
          <Link
            href={actionHref}
            className="text-brand-600 dark:text-brand-400 text-xs sm:text-sm font-medium hover:underline touch-target"
          >
            {actionLabel}
          </Link>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}
