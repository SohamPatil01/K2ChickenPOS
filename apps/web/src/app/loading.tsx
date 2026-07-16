import { BrandLoader } from '@/components/ui/BrandLoader';

// Root route-level loading UI (login, legacy routes).
export default function RootLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center">
      <BrandLoader label="Loading…" />
    </div>
  );
}
