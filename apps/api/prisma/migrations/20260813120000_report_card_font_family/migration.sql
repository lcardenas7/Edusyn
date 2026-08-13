-- Fuente configurable del boletín (Banco de Formatos §skin). Nullable: null → 'sans' en el front.
ALTER TABLE "ReportCardConfig"
  ADD COLUMN IF NOT EXISTS "fontFamily" TEXT;

-- Transición: modo de visualización de la valoración ('COLUMNS' ✓ por nivel | 'SINGLE' una columna con el código).
ALTER TABLE "ReportCardConfig"
  ADD COLUMN IF NOT EXISTS "preschoolLevelDisplay" TEXT DEFAULT 'COLUMNS';
