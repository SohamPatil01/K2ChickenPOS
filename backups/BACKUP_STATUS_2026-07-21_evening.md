# Full system backup — 2026-07-21 (evening)

**Status:** SUCCESS  
**Trigger:** Manual (pre-Railway migration)  
**API:** https://k2-chicken-pos-api.vercel.app  
**DB:** Neon `neondb` (still live)

## Artifacts (local `backups/`)

| Kind | File | Size |
|------|------|------|
| Full JSON (all tables) | `full_backup_2026-07-21_16-08-19.551Z.json` | ~11 MB |
| Manifest | `full_backup_2026-07-21_16-08-19.551Z.manifest.json` | — |
| Native dump (custom) | `pg_dump_2026-07-21T16-08-34Z.dump` | ~1.7 MB |
| Native dump (SQL) | `pg_dump_2026-07-21T16-08-34Z.sql` | — |
| Source archive | `source_archive_2026-07-21T16-*.tar.gz` | — |

Also on Vercel Blob: `full-backup-2026-07-21T16-08-19.551Z.json`

## Key row counts

| Table | Count |
|-------|------:|
| Sale | 6416 |
| SaleItem | 8161 |
| Payment | 6564 |
| Customer | 297 |
| Product | 34 |
| InventoryLedger | 9675 |
| LoyaltyTransaction | 1309 |
| AuditLog | 6463 |
| PurchaseOrder | 149 |
| DeliveryOrder | 68 |
| User | 4 |
| Store | 2 |

## Restore (Railway)

```bash
export NEW_DATABASE_URL='postgresql://...@proxy.rlwy.net:.../railway'
DUMP=backups/pg_dump_2026-07-21T16-08-34Z.dump ./scripts/restore-to-railway.sh
```
