import { BrandLoader } from '@/components/ui/BrandLoader';

// Route-level loading UI for /store/* navigations.
export default function StoreLoading() {
  return <BrandLoader fullscreen label="Loading…" />;
}
