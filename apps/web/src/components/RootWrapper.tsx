'use client';

import ErrorBoundary from './ErrorBoundary';

export default function RootWrapper({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
