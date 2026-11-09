-- Deduplicate accidental double-EARN rows (keep earliest per sale), then
-- enforce at most one EARN transaction per sale going forward.

DELETE FROM "LoyaltyTransaction" a
USING "LoyaltyTransaction" b
WHERE a.type = 'EARN'
  AND b.type = 'EARN'
  AND a."saleId" IS NOT NULL
  AND a."saleId" = b."saleId"
  AND (
    a."createdAt" > b."createdAt"
    OR (a."createdAt" = b."createdAt" AND a.id > b.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyTransaction_earn_saleId_unique"
ON "LoyaltyTransaction" ("saleId")
WHERE type = 'EARN' AND "saleId" IS NOT NULL;
