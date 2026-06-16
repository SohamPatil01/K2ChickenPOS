/**
 * Verify Neon migration row counts vs optional Supabase source or local full backup.
 * Usage: tsx scripts/verify-neon-migration.ts <neon-direct-url> [supabase-url]
 */
import { readFile, readdir } from 'fs/promises';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FULL_BACKUP_TABLE_ORDER } from '../apps/api/src/services/fullDatabaseBackup';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function countRows(dbUrl: string, table: string): number {
  const out = execSync(
    `psql "${dbUrl}" -t -A -c "SELECT COUNT(*) FROM \\"${table}\\""`,
    { encoding: 'utf-8' }
  ).trim();
  return Number(out);
}

async function expectedFromBackup(): Promise<Record<string, number>> {
  const names = (await readdir(join(root, 'backups'))).filter(
    (f) => f.startsWith('full_backup_') && f.endsWith('.json')
  );
  if (!names.length) return {};
  names.sort().reverse();
  const raw = await readFile(join(root, 'backups', names[0]!), 'utf-8');
  const backup = JSON.parse(raw) as { data: Record<string, unknown[]> };
  const expected: Record<string, number> = {};
  for (const t of FULL_BACKUP_TABLE_ORDER) {
    expected[t] = backup.data[t]?.length ?? 0;
  }
  return expected;
}

async function main() {
  const neonUrl = process.argv[2];
  const supabaseUrl = process.argv[3];
  if (!neonUrl) {
    console.error('Usage: tsx scripts/verify-neon-migration.ts <neon-url> [supabase-url]');
    process.exit(1);
  }

  const expectedBackup = await expectedFromBackup();
  let failed = 0;

  console.log('Table verification (Neon vs source):\n');
  for (const table of FULL_BACKUP_TABLE_ORDER) {
    const neon = countRows(neonUrl, table);
    let expected: number | null = null;
    let source = '';

    if (supabaseUrl) {
      expected = countRows(supabaseUrl, table);
      source = 'supabase';
    } else if (expectedBackup[table] !== undefined) {
      expected = expectedBackup[table]!;
      source = 'backup';
    }

    if (expected === null) {
      if (neon > 0) console.log(`  ? ${table}: neon=${neon}`);
      continue;
    }

    if (neon === expected) {
      console.log(`  ✓ ${table}: ${neon} (${source})`);
    } else {
      console.log(`  ✗ ${table}: neon=${neon} expected=${expected} (${source})`);
      failed++;
    }
  }

  const users = execSync(
    `psql "${neonUrl}" -t -A -c "SELECT COUNT(*) FROM \\"User\\" WHERE \\"passwordHash\\" IS NOT NULL AND \\"passwordHash\\" <> ''"`,
    { encoding: 'utf-8' }
  ).trim();
  console.log(`\n  Users with passwordHash: ${users}`);

  if (failed > 0) {
    console.error(`\n${failed} table(s) mismatched — do NOT cut over production yet.`);
    process.exit(1);
  }
  console.log('\nAll tables match. Safe to point Vercel DATABASE_URL at Neon pooled URL.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
