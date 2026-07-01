-- C-1: distinguir una nota final fijada manualmente de una derivada de los parciales.
-- Si isManualOverride = true, el recálculo automático NO sobreescribe el valor.
-- 100% aditivo: columna nueva con DEFAULT. No toca RLS ni otras tablas. Cero downtime.

ALTER TABLE "PeriodFinalGrade"
  ADD COLUMN "isManualOverride" BOOLEAN NOT NULL DEFAULT false;
