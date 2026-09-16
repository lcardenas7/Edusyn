-- Edusyn Construye F1: asignación por aula, equipos, versiones inmutables y bitácora.
CREATE TYPE "ConstruyeProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'READY_FOR_REVIEW', 'SUBMITTED', 'RETURNED', 'ARCHIVED');
CREATE TYPE "ConstruyeMemberRole" AS ENUM ('RESEARCH', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'COORDINATION');
CREATE TYPE "ConstruyeJournalType" AS ENUM ('BRIEF_UPDATED', 'SOURCE_ADDED', 'PROMPT_COPIED', 'AI_IMPORT_PROPOSED', 'AI_IMPORT_APPLIED', 'FILE_CHANGED', 'VERSION_CREATED', 'TEST_RECORDED', 'HELP_REQUESTED', 'TEACHER_COMMENT');

CREATE TABLE "ConstruyeProject" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "classroomActivityId" TEXT,
  "teacherUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "instructions" TEXT,
  "briefTemplate" JSONB,
  "status" "ConstruyeProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "startDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConstruyeProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstruyeTeam" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConstruyeTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstruyeTeamMember" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "studentEnrollmentId" TEXT NOT NULL,
  "role" "ConstruyeMemberRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConstruyeTeamMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstruyeVersion" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "label" TEXT,
  "manifest" JSONB NOT NULL,
  "createdByEnrollmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConstruyeVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstruyeJournalEntry" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "actorEnrollmentId" TEXT,
  "actorUserId" TEXT,
  "type" "ConstruyeJournalType" NOT NULL,
  "summary" TEXT NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConstruyeJournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConstruyeProject_institutionId_idx" ON "ConstruyeProject"("institutionId");
CREATE INDEX "ConstruyeProject_classroomId_idx" ON "ConstruyeProject"("classroomId");
CREATE INDEX "ConstruyeProject_classroomActivityId_idx" ON "ConstruyeProject"("classroomActivityId");
CREATE INDEX "ConstruyeTeam_institutionId_idx" ON "ConstruyeTeam"("institutionId");
CREATE INDEX "ConstruyeTeam_projectId_idx" ON "ConstruyeTeam"("projectId");
CREATE INDEX "ConstruyeTeamMember_institutionId_idx" ON "ConstruyeTeamMember"("institutionId");
CREATE INDEX "ConstruyeTeamMember_studentEnrollmentId_idx" ON "ConstruyeTeamMember"("studentEnrollmentId");
CREATE UNIQUE INDEX "ConstruyeTeamMember_teamId_studentEnrollmentId_key" ON "ConstruyeTeamMember"("teamId", "studentEnrollmentId");
CREATE INDEX "ConstruyeVersion_institutionId_idx" ON "ConstruyeVersion"("institutionId");
CREATE UNIQUE INDEX "ConstruyeVersion_teamId_number_key" ON "ConstruyeVersion"("teamId", "number");
CREATE INDEX "ConstruyeVersion_projectId_teamId_idx" ON "ConstruyeVersion"("projectId", "teamId");
CREATE INDEX "ConstruyeJournalEntry_institutionId_idx" ON "ConstruyeJournalEntry"("institutionId");
CREATE INDEX "ConstruyeJournalEntry_projectId_teamId_createdAt_idx" ON "ConstruyeJournalEntry"("projectId", "teamId", "createdAt");

ALTER TABLE "ConstruyeProject" ADD CONSTRAINT "ConstruyeProject_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstruyeProject" ADD CONSTRAINT "ConstruyeProject_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstruyeProject" ADD CONSTRAINT "ConstruyeProject_classroomActivityId_fkey" FOREIGN KEY ("classroomActivityId") REFERENCES "ClassroomActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstruyeProject" ADD CONSTRAINT "ConstruyeProject_teacherUserId_fkey" FOREIGN KEY ("teacherUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstruyeTeam" ADD CONSTRAINT "ConstruyeTeam_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstruyeTeam" ADD CONSTRAINT "ConstruyeTeam_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstruyeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstruyeTeamMember" ADD CONSTRAINT "ConstruyeTeamMember_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstruyeTeamMember" ADD CONSTRAINT "ConstruyeTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ConstruyeTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstruyeTeamMember" ADD CONSTRAINT "ConstruyeTeamMember_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstruyeVersion" ADD CONSTRAINT "ConstruyeVersion_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstruyeVersion" ADD CONSTRAINT "ConstruyeVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstruyeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstruyeVersion" ADD CONSTRAINT "ConstruyeVersion_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ConstruyeTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstruyeVersion" ADD CONSTRAINT "ConstruyeVersion_createdByEnrollmentId_fkey" FOREIGN KEY ("createdByEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstruyeJournalEntry" ADD CONSTRAINT "ConstruyeJournalEntry_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstruyeJournalEntry" ADD CONSTRAINT "ConstruyeJournalEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ConstruyeProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstruyeJournalEntry" ADD CONSTRAINT "ConstruyeJournalEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ConstruyeTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstruyeJournalEntry" ADD CONSTRAINT "ConstruyeJournalEntry_actorEnrollmentId_fkey" FOREIGN KEY ("actorEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstruyeJournalEntry" ADD CONSTRAINT "ConstruyeJournalEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS por institución. Igual que los módulos actuales: se activa solo cuando el
-- helper está instalado, para conservar entornos locales sin RLS.
DO $$ DECLARE t TEXT; BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN
    FOREACH t IN ARRAY ARRAY['ConstruyeProject','ConstruyeTeam','ConstruyeTeamMember','ConstruyeVersion','ConstruyeJournalEntry'] LOOP
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t AND policyname = 'tenant_isolation') THEN
        EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())', t);
      END IF;
    END LOOP;
  END IF;
END $$;
