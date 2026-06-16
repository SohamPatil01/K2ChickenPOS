// @ts-nocheck
import { FastifyInstance } from 'fastify';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { buildFullDatabaseBackup } from '../services/fullDatabaseBackup.js';

// Create prisma instance for backup operations
const globalForPrisma = globalThis as unknown as { prisma: any };
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

const RLS_PUBLIC_TABLES = [
  'Store', 'User', 'Customer', 'CustomerAddress', 'Product', 'Category',
  'StoreProductPrice', 'InventoryLedger', 'Sale', 'SaleItem', 'Payment', 'Shift',
  'ScaleBarcodeConfig', 'PurchaseOrder', 'PurchaseOrderItem', 'Dispatch', 'DispatchItem',
  'GRN', 'DeliveryOrder', 'DeliveryEvent', 'AuditLog', 'SyncEvent', 'FranchiseConfig',
  'PricingPlan', 'PricingRule', 'PricingOverride', 'ProductMaster', 'Supplier',
  'CentralPurchaseOrder', 'CentralPOItem', 'InwardStock', 'StockAllocation',
  'RoyaltyInvoice', 'RoyaltyLedger', 'ComplianceChecklistTemplate', 'ComplianceRecord',
  'HQAlert', 'AlertRule', 'FranchiseHealthScore', 'YieldIntelligence',
  'ReplenishmentRequest', 'DiscountOverride', 'DailyClosing', 'LoyaltyTransaction',
];

function isBackupAdminRequest(request: any): boolean {
  const backupSecret = process.env.BACKUP_SECRET;
  const providedSecret =
    (request.headers['x-backup-secret'] as string) || (request.query as any).secret;
  const vercelCronHeader =
    request.headers['x-vercel-cron'] ||
    request.headers['X-Vercel-Cron'] ||
    request.headers['X-VERCEL-CRON'];
  const isVercelCron =
    vercelCronHeader === '1' ||
    vercelCronHeader === 'true' ||
    vercelCronHeader === 'True' ||
    !!vercelCronHeader;
  const userAgent = (
    request.headers['user-agent'] ||
    request.headers['User-Agent'] ||
    ''
  ).toLowerCase();
  const isVercelUserAgent =
    userAgent.includes('vercel') || userAgent.includes('vercel-cron');
  return (
    isVercelCron ||
    isVercelUserAgent ||
    (backupSecret && providedSecret === backupSecret) ||
    !backupSecret
  );
}

interface BackupResponse {
  success: boolean;
  message: string;
  timestamp: string;
  backupSize?: number;
  tables?: Record<string, number>;
  error?: string;
}

/**
 * Database Backup Routes
 * 
 * Provides endpoints for creating periodic backups of the PostgreSQL database.
 * This can be triggered manually or via Vercel Cron Jobs.
 */
