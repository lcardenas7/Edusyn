-- Edusyn Crea: brief pedagógico persistente por equipo.
-- Cambio aditivo: no modifica versiones, código ni entradas históricas existentes.
ALTER TABLE "ConstruyeTeam"
  ADD COLUMN "brief" JSONB,
  ADD COLUMN "briefUpdatedAt" TIMESTAMP(3);
