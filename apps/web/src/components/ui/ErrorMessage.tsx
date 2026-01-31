import React from 'react';
import { handleApiError } from '@/lib/errorHandler';

interface ErrorMessageProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  showDetails?: boolean;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onRetry,
  className = '',
  showDetails = false,
}) => {
  const appError = handleApiError(error);

  return (
    <div className={`bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-2xl">❌</div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
            Error
          </h3>
          <p className="text-sm text-red-700 dark:text-red-400 mb-2">
            {appError.userFriendlyMessage}
          </p>
          
          {showDetails && appError.message && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300">
                Technical details
              </summary>
              <pre className="mt-2 p-2 bg-red-100 dark:bg-red-900/40 rounded text-xs overflow-auto max-h-32">
                {appError.message}
                {appError.code && `\nCode: ${appError.code}`}
                {appError.statusCode && `\nStatus: ${appError.statusCode}`}
              </pre>
            </details>
          )}

          {onRetry && appError.isRetryable && (
            <button
              onClick={onRetry}
              className="mt-3 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorMessage;

