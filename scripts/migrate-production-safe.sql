-- Safe migration script to add timezone and businessDate columns
-- This script is safe to run on production as it:
-- 1. Only adds nullable columns with defaults
-- 2. Doesn't modify existing data
-- 3. Doesn't break existing queries

-- Add timezone column to Store table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Store' AND column_name = 'timezone'
    ) THEN
        ALTER TABLE "Store" 
        ADD COLUMN "timezone" TEXT DEFAULT 'Asia/Kolkata';
        
        -- Update existing rows to have the default timezone
        UPDATE "Store" 
        SET "timezone" = 'Asia/Kolkata' 
        WHERE "timezone" IS NULL;
    END IF;
END $$;

-- Add businessDate column to Sale table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Sale' AND column_name = 'businessDate'
    ) THEN
        ALTER TABLE "Sale" 
        ADD COLUMN "businessDate" TIMESTAMP(3);
        
        -- Note: We don't populate existing rows - they remain NULL
        -- This is intentional as businessDate is optional
    END IF;
END $$;

-- Add businessDate column to Shift table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Shift' AND column_name = 'businessDate'
    ) THEN
        ALTER TABLE "Shift" 
        ADD COLUMN "businessDate" TIMESTAMP(3);
        
        -- Note: We don't populate existing rows - they remain NULL
        -- This is intentional as businessDate is optional
    END IF;
END $$;

-- Add index on [storeId, businessDate] for Sale table (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'Sale' 
        AND indexname = 'Sale_storeId_businessDate_idx'
    ) THEN
        CREATE INDEX "Sale_storeId_businessDate_idx" 
        ON "Sale"("storeId", "businessDate");
    END IF;
END $$;

-- Verify the changes
SELECT 
    'Store.timezone' as column_name,
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Store' AND column_name = 'timezone'
    ) as exists
UNION ALL
SELECT 
    'Sale.businessDate',
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Sale' AND column_name = 'businessDate'
    )
UNION ALL
SELECT 
    'Shift.businessDate',
    EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Shift' AND column_name = 'businessDate'
    )
UNION ALL
SELECT 
    'Sale_storeId_businessDate_idx',
    EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'Sale' 
        AND indexname = 'Sale_storeId_businessDate_idx'
    );

