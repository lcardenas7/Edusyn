CREATE TYPE "ClassroomDuelStatus" AS ENUM ('INVITED', 'ACTIVE', 'COMPLETED', 'DECLINED', 'EXPIRED');

CREATE TABLE "ClassroomDuel" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "inviterEnrollmentId" TEXT NOT NULL,
  "inviteeEnrollmentId" TEXT NOT NULL,
  "pairKey" TEXT NOT NULL,
  "status" "ClassroomDuelStatus" NOT NULL DEFAULT 'INVITED',
  "questions" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassroomDuel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClassroomDuelAnswer" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "duelId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "answer" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassroomDuelAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassroomDuel_institutionId_classroomId_status_idx" ON "ClassroomDuel"("institutionId", "classroomId", "status");
CREATE INDEX "ClassroomDuel_institutionId_inviterEnrollmentId_createdAt_idx" ON "ClassroomDuel"("institutionId", "inviterEnrollmentId", "createdAt");
CREATE INDEX "ClassroomDuel_institutionId_inviteeEnrollmentId_createdAt_idx" ON "ClassroomDuel"("institutionId", "inviteeEnrollmentId", "createdAt");
CREATE UNIQUE INDEX "ClassroomDuel_open_pair_key" ON "ClassroomDuel"("institutionId", "classroomId", "pairKey") WHERE "status" IN ('INVITED', 'ACTIVE');
CREATE UNIQUE INDEX "ClassroomDuelAnswer_duelId_enrollmentId_ordinal_key" ON "ClassroomDuelAnswer"("duelId", "enrollmentId", "ordinal");
CREATE INDEX "ClassroomDuelAnswer_institutionId_enrollmentId_idx" ON "ClassroomDuelAnswer"("institutionId", "enrollmentId");

ALTER TABLE "ClassroomDuel" ADD CONSTRAINT "ClassroomDuel_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassroomDuel" ADD CONSTRAINT "ClassroomDuel_inviterEnrollmentId_fkey" FOREIGN KEY ("inviterEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassroomDuel" ADD CONSTRAINT "ClassroomDuel_inviteeEnrollmentId_fkey" FOREIGN KEY ("inviteeEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassroomDuelAnswer" ADD CONSTRAINT "ClassroomDuelAnswer_duelId_fkey" FOREIGN KEY ("duelId") REFERENCES "ClassroomDuel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassroomDuelAnswer" ADD CONSTRAINT "ClassroomDuelAnswer_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    ALTER TABLE "ClassroomDuel" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "ClassroomDuel" FORCE ROW LEVEL SECURITY;
    CREATE POLICY "tenant_isolation" ON "ClassroomDuel" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id());
    ALTER TABLE "ClassroomDuelAnswer" ENABLE ROW LEVEL SECURITY;
    ALTER TABLE "ClassroomDuelAnswer" FORCE ROW LEVEL SECURITY;
    CREATE POLICY "tenant_isolation" ON "ClassroomDuelAnswer" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id());
  END IF;
END $$;
