import { FastifyInstance } from 'fastify';
import { getUser, requireRole } from '../utils/auth.js';
import { analyticsService } from '../services/analyticsService.js';
import { alertService } from '../services/alertService.js';

function parseFranchiseStoreId(q: Record<string, unknown>): string | undefined {
  const v = q.franchiseStoreId ?? q.franchiseId;
  if (v === undefined || v === null || v === '') return undefined;
  return String(v);
}

function isBadScopeError(message: string) {
  return (
    message.includes('Invalid franchiseStoreId') ||
    message.includes('Franchise users can only query')
  );
}

export async function analyticsRoutes(fastify: FastifyInstance) {
  // Sales overview (aligned scope + businessDate buckets)
  fastify.get('/sales-overview', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = (getUser(request) as any).storeId;
        const q = request.query as Record<string, unknown>;
        const franchiseStoreId = parseFranchiseStoreId(q);

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store',
          });
        }

        const startDate = (q.startDate as string) || '';
        const endDate = (q.endDate as string) || '';
        const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();
        const start = startDate
          ? new Date(startDate + 'T00:00:00.000Z')
          : new Date(end.getTime() - 29 * 86400000);

        const overview = await analyticsService.getSalesOverview(
          storeId,
          start,
          end,
          franchiseStoreId ?? null
        );
        return reply.send(overview);
      } catch (error: any) {
        if (isBadScopeError(error.message)) {
          return reply.status(400).send({ error: 'Invalid scope', message: error.message });
        }
        request.log.error(error, 'Failed to load sales overview');
        return reply.status(500).send({
          error: 'Failed to load sales overview',
          message: error.message,
        });
      }
    },
  });

  // Rule-based insights
  fastify.get('/insights', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = (getUser(request) as any).storeId;
        const q = request.query as Record<string, unknown>;
        const franchiseStoreId = parseFranchiseStoreId(q);

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store',
          });
        }

        const startDate = (q.startDate as string) || '';
        const endDate = (q.endDate as string) || '';
        const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();
        const start = startDate
          ? new Date(startDate + 'T00:00:00.000Z')
          : new Date(end.getTime() - 29 * 86400000);

        const insights = await analyticsService.getInsights(
          storeId,
          start,
          end,
          franchiseStoreId ?? null
        );
        return reply.send(insights);
      } catch (error: any) {
        if (isBadScopeError(error.message)) {
          return reply.status(400).send({ error: 'Invalid scope', message: error.message });
        }
        request.log.error(error, 'Failed to generate insights');
        return reply.status(500).send({
          error: 'Failed to generate insights',
          message: error.message,
        });
      }
    },
  });

  // Sales Forecasting
  fastify.get('/forecast', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = (getUser(request) as any).storeId;
        const q = request.query as Record<string, unknown>;
        const rawDays = q.days;
        const forecastDays =
          rawDays != null
            ? Math.min(30, Math.max(1, parseInt(String(rawDays), 10) || 7))
            : 7;
        const rawHist = q.historyDays;
        const historyDays =
          rawHist != null
            ? Math.min(365, Math.max(14, parseInt(String(rawHist), 10) || 90))
            : undefined;
        const franchiseStoreId = parseFranchiseStoreId(q);

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store',
          });
        }

        const forecast = await analyticsService.forecastSales(storeId, {
          forecastDays,
          historyDays,
          franchiseStoreId: franchiseStoreId ?? null,
        });
        return reply.send(forecast);
      } catch (error: any) {
        if (isBadScopeError(error.message)) {
          return reply.status(400).send({ error: 'Invalid scope', message: error.message });
        }
        request.log.error(error, 'Failed to generate sales forecast');
        return reply.status(500).send({
          error: 'Failed to generate forecast',
          message: error.message,
        });
      }
    },
  });

  // Demand Prediction
  fastify.get('/demand', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = (getUser(request) as any).storeId;
        const q = request.query as Record<string, unknown>;
        const days = q.days != null ? Number(q.days) : 30;
        const franchiseStoreId = parseFranchiseStoreId(q);
        const byStore =
          q.byStore === 'true' ||
          q.byStore === '1' ||
          q.byStore === true;

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store',
          });
        }

        const demand = await analyticsService.predictDemand(storeId, days || 30, {
          franchiseStoreId: franchiseStoreId ?? null,
          byStore,
        });
        return reply.send(demand);
      } catch (error: any) {
        if (isBadScopeError(error.message)) {
          return reply.status(400).send({ error: 'Invalid scope', message: error.message });
        }
        request.log.error(error, 'Failed to predict demand');
        return reply.status(500).send({
          error: 'Failed to predict demand',
          message: error.message,
        });
      }
    },
  });

  // Inventory Recommendations
  fastify.get('/inventory-recommendations', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = (getUser(request) as any).storeId;
        const q = request.query as Record<string, unknown>;
        const franchiseStoreId = parseFranchiseStoreId(q);
        const rawHist = q.historyDays;
        const historyDays =
          rawHist != null ? parseInt(String(rawHist), 10) : undefined;

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store',
          });
        }

        const recommendations = await analyticsService.getInventoryRecommendations(storeId, {
          franchiseStoreId: franchiseStoreId ?? null,
          historyDays: Number.isFinite(historyDays) ? historyDays : undefined,
        });
        return reply.send(recommendations);
      } catch (error: any) {
        if (isBadScopeError(error.message)) {
          return reply.status(400).send({ error: 'Invalid scope', message: error.message });
        }
        request.log.error(error, 'Failed to generate inventory recommendations');
        return reply.status(500).send({
          error: 'Failed to generate recommendations',
          message: error.message,
        });
      }
    },
  });

  // Average Cost Calculation
  fastify.get('/average-cost/:productId', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const { productId } = request.params;

        const avgCost = await analyticsService.calculateAverageCost(productId);
        return reply.send({
          productId,
          averageCost: Math.round(avgCost * 100) / 100
        });
      } catch (error: any) {
        request.log.error(error, 'Failed to calculate average cost');
        return reply.status(500).send({
          error: 'Failed to calculate average cost',
          message: error.message
        });
      }
    },
  });

  // Alerts
  fastify.get('/alerts', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER', 'CASHIER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = request.user.storeId;

        const alerts = await alertService.generateAlerts(storeId);
        return reply.send({ alerts, count: alerts.length });
      } catch (error: any) {
        request.log.error(error, 'Failed to generate alerts');
        return reply.status(500).send({
          error: 'Failed to generate alerts',
          message: error.message
        });
      }
    },
  });

  // Additional analytics endpoints for /analytics page

  // Top Items
  fastify.get('/top-items', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = request.user?.storeId;
        const q = request.query as Record<string, unknown>;
        const { startDate, endDate } = q as { startDate?: string; endDate?: string };
        const franchiseStoreId = parseFranchiseStoreId(q);

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store'
          });
        }

        const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();

        const topItems = await analyticsService.getTopItems(storeId, start, end, franchiseStoreId ?? null);
        return reply.send(topItems);
      } catch (error: any) {
        request.log.error(error, 'Failed to get top items');
        return reply.status(500).send({
          error: 'Failed to get top items',
          message: error.message
        });
      }
    },
  });

  // Sales Trend
  fastify.get('/sales-trend', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = request.user?.storeId;
        const q = request.query as Record<string, unknown>;
        const { startDate, endDate } = q as { startDate?: string; endDate?: string };
        const franchiseStoreId = parseFranchiseStoreId(q);

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store'
          });
        }

        const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();

        const trend = await analyticsService.getSalesTrend(storeId, start, end, franchiseStoreId ?? null);
        return reply.send(trend);
      } catch (error: any) {
        request.log.error(error, 'Failed to get sales trend');
        return reply.status(500).send({
          error: 'Failed to get sales trend',
          message: error.message
        });
      }
    },
  });

  // Payment Mix
  fastify.get('/payment-mix', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = request.user?.storeId;
        const q = request.query as Record<string, unknown>;
        const { startDate, endDate } = q as { startDate?: string; endDate?: string };
        const franchiseStoreId = parseFranchiseStoreId(q);

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store'
          });
        }

        const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();

        const paymentMix = await analyticsService.getPaymentMix(storeId, start, end, franchiseStoreId ?? null);
        return reply.send(paymentMix);
      } catch (error: any) {
        request.log.error(error, 'Failed to get payment mix');
        return reply.status(500).send({
          error: 'Failed to get payment mix',
          message: error.message
        });
      }
    },
  });

  // Time Heatmap
  fastify.get('/time-heatmap', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = request.user?.storeId;
        const q = request.query as Record<string, unknown>;
        const { startDate, endDate } = q as { startDate?: string; endDate?: string };
        const franchiseStoreId = parseFranchiseStoreId(q);

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store'
          });
        }

        const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();

        const heatmap = await analyticsService.getTimeHeatmap(storeId, start, end, franchiseStoreId ?? null);
        return reply.send(heatmap);
      } catch (error: any) {
        request.log.error(error, 'Failed to get time heatmap');
        return reply.status(500).send({
          error: 'Failed to get time heatmap',
          message: error.message
        });
      }
    },
  });

  // Delivery KPIs (placeholder - returns empty for now)
  fastify.get('/delivery-kpis', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        // Placeholder for delivery KPIs
        return reply.send({
          totalDeliveries: 0,
          avgDeliveryTime: 0,
          onTimeRate: 0,
        });
      } catch (error: any) {
        request.log.error(error, 'Failed to get delivery KPIs');
        return reply.status(500).send({
          error: 'Failed to get delivery KPIs',
          message: error.message
        });
      }
    },
  });
}
