-- Preserve existing tenant isolation on AcademicYear; no automatic policy approval.
ALTER TABLE "AcademicYear" ADD COLUMN "qualitativePromotionPolicies" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "AcademicYear" ADD COLUMN "qualitativePromotionDecisions" JSONB NOT NULL DEFAULT '[]';
