# Database Migration Workflow

## 🎯 Goal: Add New Features Without Losing Data

This workflow ensures that when you add new features to the database, all existing data is preserved.

## 📋 Step-by-Step Workflow

### Step 1: Plan Your Changes

Before making any changes:
- [ ] Document what new feature you're adding
- [ ] Identify which tables/columns need changes
- [ ] Determine if changes are backward compatible
- [ ] Plan data migration strategy (if needed)

### Step 2: Create Backup

**ALWAYS backup before making changes:**

```bash
# Option 1: Use the backup script
./scripts/backup-before-migration.sh

# Option 2: Manual backup
pg_dump $DATABASE_URL > backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 3: Make Schema Changes

Edit `packages/db/prisma/schema.prisma`:

```prisma
// ✅ SAFE: Adding new table
model NewFeature {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  // ... fields
}

// ✅ SAFE: Adding nullable column
model Product {
  // ... existing fields
  newField String?  // Nullable = safe
}

// ✅ SAFE: Adding column with default
model Product {
  // ... existing fields
  newField String @default("default")  // Has default = safe
}
```

### Step 4: Create Migration

```bash
# Create migration (generates SQL)
pnpm --filter @azela-pos/db migrate dev --name add_new_feature

# This will:
# 1. Generate migration SQL
# 2. Apply it to your development database
# 3. Regenerate Prisma Client
```

### Step 5: Verify Migration Safety

**CRITICAL: Review the generated migration SQL:**

```bash
# Check the migration file
cat packages/db/prisma/migrations/[timestamp]_add_new_feature/migration.sql

# Or use the safety checker
./scripts/verify-migration-safety.sh packages/db/prisma/migrations/[timestamp]_add_new_feature/migration.sql
```

**Look for dangerous operations:**
- ❌ `DROP TABLE` - Deletes tables
- ❌ `TRUNCATE TABLE` - Deletes all rows
- ❌ `DROP COLUMN` - Removes columns
- ❌ `DELETE FROM` - Deletes data

**Safe operations:**
- ✅ `CREATE TABLE` - Creates new tables
- ✅ `ALTER TABLE ... ADD COLUMN` - Adds columns
- ✅ `CREATE INDEX` - Creates indexes
- ✅ `ALTER TABLE ... ALTER COLUMN ... SET DEFAULT` - Sets defaults

### Step 6: Test Migration

```bash
# Test on development database
pnpm --filter @azela-pos/db migrate dev

# Verify data is preserved
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Product\";"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"Sale\";"
```

### Step 7: Deploy to Production

```bash
# Deploy migration (preserves data)
pnpm --filter @azela-pos/db migrate deploy

# Verify after deployment
# Check application logs
# Verify data integrity
```

## 🚨 Emergency Procedures

### If Migration Fails

1. **Stop the application immediately**
2. **Check error logs**
3. **Restore from backup:**
   ```bash
   ./scripts/restore-from-backup.sh backups/backup_pre_migration_YYYYMMDD_HHMMSS.sql
   ```
4. **Fix the migration**
5. **Test again before redeploying**

### If Data is Lost

1. **Stop the application immediately**
2. **DO NOT run any more migrations**
3. **Restore from backup:**
   ```bash
   ./scripts/restore-from-backup.sh backups/backup_pre_migration_YYYYMMDD_HHMMSS.sql
   ```
4. **Verify data is restored**
5. **Investigate what went wrong**
6. **Fix the migration before retrying**

## ✅ Safe Migration Examples

### Example 1: Adding a New Table

```prisma
// schema.prisma
model UserPreferences {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  theme     String   @default("light")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model User {
  // ... existing fields
  preferences UserPreferences?
}
```

**Result:** ✅ Safe - Creates new table, doesn't affect existing data

### Example 2: Adding Optional Field

```prisma
model Product {
  // ... existing fields
  description String?  // Nullable = safe
}
```

**Result:** ✅ Safe - Existing products get NULL, new products can set description

### Example 3: Adding Required Field with Default

```prisma
model Product {
  // ... existing fields
  status String @default("ACTIVE")  // Has default = safe
}
```

**Result:** ✅ Safe - All existing products get "ACTIVE" status

### Example 4: Adding Required Field (Multi-Step)

**Step 1:** Add as nullable
```prisma
model Product {
  newRequiredField String?
}
```

**Step 2:** Update existing rows
```sql
-- Run this SQL manually or in a data migration
UPDATE "Product" SET newRequiredField = 'default' WHERE newRequiredField IS NULL;
```

**Step 3:** Make it required
```prisma
model Product {
  newRequiredField String @default("default")
}
```

## ❌ Dangerous Patterns (Avoid)

### Pattern 1: Dropping Columns

```prisma
// ❌ DON'T DO THIS
model Product {
  // oldField String  // Removing this = data loss
}
```

**Safe Alternative:**
1. Mark as deprecated in code
2. Stop using it
3. Keep in schema for historical data
4. Or migrate data to new column first

### Pattern 2: Changing Column Types

```prisma
// ❌ DANGEROUS
model Product {
  price String  // Was Decimal, now String = data loss risk
}
```

**Safe Alternative:**
1. Create new column
2. Migrate data
3. Update application code
4. Drop old column (in separate migration)

### Pattern 3: Running Seed Script

```bash
# ❌ NEVER in production
pnpm --filter @azela-pos/db seed
```

**Why:** Seed script deletes all data before seeding

**Safe Alternative:** Use data migration scripts that INSERT only

## 📚 Quick Reference

```bash
# ✅ Safe: Create migration
pnpm --filter @azela-pos/db migrate dev --name feature_name

# ✅ Safe: Deploy migration (preserves data)
pnpm --filter @azela-pos/db migrate deploy

# ✅ Safe: Backup before migration
./scripts/backup-before-migration.sh

# ✅ Safe: Verify migration safety
./scripts/verify-migration-safety.sh [migration_file]

# ❌ DANGEROUS: Reset database (deletes all data)
pnpm --filter @azela-pos/db migrate reset

# ❌ DANGEROUS: Seed script (deletes all data)
pnpm --filter @azela-pos/db seed
```

## 🎓 Best Practices

1. **Always backup first** - No exceptions
2. **Review migration SQL** - Check for dangerous operations
3. **Test on staging** - Never test migrations on production
4. **One feature per migration** - Don't mix multiple changes
5. **Descriptive names** - `add_user_preferences` not `migration_5`
6. **Monitor after deploy** - Watch logs and metrics
7. **Have rollback plan** - Know how to revert

## 📖 Additional Resources

- [Safe Migration Guide](./SAFE_MIGRATION_GUIDE.md) - Detailed safety guidelines
- [Database Backup Guide](./DATABASE_BACKUP_GUIDE.md) - Backup procedures
- [Why Data Was Deleted](./WHY_DATA_WAS_DELETED.md) - Learn from past mistakes

---

**Remember: When in doubt, backup first, test second, deploy third!**

