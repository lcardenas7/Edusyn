-- Convivencia en Transición: cada desempeño libre del docente puede tener su
-- valoración cualitativa independiente. El texto legado se conserva intacto.
ALTER TABLE "ConvivenciaEntry"
  ADD COLUMN IF NOT EXISTS "items" JSONB;
