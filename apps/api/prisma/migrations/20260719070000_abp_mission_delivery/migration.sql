-- Misión de ENTREGA dentro del ABP: un "taller" que el equipo cumple ENTREGANDO
-- un producto (archivo/enlace/texto), no marcando un checkbox. Aditiva, sin
-- pérdida: las misiones existentes quedan como "trabajo libre" (deliverableKind NULL).

ALTER TABLE "AbpMission"
  ADD COLUMN IF NOT EXISTS "deliverableKind"        TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryState"          TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "deliveryUrl"            TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryText"           TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryLabel"          TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryByEnrollmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveredAt"            TIMESTAMP(3);
