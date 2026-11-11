import type { FastifyInstance } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { HttpError } from '../errors.js';
import { runMobileTick } from '../workers/tick.js';

function secretOk(header: string | undefined): boolean {
  const secret = process.env.MOBILE_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/**
 * Scheduler entrypoint. Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET
 * is set; any other scheduler can do the same. (The spoofable `x-vercel-cron` header is NOT trusted.)
 */
export async function mobileCronRoutes(app: FastifyInstance) {
  app.route({
    method: ['GET', 'POST'],
    url: '/cron/tick',
    handler: async (request) => {
      if (!secretOk(request.headers.authorization)) throw new HttpError(401, 'UNAUTHORIZED', 'Unauthorized');
      return runMobileTick(new Date());
    },
  });
}
