-- CreateEnum
CREATE TYPE "AbpProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AbpPhaseStatus" AS ENUM ('LOCKED', 'IN_PROGRESS', 'AWAITING', 'VALIDATED', 'RETURNED');

-- CreateEnum
CREATE TYPE "AbpValidationStatus" AS ENUM ('PENDING', 'APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "AbpContributionType" AS ENUM ('CANVAS_CARD', 'IDEA', 'VOTE', 'TASK_DONE', 'EVIDENCE', 'COEVAL');

-- AlterEnum
ALTER TYPE "XpSource" ADD VALUE 'ABP';

-- DropIndex

-- CreateTable
CREATE TABLE "AbpProject" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "challenge" TEXT,
    "status" "AbpProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "phaseConfig" JSONB,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbpProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbpTeam" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🚀',
    "color" TEXT NOT NULL DEFAULT '#0E4A5A',
    "currentPhase" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "problem" TEXT,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbpTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbpTeamMember" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbpTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbpPhaseState" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "status" "AbpPhaseStatus" NOT NULL DEFAULT 'LOCKED',
    "data" JSONB,
    "feedback" TEXT,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "validatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbpPhaseState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbpValidationRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "status" "AbpValidationStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AbpValidationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbpContribution" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "phase" INTEGER NOT NULL,
    "type" "AbpContributionType" NOT NULL,
    "refId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbpContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbpProject_institutionId_idx" ON "AbpProject"("institutionId");

-- CreateIndex
CREATE INDEX "AbpProject_classroomId_idx" ON "AbpProject"("classroomId");

-- CreateIndex
CREATE INDEX "AbpTeam_institutionId_idx" ON "AbpTeam"("institutionId");

-- CreateIndex
CREATE INDEX "AbpTeam_projectId_idx" ON "AbpTeam"("projectId");

-- CreateIndex
CREATE INDEX "AbpTeamMember_institutionId_idx" ON "AbpTeamMember"("institutionId");

-- CreateIndex
CREATE INDEX "AbpTeamMember_studentEnrollmentId_idx" ON "AbpTeamMember"("studentEnrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AbpTeamMember_teamId_studentEnrollmentId_key" ON "AbpTeamMember"("teamId", "studentEnrollmentId");

-- CreateIndex
CREATE INDEX "AbpPhaseState_institutionId_idx" ON "AbpPhaseState"("institutionId");

-- CreateIndex
CREATE INDEX "AbpPhaseState_teamId_idx" ON "AbpPhaseState"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "AbpPhaseState_teamId_phase_key" ON "AbpPhaseState"("teamId", "phase");

-- CreateIndex
CREATE INDEX "AbpValidationRequest_institutionId_idx" ON "AbpValidationRequest"("institutionId");

-- CreateIndex
CREATE INDEX "AbpValidationRequest_teamId_idx" ON "AbpValidationRequest"("teamId");

-- CreateIndex
CREATE INDEX "AbpValidationRequest_status_idx" ON "AbpValidationRequest"("status");

-- CreateIndex
CREATE INDEX "AbpContribution_institutionId_idx" ON "AbpContribution"("institutionId");

-- CreateIndex
CREATE INDEX "AbpContribution_teamId_phase_idx" ON "AbpContribution"("teamId", "phase");

-- CreateIndex
CREATE INDEX "AbpContribution_studentEnrollmentId_idx" ON "AbpContribution"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "AbpContribution_type_idx" ON "AbpContribution"("type");

-- CreateIndex
CREATE UNIQUE INDEX "AbpContribution_studentEnrollmentId_type_refId_key" ON "AbpContribution"("studentEnrollmentId", "type", "refId");

-- AddForeignKey
ALTER TABLE "AbpProject" ADD CONSTRAINT "AbpProject_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpProject" ADD CONSTRAINT "AbpProject_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpTeam" ADD CONSTRAINT "AbpTeam_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpTeam" ADD CONSTRAINT "AbpTeam_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AbpProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpTeamMember" ADD CONSTRAINT "AbpTeamMember_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpTeamMember" ADD CONSTRAINT "AbpTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AbpTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpTeamMember" ADD CONSTRAINT "AbpTeamMember_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpPhaseState" ADD CONSTRAINT "AbpPhaseState_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpPhaseState" ADD CONSTRAINT "AbpPhaseState_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AbpTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpValidationRequest" ADD CONSTRAINT "AbpValidationRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpValidationRequest" ADD CONSTRAINT "AbpValidationRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AbpTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpContribution" ADD CONSTRAINT "AbpContribution_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpContribution" ADD CONSTRAINT "AbpContribution_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AbpTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpContribution" ADD CONSTRAINT "AbpContribution_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex

-- RenameIndex

-- RLS multi-tenant por tabla (aislamiento por institucion) - patron tenant-scoped.
-- Defensivo: solo si current_institution_id() existe (se omite donde no hay RLS).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpProject" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpProject" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpProject' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpProject" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpTeam" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpTeam" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpTeam' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpTeam" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpTeamMember" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpTeamMember" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpTeamMember' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpTeamMember" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpPhaseState" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpPhaseState" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpPhaseState' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpPhaseState" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpValidationRequest" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpValidationRequest" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpValidationRequest' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpValidationRequest" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpContribution" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpContribution" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpContribution' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpContribution" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
