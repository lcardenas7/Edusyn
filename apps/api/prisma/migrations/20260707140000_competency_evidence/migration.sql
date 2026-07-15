-- Evidencia de competencias (Paso 2, increment 3): CompetencyEvidence.
-- El corazón de "todo genera evidencia": cada trabajo enganchado a un can-do
-- produce una fila; el dominio (%) se deriva de la evidencia acumulada.
-- Tenant-scoped (RLS). 100% aditivo: 1 tabla nueva.
-- docs/PROPUESTA_UNIFICADA_RUTAS_BILINGUE.md §13 (Paso 2)

-- CreateTable
CREATE TABLE "CompetencyEvidence" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT,
    "competencyId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceRef" TEXT,
    "routeStepId" TEXT,
    "score" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetencyEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyEvidence_idempotencyKey_key" ON "CompetencyEvidence"("idempotencyKey");
CREATE INDEX "CompetencyEvidence_institutionId_idx" ON "CompetencyEvidence"("institutionId");
CREATE INDEX "CompetencyEvidence_studentId_competencyId_idx" ON "CompetencyEvidence"("studentId", "competencyId");
CREATE INDEX "CompetencyEvidence_competencyId_idx" ON "CompetencyEvidence"("competencyId");
CREATE INDEX "CompetencyEvidence_routeStepId_idx" ON "CompetencyEvidence"("routeStepId");

-- AddForeignKey
ALTER TABLE "CompetencyEvidence" ADD CONSTRAINT "CompetencyEvidence_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetencyEvidence" ADD CONSTRAINT "CompetencyEvidence_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS multi-tenant (aislamiento por institución) — mismo patrón que el resto.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "CompetencyEvidence" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "CompetencyEvidence" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'CompetencyEvidence' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "CompetencyEvidence" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
