// @ts-nocheck
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { prisma } from '@azela-pos/db';
import { authenticate } from './utils/auth.js';
import { authRoutes } from './routes/auth.js';
import { productRoutes } from './routes/products.js';
import { customerRoutes } from './routes/customers.js';
import { saleRoutes } from './routes/sales.js';
import { scaleRoutes } from './routes/scale.js';
import { inventoryRoutes } from './routes/inventory.js';
import { poRoutes } from './routes/po.js';
import { deliveryRoutes } from './routes/delivery.js';
import { analyticsRoutes } from './routes/analytics.js';
import { syncRoutes } from './routes/sync.js';
import { reportRoutes } from './routes/reports.js';
import { storeRoutes } from './routes/stores.js';
import { franchiseHQRoutes } from './routes/franchise-hq.js';
import { userRoutes } from './routes/users.js';
import { hqEnhancedRoutes } from './routes/hq-enhanced.js';
import { hqProcurementRoutes } from './routes/hq-procurement.js';
import { hqProductMasterRoutes } from './routes/hq-product-master.js';
import { hqPricingRoutes } from './routes/hq-pricing.js';
import { hqRoyaltyRoutes } from './routes/hq-royalty.js';
import { hqComplianceRoutes } from './routes/hq-compliance.js';
import { hqAnalyticsRoutes } from './routes/hq-analytics.js';
import { discountRoutes } from './routes/discounts.js';
import { dailyClosingRoutes } from './routes/daily-closing.js';
import { hqHealthScoreRoutes } from './routes/hq-health-score.js';
import { hqFraudAlertsRoutes } from './routes/hq-fraud-alerts.js';
import { hqYieldIntelligenceRoutes } from './routes/hq-yield-intelligence.js';
import { hqReplenishmentRoutes } from './routes/hq-replenishment.js';

const fastify = Fastify({
  logger: true,
});

async function build() {
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register rate limiting with higher limits to prevent blocking legitimate requests
  await fastify.register(rateLimit as any, {
    max: 1000, // Increased from 100 to 1000 requests per minute
    timeWindow: '1 minute',
    skipOnError: true,
    // Skip rate limiting for health check and login endpoints
    skip: (request: any): boolean => {
      return request.url === '/health' || request.url === '/api/v1/auth/login';
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key',
  });

  // Register authenticate decorator
  fastify.decorate('authenticate', authenticate);

  // Health check
  fastify.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Register routes
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(productRoutes, { prefix: '/api/v1/products' });
  await fastify.register(customerRoutes, { prefix: '/api/v1/customers' });
  await fastify.register(saleRoutes, { prefix: '/api/v1/sales' });
  await fastify.register(scaleRoutes, { prefix: '/api/v1/scale' });
  await fastify.register(inventoryRoutes, { prefix: '/api/v1/inventory' });
  await fastify.register(poRoutes, { prefix: '/api/v1/po' });
  await fastify.register(deliveryRoutes, { prefix: '/api/v1/delivery' });
  await fastify.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await fastify.register(syncRoutes, { prefix: '/api/v1/sync' });
  await fastify.register(reportRoutes, { prefix: '/api/v1/reports' });
  await fastify.register(storeRoutes, { prefix: '/api/v1/stores' });
  await fastify.register(franchiseHQRoutes, { prefix: '/api/v1/hq' });
  await fastify.register(userRoutes, { prefix: '/api/v1/users' });
  
  // HQ Enhanced Routes
  await fastify.register(hqEnhancedRoutes, { prefix: '/api/v1/hq' });
  await fastify.register(hqProcurementRoutes, { prefix: '/api/v1/hq' });
  await fastify.register(hqProductMasterRoutes, { prefix: '/api/v1/hq' });
  await fastify.register(hqPricingRoutes, { prefix: '/api/v1/hq' });
  await fastify.register(hqRoyaltyRoutes, { prefix: '/api/v1/hq' });
  await fastify.register(hqComplianceRoutes, { prefix: '/api/v1/hq' });
  await fastify.register(hqAnalyticsRoutes, { prefix: '/api/v1/hq' });
  await fastify.register(hqHealthScoreRoutes, { prefix: '/api/v1/hq' });
  await fastify.register(hqFraudAlertsRoutes, { prefix: '/api/v1/hq' });
  await fastify.register(hqYieldIntelligenceRoutes, { prefix: '/api/v1/hq' });
  await fastify.register(hqReplenishmentRoutes, { prefix: '/api/v1/hq' });
  await fastify.register(discountRoutes, { prefix: '/api/v1' });
  await fastify.register(dailyClosingRoutes, { prefix: '/api/v1' });

  return fastify;
}

async function start() {
  try {
    const app = await build();
    const port = Number(process.env.API_PORT) || 3001;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 API server running on http://localhost:${port}`);
  } catch (err: any) {
    console.error('Failed to start API server:', err);
    fastify.log.error(err);
    const port = Number(process.env.API_PORT) || 3001;
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use`);
    } else if (err.message?.includes('DATABASE_URL')) {
      console.error('Database connection error. Please check your DATABASE_URL in .env file');
    }
    process.exit(1);
  }
}

start();

