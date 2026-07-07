-- Gamificación: insignias/logros (LearningBadgeAward). 100% aditivo: 1 tabla nueva.
-- El catálogo de insignias vive en código (badge-catalog.ts). No toca nada existente.
-- docs/PROPUESTA_UNIFICADA_RUTAS_BILINGUE.md §13 (Paso 1, increment 3)

-- CreateTable
CREATE TABLE "LearningBadgeAward" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "badgeCode" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningBadgeAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningBadgeAward_institutionId_idx" ON "LearningBadgeAward"("institutionId");

-- CreateIndex
CREATE INDEX "LearningBadgeAward_identityId_idx" ON "LearningBadgeAward"("identityId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningBadgeAward_studentId_badgeCode_key" ON "LearningBadgeAward"("studentId", "badgeCode");

-- AddForeignKey
ALTER TABLE "LearningBadgeAward" ADD CONSTRAINT "LearningBadgeAward_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningBadgeAward" ADD CONSTRAINT "LearningBadgeAward_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "LearningIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS multi-tenant (aislamiento por institución) — mismo patrón que el resto de tablas tenant-scoped.
-- Defensivo: solo se aplica si la función current_institution_id() existe.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "LearningBadgeAward" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "LearningBadgeAward" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'LearningBadgeAward' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "LearningBadgeAward" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
