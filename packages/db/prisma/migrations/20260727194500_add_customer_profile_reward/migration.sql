ALTER TABLE "Customer"
ADD COLUMN "profileCompletedAt" TIMESTAMP(3),
ADD COLUMN "profileRewardPercent" DOUBLE PRECISION,
ADD COLUMN "profileRewardStatus" TEXT,
ADD COLUMN "profileRewardSource" TEXT;
