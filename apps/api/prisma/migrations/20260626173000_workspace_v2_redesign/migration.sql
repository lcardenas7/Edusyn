-- ═══════════════════════════════════════════════════════════════════════════
-- WORKSPACE V2 — Migración aditiva para el rediseño de Mi Espacio Docente
-- ═══════════════════════════════════════════════════════════════════════════
-- Propósito: agregar campos al modelo Workspace para soportar el rediseño
-- "Mi Espacio Docente" (ver docs/MI_ESPACIO_DOCENTE_VISION.md).
--
-- Características de seguridad:
--   - Solo ADD COLUMN, CREATE TYPE, CREATE INDEX. Sin DROPs ni RENAMEs.
--   - Todas las columnas nuevas son nullable o tienen DEFAULT.
--   - Compatible con la UI existente: el código viejo ignora estos campos.
--   - Bajo riesgo en producción: cambios de catálogo en Postgres, sin
--     reescritura de tablas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Nuevo enum polimórfico para tipos de elemento ──────────────────────
CREATE TYPE "WorkspaceItemKind" AS ENUM (
  'NOTE',
  'TASK',
  'OBSERVATION',
  'LOG',
  'COLLECTION',
  'IDEA',
  'LIST',
  'FILE',
  'EVENT'
);

-- ── 2. Campos nuevos en WorkspaceBoard ────────────────────────────────────
ALTER TABLE "WorkspaceBoard"
  ADD COLUMN "emoji"          TEXT,
  ADD COLUMN "coverImage"     TEXT,
  ADD COLUMN "bannerColor"    TEXT,
  ADD COLUMN "isPinned"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isPersonal"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "linkedClassId"  TEXT,
  ADD COLUMN "hiddenSections" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "lastAccessedAt" TIMESTAMP(3);

-- ── 3. Campos nuevos en WorkspaceItem ─────────────────────────────────────
ALTER TABLE "WorkspaceItem"
  ADD COLUMN "kind"            "WorkspaceItemKind",
  ADD COLUMN "completedAt"     TIMESTAMP(3),
  ADD COLUMN "amount"          DECIMAL(12,2),
  ADD COLUMN "amountCollected" DECIMAL(12,2),
  ADD COLUMN "tags"            TEXT[] DEFAULT ARRAY[]::TEXT[];

-- ── 4. Índices nuevos para queries del rediseño ───────────────────────────
-- Home: ordena espacios fijados primero
CREATE INDEX "WorkspaceBoard_teacherId_isPinned_idx"
  ON "WorkspaceBoard" ("teacherId", "isPinned");

-- Home: ordena por accedido recientemente
CREATE INDEX "WorkspaceBoard_teacherId_lastAccessedAt_idx"
  ON "WorkspaceBoard" ("teacherId", "lastAccessedAt" DESC);

-- Dentro de un espacio: filtrar items por tipo
CREATE INDEX "WorkspaceItem_boardId_kind_idx"
  ON "WorkspaceItem" ("boardId", "kind");
