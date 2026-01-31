import { AxiosError } from 'axios';

export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
  isRetryable: boolean;
  userFriendlyMessage: string;
}

export function handleApiError(error: unknown): AppError {
  // Handle Axios errors
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<any>;
    
    if (axiosError.response) {
      // Server responded with error
      const statusCode = axiosError.response.status;
      const data = axiosError.response.data;
      
      const errorMessages: Record<number, string> = {
        400: 'Invalid request. Please check your input and try again.',
        401: 'You are not authorized. Please log in again.',
        403: 'You don\'t have permission to perform this action.',
        404: 'The requested resource was not found.',
        409: 'This action conflicts with existing data.',
        422: 'The data provided is invalid.',
        429: 'Too many requests. Please wait a moment and try again.',
        500: 'Server error. Our team has been notified.',
        502: 'Service temporarily unavailable. Please try again.',
        503: 'Service is under maintenance. Please try again later.',
        504: 'Request timeout. Please check your connection and try again.',
      };

      return {
        message: data?.error || data?.message || axiosError.message,
        code: data?.code,
        statusCode,
        isRetryable: [408, 429, 500, 502, 503, 504].includes(statusCode),
        userFriendlyMessage: errorMessages[statusCode] || 'An error occurred. Please try again.',
      };
    } else if (axiosError.request) {
      // Request made but no response
      return {
        message: 'No response from server',
        isRetryable: true,
        userFriendlyMessage: 'Unable to connect to the server. Please check your internet connection and try again.',
      };
    }
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      message: error.message,
      isRetryable: false,
      userFriendlyMessage: 'An unexpected error occurred. Please try again or contact support.',
    };
  }

  // Unknown error
  return {
    message: 'Unknown error',
    isRetryable: false,
    userFriendlyMessage: 'Something went wrong. Please try again.',
  };
}

export function getErrorMessage(error: unknown): string {
  const appError = handleApiError(error);
  return appError.userFriendlyMessage;
}

export function isRetryableError(error: unknown): boolean {
  const appError = handleApiError(error);
  return appError.isRetryable;
}

