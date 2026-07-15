-- Rutas de Aprendizaje (Paso 2, increment 2): LearningRoute + LearningRouteStep.
-- Tenant-scoped (RLS por institución). 100% aditivo: 2 tablas nuevas.
-- docs/PROPUESTA_UNIFICADA_RUTAS_BILINGUE.md §13 (Paso 2)

-- CreateTable
CREATE TABLE "LearningRoute" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetCompetencyId" TEXT,
    "targetLevel" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningRouteStep" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "activityId" TEXT,
    "competencyId" TEXT,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningRouteStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningRoute_institutionId_idx" ON "LearningRoute"("institutionId");
CREATE INDEX "LearningRoute_classroomId_idx" ON "LearningRoute"("classroomId");
CREATE INDEX "LearningRouteStep_institutionId_idx" ON "LearningRouteStep"("institutionId");
CREATE INDEX "LearningRouteStep_routeId_idx" ON "LearningRouteStep"("routeId");
CREATE INDEX "LearningRouteStep_activityId_idx" ON "LearningRouteStep"("activityId");

-- AddForeignKey
ALTER TABLE "LearningRoute" ADD CONSTRAINT "LearningRoute_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningRoute" ADD CONSTRAINT "LearningRoute_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningRoute" ADD CONSTRAINT "LearningRoute_targetCompetencyId_fkey" FOREIGN KEY ("targetCompetencyId") REFERENCES "Competency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningRouteStep" ADD CONSTRAINT "LearningRouteStep_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningRouteStep" ADD CONSTRAINT "LearningRouteStep_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "LearningRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningRouteStep" ADD CONSTRAINT "LearningRouteStep_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassroomActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningRouteStep" ADD CONSTRAINT "LearningRouteStep_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS multi-tenant (aislamiento por institución) — mismo patrón que el resto.
-- Defensivo: solo se aplica si la función current_institution_id() existe.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "LearningRoute" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "LearningRoute" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'LearningRoute' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "LearningRoute" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;

    EXECUTE 'ALTER TABLE "LearningRouteStep" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "LearningRouteStep" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'LearningRouteStep' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "LearningRouteStep" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
