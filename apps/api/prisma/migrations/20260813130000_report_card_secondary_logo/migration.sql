-- Segundo escudo del boletín (izquierda, p. ej. escudo de Colombia). Nullable.
ALTER TABLE "ReportCardConfig"
  ADD COLUMN IF NOT EXISTS "secondaryLogoUrl" TEXT;
