-- Módulo "Aprendizajes y Evidencias de Aprendizaje" (antes "Logros y Juicios Valorativos").
-- Modelo canónico: Asignatura → Aprendizaje/Desempeño → (1..n) Evidencias → Valoración → Nivel → Descriptor.
-- El juicio valorativo es un elemento adicional configurable.
--
-- Aditiva y NO destructiva: solo agrega dos enums, columnas con default en AchievementConfig
-- y una tabla nueva (AchievementEvidence). No toca ni borra datos existentes.
-- Los "logros" actuales pasan a funcionar como "aprendizajes" sin cambios de datos.

-- 1) Enums nuevos (idempotentes).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AcademicRegistrationModel') THEN
    CREATE TYPE "AcademicRegistrationModel" AS ENUM ('LEARNING_ONLY', 'LEARNING_AND_EVIDENCE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportLearningGranularity') THEN
    CREATE TYPE "ReportLearningGranularity" AS ENUM ('PRIMARY_ONLY', 'ALL');
  END IF;
END$$;

-- 2) Configuración institucional del módulo (defaults preservan el comportamiento actual).
ALTER TABLE "AchievementConfig"
  ADD COLUMN IF NOT EXISTS "registrationModel" "AcademicRegistrationModel" NOT NULL DEFAULT 'LEARNING_ONLY',
  ADD COLUMN IF NOT EXISTS "showLearningInReport" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "showEvidencesInReport" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "showLevelDescriptorInReport" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "showJudgmentInReport" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "reportLearningGranularity" "ReportLearningGranularity" NOT NULL DEFAULT 'PRIMARY_ONLY';

-- 3) Tabla de evidencias de aprendizaje (siempre cuelga de un aprendizaje).
CREATE TABLE IF NOT EXISTS "AchievementEvidence" (
  "id" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "orderNumber" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AchievementEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AchievementEvidence_achievementId_idx"
  ON "AchievementEvidence"("achievementId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AchievementEvidence_achievementId_fkey'
  ) THEN
    ALTER TABLE "AchievementEvidence"
      ADD CONSTRAINT "AchievementEvidence_achievementId_fkey"
      FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
