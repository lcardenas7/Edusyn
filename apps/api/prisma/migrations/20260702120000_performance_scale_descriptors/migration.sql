-- Q-1 · Escala de proficiencia: enriquecimiento aditivo (nullable, sin backfill).
-- Los defaults (label/order/isApproved) se derivan del enum en código cuando son NULL.
ALTER TABLE "PerformanceScale" ADD COLUMN "label" TEXT;
ALTER TABLE "PerformanceScale" ADD COLUMN "descriptor" TEXT;
ALTER TABLE "PerformanceScale" ADD COLUMN "order" INTEGER;
ALTER TABLE "PerformanceScale" ADD COLUMN "isApproved" BOOLEAN;
