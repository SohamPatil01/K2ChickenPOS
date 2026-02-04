/**
 * When set, the main app "HQ" link points to the full HQ console (apps/hq-web)
 * where all franchise operations are managed. Otherwise it points to the
 * in-app HQ dashboard at /hq.
 */
export function getHQConsoleUrl(): string {
  const url = process.env.NEXT_PUBLIC_HQ_CONSOLE_URL;
  if (url && typeof url === 'string' && url.trim() !== '') {
    return url.trim().replace(/\/$/, ''); // no trailing slash
  }
  return '/hq';
}

