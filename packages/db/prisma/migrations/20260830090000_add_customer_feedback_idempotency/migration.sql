-- A sale can have at most one customer-display feedback record.
-- This is partial so existing audit actions remain unrestricted.
CREATE UNIQUE INDEX "AuditLog_customer_feedback_unique"
ON "AuditLog" ("action", "entityType", "entityId")
WHERE "action" = 'CUSTOMER_FEEDBACK' AND "entityType" = 'Sale';
