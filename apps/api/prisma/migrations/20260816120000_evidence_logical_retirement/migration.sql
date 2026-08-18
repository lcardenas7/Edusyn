-- D-12 · Retiro lógico de imprescindibles/evidencias
--
-- Migración ADITIVA y NO destructiva.
--   · No borra ni modifica ninguna fila existente.
--   · No hace backfill: las filas actuales quedan con retiredFromTermId = NULL,
--     que es exactamente su estado real (evidencias activas).
--   · NO incluye la FK de StudentEvidenceValuation.achievementEvidenceId: esa
--     depende de resolver las 12 filas huérfanas y va en una migración aparte.
--
-- Índice: deliberadamente NINGUNO sobre retiredFromTermId. Todo acceso a
-- AchievementEvidence está acotado por achievementId (ya indexado) y devuelve
-- ~3 filas por propósito; no existe consulta que filtre por estado de retiro a
-- nivel de tabla ni la inversa "qué evidencias se retiraron en el período X".

ALTER TABLE "AchievementEvidence"
  ADD COLUMN "retiredFromTermId" TEXT,
  ADD COLUMN "retiredAt" TIMESTAMP(3);

-- Restrict: borrar un período no puede reactivar evidencias en silencio.
ALTER TABLE "AchievementEvidence"
  ADD CONSTRAINT "AchievementEvidence_retiredFromTermId_fkey"
  FOREIGN KEY ("retiredFromTermId") REFERENCES "AcademicTerm"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
