-- Gamificación: Identidad de Aprendizaje (LearningIdentity) + ledger de XP (XpEvent).
-- 100% aditivo: 2 tablas + 1 enum nuevos. No toca ninguna tabla existente. Cero downtime.
-- XP por dominio (no por clics); anclado en Student para persistir entre años.
-- docs/PROPUESTA_UNIFICADA_RUTAS_BILINGUE.md §13 (Paso 1)

-- CreateEnum
CREATE TYPE "XpSource" AS ENUM ('LESSON_COMPLETE', 'LESSON_ACTIVITY', 'QUIZ_GRADED', 'PLAY', 'MANUAL');

-- CreateTable
CREATE TABLE "LearningIdentity" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" TIMESTAMP(3),
    "skillXp" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT,
    "source" "XpSource" NOT NULL,
    "skill" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningIdentity_studentId_key" ON "LearningIdentity"("studentId");

-- CreateIndex
CREATE INDEX "LearningIdentity_institutionId_idx" ON "LearningIdentity"("institutionId");

-- CreateIndex
CREATE INDEX "LearningIdentity_studentId_idx" ON "LearningIdentity"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "XpEvent_idempotencyKey_key" ON "XpEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "XpEvent_institutionId_createdAt_idx" ON "XpEvent"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "XpEvent_identityId_idx" ON "XpEvent"("identityId");

-- CreateIndex
CREATE INDEX "XpEvent_studentId_idx" ON "XpEvent"("studentId");

-- AddForeignKey
ALTER TABLE "LearningIdentity" ADD CONSTRAINT "LearningIdentity_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningIdentity" ADD CONSTRAINT "LearningIdentity_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "LearningIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS multi-tenant (aislamiento por institución) — mismo patrón que el resto de tablas tenant-scoped.
-- Defensivo: solo se aplica si la función current_institution_id() existe (entornos con RLS configurada).
-- En entornos sin RLS (p.ej. staging), se omite sin fallar y el aislamiento queda a nivel de aplicación.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "LearningIdentity" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "LearningIdentity" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'LearningIdentity' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "LearningIdentity" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;

    EXECUTE 'ALTER TABLE "XpEvent" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "XpEvent" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'XpEvent' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "XpEvent" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
