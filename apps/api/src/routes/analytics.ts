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
  fastify.get('/v1/analytics/forecast', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = request.user.storeId;
        const { days } = request.query as { days?: number };

        const forecast = await analyticsService.forecastSales(storeId, days || 7);
        return reply.send(forecast);
      } catch (error: any) {
        request.log.error(error, 'Failed to generate sales forecast');
        return reply.status(500).send({ 
          error: 'Failed to generate forecast', 
          message: error.message 
        });
      }
    },
  });

  // Demand Prediction
  fastify.get('/v1/analytics/demand', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = request.user.storeId;
        const { days } = request.query as { days?: number };

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
  fastify.get('/v1/analytics/inventory-recommendations', {
    preHandler: [fastify.authenticate, requireRole('MANAGER', 'OWNER')],
    handler: async (request: any, reply) => {
      try {
        const storeId = request.user.storeId;

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
  fastify.get('/v1/analytics/average-cost/:productId', {
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
  fastify.get('/v1/analytics/alerts', {
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
}