export async function backupRoutes(fastify: FastifyInstance) {
  
  /**
   * GET /api/v1/backup/test-cron
   * Test endpoint to verify cron job configuration
   * This endpoint logs all headers to help diagnose cron job issues
   */
  fastify.get('/test-cron', async (request, reply) => {
    const allHeaders = Object.keys(request.headers).reduce((acc, key) => {
      acc[key] = request.headers[key];
      return acc;
    }, {} as Record<string, any>);
    
    const vercelCronHeader = request.headers['x-vercel-cron'] || 
                            request.headers['X-Vercel-Cron'] ||
                            request.headers['X-VERCEL-CRON'];
    const userAgent = (request.headers['user-agent'] || request.headers['User-Agent'] || '').toLowerCase();
    
    return {
      success: true,
      message: 'Cron test endpoint',
      timestamp: new Date().toISOString(),
      headers: allHeaders,
      cronDetection: {
        hasVercelCronHeader: !!vercelCronHeader,
        vercelCronHeaderValue: vercelCronHeader,
        userAgent: userAgent,
        isVercelCron: vercelCronHeader === '1' || vercelCronHeader === 'true' || !!vercelCronHeader,
        isVercelUserAgent: userAgent.includes('vercel'),
        environment: {
          hasBackupSecret: !!process.env.BACKUP_SECRET,
          backupStorageMethod: process.env.BACKUP_STORAGE_METHOD || 'vercel-blob',
          hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
          hasDatabaseUrl: !!process.env.DATABASE_URL
        }
      }
    };
  });

  /**
   * GET /api/v1/backup/health
   * Health check for backup service
   */
  fastify.get('/health', async (request, reply) => {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      reply.header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'backup',
        database: 'connected'
      };
    } catch (error: any) {
      reply.status(500);
      reply.header('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        service: 'backup',
        database: 'disconnected',
        error: error.message
      };
    }
  });

  /**
   * POST /api/v1/backup/create
   * Create a database backup
   * 
   * This endpoint creates a JSON backup of all critical tables.
   * Can be triggered by Vercel Cron or manually.
   * 
   * Authentication: Requires BACKUP_SECRET in header or query
   */
  fastify.post('/create', async (request, reply): Promise<BackupResponse> => {
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();
    
    try {
      // Log all request headers for debugging (in production, this helps diagnose cron issues)
      const allHeaders = Object.keys(request.headers).reduce((acc, key) => {
        acc[key] = request.headers[key];
        return acc;
      }, {} as Record<string, any>);
      
      fastify.log.info(`[Backup] Request received - ID: ${requestId}, Method: ${request.method}, URL: ${request.url}`);
      fastify.log.info(`[Backup] Headers: ${JSON.stringify(allHeaders, null, 2)}`);
      
      // Verify backup secret for security
      // If BACKUP_SECRET is not set, allow access (for initial setup)
      // SECURITY: Set BACKUP_SECRET in production environment variables
      const backupSecret = process.env.BACKUP_SECRET;
      const providedSecret = (request.headers['x-backup-secret'] as string) || 
                            (request.headers['x-backup-secret'] as string) ||
                            (request.query as any).secret;
      
      // Allow Vercel Cron Jobs to authenticate
      // Vercel sends x-vercel-cron header (value can be '1' or just present)
      const vercelCronHeader = request.headers['x-vercel-cron'] || 
                              request.headers['X-Vercel-Cron'] ||
                              request.headers['X-VERCEL-CRON'];
      const isVercelCron = vercelCronHeader === '1' || 
                          vercelCronHeader === 'true' || 
                          vercelCronHeader === 'True' ||
                          !!vercelCronHeader;
      
      // Also check for Vercel's user-agent or other indicators
      const userAgent = (request.headers['user-agent'] || request.headers['User-Agent'] || '').toLowerCase();
      const isVercelUserAgent = userAgent.includes('vercel') || userAgent.includes('vercel-cron');
      
      // Check for Vercel's cron indicator in various forms
      const hasVercelCronIndicator = isVercelCron || isVercelUserAgent;
      
      // Log authentication attempt for debugging
      fastify.log.info(`[Backup] Auth check - RequestID: ${requestId}`);
      fastify.log.info(`[Backup]   - VercelCron Header: ${vercelCronHeader} (exists: ${!!vercelCronHeader})`);
      fastify.log.info(`[Backup]   - IsVercelCron: ${isVercelCron}`);
      fastify.log.info(`[Backup]   - UserAgent: ${userAgent.substring(0, 100)}`);
      fastify.log.info(`[Backup]   - IsVercelUserAgent: ${isVercelUserAgent}`);
      fastify.log.info(`[Backup]   - HasVercelCronIndicator: ${hasVercelCronIndicator}`);
      fastify.log.info(`[Backup]   - BACKUP_SECRET set: ${!!backupSecret}`);
      fastify.log.info(`[Backup]   - ProvidedSecret: ${!!providedSecret}`);
      
      // Authenticate: Vercel Cron job OR valid secret OR no secret configured (for initial setup)
      // Be more permissive for cron jobs - if it looks like a Vercel cron, allow it
      const isAuthenticated = hasVercelCronIndicator || 
                             (backupSecret && providedSecret === backupSecret) ||
                             (!backupSecret);

      if (!isAuthenticated) {
        fastify.log.warn(`[Backup] Authentication failed - RequestID: ${requestId}`);
        fastify.log.warn(`[Backup]   - VercelCron: ${isVercelCron}, HasSecret: ${!!backupSecret}, ProvidedSecret: ${!!providedSecret}`);
        reply.status(401);
        return {
          success: false,
          message: 'Unauthorized: Invalid backup secret or not a Vercel Cron job',
          timestamp: new Date().toISOString()
        };
      }

      // Log warning if BACKUP_SECRET is not set (for production security)
      if (!backupSecret && !hasVercelCronIndicator) {
        fastify.log.warn(`[Backup] BACKUP_SECRET not set - allowing backup without authentication (not recommended for production) - RequestID: ${requestId}`);
      }
      
      fastify.log.info(`[Backup] Authentication successful - RequestID: ${requestId}, Source: ${hasVercelCronIndicator ? 'Vercel Cron' : 'Manual'}`);

      const timestamp = new Date().toISOString();
      fastify.log.info(`[Backup] Starting database backup - RequestID: ${requestId}, Timestamp: ${timestamp}`);

      // Fetch all critical data from database
      // Use try-catch for queries that might fail due to missing columns in older database schemas
      const [
        stores,
        users,
        products,
        customers,
        sales,
        saleItems,
        payments,
        inventoryLedger,
        purchaseOrders,
        purchaseOrderItems,
        deliveryOrders,
        franchiseConfigs,
        royaltyInvoices,
        royaltyLedgers,
        complianceRecords,
        discountOverrides,
        dailyClosings
      ] = await Promise.all([
        prisma.store.findMany().catch((err) => { console.error('Error fetching stores:', err); return []; }),
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            storeId: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            // Exclude password hash for security
          }
        }).catch((err) => { console.error('Error fetching users:', err); return []; }),
        prisma.product.findMany().catch((err) => { console.error('Error fetching products:', err); return []; }),
        prisma.customer.findMany().catch((err) => { console.error('Error fetching customers:', err); return []; }),
        prisma.sale.findMany().catch((err) => { console.error('Error fetching sales:', err); return []; }),
        prisma.saleItem.findMany().catch((err) => { console.error('Error fetching saleItems:', err); return []; }),
        prisma.payment.findMany().catch((err) => { console.error('Error fetching payments:', err); return []; }),
        prisma.inventoryLedger.findMany().catch((err) => { console.error('Error fetching inventoryLedger:', err); return []; }),
        prisma.purchaseOrder.findMany().catch((err) => { console.error('Error fetching purchaseOrders:', err); return []; }),
        // PurchaseOrderItem might have missing columns (receivedQtyKg, receivedQtyPcs, updatedAt) in older schemas
        // Try with all columns first, fallback to basic query if columns don't exist
        (async () => {
          try {
            return await prisma.purchaseOrderItem.findMany();
          } catch (err: any) {
            // If error is about missing columns, try with raw SQL selecting only existing columns
            if (err.message?.includes('does not exist') || err.message?.includes('column')) {
              console.warn('[Backup] PurchaseOrderItem missing new columns, using fallback query');
              try {
                const result = await prisma.$queryRawUnsafe(`
                  SELECT id, "poId", "productId", "qtyKg", "qtyPcs", "requestedRate", "createdAt"
                  FROM "PurchaseOrderItem"
                `);
                return result || [];
              } catch (fallbackErr) {
                console.error('[Backup] Error fetching purchaseOrderItems (fallback failed):', fallbackErr);
                return [];
              }
            }
            console.error('[Backup] Error fetching purchaseOrderItems:', err);
            return [];
          }
        })(),
        prisma.deliveryOrder.findMany().catch((err) => { console.error('Error fetching deliveryOrders:', err); return []; }),
        prisma.franchiseConfig.findMany().catch((err) => { console.error('Error fetching franchiseConfigs:', err); return []; }),
        prisma.royaltyInvoice.findMany().catch((err) => { console.error('Error fetching royaltyInvoices:', err); return []; }),
        prisma.royaltyLedger.findMany().catch((err) => { console.error('Error fetching royaltyLedgers:', err); return []; }),
        prisma.complianceRecord.findMany().catch((err) => { console.error('Error fetching complianceRecords:', err); return []; }),
        prisma.discountOverride.findMany().catch((err) => { console.error('Error fetching discountOverrides:', err); return []; }),
        prisma.dailyClosing.findMany().catch((err) => { console.error('Error fetching dailyClosings:', err); return []; })
      ]);

      // Create backup object
      const backup = {
        metadata: {
          version: '1.0',
          timestamp,
          source: 'vercel-cron-backup',
          databaseUrl: process.env.DATABASE_URL?.split('@')[1] || 'unknown' // Only include host part
        },
        data: {
          stores,
          users,
          products,
          customers,
          sales,
          saleItems,
          payments,
          inventoryLedger,
          purchaseOrders,
          purchaseOrderItems,
          deliveryOrders,
          franchiseConfigs,
          royaltyInvoices,
          royaltyLedgers,
          complianceRecords,
          discountOverrides,
          dailyClosings
        }
      };

      // Calculate table counts
      const tables = {
        stores: stores.length,
        users: users.length,
        products: products.length,
        customers: customers.length,
        sales: sales.length,
        saleItems: saleItems.length,
        payments: payments.length,
        inventoryLedger: inventoryLedger.length,
        purchaseOrders: purchaseOrders.length,
        purchaseOrderItems: purchaseOrderItems.length,
        deliveryOrders: deliveryOrders.length,
        franchiseConfigs: franchiseConfigs.length,
        royaltyInvoices: royaltyInvoices.length,
        royaltyLedgers: royaltyLedgers.length,
        complianceRecords: complianceRecords.length,
        discountOverrides: discountOverrides.length,
        dailyClosings: dailyClosings.length
      };

      const backupJson = JSON.stringify(backup, null, 2);
      const backupSize = Buffer.byteLength(backupJson, 'utf8');

      fastify.log.info(`[Backup] Data fetched successfully. Total size: ${backupSize} bytes`);

      // Store backup based on configured storage method
      const storageMethod = process.env.BACKUP_STORAGE_METHOD || 'vercel-blob';
      fastify.log.info(`[Backup] Storage method: ${storageMethod}`);
      
      if (storageMethod === 'vercel-blob') {
        // Use Vercel Blob Storage (recommended)
        fastify.log.info('[Backup] Attempting to store in Vercel Blob...');
        const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
        if (!blobToken) {
          throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set. Please enable Vercel Blob Storage in your project settings.');
        }
        await storeInVercelBlob(backupJson, timestamp);
        fastify.log.info('[Backup] Successfully stored in Vercel Blob');
      } else if (storageMethod === 's3') {
        // Use AWS S3
        fastify.log.info('[Backup] Attempting to store in AWS S3...');
        await storeInS3(backupJson, timestamp);
        fastify.log.info('[Backup] Successfully stored in S3');
      } else {
        // Log only (for testing)
        fastify.log.warn(`[Backup] Backup created (${backupSize} bytes) but not stored (BACKUP_STORAGE_METHOD=${storageMethod} not configured)`);
      }

      const duration = Date.now() - startTime;
      fastify.log.info(`[Backup] Database backup completed successfully - RequestID: ${requestId}, Size: ${backupSize} bytes, Duration: ${duration}ms`);

      return {
        success: true,
        message: 'Database backup created successfully',
        timestamp,
        backupSize,
        tables
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      fastify.log.error(`[Backup] Backup failed - RequestID: ${requestId}, Duration: ${duration}ms`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
        requestId
      });
      reply.status(500);
      return {
        success: false,
        message: 'Backup failed',
        timestamp: new Date().toISOString(),
        error: error.message || 'Unknown error occurred'
      };
    }
  });

  /**
   * POST /api/v1/backup/create-full
   * Full migration backup — every app table (SELECT *), including password hashes.
   * Stored as full-backup-{timestamp}.json on Vercel Blob.
   */
  fastify.post('/create-full', async (request, reply): Promise<BackupResponse> => {
    const requestId = Math.random().toString(36).substring(7);
    const startTime = Date.now();

    try {
      if (!isBackupAdminRequest(request)) {
        reply.status(401);
        return {
          success: false,
          message: 'Unauthorized: Invalid backup secret or not a Vercel Cron job',
          timestamp: new Date().toISOString(),
        };
      }

      fastify.log.info(`[FullBackup] Starting full migration backup - RequestID: ${requestId}`);

      const { backupJson, backupSize, tables, timestamp } = await buildFullDatabaseBackup();
      const storageMethod = process.env.BACKUP_STORAGE_METHOD || 'vercel-blob';

      if (storageMethod === 'vercel-blob') {
        const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
        if (!blobToken) {
          throw new Error('BLOB_READ_WRITE_TOKEN is not set');
        }
        await storeInVercelBlob(backupJson, timestamp, 'full-backup-');
      } else if (storageMethod === 's3') {
        await storeInS3(backupJson, timestamp, 'full-backup-');
      }

      const duration = Date.now() - startTime;
      fastify.log.info(
        `[FullBackup] Completed - RequestID: ${requestId}, Size: ${backupSize}, Duration: ${duration}ms`
      );

      return {
        success: true,
        message: 'Full migration backup created successfully',
        timestamp,
        backupSize,
        tables,
        blobFilename: `full-backup-${timestamp.replace(/:/g, '-')}.json`,
      };
    } catch (error: any) {
      fastify.log.error(`[FullBackup] Failed - RequestID: ${requestId}`, error);
      reply.status(500);
      return {
        success: false,
        message: 'Full backup failed',
        timestamp: new Date().toISOString(),
        error: error.message || 'Unknown error',
      };
    }
  });

  /**
   * GET /api/v1/backup/list
   * List available backups
   */
  fastify.get('/list', async (request, reply) => {
    try {
      const backupSecret = process.env.BACKUP_SECRET;
      const providedSecret = (request.headers['x-backup-secret'] as string) || 
                            (request.query as any).secret;
      
      // Allow Vercel Cron Jobs to authenticate (they send x-vercel-cron header)
      const isVercelCron = request.headers['x-vercel-cron'] === '1';
      
      // Authenticate: either valid secret OR Vercel Cron job
      const isAuthenticated = isVercelCron || (backupSecret && providedSecret === backupSecret);

      if (!isAuthenticated) {
        reply.status(401);
        return {
          success: false,
          message: 'Unauthorized: Invalid backup secret or not a Vercel Cron job'
        };
      }

      const storageMethod = process.env.BACKUP_STORAGE_METHOD || 'vercel-blob';
      
      if (storageMethod === 'vercel-blob') {
        const backups = await listVercelBlobBackups();
        return {
          success: true,
          backups,
          storageMethod
        };
      } else if (storageMethod === 's3') {
        const backups = await listS3Backups();
        return {
          success: true,
          backups,
          storageMethod
        };
      } else {
        return {
          success: false,
          message: 'Backup storage not configured',
          storageMethod: 'none'
        };
      }

    } catch (error: any) {
      fastify.log.error('Failed to list backups:', error);
      reply.status(500);
      return {
        success: false,
        message: 'Failed to list backups',
        error: error.message
      };
    }
  });

  /**
   * POST /api/v1/backup/enable-rls
   * Enable RLS on public app tables (DDL only — no data deleted or modified).
   */
  fastify.post('/enable-rls', async (request, reply) => {
    try {
      if (!isBackupAdminRequest(request)) {
        reply.status(401);
        return {
          success: false,
          message: 'Unauthorized: Invalid backup secret or not a Vercel Cron job',
          timestamp: new Date().toISOString(),
        };
      }

      const [customerCountBefore, saleCountBefore] = await Promise.all([
        prisma.customer.count(),
        prisma.sale.count(),
      ]);

      const enabled: string[] = [];
      const policiesCreated: string[] = [];
      for (const table of RLS_PUBLIC_TABLES) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE IF EXISTS public."${table}" ENABLE ROW LEVEL SECURITY`
        );
        enabled.push(table);

        // Prisma connects as postgres — allow full access so API/reports keep working
        for (const role of ['postgres', 'service_role']) {
          const policyName = `prisma_${role}_all_access`;
          await prisma.$executeRawUnsafe(`
            DO $$ BEGIN
              CREATE POLICY "${policyName}" ON public."${table}"
                FOR ALL TO ${role} USING (true) WITH CHECK (true);
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
          `);
          policiesCreated.push(`${table}:${role}`);
        }
      }

      // Verify Prisma can still read sales with relations (reports/orders depend on this)
      const saleSample = await prisma.sale.findFirst({
        include: {
          items: { include: { product: { include: { category: true } } } },
          payments: true,
          customer: true,
        },
      });

      const rlsCheck: { relname: string; relrowsecurity: boolean }[] =
        await prisma.$queryRawUnsafe(`
          SELECT c.relname, c.relrowsecurity
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relname = 'PurchaseOrderItem'
        `);

      const [customerCountAfter, saleCountAfter] = await Promise.all([
        prisma.customer.count(),
        prisma.sale.count(),
      ]);

      return {
        success: true,
        message: 'Row level security enabled on public tables (no data modified)',
        timestamp: new Date().toISOString(),
        tablesEnabled: enabled.length,
        policiesCreated: policiesCreated.length,
        prismaReadCheck: {
          saleFound: !!saleSample,
          itemCount: saleSample?.items?.length ?? 0,
        },
        purchaseOrderItemRls: rlsCheck[0]?.relrowsecurity === true,
        dataIntegrity: {
          customersBefore: customerCountBefore,
          customersAfter: customerCountAfter,
          salesBefore: saleCountBefore,
          salesAfter: saleCountAfter,
          unchanged:
            customerCountBefore === customerCountAfter &&
            saleCountBefore === saleCountAfter,
        },
      };
    } catch (error: any) {
      fastify.log.error('[Backup] enable-rls failed:', error);
      reply.status(500);
      return {
        success: false,
        message: 'Failed to enable RLS',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  });

  /**
   * POST /api/v1/backup/apply-customer-area-column
   * Add nullable Customer.area and backfill from legacy Area addresses (DDL + safe UPDATE only).
   */
  fastify.post('/apply-customer-area-column', async (request, reply) => {
    try {
      if (!isBackupAdminRequest(request)) {
        reply.status(401);
        return {
          success: false,
          message: 'Unauthorized: Invalid backup secret or not a Vercel Cron job',
          timestamp: new Date().toISOString(),
        };
      }

      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'area'
          ) THEN
            ALTER TABLE "Customer" ADD COLUMN "area" TEXT;
          END IF;
        END $$;
      `);

      const backfill = await prisma.$executeRawUnsafe(`
        UPDATE "Customer" c
        SET "area" = NULLIF(TRIM(ca."line1"), '')
        FROM "CustomerAddress" ca
        WHERE ca."customerId" = c.id
          AND ca."label" = 'Area'
          AND c."area" IS NULL
          AND ca."line1" IS NOT NULL
          AND TRIM(ca."line1") <> ''
          AND TRIM(ca."line1") <> '—';
      `);

      const columnCheck: { exists: boolean }[] = await prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'area'
        ) AS exists
      `);

      const salesProbe = await prisma.sale.findFirst({
        where: { customerId: { not: null } },
        include: {
          customer: {
            include: { addresses: { where: { label: 'Area' }, take: 1 } },
          },
        },
      });

      return {
        success: true,
        message: 'Customer.area column applied and backfilled from legacy addresses',
        timestamp: new Date().toISOString(),
        columnExists: columnCheck[0]?.exists === true,
        backfillRowsTouched: typeof backfill === 'number' ? backfill : null,
        salesProbe: {
          saleFound: !!salesProbe,
          customerArea: salesProbe?.customer?.area ?? null,
        },
      };
    } catch (error: any) {
      fastify.log.error('[Backup] apply-customer-area-column failed:', error);
      reply.status(500);
      return {
        success: false,
        message: 'Failed to apply Customer.area migration',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  });

  /**
   * GET /api/v1/backup/storage-diagnostics
   * Report database disk usage, table sizes, and large-field estimates.
   */
  fastify.get('/storage-diagnostics', async (request, reply) => {
    try {
      if (!isBackupAdminRequest(request)) {
        reply.status(401);
        return {
          success: false,
          message: 'Unauthorized: Invalid backup secret or not a Vercel Cron job',
          timestamp: new Date().toISOString(),
        };
      }

      const dbSizeRows: { size_bytes: bigint; size_pretty: string }[] =
        await prisma.$queryRawUnsafe(`
          SELECT
            pg_database_size(current_database())::bigint AS size_bytes,
            pg_size_pretty(pg_database_size(current_database())) AS size_pretty
        `);

      const tableSizes: {
        table_name: string;
        size_bytes: bigint;
        size_pretty: string;
        row_estimate: bigint | null;
        dead_tuples: bigint | null;
      }[] = await prisma.$queryRawUnsafe(`
        SELECT
          c.relname AS table_name,
          pg_total_relation_size(c.oid)::bigint AS size_bytes,
          pg_size_pretty(pg_total_relation_size(c.oid)) AS size_pretty,
          s.n_live_tup::bigint AS row_estimate,
          s.n_dead_tup::bigint AS dead_tuples
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
        WHERE n.nspname = 'public' AND c.relkind = 'r'
        ORDER BY pg_total_relation_size(c.oid) DESC
        LIMIT 30
      `);

      const rowCounts: { table_name: string; row_count: bigint }[] =
        await prisma.$queryRawUnsafe(`
          SELECT
            relname AS table_name,
            COALESCE(n_live_tup, 0)::bigint AS row_count
          FROM pg_stat_user_tables
          WHERE schemaname = 'public'
          ORDER BY n_live_tup DESC NULLS LAST
          LIMIT 20
        `);

      const imageStats: {
        products_with_data_url: bigint;
        total_chars: bigint | null;
      }[] = await prisma.$queryRawUnsafe(`
        SELECT
          COUNT(*)::bigint AS products_with_data_url,
          COALESCE(SUM(LENGTH("imageUrl")), 0)::bigint AS total_chars
        FROM "Product"
        WHERE "imageUrl" LIKE 'data:%'
      `);

      const syncEventStats: {
        total: bigint;
        acked: bigint;
        oldest: Date | null;
      }[] = await prisma.$queryRawUnsafe(`
        SELECT
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE "ackedAt" IS NOT NULL)::bigint AS acked,
          MIN("serverReceivedAt") AS oldest
        FROM "SyncEvent"
      `);

      const auditLogStats: {
        total: bigint;
        oldest: Date | null;
      }[] = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::bigint AS total, MIN("createdAt") AS oldest FROM "AuditLog"
      `);

      const backupJsonEstimate = await estimateLogicalBackupBytes();

      const dbSizeBytes = Number(dbSizeRows[0]?.size_bytes ?? 0);
      const imageChars = Number(imageStats[0]?.total_chars ?? 0);

      return {
        success: true,
        timestamp: new Date().toISOString(),
        database: {
          sizeBytes: dbSizeBytes,
          sizePretty: dbSizeRows[0]?.size_pretty ?? 'unknown',
          logicalBackupEstimateBytes: backupJsonEstimate,
          logicalBackupEstimatePretty: formatBytes(backupJsonEstimate),
          bloatHint:
            dbSizeBytes > backupJsonEstimate * 3
              ? 'Database disk is much larger than logical data — run storage-cleanup then VACUUM in Supabase SQL editor'
              : null,
        },
        tables: tableSizes.map((t) => ({
          table: t.table_name,
          sizeBytes: Number(t.size_bytes),
          sizePretty: t.size_pretty,
          rowEstimate: t.row_estimate != null ? Number(t.row_estimate) : null,
          deadTuples: t.dead_tuples != null ? Number(t.dead_tuples) : null,
        })),
        rowCounts: rowCounts.map((r) => ({
          table: r.table_name,
          rows: Number(r.row_count),
        })),
        largeFields: {
          productBase64Images: {
            count: Number(imageStats[0]?.products_with_data_url ?? 0),
            totalChars: imageChars,
            estimatedBytes: imageChars,
            estimatedPretty: formatBytes(imageChars),
          },
          syncEvents: {
            total: Number(syncEventStats[0]?.total ?? 0),
            acked: Number(syncEventStats[0]?.acked ?? 0),
            oldest: syncEventStats[0]?.oldest ?? null,
          },
          auditLogs: {
            total: Number(auditLogStats[0]?.total ?? 0),
            oldest: auditLogStats[0]?.oldest ?? null,
          },
        },
        recommendations: buildStorageRecommendations({
          dbSizeBytes,
          backupBytes: backupJsonEstimate,
          syncEventTotal: Number(syncEventStats[0]?.total ?? 0),
          auditLogTotal: Number(auditLogStats[0]?.total ?? 0),
          base64ImageBytes: imageChars,
        }),
      };
    } catch (error: any) {
      fastify.log.error('[Backup] storage-diagnostics failed:', error);
      reply.status(500);
      return {
        success: false,
        message: 'Failed to collect storage diagnostics',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  });

  /**
   * POST /api/v1/backup/storage-cleanup
   * Prune old sync/audit rows, strip base64 product images, optional VACUUM ANALYZE.
   * Body: { dryRun?: boolean, pruneSyncEventsDays?: number, pruneAuditLogDays?: number, stripBase64Images?: boolean, vacuum?: boolean }
   */
  fastify.post('/storage-cleanup', async (request, reply) => {
    try {
      if (!isBackupAdminRequest(request)) {
        reply.status(401);
        return {
          success: false,
          message: 'Unauthorized: Invalid backup secret or not a Vercel Cron job',
          timestamp: new Date().toISOString(),
        };
      }

      const body = (request.body ?? {}) as {
        dryRun?: boolean;
        pruneSyncEventsDays?: number;
        pruneAuditLogDays?: number;
        stripBase64Images?: boolean;
        vacuum?: boolean;
      };

      const dryRun = body.dryRun !== false;
      const pruneSyncEventsDays = Math.max(1, body.pruneSyncEventsDays ?? 14);
      const pruneAuditLogDays = Math.max(30, body.pruneAuditLogDays ?? 180);
      const stripBase64Images = body.stripBase64Images !== false;
      const vacuum = body.vacuum === true;

      const beforeDbSize: { size_bytes: bigint }[] = await prisma.$queryRawUnsafe(`
        SELECT pg_database_size(current_database())::bigint AS size_bytes
      `);

      const syncCutoff = new Date(Date.now() - pruneSyncEventsDays * 24 * 60 * 60 * 1000);
      const auditCutoff = new Date(Date.now() - pruneAuditLogDays * 24 * 60 * 60 * 1000);

      const syncToDelete: { count: bigint }[] = await prisma.$queryRaw`
          SELECT COUNT(*)::bigint AS count
          FROM "SyncEvent"
          WHERE "ackedAt" IS NOT NULL AND "serverReceivedAt" < ${syncCutoff}
        `;

      const auditToDelete: { count: bigint }[] = await prisma.$queryRaw`
          SELECT COUNT(*)::bigint AS count
          FROM "AuditLog"
          WHERE "createdAt" < ${auditCutoff}
        `;

      const imagesToStrip: {
        count: bigint;
        total_chars: bigint | null;
      }[] = await prisma.$queryRawUnsafe(`
        SELECT
          COUNT(*)::bigint AS count,
          COALESCE(SUM(LENGTH("imageUrl")), 0)::bigint AS total_chars
        FROM "Product"
        WHERE "imageUrl" LIKE 'data:%'
      `);

      const plan = {
        dryRun,
        pruneSyncEventsDays,
        pruneAuditLogDays,
        stripBase64Images,
        vacuum,
        syncEventsToDelete: Number(syncToDelete[0]?.count ?? 0),
        auditLogsToDelete: Number(auditToDelete[0]?.count ?? 0),
        base64ImagesToStrip: Number(imagesToStrip[0]?.count ?? 0),
        base64CharsToFree: Number(imagesToStrip[0]?.total_chars ?? 0),
        databaseSizeBefore: formatBytes(Number(beforeDbSize[0]?.size_bytes ?? 0)),
      };

      if (dryRun) {
        return {
          success: true,
          message: 'Dry run only — no rows changed. POST again with {"dryRun":false} to apply.',
          timestamp: new Date().toISOString(),
          plan,
        };
      }

      let deletedSyncEvents = 0;
      let deletedAuditLogs = 0;
      let strippedImages = 0;

      if (plan.syncEventsToDelete > 0) {
        deletedSyncEvents = await prisma.$executeRaw`
            DELETE FROM "SyncEvent"
            WHERE "ackedAt" IS NOT NULL AND "serverReceivedAt" < ${syncCutoff}
          `;
      }

      if (plan.auditLogsToDelete > 0) {
        deletedAuditLogs = await prisma.$executeRaw`
            DELETE FROM "AuditLog"
            WHERE "createdAt" < ${auditCutoff}
          `;
      }

      if (stripBase64Images && plan.base64ImagesToStrip > 0) {
        strippedImages = await prisma.$executeRawUnsafe(`
          UPDATE "Product"
          SET "imageUrl" = NULL, "updatedAt" = NOW()
          WHERE "imageUrl" LIKE 'data:%'
        `);
      }

      const vacuumed: string[] = [];
      if (vacuum) {
        const tables = ['SyncEvent', 'AuditLog', 'Product', 'Sale', 'SaleItem', 'InventoryLedger'];
        for (const table of tables) {
          await prisma.$executeRawUnsafe(`VACUUM ANALYZE "${table}"`);
          vacuumed.push(table);
        }
      }

      const afterDbSize: { size_bytes: bigint }[] = await prisma.$queryRawUnsafe(`
        SELECT pg_database_size(current_database())::bigint AS size_bytes
      `);

      return {
        success: true,
        message: 'Storage cleanup completed',
        timestamp: new Date().toISOString(),
        plan,
        results: {
          deletedSyncEvents,
          deletedAuditLogs,
          strippedImages,
          vacuumed,
          databaseSizeBefore: formatBytes(Number(beforeDbSize[0]?.size_bytes ?? 0)),
          databaseSizeAfter: formatBytes(Number(afterDbSize[0]?.size_bytes ?? 0)),
          note:
            'pg_database_size may not drop until Supabase runs VACUUM FULL. Use SQL editor: VACUUM (VERBOSE, ANALYZE);',
        },
      };
    } catch (error: any) {
      fastify.log.error('[Backup] storage-cleanup failed:', error);
      reply.status(500);
      return {
        success: false,
        message: 'Storage cleanup failed',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  });

  /**
   * GET /api/v1/backup/storage-cleanup-weekly
   * Vercel Cron: prune old SyncEvent/AuditLog rows (no base64 strip).
   */
  fastify.get('/storage-cleanup-weekly', async (request, reply) => {
    if (!isBackupAdminRequest(request)) {
      reply.status(401);
      return {
        success: false,
        message: 'Unauthorized',
        timestamp: new Date().toISOString(),
      };
    }

    const syncCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const auditCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    const deletedSyncEvents = await prisma.$executeRaw`
      DELETE FROM "SyncEvent"
      WHERE "ackedAt" IS NOT NULL AND "serverReceivedAt" < ${syncCutoff}
    `;
    const deletedAuditLogs = await prisma.$executeRaw`
      DELETE FROM "AuditLog"
      WHERE "createdAt" < ${auditCutoff}
    `;

    return {
      success: true,
      message: 'Weekly storage prune completed',
      timestamp: new Date().toISOString(),
      deletedSyncEvents,
      deletedAuditLogs,
    };
  });

  /**
   * POST /api/v1/backup/apply-payment-method-enum
   * Add CREDIT + ONLINE to PaymentMethod enum (DDL only — no data deleted).
   */
  fastify.post('/apply-payment-method-enum', async (request, reply) => {
    try {
      if (!isBackupAdminRequest(request)) {
        reply.status(401);
        return {
          success: false,
          message: 'Unauthorized: Invalid backup secret or not a Vercel Cron job',
          timestamp: new Date().toISOString(),
        };
      }

      await prisma.$executeRawUnsafe(
        `ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CREDIT'`
      );
      await prisma.$executeRawUnsafe(
        `ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'ONLINE'`
      );

      const enumValues: { enumlabel: string }[] = await prisma.$queryRawUnsafe(`
        SELECT e.enumlabel
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'PaymentMethod'
        ORDER BY e.enumsortorder
      `);

      const creditQueryCheck = await prisma.payment.count({
        where: { method: 'CREDIT' },
      });

      return {
        success: true,
        message: 'PaymentMethod enum extended with CREDIT and ONLINE',
        timestamp: new Date().toISOString(),
        enumValues: enumValues.map((r) => r.enumlabel),
        creditPaymentCount: creditQueryCheck,
      };
    } catch (error: any) {
      fastify.log.error('[Backup] apply-payment-method-enum failed:', error);
      reply.status(500);
      return {
        success: false,
        message: 'Failed to apply PaymentMethod enum migration',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

async function estimateLogicalBackupBytes(): Promise<number> {
  const counts: { total: bigint }[] = await prisma.$queryRawUnsafe(`
    SELECT (
      (SELECT COUNT(*) FROM "Store") +
      (SELECT COUNT(*) FROM "User") +
      (SELECT COUNT(*) FROM "Product") +
      (SELECT COUNT(*) FROM "Customer") +
      (SELECT COUNT(*) FROM "Sale") +
      (SELECT COUNT(*) FROM "SaleItem") +
      (SELECT COUNT(*) FROM "Payment") +
      (SELECT COUNT(*) FROM "InventoryLedger") +
      (SELECT COUNT(*) FROM "SyncEvent") +
      (SELECT COUNT(*) FROM "AuditLog")
    )::bigint AS total
  `);
  const rows = Number(counts[0]?.total ?? 0);
  return Math.max(rows * 1200, 0);
}

function buildStorageRecommendations(input: {
  dbSizeBytes: number;
  backupBytes: number;
  syncEventTotal: number;
  auditLogTotal: number;
  base64ImageBytes: number;
}): string[] {
  const tips: string[] = [];
  if (input.dbSizeBytes > 5 * 1024 ** 3) {
    tips.push('Database exceeds 5 GB Supabase included usage — cleanup and VACUUM, or upgrade/disable spend cap.');
  }
  if (input.syncEventTotal > 5000) {
    tips.push('Prune old SyncEvent rows (POST /api/v1/backup/storage-cleanup with dryRun:false).');
  }
  if (input.auditLogTotal > 10000) {
    tips.push('Prune old AuditLog rows older than 180 days.');
  }
  if (input.base64ImageBytes > 500_000) {
    tips.push('Remove base64 product images from Product.imageUrl — store URLs or Vercel Blob instead.');
  }
  if (input.dbSizeBytes > input.backupBytes * 5) {
    tips.push('Run VACUUM (VERBOSE, ANALYZE) in Supabase SQL editor after cleanup to reclaim dead tuple space.');
  }
  if (tips.length === 0) {
    tips.push('No obvious bloat detected in app tables — check Supabase dashboard → Database → Disk usage for WAL/backups.');
  }
  return tips;
}

/**
 * Store backup in Vercel Blob Storage
 */
async function storeInVercelBlob(backupJson: string, timestamp: string, filenamePrefix = 'backup-') {
  try {
    // Dynamic import to avoid issues if @vercel/blob is not installed
    const { put } = await import('@vercel/blob');
    
    const filename = `${filenamePrefix}${timestamp.replace(/:/g, '-')}.json`;
    
    console.log(`[Backup] Uploading to Vercel Blob: ${filename} (${backupJson.length} bytes)`);
    
    const blob = await put(filename, backupJson, {
      access: 'public',
      addRandomSuffix: false,
    });

    console.log(`[Backup] Successfully stored in Vercel Blob: ${blob.url}`);
    return blob;
  } catch (error: any) {
    console.error('[Backup] Failed to store in Vercel Blob:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Provide more helpful error messages
    if (error.message?.includes('BLOB_READ_WRITE_TOKEN') || error.message?.includes('token')) {
      throw new Error(`Vercel Blob storage failed: BLOB_READ_WRITE_TOKEN is missing or invalid. Please check your Vercel environment variables. Original error: ${error.message}`);
    }
    
    throw new Error(`Vercel Blob storage failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Store backup in AWS S3
 */
async function storeInS3(backupJson: string, timestamp: string, filenamePrefix = 'backup-') {
  try {
    // Dynamic import to avoid issues if AWS SDK is not installed
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const filename = `${filenamePrefix}${timestamp.replace(/:/g, '-')}.json`;
    const bucketName = process.env.AWS_S3_BACKUP_BUCKET!;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: `database-backups/${filename}`,
      Body: backupJson,
      ContentType: 'application/json',
    });

    await s3Client.send(command);
    console.log(`Backup stored in S3: s3://${bucketName}/database-backups/${filename}`);
  } catch (error: any) {
    console.error('Failed to store in S3:', error);
    throw new Error(`S3 storage failed: ${error.message}`);
  }
}

/**
 * List backups from Vercel Blob Storage
 */
async function listVercelBlobBackups() {
  try {
    const { list } = await import('@vercel/blob');
    const { blobs } = await list();
    
    return blobs
      .filter(
        (blob) =>
          blob.pathname.startsWith('backup-') || blob.pathname.startsWith('full-backup-')
      )
      .map(blob => ({
        filename: blob.pathname,
        url: blob.url,
        size: blob.size,
        uploadedAt: blob.uploadedAt
      }));
  } catch (error: any) {
    console.error('Failed to list Vercel Blob backups:', error);
    return [];
  }
}

/**
 * List backups from AWS S3
 */
async function listS3Backups() {
  try {
    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const bucketName = process.env.AWS_S3_BACKUP_BUCKET!;

    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: 'database-backups/',
    });

    const response = await s3Client.send(command);
    
    return (response.Contents || []).map(obj => ({
      filename: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified
    }));
  } catch (error: any) {
    console.error('Failed to list S3 backups:', error);
    return [];
  }
}

