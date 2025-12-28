// @ts-nocheck
// Vercel serverless function handler
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load environment variables - Vercel provides these automatically
config({ path: resolve(__dirname, '../../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { prisma } from '@azela-pos/db';
import { authenticate } from '../src/utils/auth.js';
import { authRoutes } from '../src/routes/auth.js';
import { productRoutes } from '../src/routes/products.js';
import { customerRoutes } from '../src/routes/customers.js';
import { saleRoutes } from '../src/routes/sales.js';
import { scaleRoutes } from '../src/routes/scale.js';
import { inventoryRoutes } from '../src/routes/inventory.js';
import { poRoutes } from '../src/routes/po.js';
import { deliveryRoutes } from '../src/routes/delivery.js';
import { analyticsRoutes } from '../src/routes/analytics.js';
import { syncRoutes } from '../src/routes/sync.js';
import { reportRoutes } from '../src/routes/reports.js';
import { storeRoutes } from '../src/routes/stores.js';
import { franchiseHQRoutes } from '../src/routes/franchise-hq.js';
import { userRoutes } from '../src/routes/users.js';
import { hqEnhancedRoutes } from '../src/routes/hq-enhanced.js';
import { hqProcurementRoutes } from '../src/routes/hq-procurement.js';
import { hqProductMasterRoutes } from '../src/routes/hq-product-master.js';
import { hqPricingRoutes } from '../src/routes/hq-pricing.js';
import { hqRoyaltyRoutes } from '../src/routes/hq-royalty.js';
import { hqComplianceRoutes } from '../src/routes/hq-compliance.js';
import { hqAnalyticsRoutes } from '../src/routes/hq-analytics.js';
import { discountRoutes } from '../src/routes/discounts.js';
import { dailyClosingRoutes } from '../src/routes/daily-closing.js';
import { hqHealthScoreRoutes } from '../src/routes/hq-health-score.js';
import { hqFraudAlertsRoutes } from '../src/routes/hq-fraud-alerts.js';
import { hqYieldIntelligenceRoutes } from '../src/routes/hq-yield-intelligence.js';
import { hqReplenishmentRoutes } from '../src/routes/hq-replenishment.js';

let app: any = null;

async function build() {
  if (app) return app;

  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'development',
  });

  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register rate limiting with higher limits to prevent blocking legitimate requests
  await fastify.register(rateLimit as any, {
    max: 1000,
    timeWindow: '1 minute',
    skipOnError: true,
    skip: ((request: any): boolean => {
      return (request as any).url === '/health' || (request as any).url === '/api/v1/auth/login';
    }) as any,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  } as any);

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

  app = fastify;
  return fastify;
}

// Vercel serverless function handler
export default async function handler(req: any, res: any) {
  try {
    // Handle favicon and other static file requests
    const url = req.url || '/';
    if (url === '/favicon.ico' || url.startsWith('/_next/') || url.startsWith('/static/')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const fastifyApp = await build();
    await fastifyApp.ready();
    
    // Convert Vercel request/response to Fastify format
    const method = req.method || 'GET';
    
    // Prepare headers (remove host and connection headers)
    const headers: any = {};
    Object.keys(req.headers || {}).forEach(key => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'host' && lowerKey !== 'connection' && lowerKey !== 'content-length') {
        headers[key] = req.headers[key];
      }
    });

    // Handle request body
    let payload: string | undefined = undefined;
    if (method !== 'GET' && method !== 'HEAD' && req.body) {
      if (typeof req.body === 'string') {
        payload = req.body;
      } else if (typeof req.body === 'object') {
        payload = JSON.stringify(req.body);
      }
    }

    // Use Fastify's inject method for serverless
    const response = await fastifyApp.inject({
      method,
      url,
      headers,
      payload,
      query: req.query || {},
    });

    // Set response headers
    const responseHeaders = response.headers || {};
    Object.keys(responseHeaders).forEach(key => {
      const value = responseHeaders[key];
      if (value !== undefined && value !== null) {
        try {
          res.setHeader(key, value);
        } catch (e) {
          // Ignore header setting errors
        }
      }
    });

    // Send response with proper status code
    res.status(response.statusCode || 200);
    
    // Handle different content types
    const contentType = (responseHeaders['content-type'] || '').toLowerCase();
    if (contentType.includes('application/json')) {
      try {
        const json = JSON.parse(response.payload || '{}');
        res.json(json);
      } catch {
        res.send(response.payload || '');
      }
    } else {
      res.send(response.payload || '');
    }
  } catch (error: any) {
    console.error('Serverless function error:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    console.error('Request URL:', req?.url);
    console.error('Request method:', req?.method);
    
    // Ensure we send a response even if there's an error
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' ? { stack: error?.stack } : {})
      });
    }
  }
}

