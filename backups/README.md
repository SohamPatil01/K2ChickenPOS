# Database backups

Backups in this folder are **read-only snapshots**. Creating a backup never modifies or deletes any data in the database.

## Policy

- **No modification**: Backup scripts only *read* from the database (via `pg_dump`). They never write, update, or delete anything in the database.
- **Include everything**: Each full backup includes the entire database — all schemas, all tables, and all data. Nothing is excluded.
- **No overlap**: Each backup is written to a new timestamped file. Backups do not overwrite existing data or interfere with each other.

## Creating a backup

From the project root:

```bash
./scripts/backup-localhost.sh
```

This creates `backups/backup_localhost_YYYYMMDD_HHMMSS.sql` with a full dump (schema + data).

## Restore

```bash
./scripts/restore-from-backup.sh backups/backup_localhost_YYYYMMDD_HHMMSS.sql
```

**Note:** Restore *does* modify the target database (it loads the backup). Only the act of *creating* a backup is read-only.
