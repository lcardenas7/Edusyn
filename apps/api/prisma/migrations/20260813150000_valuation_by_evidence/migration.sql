-- Modo de valoración cualitativa por institución (por propósito | por imprescindible).
DO $$ BEGIN
  CREATE TYPE "AchievementValuationScope" AS ENUM ('PURPOSE', 'EVIDENCE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "AchievementConfig"
  ADD COLUMN IF NOT EXISTS "valuationScope" "AchievementValuationScope" NOT NULL DEFAULT 'PURPOSE';

-- Valoración por imprescindible: estudiante × evidencia × período → nivel. Aditivo.
CREATE TABLE IF NOT EXISTS "StudentEvidenceValuation" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentEnrollmentId" TEXT NOT NULL,
  "achievementEvidenceId" TEXT NOT NULL,
  "academicTermId" TEXT NOT NULL,
  "performanceLevel" "PerformanceLevel" NOT NULL,
  "observation" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentEvidenceValuation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentEvidenceValuation_stu_evi_term_key"
  ON "StudentEvidenceValuation"("studentEnrollmentId", "achievementEvidenceId", "academicTermId");
CREATE INDEX IF NOT EXISTS "StudentEvidenceValuation_academicTermId_idx"
  ON "StudentEvidenceValuation"("academicTermId");
CREATE INDEX IF NOT EXISTS "StudentEvidenceValuation_achievementEvidenceId_idx"
  ON "StudentEvidenceValuation"("achievementEvidenceId");
CREATE INDEX IF NOT EXISTS "StudentEvidenceValuation_institutionId_idx"
  ON "StudentEvidenceValuation"("institutionId");
