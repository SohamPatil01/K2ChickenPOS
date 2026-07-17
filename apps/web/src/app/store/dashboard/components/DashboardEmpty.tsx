'use client';

import Link from 'next/link';

interface DashboardEmptyProps {
  message: string;
  actionHref?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function DashboardEmpty({
  message,
  actionHref,
  actionLabel,
  onAction,
  className = '',
}: DashboardEmptyProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-8 sm:py-12 text-center ${className}`}
    >
      <p className="text-ink-muted text-sm sm:text-base mb-4">
        {message}
      </p>
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link
            href={actionHref}
            className="px-4 py-2 bg-gradient-brand hover:brightness-105 shadow-glow-brand text-white rounded-lg text-sm font-medium transition-colors"
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onAction}
            className="px-4 py-2 bg-gradient-brand hover:brightness-105 shadow-glow-brand text-white rounded-lg text-sm font-medium transition-colors"
          >
            {actionLabel}
          </button>
        )
      )}
    </div>
  );
}
