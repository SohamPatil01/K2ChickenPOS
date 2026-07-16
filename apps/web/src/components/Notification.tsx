'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle } from 'lucide-react';

interface NotificationProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose?: () => void;
}

export default function Notification({ message, type = 'info', duration = 3000, onClose }: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300); // Wait for fade out animation
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const accentColors = {
    success: 'border-green-500/40 text-green-600 dark:text-green-400',
    error: 'border-red-500/40 text-red-600 dark:text-red-400',
    info: 'border-blue-500/40 text-blue-600 dark:text-blue-400',
    warning: 'border-yellow-500/40 text-yellow-600 dark:text-yellow-400',
  };

  const icons = {
    success: CheckCircle2,
    error: XCircle,
    info: Info,
    warning: AlertTriangle,
  };
  const Icon = icons[type];

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] glass-panel-strong ${accentColors[type]} px-5 py-4 rounded-2xl flex items-center gap-3 min-w-[300px] max-w-[500px]`}
      style={{
        animation: isVisible ? 'slideInRight 0.3s ease-out' : 'slideOutRight 0.3s ease-out',
      }}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="flex-1 text-sm font-medium leading-relaxed text-ink">{message}</p>
      <button
        onClick={handleClose}
        className="flex-shrink-0 text-ink-muted hover:text-ink text-xl font-bold leading-none"
        aria-label="Close"
      >
        ×
      </button>
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

