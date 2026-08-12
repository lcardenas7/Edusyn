-- Boletín de Transición configurable (Propósitos e Imprescindibles).
-- docs/DISENO_BOLETIN_TRANSICION.md — aditiva y compatible hacia atrás.

-- 1) Enums.
ALTER TYPE "SubjectType" ADD VALUE IF NOT EXISTS 'PRESCHOOL_DIMENSION';
ALTER TYPE "SubjectType" ADD VALUE IF NOT EXISTS 'CONVIVENCIA';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LearningCatalogMode') THEN
    CREATE TYPE "LearningCatalogMode" AS ENUM ('TEACHER_MANAGED', 'ADMIN_FIXED');
  END IF;
END$$;

-- 2) Subject.displayHours (horas mostradas en boletín; null ⇒ horas reales).
ALTER TABLE "Subject" ADD COLUMN IF NOT EXISTS "displayHours" INTEGER;

-- 3) AchievementConfig: etiquetas configurables + modo de catálogo.
ALTER TABLE "AchievementConfig"
  ADD COLUMN IF NOT EXISTS "learningLabelSingular" TEXT NOT NULL DEFAULT 'Aprendizaje',
  ADD COLUMN IF NOT EXISTS "learningLabelPlural"   TEXT NOT NULL DEFAULT 'Aprendizajes',
  ADD COLUMN IF NOT EXISTS "evidenceLabelSingular" TEXT NOT NULL DEFAULT 'Evidencia',
  ADD COLUMN IF NOT EXISTS "evidenceLabelPlural"   TEXT NOT NULL DEFAULT 'Evidencias',
  ADD COLUMN IF NOT EXISTS "learningCatalogMode" "LearningCatalogMode" NOT NULL DEFAULT 'TEACHER_MANAGED';

-- 4) ReportCardConfig: puesto opcional preescolar + inas 0.
ALTER TABLE "ReportCardConfig"
  ADD COLUMN IF NOT EXISTS "preschoolShowRank" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "preschoolRankWeights" JSONB,
  ADD COLUMN IF NOT EXISTS "showZeroAbsences" BOOLEAN NOT NULL DEFAULT false;

-- 5) Achievement: soporte catálogo por grado + anual (columnas nullables).
ALTER TABLE "Achievement" ALTER COLUMN "teacherAssignmentId" DROP NOT NULL;
ALTER TABLE "Achievement" ALTER COLUMN "academicTermId" DROP NOT NULL;
ALTER TABLE "Achievement"
  ADD COLUMN IF NOT EXISTS "gradeId" TEXT,
  ADD COLUMN IF NOT EXISTS "subjectId" TEXT,
  ADD COLUMN IF NOT EXISTS "academicYearId" TEXT;

-- El unique por código+asignación deja de aplicar (asignación ahora puede ser null).
ALTER TABLE "Achievement" DROP CONSTRAINT IF EXISTS "Achievement_code_teacherAssignmentId_key";

CREATE INDEX IF NOT EXISTS "Achievement_gradeId_subjectId_academicYearId_idx"
  ON "Achievement"("gradeId", "subjectId", "academicYearId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Achievement_gradeId_fkey') THEN
    ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_gradeId_fkey"
      FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Achievement_subjectId_fkey') THEN
    ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Achievement_academicYearId_fkey') THEN
    ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_academicYearId_fkey"
      FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- 6) StudentAchievement: valoración por período.
ALTER TABLE "StudentAchievement" ADD COLUMN IF NOT EXISTS "academicTermId" TEXT;

-- Backfill: para valoraciones existentes, tomar el período del aprendizaje (preserva unicidad).
UPDATE "StudentAchievement" sa
  SET "academicTermId" = a."academicTermId"
  FROM "Achievement" a
  WHERE sa."achievementId" = a."id" AND sa."academicTermId" IS NULL;

ALTER TABLE "StudentAchievement" DROP CONSTRAINT IF EXISTS "StudentAchievement_studentEnrollmentId_achievementId_key";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StudentAchievement_studentEnrollmentId_achievementId_academicTermId_key'
  ) THEN
    ALTER TABLE "StudentAchievement"
      ADD CONSTRAINT "StudentAchievement_studentEnrollmentId_achievementId_academicTermId_key"
      UNIQUE ("studentEnrollmentId", "achievementId", "academicTermId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentAchievement_academicTermId_fkey') THEN
    ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_academicTermId_fkey"
      FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- 7) ConvivenciaEntry (registro textual mínimo).
CREATE TABLE IF NOT EXISTS "ConvivenciaEntry" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "studentEnrollmentId" TEXT NOT NULL,
  "academicTermId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConvivenciaEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConvivenciaEntry_studentEnrollmentId_academicTermId_subjectId_key"
  ON "ConvivenciaEntry"("studentEnrollmentId", "academicTermId", "subjectId");
CREATE INDEX IF NOT EXISTS "ConvivenciaEntry_studentEnrollmentId_idx" ON "ConvivenciaEntry"("studentEnrollmentId");
CREATE INDEX IF NOT EXISTS "ConvivenciaEntry_academicTermId_idx" ON "ConvivenciaEntry"("academicTermId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConvivenciaEntry_institutionId_fkey') THEN
    ALTER TABLE "ConvivenciaEntry" ADD CONSTRAINT "ConvivenciaEntry_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConvivenciaEntry_studentEnrollmentId_fkey') THEN
    ALTER TABLE "ConvivenciaEntry" ADD CONSTRAINT "ConvivenciaEntry_studentEnrollmentId_fkey"
      FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConvivenciaEntry_academicTermId_fkey') THEN
    ALTER TABLE "ConvivenciaEntry" ADD CONSTRAINT "ConvivenciaEntry_academicTermId_fkey"
      FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConvivenciaEntry_subjectId_fkey') THEN
    ALTER TABLE "ConvivenciaEntry" ADD CONSTRAINT "ConvivenciaEntry_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConvivenciaEntry_createdById_fkey') THEN
    ALTER TABLE "ConvivenciaEntry" ADD CONSTRAINT "ConvivenciaEntry_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
