-- CreateEnum
CREATE TYPE "AbpMissionStatus" AS ENUM ('LOCKED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AbpGeneratedBy" AS ENUM ('MANUAL', 'TEMPLATE', 'AI');

-- CreateEnum
CREATE TYPE "AbpMissionActivityType" AS ENUM ('READING', 'VIDEO', 'QUIZ', 'INTERVIEW', 'UPLOAD', 'LINK', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AbpImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- DropIndex

-- CreateTable
CREATE TABLE "AbpMission" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "phaseStateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "AbpMissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "generatedBy" "AbpGeneratedBy" NOT NULL DEFAULT 'MANUAL',
    "generationContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbpMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbpMissionActivity" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "type" "AbpMissionActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedByEnrollmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbpMissionActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbpDiscovery" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "authorStudentEnrollmentId" TEXT,
    "authorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceKind" TEXT,
    "evidenceUrl" TEXT,
    "impact" "AbpImpact" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbpDiscovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbpLogEntry" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "phase" INTEGER,
    "authorStudentEnrollmentId" TEXT,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbpLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbpMission_institutionId_idx" ON "AbpMission"("institutionId");

-- CreateIndex
CREATE INDEX "AbpMission_phaseStateId_sortOrder_idx" ON "AbpMission"("phaseStateId", "sortOrder");

-- CreateIndex
CREATE INDEX "AbpMissionActivity_institutionId_idx" ON "AbpMissionActivity"("institutionId");

-- CreateIndex
CREATE INDEX "AbpMissionActivity_missionId_sortOrder_idx" ON "AbpMissionActivity"("missionId", "sortOrder");

-- CreateIndex
CREATE INDEX "AbpDiscovery_institutionId_idx" ON "AbpDiscovery"("institutionId");

-- CreateIndex
CREATE INDEX "AbpDiscovery_teamId_phase_idx" ON "AbpDiscovery"("teamId", "phase");

-- CreateIndex
CREATE INDEX "AbpLogEntry_institutionId_idx" ON "AbpLogEntry"("institutionId");

-- CreateIndex
CREATE INDEX "AbpLogEntry_teamId_idx" ON "AbpLogEntry"("teamId");

-- AddForeignKey
ALTER TABLE "AbpMission" ADD CONSTRAINT "AbpMission_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpMission" ADD CONSTRAINT "AbpMission_phaseStateId_fkey" FOREIGN KEY ("phaseStateId") REFERENCES "AbpPhaseState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpMissionActivity" ADD CONSTRAINT "AbpMissionActivity_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpMissionActivity" ADD CONSTRAINT "AbpMissionActivity_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "AbpMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpMissionActivity" ADD CONSTRAINT "AbpMissionActivity_completedByEnrollmentId_fkey" FOREIGN KEY ("completedByEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpDiscovery" ADD CONSTRAINT "AbpDiscovery_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpDiscovery" ADD CONSTRAINT "AbpDiscovery_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AbpTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpDiscovery" ADD CONSTRAINT "AbpDiscovery_authorStudentEnrollmentId_fkey" FOREIGN KEY ("authorStudentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpLogEntry" ADD CONSTRAINT "AbpLogEntry_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpLogEntry" ADD CONSTRAINT "AbpLogEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AbpTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpLogEntry" ADD CONSTRAINT "AbpLogEntry_authorStudentEnrollmentId_fkey" FOREIGN KEY ("authorStudentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex

-- RenameIndex

-- RLS multi-tenant por tabla (patron tenant-scoped, defensivo).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpMission" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpMission" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpMission' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpMission" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpMissionActivity" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpMissionActivity" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpMissionActivity' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpMissionActivity" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpDiscovery" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpDiscovery" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpDiscovery' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpDiscovery" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpLogEntry" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpLogEntry" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpLogEntry' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpLogEntry" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
