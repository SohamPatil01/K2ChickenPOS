# Safe Database Migration Guide

## 🛡️ Data Preservation Policy

**CRITICAL RULE: When adding new features to the database, existing data MUST be preserved.**

This guide ensures that all database changes (migrations, schema updates, new features) maintain existing data integrity.

## ✅ Prisma Migrations (Safe by Default)

Prisma migrations **automatically preserve data** when you:
- Add new tables
- Add new columns (with default values or nullable)
- Modify column types (when compatible)
- Add indexes
- Add foreign keys

### Safe Migration Workflow

```bash
# 1. Always create a backup first
pnpm db:backup  # (we'll create this script)

# 2. Make changes to schema.prisma
# Edit packages/db/prisma/schema.prisma

# 3. Create a migration (this generates SQL that preserves data)
pnpm --filter @azela-pos/db migrate dev --name add_new_feature

# 4. Review the generated migration SQL
# Check packages/db/prisma/migrations/[timestamp]_add_new_feature/migration.sql
# Ensure it doesn't contain DROP TABLE or TRUNCATE

# 5. Test the migration on a copy of production data
# Use a staging database first

# 6. Deploy to production
pnpm --filter @azela-pos/db migrate deploy
```

## ⚠️ Dangerous Operations (Avoid or Use with Extreme Caution)

### ❌ NEVER DO THESE IN PRODUCTION:

1. **DROP TABLE** - Deletes entire tables
2. **TRUNCATE TABLE** - Deletes all rows
3. **DROP COLUMN** - Removes columns (data loss)
4. **ALTER COLUMN TYPE** - Can cause data loss if incompatible
5. **Running seed script** - Deletes all data

### ✅ Safe Alternatives:

| Dangerous Operation | Safe Alternative |
|---------------------|------------------|
| `DROP TABLE` | Mark as deprecated, stop using, keep for historical data |
| `TRUNCATE TABLE` | Use soft deletes (add `deletedAt` column) |
| `DROP COLUMN` | Mark as deprecated, add new column, migrate data gradually |
| `ALTER COLUMN TYPE` | Create new column, migrate data, then drop old (in separate migration) |
| Seed script | Use data migration scripts that INSERT only |

## 📋 Pre-Migration Checklist

Before running any migration:

- [ ] **Backup created** - Full database backup exists
- [ ] **Migration reviewed** - SQL doesn't contain DROP/TRUNCATE
- [ ] **Tested on staging** - Migration tested on copy of production data
- [ ] **Rollback plan** - Know how to revert if something goes wrong
- [ ] **Downtime planned** - If needed, schedule maintenance window
- [ ] **Team notified** - All developers aware of migration

## 🔧 Adding New Features Safely

### Example 1: Adding a New Table

```prisma
// schema.prisma
model NewFeature {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  // ... fields
}
```

**Result:** ✅ Safe - Creates new table, doesn't affect existing data

### Example 2: Adding a New Column

```prisma
model Product {
  // ... existing fields
  newField String?  // Nullable = safe, existing rows get NULL
  // OR
  newField String @default("default")  // With default = safe
}
```

**Result:** ✅ Safe - Existing rows get NULL or default value

### Example 3: Adding a Required Column (DANGEROUS)

```prisma
model Product {
  // ... existing fields
  newRequiredField String  // ❌ DANGEROUS - No default!
}
```

**Fix:** Make it nullable first, then add default values, then make required:

```prisma
// Step 1: Add as nullable
model Product {
  newRequiredField String?
}

// Step 2: Update existing rows with default
// Run data migration: UPDATE Product SET newRequiredField = 'default' WHERE newRequiredField IS NULL;

// Step 3: Make required
model Product {
  newRequiredField String @default("default")
}
```

## 🚨 Emergency Rollback

If a migration causes issues:

```bash
# 1. Stop the application immediately

# 2. Restore from backup
./scripts/restore-from-backup.sh backup_YYYYMMDD_HHMMSS.sql

# 3. Mark migration as rolled back
# Edit _prisma_migrations table or use Prisma migrate resolve
```

## 📝 Migration Best Practices

1. **One feature per migration** - Don't mix multiple changes
2. **Descriptive names** - `add_user_preferences` not `migration_5`
3. **Test locally first** - Always test on development database
4. **Review generated SQL** - Check migration SQL before deploying
5. **Backup before deploy** - Always backup production before migration
6. **Deploy during low traffic** - Schedule migrations during off-peak hours
7. **Monitor after deploy** - Watch logs and metrics after migration

## 🔍 How to Verify Data Preservation

After running a migration:

```bash
# 1. Check row counts (should be same or more, never less)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Product\";"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Sale\";"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"User\";"

# 2. Verify data integrity
psql $DATABASE_URL -c "SELECT * FROM \"Product\" LIMIT 5;"

# 3. Check for NULL values in new columns (if nullable)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Product\" WHERE newField IS NULL;"
```

## 🛠️ Tools and Scripts

### Backup Before Migration
```bash
./scripts/backup-before-migration.sh
```

### Verify Migration Safety
```bash
./scripts/verify-migration-safety.sh packages/db/prisma/migrations/[migration_name]
```

### Rollback Migration
```bash
./scripts/rollback-migration.sh [migration_name]
```

## 📚 Additional Resources

- [Prisma Migration Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Database Backup Guide](./DATABASE_BACKUP_GUIDE.md)
- [Why Data Was Deleted](./WHY_DATA_WAS_DELETED.md) - Learn from past mistakes

## ⚡ Quick Reference

```bash
# Safe: Create migration
pnpm --filter @azela-pos/db migrate dev --name feature_name

# Safe: Deploy migration (preserves data)
pnpm --filter @azela-pos/db migrate deploy

# DANGEROUS: Reset database (deletes all data)
pnpm --filter @azela-pos/db migrate reset  # ❌ NEVER in production

# DANGEROUS: Seed script (deletes all data)
pnpm --filter @azela-pos/db seed  # ❌ NEVER in production
```

---

**Remember: When in doubt, backup first, test second, deploy third!**

