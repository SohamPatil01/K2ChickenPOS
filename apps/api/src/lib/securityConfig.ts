/**
 * Shared API security config for local (`src/index.ts`) and Vercel (`api/index.ts`) entrypoints.
 */

export const ALLOWED_ORIGINS = [
  'https://k2-chicken-pos-web.vercel.app',
  'https://k2-chicken-pos-hq-web.vercel.app',
  'https://pos.azeelaai.com',
  'https://hq.azeelaai.com',
  'https://points.k2chicken.com',
  'https://loyalty.k2chicken.com',
  'https://preorder.k2chicken.com',
  'https://www.preorder.k2chicken.com',
  'https://book.k2chicken.com',
  'https://www.book.k2chicken.com',
  'https://www.k2chicken.com',
  'https://k2chicken.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3004',
];

const EXTRA_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function isAllowedCorsOrigin(origin?: string | null): boolean {
  if (!origin) return true; // non-browser / same-origin
  if (ALLOWED_ORIGINS.includes(origin) || EXTRA_ORIGINS.includes(origin)) return true;
  if (origin.endsWith('.k2chicken.com')) return true;
  if (process.env.NODE_ENV !== 'production' && /localhost|127\.0\.0\.1/.test(origin)) {
    return true;
  }
  // Preview deploys: only known project prefixes, never arbitrary origins
  if (
    /^https:\/\/k2-chicken-pos[\w-]*\.vercel\.app$/.test(origin) ||
    /^https:\/\/azela-pos[\w-]*\.vercel\.app$/.test(origin)
  ) {
    return true;
  }
  return false;
}

export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (!secret) {
    if (isProd) {
      throw new Error('JWT_SECRET must be set in production');
    }
    console.warn('[Security] JWT_SECRET missing — using insecure dev fallback');
    return 'dev-only-insecure-jwt-secret';
  }
  if (secret === 'your-secret-key' || secret.length < 32) {
    if (isProd) {
      throw new Error('JWT_SECRET must be at least 32 characters and not a default value');
    }
    console.warn('[Security] JWT_SECRET is weak — acceptable only for local development');
  }
  return secret;
}

/** Paths that skip the global POS rate limit (still have route-level limits where needed). */
export function shouldSkipGlobalRateLimit(urlPath: string, method: string): boolean {
  if (method === 'OPTIONS') return true;
  const u = String(urlPath || '').split('?')[0];
  return u === '/health' || u === '/';
}

export const AUTH_ROUTE_RATE_LIMIT = {
  login: { max: 20, timeWindow: '1 minute' as const },
  refresh: { max: 60, timeWindow: '1 minute' as const },
  profiles: { max: 60, timeWindow: '1 minute' as const },
};

export function requireBackupAuth(request: {
  headers: Record<string, unknown>;
}): { ok: true; via: 'cron' | 'secret' } | { ok: false; status: 401 | 503; error: string } {
  const backupSecret = process.env.BACKUP_SECRET?.trim();
  const vercelCronHeader =
    request.headers['x-vercel-cron'] ||
    request.headers['X-Vercel-Cron'] ||
    request.headers['X-VERCEL-CRON'];
  const isVercelCron =
    vercelCronHeader === '1' ||
    vercelCronHeader === 'true' ||
    vercelCronHeader === 'True';

  if (isVercelCron) {
    return { ok: true, via: 'cron' };
  }

  if (!backupSecret) {
    return {
      ok: false,
      status: 503,
      error: 'BACKUP_SECRET is not configured',
    };
  }

  const provided =
    (request.headers['x-backup-secret'] as string | undefined) ||
    (typeof request.headers.authorization === 'string' &&
    request.headers.authorization.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : undefined);

  if (provided && provided === backupSecret) {
    return { ok: true, via: 'secret' };
  }

  return { ok: false, status: 401, error: 'Unauthorized' };
}
