ALTER TABLE "RecoveryConfig"
ADD COLUMN IF NOT EXISTS "periodRequiresReviewApproval" BOOLEAN NOT NULL DEFAULT true;
