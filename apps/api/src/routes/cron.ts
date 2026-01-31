import { FastifyInstance } from 'fastify';
import { runDailyClosing } from '../cron/dailyClosing';

/**
 * Cron endpoints for scheduled tasks
 * These are triggered by Vercel Cron or manually by admins
 */

export async function cronRoutes(fastify: FastifyInstance) {
  // Daily closing cron endpoint (triggered at 8 PM by Vercel Cron)
  fastify.post('/api/v1/cron/daily-closing', async (request, reply) => {
    try {
      // Security: Only allow Vercel Cron or authenticated admin
      const isVercelCron = request.headers['x-vercel-cron'] === '1';
      const isAdmin = request.user?.role === 'OWNER' || request.user?.role === 'MANAGER';

      if (!isVercelCron && !isAdmin) {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Only Vercel Cron or admins can trigger this endpoint',
        });
      }

      console.log('[API] Daily closing cron triggered');
      const results = await runDailyClosing();

      return reply.code(200).send({
        success: true,
        message: 'Daily closing completed',
        results,
      });
    } catch (error: any) {
      console.error('[API] Daily closing cron failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message || 'Failed to run daily closing',
      });
    }
  });

  // Manual trigger endpoint (for testing or emergency use)
  fastify.post('/api/v1/cron/daily-closing/manual', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      // Only allow OWNER or MANAGER
      if (request.user?.role !== 'OWNER' && request.user?.role !== 'MANAGER') {
        return reply.code(403).send({
          error: 'Forbidden',
          message: 'Only owners and managers can manually trigger daily closing',
        });
      }

      console.log(`[API] Manual daily closing triggered by ${request.user.name}`);
      const results = await runDailyClosing();

      return reply.code(200).send({
        success: true,
        message: 'Daily closing manually triggered',
        results,
      });
    } catch (error: any) {
      console.error('[API] Manual daily closing failed:', error);
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message || 'Failed to run daily closing',
      });
    }
  });
}

