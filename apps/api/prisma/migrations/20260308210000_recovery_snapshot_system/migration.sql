-- ============================================================================
-- MIGRACIÓN: Sistema de Snapshots de Recuperación
-- ============================================================================
-- Agrega soporte para tipos de snapshot y seguimiento del proceso de recuperación
-- ============================================================================

-- 1. Crear enum para tipos de snapshot de boletín
CREATE TYPE "ReportCardSnapshotType" AS ENUM ('INITIAL_CLOSE', 'POST_RECOVERY', 'FINAL_CLOSE', 'REOPENED');

-- 2. Crear enum para estado del proceso de recuperación
CREATE TYPE "RecoveryPhaseStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_SNAPSHOT', 'SNAPSHOT_CREATED', 'FINALIZED');

-- 3. Agregar columnas a TermReportCardSnapshot
ALTER TABLE "TermReportCardSnapshot" ADD COLUMN "snapshotType" "ReportCardSnapshotType" NOT NULL DEFAULT 'INITIAL_CLOSE';
ALTER TABLE "TermReportCardSnapshot" ADD COLUMN "recoveryChanges" JSONB;

-- 4. Agregar columnas a RecoveryPeriodConfig
ALTER TABLE "RecoveryPeriodConfig" ADD COLUMN "recoveryPhaseStatus" "RecoveryPhaseStatus" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "RecoveryPeriodConfig" ADD COLUMN "snapshotCreatedAt" TIMESTAMP(3);
ALTER TABLE "RecoveryPeriodConfig" ADD COLUMN "closedById" TEXT;
ALTER TABLE "RecoveryPeriodConfig" ADD COLUMN "closedAt" TIMESTAMP(3);

-- 5. Crear índice para búsqueda por tipo de snapshot
CREATE INDEX "TermReportCardSnapshot_academicTermId_snapshotType_idx" ON "TermReportCardSnapshot"("academicTermId", "snapshotType");

-- 6. Crear foreign key para closedBy
ALTER TABLE "RecoveryPeriodConfig" ADD CONSTRAINT "RecoveryPeriodConfig_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
