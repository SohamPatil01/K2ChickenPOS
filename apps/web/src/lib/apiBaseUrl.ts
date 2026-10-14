/** Same base URL as axios `api`.
 * On localhost, use same-origin `/api/*` (Next.js rewrites) to skip CORS preflight —
 * that alone roughly halves request count and latency in local dev.
 * On the public pre-order hosts, also use same-origin `/api/*` so the browser never
 * hits cross-origin CORS (avoids stale Access-Control-Allow-Origin from book.k2chicken.com).
 * On other deployed hosts, call NEXT_PUBLIC_API_URL directly so auth headers are not stripped.
 */
const BOOK_API_PROXY_HOSTS = new Set([
  'preorder.k2chicken.com',
  'www.preorder.k2chicken.com',
  'book.k2chicken.com',
  'www.book.k2chicken.com',
]);

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return '';
    }
    if (BOOK_API_PROXY_HOSTS.has(host)) {
      return '';
    }
  }
  return (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
}
