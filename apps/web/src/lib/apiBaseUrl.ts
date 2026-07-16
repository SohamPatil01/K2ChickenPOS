/** Same base URL as axios `api`.
 * On localhost, use same-origin `/api/*` (Next.js rewrites) to skip CORS preflight —
 * that alone roughly halves request count and latency in local dev.
 * On deployed hosts, call NEXT_PUBLIC_API_URL directly so auth headers are not stripped.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return '';
    }
  }
  return (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
}
