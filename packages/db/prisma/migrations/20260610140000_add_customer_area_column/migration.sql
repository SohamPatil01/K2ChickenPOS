-- Add nullable area column (no deletes, no overwrites of existing customer rows).
ALTER TABLE "Customer" ADD COLUMN "area" TEXT;

-- Copy legacy area from CustomerAddress only where the new column is still null.
UPDATE "Customer" c
SET "area" = NULLIF(TRIM(ca."line1"), '')
FROM "CustomerAddress" ca
WHERE ca."customerId" = c.id
  AND ca."label" = 'Area'
  AND c."area" IS NULL
  AND ca."line1" IS NOT NULL
  AND TRIM(ca."line1") <> ''
  AND TRIM(ca."line1") <> '—';
