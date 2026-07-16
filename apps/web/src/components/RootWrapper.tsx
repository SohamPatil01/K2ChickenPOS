'use client';

import type { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';
import WelcomeSplash from './WelcomeSplash';

export default function RootWrapper({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <WelcomeSplash />
      {children}
    </ErrorBoundary>
  );
}
