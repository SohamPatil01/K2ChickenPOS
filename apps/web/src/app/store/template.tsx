'use client';

import { PageTransition } from '@/components/ui/PageTransition';

// template.tsx remounts on every navigation within /store while
// layout.tsx (auth guard + shell) persists — so the sidebar never
// re-animates but each page gets an enter transition.
export default function StoreTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition className="h-full min-h-0">{children}</PageTransition>;
}
