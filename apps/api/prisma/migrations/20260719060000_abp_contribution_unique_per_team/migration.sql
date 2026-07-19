-- La idempotencia de AbpContribution debe ser POR EQUIPO. Sin teamId en el unique,
-- la tarjeta '0' (CANVAS_CARD) de un equipo anterior del mismo estudiante colisionaba
-- con la del equipo nuevo: el INSERT violaba el índice, abortaba la transacción
-- por-request (RLS) y el guardado del canvas se revertía ("el texto se borra").
-- Aditiva y sin pérdida: el índice nuevo es más laxo (permite todo lo que ya existe).

DROP INDEX IF EXISTS "AbpContribution_studentEnrollmentId_type_refId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "AbpContribution_teamId_studentEnrollmentId_type_refId_key"
  ON "AbpContribution"("teamId", "studentEnrollmentId", "type", "refId");
