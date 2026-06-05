-- Add CREDIT and ONLINE to PaymentMethod enum (required for credit sales + reports).
-- Safe: only extends enum; existing rows unchanged.

ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CREDIT';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'ONLINE';
