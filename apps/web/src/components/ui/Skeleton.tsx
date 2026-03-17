import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}) => {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700';
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
};

// Predefined skeleton components for common use cases
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = '',
}) => (
  <>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        height={16}
        className={`mb-2 ${i === lines - 1 ? 'w-3/4' : 'w-full'} ${className}`}
      />
    ))}
  </>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-4 border border-gray-200 dark:border-gray-700 rounded-2xl ${className}`}>
    <Skeleton variant="rectangular" height={120} className="mb-4" />
    <SkeletonText lines={2} />
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => (
  <div className="space-y-2">
    {/* Header */}
    <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} variant="text" height={20} />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="grid grid-cols-4 gap-4 p-4 border-b border-gray-200 dark:border-gray-700">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} variant="text" height={16} />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonProductCard: React.FC = () => (
  <div className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
    <Skeleton variant="rectangular" height={80} className="mb-3" />
    <Skeleton variant="text" height={16} className="mb-2" />
    <Skeleton variant="text" height={14} className="w-2/3" />
  </div>
);

export const SkeletonStatCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-6 bg-white dark:bg-gray-800 rounded-xl shadow ${className}`}>
    <Skeleton variant="text" height={20} className="mb-4 w-1/2" />
    <Skeleton variant="text" height={32} className="mb-2 w-3/4" />
    <Skeleton variant="text" height={14} className="w-1/3" />
  </div>
);

export default Skeleton;

