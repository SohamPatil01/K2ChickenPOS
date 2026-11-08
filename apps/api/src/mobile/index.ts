import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@azela-pos/db';
import { HttpError } from './errors.js';
import { mobileAuthRoutes } from './routes/authRoutes.js';
import { mobilePublicRoutes } from './routes/publicRoutes.js';
import { mobileMeRoutes } from './routes/meRoutes.js';
import { mobileAdminRoutes } from './routes/adminRoutes.js';
import { mobileCronRoutes } from './routes/cronRoutes.js';

/**
 * K2 Chicken customer app API. Mounted at /api/v1/mobile. Additive: it reads POS tables and
 * writes only PreOrders (the existing online-order path) plus its own tables.
 */
export async function mobileRoutes(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return reply.code(error.statusCode).send({ error: error.message, code: error.code, ...(error.extra ?? {}) });
    }
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Invalid request',
        code: 'VALIDATION_FAILED',
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 429) return reply.code(429).send({ error: 'Too many requests', code: 'RATE_LIMITED' });
    if (status && status >= 400 && status < 500) return reply.code(status).send({ error: error.message, code: 'BAD_REQUEST' });
    // PII-minimised: no request body or customer data in error logs.
    request.log.error({ err: { message: error.message, code: (error as Prisma.PrismaClientKnownRequestError).code }, url: request.routeOptions?.url }, 'mobile api error');
    return reply.code(500).send({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' });
  });

  await app.register(mobilePublicRoutes);
  await app.register(mobileAuthRoutes);
  await app.register(mobileMeRoutes);
  await app.register(mobileAdminRoutes);
  await app.register(mobileCronRoutes);
}
