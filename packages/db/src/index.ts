import { PrismaClient } from '@prisma/client';

export { PrismaClient };
export * from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Tune DATABASE_URL for Vercel serverless → Railway TCP proxy.
 * Short-lived isolates should use a single connection and longer connect timeouts.
 */
function normalizeDatabaseUrl(raw?: string): string | undefined {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', '1');
    }
    if (!u.searchParams.has('pool_timeout')) {
      u.searchParams.set('pool_timeout', '20');
    }
    if (!u.searchParams.has('connect_timeout')) {
      u.searchParams.set('connect_timeout', '15');
    }
    if (
      !u.searchParams.has('sslmode') &&
      /rlwy\.net|railway\.app|supabase|neon\.tech|amazonaws\.com/i.test(u.host)
    ) {
      u.searchParams.set('sslmode', 'require');
    }
    return u.href;
  } catch {
    return raw;
  }
}

function isTransientDbError(err: unknown): boolean {
  const anyErr = err as { code?: string; message?: string; name?: string } | null;
  const msg = String(anyErr?.message || err || '');
  const code = String(anyErr?.code || '');
  return (
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1008' ||
    code === 'P1017' ||
    code === 'P2024' ||
    /Can't reach database server/i.test(msg) ||
    /Timed out fetching a new connection/i.test(msg) ||
    /Connection reset/i.test(msg) ||
    /Server has closed the connection/i.test(msg) ||
    /ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND/i.test(msg) ||
    /PrismaClientInitializationError/i.test(String(anyErr?.name || ''))
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createPrismaClient(): PrismaClient {
  const url = normalizeDatabaseUrl(process.env.DATABASE_URL);
  const base = new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

  // Automatic retries for brief Railway / network blips (common from Vercel).
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        const maxAttempts = 4;
        let lastError: unknown;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            return await query(args);
          } catch (err) {
            lastError = err;
            if (!isTransientDbError(err) || attempt === maxAttempts) {
              throw err;
            }
            const delay = Math.min(1200, 150 * 2 ** (attempt - 1));
            console.warn(
              `[db] transient error (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`,
              (err as Error)?.message || err
            );
            try {
              await base.$connect();
            } catch {
              // next attempt will surface persistent failure
            }
            await sleep(delay);
          }
        }
        throw lastError;
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Always reuse the client across warm serverless invocations (Vercel).
globalForPrisma.prisma = prisma;
