import { prisma } from '@azela-pos/db';

/** All application tables in FK-safe restore order (PascalCase = Postgres table names). */
export const FULL_BACKUP_TABLE_ORDER = [
  'Store',
  'Category',
  'PricingPlan',
  'User',
  'Customer',
  'CustomerAddress',
  'Product',
  'StoreProductPrice',
  'ScaleBarcodeConfig',
  'FranchiseConfig',
  'PricingRule',
  'ProductMaster',
  'Supplier',
  'Shift',
  'Sale',
  'SaleItem',
  'Payment',
  'InventoryLedger',
  'PurchaseOrder',
  'PurchaseOrderItem',
  'Dispatch',
  'DispatchItem',
  'GRN',
  'DeliveryOrder',
  'DeliveryEvent',
  'CentralPurchaseOrder',
  'CentralPOItem',
  'InwardStock',
  'StockAllocation',
  'RoyaltyInvoice',
  'RoyaltyLedger',
  'ComplianceChecklistTemplate',
  'ComplianceRecord',
  'HQAlert',
  'AlertRule',
  'FranchiseHealthScore',
  'YieldIntelligence',
  'ReplenishmentRequest',
  'DiscountOverride',
  'DailyClosing',
  'LoyaltyTransaction',
  'PricingOverride',
  'AuditLog',
  'SyncEvent',
] as const;

function serializeForBackup(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Date) return v.toISOString();
    return v;
  });
}

async function exportTable(tableName: string): Promise<unknown[]> {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM "${tableName}"`);
    return Array.isArray(rows) ? rows : [];
  } catch (error: any) {
    console.error(`[FullBackup] Failed to export "${tableName}":`, error.message);
    return [];
  }
}

export interface FullBackupResult {
  backupJson: string;
  backupSize: number;
  tables: Record<string, number>;
  timestamp: string;
}

export async function buildFullDatabaseBackup(): Promise<FullBackupResult> {
  const timestamp = new Date().toISOString();
  const data: Record<string, unknown[]> = {};
  const tables: Record<string, number> = {};

  for (const tableName of FULL_BACKUP_TABLE_ORDER) {
    const rows = await exportTable(tableName);
    data[tableName] = rows;
    tables[tableName] = rows.length;
  }

  let migrationRows: { count: bigint }[] = [{ count: 0n }];
  try {
    migrationRows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
    `);
  } catch {
    migrationRows = [{ count: 0n }];
  }

  const backup = {
    metadata: {
      version: '2.0',
      kind: 'full-migration',
      timestamp,
      source: 'k2-chicken-pos-full-backup',
      databaseHost: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown',
      tableOrder: [...FULL_BACKUP_TABLE_ORDER],
      prismaMigrationCount: Number(migrationRows[0]?.count ?? 0),
      notes: [
        'Complete row-level export of all public app tables via SELECT *.',
        'Includes User.passwordHash for auth migration.',
        'Restore: run prisma migrate deploy on target DB, then scripts/restore-from-cloud-backup.ts',
        'For native Postgres migration, prefer scripts/pg-dump-production.sh when DATABASE_URL is available.',
      ],
    },
    data,
  };

  const backupJson = serializeForBackup(backup);
  return {
    backupJson,
    backupSize: Buffer.byteLength(backupJson, 'utf8'),
    tables,
    timestamp,
  };
}
