#!/usr/bin/env bash
# Safe, idempotent: add Customer.area and backfill from legacy Area addresses only where null.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "  export DATABASE_URL='postgresql://...'"
  exit 1
fi

echo "Applying customer area migration..."

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'area'
  ) THEN
    ALTER TABLE "Customer" ADD COLUMN "area" TEXT;
  END IF;
END $$;

UPDATE "Customer" c
SET "area" = NULLIF(TRIM(ca."line1"), '')
FROM "CustomerAddress" ca
WHERE ca."customerId" = c.id
  AND ca."label" = 'Area'
  AND c."area" IS NULL
  AND ca."line1" IS NOT NULL
  AND TRIM(ca."line1") <> ''
  AND TRIM(ca."line1") <> '—';
SQL

echo "Done. Customer.area column is ready."
echo "Then run: DATABASE_URL=\"\$DATABASE_URL\" pnpm db:migrate:deploy"
