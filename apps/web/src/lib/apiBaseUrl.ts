/** Same base URL as axios `api` — direct API on Vercel, empty = Next.js rewrite in dev. */
export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
}
