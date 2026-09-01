# Full system backup — 2026-07-21

**Status:** SUCCESS  
**Trigger:** Manual (post Neon upgrade)  
**API:** https://k2-chicken-pos-api.vercel.app  
**DB probe:** `/health?deep=1` → connected (`neondb`, PostgreSQL 17.10)

## Artifacts (local `backups/`)

| Kind | File | Size | Notes |
|------|------|------|-------|
| Full JSON (all tables) | `full_backup_2026-07-21_05-00-42.362Z.json` | ~11 MB | Also on Vercel Blob as `full-backup-2026-07-21T05-00-42.362Z.json` |
| Manifest | `full_backup_2026-07-21_05-00-42.362Z.manifest.json` | — | Table counts |
| Native dump (custom) | `pg_dump_2026-07-21T05-01-11Z.dump` | ~2.1 MB | Best for `pg_restore` |
| Native dump (SQL) | `pg_dump_2026-07-21T05-01-11Z.sql` | ~7.1 MB | Plain SQL restore |
| Source archive | `source_archive_2026-07-21T05-00-58Z.tar.gz` | ~913 KB | Code only (no node_modules/.env/backups) |

## Key row counts (from full JSON)

| Table | Count |
|-------|------:|
| Sale | 6385 |
| SaleItem | 8115 |
| Payment | 6533 |
| Customer | 291 |
| Product | 34 |
| InventoryLedger | 9620 |
| LoyaltyTransaction | 1300 |
| AuditLog | 6395 |
| PurchaseOrder | 148 |
| DeliveryOrder | 68 |
| User | 4 |
| Store | 2 |

Live DB `Sale` count at dump time: **6385** (matches).

## Restore cheatsheet

**JSON → new DB**
```bash
pnpm --filter @azela-pos/db exec prisma migrate deploy
pnpm exec tsx scripts/restore-from-cloud-backup.ts backups/full_backup_2026-07-21_05-00-42.362Z.json
```

**Native dump**
```bash
pg_restore --no-owner --no-acl --clean --if-exists -d "$NEW_DATABASE_URL" backups/pg_dump_2026-07-21T05-01-11Z.dump
# or
psql "$NEW_DATABASE_URL" -f backups/pg_dump_2026-07-21T05-01-11Z.sql
```

## Checksums (SHA-256)

| File | SHA-256 |
|------|---------|
| `full_backup_2026-07-21_05-00-42.362Z.json` | `57645fbc1079b31310b44b5b1cb275b152f25cf665816874027e55ec74cd9e49` |
| `pg_dump_2026-07-21T05-01-11Z.dump` | `5e2f5c1537902c48b4c887258516ab2f024e72b90c19a51e140094e664067937` |
| `pg_dump_2026-07-21T05-01-11Z.sql` | `2903763d7f6b25486b618e3d1a5d75aa622a4538f81c476a7d5063c27a11ae4b` |
| `source_archive_2026-07-21T05-00-58Z.tar.gz` | `3e8e9e90915cf981f9c623d0c6657ff577591203d132f973e77e91bbf7fa839f` |

## Notes

- Prefer the **custom `.dump`** + **full JSON** together for an in-depth recovery path.
- Source archive excludes secrets (`.env*`) and `node_modules`.
- Do not commit large dumps to git.
