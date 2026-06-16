/**
 * Restore JSON backups from /api/v1/backup/create (v1) or /api/v1/backup/create-full (v2).
 * v2 exports PascalCase Postgres table names with all columns (incl. passwordHash).
 *
 * Usage:
 *   pnpm exec tsx scripts/restore-from-cloud-backup.ts backups/full_backup_....json
 *
 * Target DB should already have schema: pnpm --filter @azela-pos/db exec prisma migrate deploy
 */
import { readFile } from 'fs/promises';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
import { FULL_BACKUP_TABLE_ORDER } from '../apps/api/src/services/fullDatabaseBackup';

type BackupFile = {
  metadata: { timestamp: string; version?: string; kind?: string };
  data: Record<string, unknown[]>;
};

const TABLE_TO_PRISMA_MODEL: Record<string, string> = {
  Store: 'store',
  Category: 'category',
  PricingPlan: 'pricingPlan',
  User: 'user',
  Customer: 'customer',
  CustomerAddress: 'customerAddress',
  Product: 'product',
  StoreProductPrice: 'storeProductPrice',
  ScaleBarcodeConfig: 'scaleBarcodeConfig',
  FranchiseConfig: 'franchiseConfig',
  PricingRule: 'pricingRule',
  ProductMaster: 'productMaster',
  Supplier: 'supplier',
  Shift: 'shift',
  Sale: 'sale',
  SaleItem: 'saleItem',
  Payment: 'payment',
  InventoryLedger: 'inventoryLedger',
  PurchaseOrder: 'purchaseOrder',
  PurchaseOrderItem: 'purchaseOrderItem',
  Dispatch: 'dispatch',
  DispatchItem: 'dispatchItem',
  GRN: 'gRN',
  DeliveryOrder: 'deliveryOrder',
  DeliveryEvent: 'deliveryEvent',
  CentralPurchaseOrder: 'centralPurchaseOrder',
  CentralPOItem: 'centralPOItem',
  InwardStock: 'inwardStock',
  StockAllocation: 'stockAllocation',
  RoyaltyInvoice: 'royaltyInvoice',
  RoyaltyLedger: 'royaltyLedger',
  ComplianceChecklistTemplate: 'complianceChecklistTemplate',
  ComplianceRecord: 'complianceRecord',
  HQAlert: 'hQAlert',
  AlertRule: 'alertRule',
  FranchiseHealthScore: 'franchiseHealthScore',
  YieldIntelligence: 'yieldIntelligence',
  ReplenishmentRequest: 'replenishmentRequest',
  DiscountOverride: 'discountOverride',
  DailyClosing: 'dailyClosing',
  LoyaltyTransaction: 'loyaltyTransaction',
  PricingOverride: 'pricingOverride',
  AuditLog: 'auditLog',
  SyncEvent: 'syncEvent',
};

const LEGACY_RESTORE_ORDER: Array<{ key: string; model: string }> = [
  { key: 'stores', model: 'store' },
  { key: 'users', model: 'user' },
  { key: 'products', model: 'product' },
  { key: 'customers', model: 'customer' },
  { key: 'sales', model: 'sale' },
  { key: 'saleItems', model: 'saleItem' },
  { key: 'payments', model: 'payment' },
  { key: 'inventoryLedger', model: 'inventoryLedger' },
  { key: 'purchaseOrders', model: 'purchaseOrder' },
  { key: 'purchaseOrderItems', model: 'purchaseOrderItem' },
  { key: 'deliveryOrders', model: 'deliveryOrder' },
  { key: 'franchiseConfigs', model: 'franchiseConfig' },
  { key: 'royaltyInvoices', model: 'royaltyInvoice' },
  { key: 'royaltyLedgers', model: 'royaltyLedger' },
  { key: 'complianceRecords', model: 'complianceRecord' },
  { key: 'discountOverrides', model: 'discountOverride' },
  { key: 'dailyClosings', model: 'dailyClosing' },
];

function isFullBackup(backup: BackupFile): boolean {
  return (
    backup.metadata?.version === '2.0' ||
    backup.metadata?.kind === 'full-migration' ||
    Boolean(backup.data?.Store)
  );
}

async function restoreRows(model: string, rows: unknown[]) {
  const delegate = (prisma as any)[model];
  if (!delegate?.createMany) {
    console.warn(`  skip (no prisma model ${model})`);
    return;
  }
  const normalized = rows.map((row) => normalizeRow(row));
  const batchSize = 200;
  let inserted = 0;
  for (let i = 0; i < normalized.length; i += batchSize) {
    const chunk = normalized.slice(i, i + batchSize);
    try {
      const result = await delegate.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      inserted += result.count;
    } catch (err: any) {
      console.error(`  batch failed for ${model}:`, err.message);
      throw err;
    }
  }
  console.log(`  inserted ${inserted} row(s)`);
}

/** Coerce ISO date strings from JSON backups into Date objects for Prisma. */
function normalizeRow(row: unknown): Record<string, unknown> {
  if (!row || typeof row !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const d = new Date(value);
      out[key] = Number.isNaN(d.getTime()) ? value : d;
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: tsx scripts/restore-from-cloud-backup.ts <backup.json>');
    process.exit(1);
  }

  const raw = await readFile(file, 'utf-8');
  const backup = JSON.parse(raw) as BackupFile;
  console.log(
    `Restoring backup from ${backup.metadata.timestamp} (${file}) — ${isFullBackup(backup) ? 'FULL v2' : 'legacy v1'}`
  );

  if (isFullBackup(backup)) {
    for (const tableName of FULL_BACKUP_TABLE_ORDER) {
      const rows = backup.data[tableName];
      if (!rows?.length) {
        console.log(`skip ${tableName} (0 rows)`);
        continue;
      }
      const model = TABLE_TO_PRISMA_MODEL[tableName];
      if (!model) {
        console.warn(`skip ${tableName} (no model mapping)`);
        continue;
      }
      console.log(`${tableName} (${rows.length} rows):`);
      await restoreRows(model, rows);
    }
  } else {
    for (const { key, model } of LEGACY_RESTORE_ORDER) {
      const rows = backup.data[key];
      if (!rows?.length) {
        console.log(`skip ${key} (0 rows)`);
        continue;
      }
      console.log(`${key} (${rows.length} rows):`);
      await restoreRows(model, rows);
    }
  }

  console.log('Restore finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
