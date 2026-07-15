-- Grafo de competencias (Paso 2): tabla de referencia GLOBAL y canónica.
-- No es tenant-scoped (el CEFR es igual para todas las instituciones), por eso
-- no lleva institutionId ni RLS. Se pre-carga vía seed (prisma/seed-cefr.ts).
-- 100% aditivo: 1 tabla nueva. No toca nada existente.
-- docs/PROPUESTA_UNIFICADA_RUTAS_BILINGUE.md §13 (Paso 2)

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "level" TEXT,
    "skill" TEXT,
    "code" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Competency_code_key" ON "Competency"("code");

-- CreateIndex
CREATE INDEX "Competency_framework_level_skill_idx" ON "Competency"("framework", "level", "skill");

-- CreateIndex
CREATE INDEX "Competency_framework_idx" ON "Competency"("framework");
