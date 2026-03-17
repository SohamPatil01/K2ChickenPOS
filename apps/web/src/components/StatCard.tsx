'use client';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  comparison?: { label: string; value: number; change: number };
  gradient?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  comparison,
  gradient,
  className = '',
  style,
}: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 hover:scale-[1.02] ${
        gradient ||
        'bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900'
      } ${className}`}
      style={style}
    >
      <div className="absolute top-0 right-0 opacity-10">
        <div className="text-7xl">{icon}</div>
      </div>
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div
            className={`p-3 rounded-lg ${
              gradient ? 'bg-white/20 backdrop-blur-sm' : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            <span className="text-3xl">{icon}</span>
          </div>
          {comparison && (
            <div
              className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
                comparison.change > 0
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : comparison.change < 0
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-400'
              }`}
            >
              {comparison.change > 0 ? '↑' : comparison.change < 0 ? '↓' : '→'}{' '}
              {Math.abs(comparison.change).toFixed(1)}%
            </div>
          )}
        </div>
        <p
          className={`text-sm font-semibold uppercase tracking-wide mb-2 ${
            gradient ? 'text-white/90' : 'text-gray-600 dark:text-gray-400'
          }`}
        >
          {title}
        </p>
        <p
          className={`text-3xl font-bold mb-1 truncate ${
            gradient ? 'text-white' : 'text-gray-900 dark:text-white'
          }`}
        >
          {value}
        </p>
        {subtitle && (
          <p
            className={`text-sm truncate ${
              gradient ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {subtitle}
          </p>
        )}
        {comparison && (
          <p
            className={`text-xs mt-2 ${
              gradient ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {comparison.label}
          </p>
        )}
      </div>
    </div>
  );
}
