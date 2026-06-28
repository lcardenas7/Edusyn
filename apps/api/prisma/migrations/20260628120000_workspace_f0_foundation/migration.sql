-- ═══════════════════════════════════════════════════════════════════════════
-- WORKSPACE V2 · F0 — Fundación
-- ═══════════════════════════════════════════════════════════════════════════
-- Capas transversales del Espacio Docente: Calendario, Seguimientos,
-- Actividad, Favoritos y Dashboard configurable. Más campos de contenedor en
-- WorkspaceBoard y backfill de WorkspaceItem.kind.
--
-- Seguridad:
--   - 100% aditiva (CREATE/ALTER ADD). Sin DROP de datos ni renames.
--   - Privado del docente; no toca el core académico.
--   - El backfill solo rellena kind donde está NULL (reversible).
-- Ver docs/MI_ESPACIO_DOCENTE_MASTER.md §24.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enums ───────────────────────────────────────────────────────────────────
CREATE TYPE "WorkspaceEventType" AS ENUM ('REMINDER', 'MEETING', 'DEADLINE', 'ACTIVITY', 'OTHER');
CREATE TYPE "WorkspaceFollowUpStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE');
CREATE TYPE "WorkspaceFollowUpSource" AS ENUM ('OBSERVATION', 'BITACORA', 'PROJECT', 'COLLECTION', 'TASK', 'MANUAL');
CREATE TYPE "WorkspaceFavoriteType" AS ENUM ('BOARD', 'ITEM', 'PROJECT', 'RESOURCE', 'FOLLOWUP', 'COLLECTION');

-- ── WorkspaceBoard: contenedor de curso con módulos bajo demanda ─────────────
ALTER TABLE "WorkspaceBoard"
  ADD COLUMN "enabledModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "isCourseSpace"  BOOLEAN NOT NULL DEFAULT false;

-- ── Calendario ──────────────────────────────────────────────────────────────
CREATE TABLE "WorkspaceEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "boardId" TEXT,
    "itemId" TEXT,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "type" "WorkspaceEventType" NOT NULL DEFAULT 'REMINDER',
    "done" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceEvent_teacherId_date_idx" ON "WorkspaceEvent"("teacherId", "date");
CREATE INDEX "WorkspaceEvent_boardId_idx" ON "WorkspaceEvent"("boardId");
CREATE INDEX "WorkspaceEvent_itemId_idx" ON "WorkspaceEvent"("itemId");

-- ── Seguimientos ────────────────────────────────────────────────────────────
CREATE TABLE "WorkspaceFollowUp" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "boardId" TEXT,
    "sourceType" "WorkspaceFollowUpSource" NOT NULL DEFAULT 'MANUAL',
    "sourceItemId" TEXT,
    "studentId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "WorkspaceFollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "WorkspaceFollowUp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceFollowUp_teacherId_status_idx" ON "WorkspaceFollowUp"("teacherId", "status");
CREATE INDEX "WorkspaceFollowUp_boardId_idx" ON "WorkspaceFollowUp"("boardId");
CREATE INDEX "WorkspaceFollowUp_dueDate_idx" ON "WorkspaceFollowUp"("dueDate");
CREATE INDEX "WorkspaceFollowUp_sourceItemId_idx" ON "WorkspaceFollowUp"("sourceItemId");

-- ── Actividad (timeline / reciente / inteligencia) ──────────────────────────
CREATE TABLE "WorkspaceActivity" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "boardId" TEXT,
    "verb" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WorkspaceActivity_teacherId_createdAt_idx" ON "WorkspaceActivity"("teacherId", "createdAt");
CREATE INDEX "WorkspaceActivity_boardId_createdAt_idx" ON "WorkspaceActivity"("boardId", "createdAt");

-- ── Favoritos ───────────────────────────────────────────────────────────────
CREATE TABLE "WorkspaceFavorite" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "entityType" "WorkspaceFavoriteType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceFavorite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceFavorite_teacherId_entityType_entityId_key" ON "WorkspaceFavorite"("teacherId", "entityType", "entityId");
CREATE INDEX "WorkspaceFavorite_teacherId_idx" ON "WorkspaceFavorite"("teacherId");

-- ── Dashboard configurable ──────────────────────────────────────────────────
CREATE TABLE "WorkspaceDashboardConfig" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "widgets" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceDashboardConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceDashboardConfig_teacherId_key" ON "WorkspaceDashboardConfig"("teacherId");

-- ── Foreign keys ────────────────────────────────────────────────────────────
ALTER TABLE "WorkspaceEvent"    ADD CONSTRAINT "WorkspaceEvent_boardId_fkey"    FOREIGN KEY ("boardId") REFERENCES "WorkspaceBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceFollowUp" ADD CONSTRAINT "WorkspaceFollowUp_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkspaceBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceActivity" ADD CONSTRAINT "WorkspaceActivity_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "WorkspaceBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- BACKFILL de WorkspaceItem.kind (resuelve la doble fuente de verdad)
-- Solo rellena donde kind IS NULL. Reversible.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Desde metadata.kind (items capturados por la UI V2)
UPDATE "WorkspaceItem"
SET "kind" = (UPPER(metadata->>'kind'))::"WorkspaceItemKind"
WHERE "kind" IS NULL
  AND metadata->>'kind' IS NOT NULL
  AND UPPER(metadata->>'kind') IN ('NOTE','TASK','OBSERVATION','LOG','COLLECTION','IDEA','LIST','FILE','EVENT');

-- 2) Desde el tipo del tablero (items legacy sin kind)
UPDATE "WorkspaceItem" i
SET "kind" = (
  CASE b."type"
    WHEN 'CLASS_LOG'       THEN 'LOG'
    WHEN 'STUDENT_NOTES'   THEN 'OBSERVATION'
    WHEN 'MICRO_COLLECT'   THEN 'COLLECTION'
    WHEN 'CLASSROOM_ROLES' THEN 'TASK'
    WHEN 'CHECKLIST'       THEN 'TASK'
    WHEN 'PROJECT'         THEN 'TASK'
    WHEN 'KANBAN'          THEN 'NOTE'
    ELSE 'NOTE'
  END
)::"WorkspaceItemKind"
FROM "WorkspaceBoard" b
WHERE i."boardId" = b."id" AND i."kind" IS NULL;
