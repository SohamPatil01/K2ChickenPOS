import { FastifyInstance } from 'fastify';
import { requireRole } from '../utils/auth.js';
import { analyticsService } from '../services/analyticsService.js';
import { alertService } from '../services/alertService.js';
import { z } from 'zod';

const forecastSchema = z.object({
  days: z.number().min(1).max(30).optional().default(7),
});

const demandSchema = z.object({
  days: z.number().min(7).max(90).optional().default(30),
});

export async function analyticsRoutes(fastify: FastifyInstance) {
  // Sales Forecasting
  fastify.get('/forecast', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = request.user?.storeId;
        const rawDays = (request.query as { days?: string | number })?.days;
        const days = rawDays != null
          ? Math.min(30, Math.max(1, parseInt(String(rawDays), 10) || 7))
          : 7;

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store'
          });
        }

        const forecast = await analyticsService.forecastSales(storeId, days);
        return reply.send(forecast);
      } catch (error: any) {
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
        const storeId = request.user?.storeId;
        const { days } = request.query as { days?: number };

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store'
          });
        }

        const demand = await analyticsService.predictDemand(storeId, days || 30);
        return reply.send(demand);
      } catch (error: any) {
        request.log.error(error, 'Failed to predict demand');
        return reply.status(500).send({
          error: 'Failed to predict demand',
          message: error.message
        });
      }
    },
  });

  // Inventory Recommendations
  fastify.get('/inventory-recommendations', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = request.user?.storeId;

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store'
          });
        }

        const recommendations = await analyticsService.getInventoryRecommendations(storeId);
        return reply.send(recommendations);
      } catch (error: any) {
        request.log.error(error, 'Failed to generate inventory recommendations');
        return reply.status(500).send({
          error: 'Failed to generate recommendations',
          message: error.message
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
        const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store'
          });
        }

        const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();

        const topItems = await analyticsService.getTopItems(storeId, start, end);
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
        const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store'
          });
        }

        const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();

        const trend = await analyticsService.getSalesTrend(storeId, start, end);
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
        const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store'
          });
        }

        const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();

        const paymentMix = await analyticsService.getPaymentMix(storeId, start, end);
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
        const { startDate, endDate } = request.query as { startDate?: string; endDate?: string };

        if (!storeId) {
          return reply.status(400).send({
            error: 'Store ID is required',
            message: 'User must be associated with a store'
          });
        }

        const start = startDate ? new Date(startDate + 'T00:00:00.000Z') : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date();

        const heatmap = await analyticsService.getTimeHeatmap(storeId, start, end);
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
