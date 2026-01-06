// @ts-nocheck
import { FastifyInstance } from 'fastify';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

// Create prisma instance for backup operations
const globalForPrisma = globalThis as unknown as { prisma: any };
const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

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
   * GET /api/v1/backup/health
   * Health check for backup service
   */
  fastify.get('/health', async (request, reply) => {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'backup',
        database: 'connected'
      };
    } catch (error: any) {
      reply.status(500);
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
    try {
      // Verify backup secret for security
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
          message: 'Unauthorized: Invalid backup secret or not a Vercel Cron job',
          timestamp: new Date().toISOString()
        };
      }

      const timestamp = new Date().toISOString();
      fastify.log.info(`Starting database backup at ${timestamp}`);

      // Fetch all critical data from database
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
        prisma.store.findMany(),
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
        }),
        prisma.product.findMany(),
        prisma.customer.findMany(),
        prisma.sale.findMany(),
        prisma.saleItem.findMany(),
        prisma.payment.findMany(),
        prisma.inventoryLedger.findMany(),
        prisma.purchaseOrder.findMany(),
        prisma.purchaseOrderItem.findMany(),
        prisma.deliveryOrder.findMany(),
        prisma.franchiseConfig.findMany(),
        prisma.royaltyInvoice.findMany(),
        prisma.royaltyLedger.findMany(),
        prisma.complianceRecord.findMany(),
        prisma.discountOverride.findMany(),
        prisma.dailyClosing.findMany()
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

      // Store backup based on configured storage method
      const storageMethod = process.env.BACKUP_STORAGE_METHOD || 'vercel-blob';
      
      if (storageMethod === 'vercel-blob') {
        // Use Vercel Blob Storage (recommended)
        await storeInVercelBlob(backupJson, timestamp);
      } else if (storageMethod === 's3') {
        // Use AWS S3
        await storeInS3(backupJson, timestamp);
      } else {
        // Log only (for testing)
        fastify.log.info(`Backup created (${backupSize} bytes) but not stored (BACKUP_STORAGE_METHOD not configured)`);
      }

      fastify.log.info(`Database backup completed successfully. Size: ${backupSize} bytes`);

      return {
        success: true,
        message: 'Database backup created successfully',
        timestamp,
        backupSize,
        tables
      };

    } catch (error: any) {
      fastify.log.error('Backup failed:', error);
      reply.status(500);
      return {
        success: false,
        message: 'Backup failed',
        timestamp: new Date().toISOString(),
        error: error.message
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
}

/**
 * Store backup in Vercel Blob Storage
 */
async function storeInVercelBlob(backupJson: string, timestamp: string) {
  try {
    // Dynamic import to avoid issues if @vercel/blob is not installed
    const { put } = await import('@vercel/blob');
    
    const filename = `backup-${timestamp.replace(/:/g, '-')}.json`;
    
    const blob = await put(filename, backupJson, {
      access: 'public',
      addRandomSuffix: false,
    });

    console.log(`Backup stored in Vercel Blob: ${blob.url}`);
    return blob;
  } catch (error: any) {
    console.error('Failed to store in Vercel Blob:', error);
    throw new Error(`Vercel Blob storage failed: ${error.message}`);
  }
}

/**
 * Store backup in AWS S3
 */
async function storeInS3(backupJson: string, timestamp: string) {
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

    const filename = `backup-${timestamp.replace(/:/g, '-')}.json`;
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
      .filter(blob => blob.pathname.startsWith('backup-'))
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

