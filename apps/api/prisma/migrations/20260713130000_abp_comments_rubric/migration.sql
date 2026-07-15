-- CreateEnum
CREATE TYPE "AbpCommentRefType" AS ENUM ('CANVAS_CARD', 'IDEA', 'TASK', 'EVIDENCE', 'COEVAL', 'PHASE');

-- DropIndex

-- AlterTable
ALTER TABLE "AbpValidationRequest" ADD COLUMN     "rubricComment" TEXT,
ADD COLUMN     "rubricScores" JSONB;

-- CreateTable
CREATE TABLE "AbpComment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "phaseStateId" TEXT NOT NULL,
    "refType" "AbpCommentRefType" NOT NULL,
    "refId" TEXT,
    "authorStudentEnrollmentId" TEXT,
    "authorUserId" TEXT,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbpComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AbpComment_institutionId_idx" ON "AbpComment"("institutionId");

-- CreateIndex
CREATE INDEX "AbpComment_teamId_idx" ON "AbpComment"("teamId");

-- CreateIndex
CREATE INDEX "AbpComment_phaseStateId_resolved_createdAt_idx" ON "AbpComment"("phaseStateId", "resolved", "createdAt");

-- CreateIndex
CREATE INDEX "AbpComment_refType_refId_idx" ON "AbpComment"("refType", "refId");

-- AddForeignKey
ALTER TABLE "AbpComment" ADD CONSTRAINT "AbpComment_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpComment" ADD CONSTRAINT "AbpComment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AbpTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpComment" ADD CONSTRAINT "AbpComment_phaseStateId_fkey" FOREIGN KEY ("phaseStateId") REFERENCES "AbpPhaseState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpComment" ADD CONSTRAINT "AbpComment_authorStudentEnrollmentId_fkey" FOREIGN KEY ("authorStudentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbpComment" ADD CONSTRAINT "AbpComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AbpComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex

-- RenameIndex

-- RLS multi-tenant para AbpComment (patron tenant-scoped, defensivo).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    EXECUTE 'ALTER TABLE "AbpComment" ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE "AbpComment" FORCE ROW LEVEL SECURITY';
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'AbpComment' AND policyname = 'tenant_isolation') THEN
      EXECUTE 'CREATE POLICY "tenant_isolation" ON "AbpComment" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())';
    END IF;
  END IF;
END $$;
