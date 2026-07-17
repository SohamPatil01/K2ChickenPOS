// @ts-nocheck
// Vercel serverless function handler
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { prisma } from '@azela-pos/db';
import { APP_NAME } from '@azela-pos/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load environment variables - Vercel provides these automatically
// Try multiple paths for .env file
try {
  config({ path: resolve(__dirname, '../../../.env') });
} catch (e) {
  // Ignore if .env doesn't exist, Vercel uses environment variables
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';

const globalForPrisma = globalThis as unknown as {
  prisma: typeof prisma | undefined;
};

if (process.env.NODE_ENV !== 'production' && !globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

// Log database connection status on startup
if (process.env.DATABASE_URL) {
  // Extract database host/name from connection string for logging (without exposing credentials)
  const dbUrl = process.env.DATABASE_URL;
  const dbHostMatch = dbUrl.match(/@([^:]+):(\d+)\/([^?]+)/);
  const dbInfo = dbHostMatch 
    ? `host: ${dbHostMatch[1]}, port: ${dbHostMatch[2]}, database: ${dbHostMatch[3]}`
    : 'connection string present';
  
  console.log('✅ DATABASE_URL is set');
  console.log(`📊 Database: ${dbInfo}`);
  
  // Test connection on startup (non-blocking)
  prisma.$connect()
    .then(() => {
      console.log('✅ Database connection successful');
      // Get database name to verify which database we're connected to
      return prisma.$queryRaw`SELECT current_database() as db_name, version() as db_version`;
    })
    .then((result: any) => {
      if (result && result[0]) {
        console.log(`📊 Connected to database: ${result[0].db_name}`);
        console.log(`📊 PostgreSQL version: ${result[0].db_version?.split(' ')[0]} ${result[0].db_version?.split(' ')[1]}`);
      }
    })
    .catch((error: any) => {
      console.error('❌ Failed to connect to database:', error.message);
      console.error('   Please check your DATABASE_URL in Vercel environment variables');
    });
} else {
  console.error('❌ DATABASE_URL environment variable is not set!');
  console.error('   Please set DATABASE_URL in Vercel project settings → Environment Variables');
}

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
import { itrRoutes } from '../src/routes/itr.js';
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
import { backupRoutes } from '../src/routes/backup.js';
import { customerDisplayRoutes } from '../src/routes/customerDisplay.js';
import { publicBillRoutes } from '../src/routes/publicBill.js';

let app: any = null;

async function build() {
  if (app) return app;

  const fastify = Fastify({
    logger: process.env.NODE_ENV === 'development',
  });

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow all origins, including Vercel deployments
      const allowedOrigins = [
        'https://k2-chicken-pos-web.vercel.app',
        'https://k2-chicken-pos-hq-web.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
      ];
      
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return cb(null, true);
      }
      
      // Check if origin is in allowed list or is a Vercel preview deployment
      if (allowedOrigins.includes(origin) || origin.includes('.vercel.app') || origin.includes('localhost')) {
        return cb(null, true);
      }
      
      // Default: allow all origins for now
      return cb(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma', 'If-Modified-Since', 'Expires'],
    exposedHeaders: ['Content-Type', 'Authorization', 'X-Customer-Total'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Register rate limiting with higher limits to prevent blocking legitimate requests
  await fastify.register(rateLimit as any, {
    // POS fires many parallel GETs (products, HQ master, etc.) + CORS OPTIONS.
    max: 2000,
    timeWindow: '1 minute',
    skipOnError: true,
    // Skip health, auth bootstrap, and CORS preflight (OPTIONS must not burn the budget).
    skip: ((request: any): boolean => {
      if ((request as any).method === 'OPTIONS') return true;
      const u = String((request as any).url || '').split('?')[0];
      return (
        u === '/health' ||
        u === '/' ||
        u === '/api/v1/auth/login' ||
        u === '/api/v1/auth/profiles' ||
        u === '/api/v1/auth/refresh'
      );
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

  // Add content-type parser for empty JSON bodies to prevent 415 errors
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      if (body === '' || body === undefined || body === null) {
        return done(null, {});
      }
      const json = JSON.parse(body as string);
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Register authenticate decorator
  fastify.decorate('authenticate', authenticate);

  // Health: shallow by default (no DB) + long edge cache → much lower Fast Origin Transfer from uptime pings.
  // Use GET /health?deep=1 for full DB probe (not cached; for manual / serious checks).
  fastify.get('/health', async (request, reply) => {
    const q = (request.query as Record<string, string | undefined>) || {};
    const deep =
      q.deep === '1' ||
      q.deep === 'true' ||
      q.full === '1' ||
      q.full === 'true';

    if (!deep) {
      reply.header(
        'Cache-Control',
        'public, s-maxage=600, stale-while-revalidate=1800'
      );
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        check: 'shallow',
      };
    }

    const health: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'unknown',
      check: 'deep',
    };

    reply.header('Cache-Control', 'private, no-store');

    try {
      if (!process.env.DATABASE_URL) {
        health.database = 'error';
        health.databaseError = 'DATABASE_URL environment variable is not set';
        reply.code(503);
        return health;
      }

      const dbUrl = process.env.DATABASE_URL;
      const dbHostMatch = dbUrl.match(/@([^:]+):(\d+)\/([^?]+)/);
      if (dbHostMatch) {
        health.databaseHost = dbHostMatch[1];
        health.databasePort = dbHostMatch[2];
        health.databaseName = dbHostMatch[3];
      }

      const dbInfo = await prisma.$queryRaw<Array<{ db_name: string; db_version: string }>>`SELECT current_database() as db_name, version() as db_version`;
      if (dbInfo && dbInfo[0]) {
        health.database = 'connected';
        health.connectedDatabase = dbInfo[0].db_name;
        health.postgresVersion =
          dbInfo[0].db_version.split(' ')[0] + ' ' + dbInfo[0].db_version.split(' ')[1];
      } else {
        health.database = 'connected';
      }
    } catch (error: any) {
      console.error('Database health check failed:', error);
      health.database = 'error';
      health.databaseError = error.message || 'Database connection failed';
      health.databaseUrlPresent = !!process.env.DATABASE_URL;
      reply.code(503);
    }

    return health;
  });

  // Root — browsers and uptime tools often hit GET /; this is the REST API, not the web app.
  fastify.get('/', async () => ({
    name: `${APP_NAME} API`,
    ok: true,
    docs: 'REST routes are under /api/v1/…',
    health: '/health',
    healthDeep: '/health?deep=1',
  }));

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
  await fastify.register(itrRoutes, { prefix: '/api/v1/itr' });
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
  await fastify.register(backupRoutes, { prefix: '/api/v1/backup' });
  await fastify.register(customerDisplayRoutes, { prefix: '/api/v1/customer-display' });
  await fastify.register(publicBillRoutes, { prefix: '/api/v1/public' });

  // 404 handler for undefined routes
  fastify.setNotFoundHandler(async (request: any, reply: FastifyReply) => {
    reply.code(404).send({
      error: 'Route not found',
      path: request.url,
      method: request.method,
      message: `The requested endpoint ${request.method} ${request.url} does not exist. Please check the API documentation.`
    });
  });

  app = fastify;
  return fastify;
}

// Vercel serverless function handler
export default async function handler(req: any, res: any) {
  try {
    // Handle OPTIONS preflight requests immediately with CORS headers
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin || req.headers.Origin;
      const allowedOrigins = [
        'https://k2-chicken-pos-web.vercel.app',
        'https://k2-chicken-pos-hq-web.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
      ];
      
      if (origin && (allowedOrigins.includes(origin) || origin.includes('.vercel.app') || origin.includes('localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, If-Modified-Since, Expires');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
      res.status(200).end();
      return;
    }

    // Handle favicon and other static file requests
    const url = req.url || '/';
    if (url === '/favicon.ico' || url.startsWith('/_next/') || url.startsWith('/static/')) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    let fastifyApp;
    try {
      fastifyApp = await build();
      await fastifyApp.ready();
    } catch (buildError: any) {
      console.error('Failed to build Fastify app:', buildError);
      console.error('Build error stack:', buildError?.stack);
      res.status(500).json({ 
        error: 'Failed to initialize application',
        message: buildError?.message || 'Unknown build error',
        ...(process.env.NODE_ENV === 'development' ? { stack: buildError?.stack } : {})
      });
      return;
    }
    
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
    let response;
    try {
      response = await fastifyApp.inject({
        method,
        url,
        headers,
        payload,
        query: req.query || {},
      });
    } catch (injectError: any) {
      console.error('Fastify inject error:', injectError);
      console.error('Inject error details:', {
        method,
        url,
        errorMessage: injectError?.message,
        errorStack: injectError?.stack,
      });
      
      // Set CORS headers before sending error
      const origin = req.headers.origin || req.headers.Origin;
      const allowedOrigins = [
        'https://k2-chicken-pos-web.vercel.app',
        'https://k2-chicken-pos-hq-web.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001',
      ];
      
      if (origin && (allowedOrigins.includes(origin) || origin.includes('.vercel.app') || origin.includes('localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, If-Modified-Since, Expires');
      
      res.status(500).json({
        error: 'Request processing failed',
        message: injectError?.message || 'Failed to process request',
        ...(process.env.NODE_ENV === 'development' ? { stack: injectError?.stack } : {})
      });
      return;
    }

    // Set response headers - ensure CORS headers are always present
    const responseHeaders = response.headers || {};
    
    // Always set CORS headers for all responses
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, If-Modified-Since');
    
    // Set other response headers
    Object.keys(responseHeaders).forEach(key => {
      const value = responseHeaders[key];
      // Don't override CORS headers we just set
      if (key.toLowerCase().startsWith('access-control-')) {
        return;
      }
      if (value !== undefined && value !== null) {
        try {
          res.setHeader(key, value);
        } catch (e) {
          // Ignore header setting errors
        }
      }
    });

    // Send response with proper status code
    // Check if headers are already sent (shouldn't happen, but safety check)
    if (res.headersSent) {
      console.warn('Response headers already sent, cannot send response');
      return;
    }
    
    res.status(response.statusCode || 200);
    
    // Handle different content types
    const contentType = (responseHeaders['content-type'] || '').toLowerCase();
    if (contentType.includes('application/json')) {
      try {
        const json = JSON.parse(response.payload || '{}');
        res.json(json);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', parseError);
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
    console.error('Request headers:', JSON.stringify(req.headers || {}, null, 2));
    
    // Ensure CORS headers are set even on error
    if (!res.headersSent) {
      const origin = req.headers?.origin || req.headers?.Origin;
      const allowedOrigins = [
        'https://k2-chicken-pos-web.vercel.app',
        'https://k2-chicken-pos-hq-web.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001',
      ];
      
      if (origin && (allowedOrigins.includes(origin) || origin.includes('.vercel.app') || origin.includes('localhost'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma, If-Modified-Since, Expires');
      
      // Send error response
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: error?.message || 'Unknown error',
        ...(process.env.NODE_ENV === 'development' ? { 
          stack: error?.stack,
          details: {
            url: req?.url,
            method: req?.method,
            errorName: error?.name,
          }
        } : {})
      });
    }
  }
}
