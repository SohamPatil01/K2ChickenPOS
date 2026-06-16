/**
 * Export full database locally when DATABASE_URL points at production.
 * Same format as POST /api/v1/backup/create-full (v2 migration JSON).
 *
 * Usage:
 *   DATABASE_URL='postgres://...' pnpm exec tsx scripts/export-full-database.ts
 */
import { writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildFullDatabaseBackup } from '../apps/api/src/services/fullDatabaseBackup';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  console.log('Exporting all tables...');
  const { backupJson, backupSize, tables, timestamp } = await buildFullDatabaseBackup();

  const backupsDir = join(root, 'backups');
  await mkdir(backupsDir, { recursive: true });
  const safeTs = timestamp.replace(/:/g, '-').replace('T', '_');
  const outFile = join(backupsDir, `full_backup_${safeTs}.json`);
  await writeFile(outFile, backupJson, 'utf-8');

  console.log(`Wrote ${outFile} (${backupSize} bytes)`);
  for (const [table, count] of Object.entries(tables)) {
    if (count > 0) console.log(`  ${table}: ${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
