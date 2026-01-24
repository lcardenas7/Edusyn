/*
  Migración: Separar Subject de SubjectLevelConfig
  
  Esta migración:
  1. Crea la tabla SubjectLevelConfig
  2. Migra los datos existentes de Subject a SubjectLevelConfig
  3. Consolida asignaturas duplicadas (mismo nombre en misma área)
  4. Elimina las columnas antiguas de Subject
  5. Crea el índice único
*/

-- 1. Crear tabla SubjectLevelConfig primero
CREATE TABLE "SubjectLevelConfig" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "weeklyHours" INTEGER NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isDominant" BOOLEAN NOT NULL DEFAULT false,
    "academicLevel" TEXT,
    "gradeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubjectLevelConfig_pkey" PRIMARY KEY ("id")
);

-- 2. Migrar datos existentes de Subject a SubjectLevelConfig
-- Cada Subject existente se convierte en una configuración
INSERT INTO "SubjectLevelConfig" ("id", "subjectId", "weeklyHours", "weight", "isDominant", "academicLevel", "gradeId", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    "id",
    COALESCE("weeklyHours", 0),
    COALESCE("weight", 1.0),
    COALESCE("isDominant", false),
    "academicLevel",
    "gradeId",
    "createdAt",
    "updatedAt"
FROM "Subject";

-- 3. Crear tabla temporal para mapear duplicados
CREATE TEMP TABLE subject_mapping AS
SELECT 
    s.id as old_id,
    FIRST_VALUE(s.id) OVER (PARTITION BY s."areaId", s.name ORDER BY s."createdAt") as canonical_id,
    s."areaId",
    s.name
FROM "Subject" s;

-- 4. Actualizar SubjectLevelConfig para apuntar al Subject canónico (el primero creado)
UPDATE "SubjectLevelConfig" slc
SET "subjectId" = sm.canonical_id
FROM subject_mapping sm
WHERE slc."subjectId" = sm.old_id AND sm.old_id != sm.canonical_id;

-- 5. Eliminar las referencias de TeacherAssignment, PeriodFinalGrade, etc. a subjects duplicados
-- Primero actualizar las referencias para que apunten al canónico
UPDATE "TeacherAssignment" ta
SET "subjectId" = sm.canonical_id
FROM subject_mapping sm
WHERE ta."subjectId" = sm.old_id AND sm.old_id != sm.canonical_id;

UPDATE "PeriodFinalGrade" pfg
SET "subjectId" = sm.canonical_id
FROM subject_mapping sm
WHERE pfg."subjectId" = sm.old_id AND sm.old_id != sm.canonical_id;

UPDATE "PeriodRecovery" pr
SET "subjectId" = sm.canonical_id
FROM subject_mapping sm
WHERE pr."subjectId" = sm.old_id AND sm.old_id != sm.canonical_id;

UPDATE "PerformanceManualEdit" pme
SET "subjectId" = sm.canonical_id
FROM subject_mapping sm
WHERE pme."subjectId" = sm.old_id AND sm.old_id != sm.canonical_id;

-- 6. Eliminar subjects duplicados (mantener solo el canónico)
DELETE FROM "Subject" s
WHERE s.id IN (
    SELECT old_id FROM subject_mapping WHERE old_id != canonical_id
);

-- 7. Limpiar tabla temporal
DROP TABLE subject_mapping;

-- 8. Ahora eliminar las columnas antiguas de Subject
-- DropForeignKey
ALTER TABLE "Subject" DROP CONSTRAINT IF EXISTS "Subject_gradeId_fkey";

-- DropIndex (si existen)
DROP INDEX IF EXISTS "Subject_areaId_academicLevel_idx";
DROP INDEX IF EXISTS "Subject_areaId_gradeId_idx";
DROP INDEX IF EXISTS "Subject_areaId_name_academicLevel_gradeId_key";

-- AlterTable - eliminar columnas
ALTER TABLE "Subject" DROP COLUMN IF EXISTS "academicLevel",
DROP COLUMN IF EXISTS "gradeId",
DROP COLUMN IF EXISTS "isDominant",
DROP COLUMN IF EXISTS "weeklyHours",
DROP COLUMN IF EXISTS "weight";

-- 9. Crear índices
CREATE INDEX "SubjectLevelConfig_subjectId_idx" ON "SubjectLevelConfig"("subjectId");
CREATE INDEX "SubjectLevelConfig_academicLevel_idx" ON "SubjectLevelConfig"("academicLevel");
CREATE INDEX "SubjectLevelConfig_gradeId_idx" ON "SubjectLevelConfig"("gradeId");
CREATE UNIQUE INDEX "SubjectLevelConfig_subjectId_academicLevel_gradeId_key" ON "SubjectLevelConfig"("subjectId", "academicLevel", "gradeId");
CREATE INDEX "Subject_areaId_idx" ON "Subject"("areaId");
CREATE UNIQUE INDEX "Subject_areaId_name_key" ON "Subject"("areaId", "name");

-- 10. AddForeignKey
ALTER TABLE "SubjectLevelConfig" ADD CONSTRAINT "SubjectLevelConfig_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectLevelConfig" ADD CONSTRAINT "SubjectLevelConfig_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
