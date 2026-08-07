-- Banco de Formatos de Boletín (docs/DISENO_BANCO_FORMATOS_BOLETIN.md).
-- Selección de plantilla por institución, por nivel (academicStructure)
-- o por grado individual (gradeId). Aditiva: tabla nueva, sin tocar datos.

CREATE TABLE IF NOT EXISTS "ReportCardTemplateSelection" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "gradeId" TEXT,
  "academicStructure" TEXT,
  "templateKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReportCardTemplateSelection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReportCardTemplateSelection_institutionId_gradeId_key"
  ON "ReportCardTemplateSelection"("institutionId", "gradeId");

CREATE UNIQUE INDEX IF NOT EXISTS "ReportCardTemplateSelection_institutionId_academicStructure_key"
  ON "ReportCardTemplateSelection"("institutionId", "academicStructure");

CREATE INDEX IF NOT EXISTS "ReportCardTemplateSelection_institutionId_idx"
  ON "ReportCardTemplateSelection"("institutionId");

-- Integridad referencial (multi-tenant): la selección se borra si se elimina la
-- institución o el grado. Guardadas para idempotencia.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReportCardTemplateSelection_institutionId_fkey') THEN
    ALTER TABLE "ReportCardTemplateSelection"
      ADD CONSTRAINT "ReportCardTemplateSelection_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReportCardTemplateSelection_gradeId_fkey') THEN
    ALTER TABLE "ReportCardTemplateSelection"
      ADD CONSTRAINT "ReportCardTemplateSelection_gradeId_fkey"
      FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
