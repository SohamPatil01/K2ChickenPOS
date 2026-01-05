# Data Preservation Policy

## 🛡️ Core Principle

**When adding new features to the database, existing data MUST be preserved.**

This policy ensures that all database changes maintain data integrity and prevent accidental data loss.

## ✅ What This Means

### Prisma Migrations (Safe by Default)

Prisma migrations **automatically preserve data** when you:
- ✅ Add new tables
- ✅ Add new columns (with defaults or nullable)
- ✅ Add indexes
- ✅ Add foreign keys
- ✅ Modify column types (when compatible)

### What Gets Protected

- ✅ All existing rows in all tables
- ✅ All relationships between data
- ✅ All historical records (sales, inventory, etc.)
- ✅ All user accounts and permissions
- ✅ All product catalogs and pricing

## 🚫 What's Blocked

### Seed Script Protection

The seed script (`packages/db/prisma/seed.ts`) is **blocked from running on production** databases:

- ❌ Blocks if `NODE_ENV=production`
- ❌ Blocks if database URL contains `pooler.supabase.com`
- ❌ Blocks if database URL contains `vercel`
- ❌ Blocks if database URL contains `neon.tech`
- ❌ Blocks if database URL contains `aws-`
- ❌ Blocks if database URL contains `production`

**Why:** Seed script deletes all data before seeding (development only)

### Dangerous Operations Blocked

These operations are flagged as dangerous:
- ❌ `DROP TABLE` - Deletes entire tables
- ❌ `TRUNCATE TABLE` - Deletes all rows
- ❌ `DROP COLUMN` - Removes columns
- ❌ Running seed script on production

## 📋 Required Workflow

### Before Any Database Change

1. **Create Backup**
   ```bash
   ./scripts/backup-before-migration.sh
   ```

2. **Plan Changes**
   - Document what you're adding
   - Identify affected tables
   - Plan data migration (if needed)

3. **Make Schema Changes**
   - Edit `packages/db/prisma/schema.prisma`
   - Use safe patterns (nullable columns, defaults)

4. **Create Migration**
   ```bash
   pnpm --filter @azela-pos/db migrate dev --name feature_name
   ```

5. **Verify Safety**
   ```bash
   ./scripts/verify-migration-safety.sh [migration_file]
   ```

6. **Test Locally**
   - Test on development database
   - Verify data is preserved
   - Check row counts

7. **Deploy**
   ```bash
   pnpm --filter @azela-pos/db migrate deploy
   ```

## 🛠️ Tools Available

### Backup Scripts
- `./scripts/backup-before-migration.sh` - Pre-migration backup
- `./scripts/backup-localhost.sh` - Local database backup
- `./scripts/restore-from-backup.sh` - Restore from backup

### Safety Checks
- `./scripts/verify-migration-safety.sh` - Check migration SQL for dangerous operations
- Seed script production blocking - Automatic protection

### Documentation
- `SAFE_MIGRATION_GUIDE.md` - Detailed safety guidelines
- `MIGRATION_WORKFLOW.md` - Step-by-step workflow
- `DATABASE_BACKUP_GUIDE.md` - Backup procedures

## 📚 Quick Reference

### ✅ Safe Commands

```bash
# Create migration (preserves data)
pnpm --filter @azela-pos/db migrate dev --name feature_name

# Deploy migration (preserves data)
pnpm --filter @azela-pos/db migrate deploy

# Backup before migration
./scripts/backup-before-migration.sh

# Verify migration safety
./scripts/verify-migration-safety.sh [migration_file]
```

### ❌ Dangerous Commands (Blocked/Protected)

```bash
# Seed script (blocked on production)
pnpm --filter @azela-pos/db seed
# → Blocked if production database detected

# Reset database (deletes all data)
pnpm --filter @azela-pos/db migrate reset
# → Only use in development
```

## 🎯 Examples

### ✅ Safe: Adding New Table

```prisma
model NewFeature {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
}
```

**Result:** ✅ Creates new table, doesn't affect existing data

### ✅ Safe: Adding Optional Column

```prisma
model Product {
  // ... existing fields
  description String?  // Nullable = safe
}
```

**Result:** ✅ Existing products get NULL, new products can set description

### ✅ Safe: Adding Column with Default

```prisma
model Product {
  // ... existing fields
  status String @default("ACTIVE")  // Has default = safe
}
```

**Result:** ✅ All existing products get "ACTIVE" status

### ❌ Dangerous: Dropping Column

```prisma
model Product {
  // oldField String  // Removing this = data loss
}
```

**Result:** ❌ Data loss - Don't do this!

**Safe Alternative:** Keep column, mark as deprecated, stop using it

## 🚨 Emergency Procedures

### If Data is Lost

1. **Stop application immediately**
2. **DO NOT run more migrations**
3. **Restore from backup:**
   ```bash
   ./scripts/restore-from-backup.sh backups/backup_YYYYMMDD_HHMMSS.sql
   ```
4. **Verify data restored**
5. **Investigate cause**
6. **Fix before retrying**

## 📖 Additional Resources

- [Safe Migration Guide](./SAFE_MIGRATION_GUIDE.md)
- [Migration Workflow](./MIGRATION_WORKFLOW.md)
- [Database Backup Guide](./DATABASE_BACKUP_GUIDE.md)
- [Why Data Was Deleted](./WHY_DATA_WAS_DELETED.md)

---

**This policy is enforced through:**
- ✅ Seed script production blocking
- ✅ Migration safety verification scripts
- ✅ Backup requirements
- ✅ Documentation and workflows

**Remember: When in doubt, backup first!**

