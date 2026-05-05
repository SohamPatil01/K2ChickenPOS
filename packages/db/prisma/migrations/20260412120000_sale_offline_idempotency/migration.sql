-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "offlineIdempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sale_storeId_offlineIdempotencyKey_key" ON "Sale"("storeId", "offlineIdempotencyKey");
