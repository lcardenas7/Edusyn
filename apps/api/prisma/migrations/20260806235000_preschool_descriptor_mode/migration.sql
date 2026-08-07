-- Fase 1 de "Evaluación de Preescolar Configurable" (docs/DISENO_EVALUACION_PREESCOLAR_CONFIGURABLE.md).
-- Descriptor por nivel: cada indicador puede guardar un descriptor por escala cualitativa
-- (L/EP/I), que autocompleta el boletín al elegir el nivel del estudiante. Configurable por
-- institución via AchievementConfig.descriptorMode.
--
-- Aditiva y no destructiva: solo agrega un enum, una columna con default y una tabla nueva.

-- 1) Enum del modo de descriptor (guardado, idempotente).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AchievementDescriptorMode') THEN
    CREATE TYPE "AchievementDescriptorMode" AS ENUM ('FREE', 'DESCRIPTOR_PER_LEVEL');
  END IF;
END$$;

-- 2) Modo de descriptor por institución (default FREE = comportamiento histórico).
ALTER TABLE "AchievementConfig"
  ADD COLUMN IF NOT EXISTS "descriptorMode" "AchievementDescriptorMode" NOT NULL DEFAULT 'FREE';

-- 3) Tabla de descriptores por indicador + escala.
CREATE TABLE IF NOT EXISTS "AchievementLevelDescriptor" (
  "id" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "levelCode" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AchievementLevelDescriptor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AchievementLevelDescriptor_achievementId_levelCode_key"
  ON "AchievementLevelDescriptor"("achievementId", "levelCode");

CREATE INDEX IF NOT EXISTS "AchievementLevelDescriptor_achievementId_idx"
  ON "AchievementLevelDescriptor"("achievementId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AchievementLevelDescriptor_achievementId_fkey'
  ) THEN
    ALTER TABLE "AchievementLevelDescriptor"
      ADD CONSTRAINT "AchievementLevelDescriptor_achievementId_fkey"
      FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
