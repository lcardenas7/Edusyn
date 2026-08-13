-- Rótulo "Boletín Académico" configurable (mostrar/ocultar) en el encabezado.
ALTER TABLE "ReportCardConfig"
  ADD COLUMN IF NOT EXISTS "showHeaderTitle" BOOLEAN NOT NULL DEFAULT true;
