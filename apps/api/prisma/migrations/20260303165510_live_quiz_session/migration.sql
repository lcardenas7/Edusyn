-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "LiveSessionMode" AS ENUM ('INDIVIDUAL', 'TEAM');

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'WAITING',
    "mode" "LiveSessionMode" NOT NULL DEFAULT 'INDIVIDUAL',
    "currentQuestionIdx" INTEGER NOT NULL DEFAULT -1,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSessionAnswer" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "teamId" TEXT,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "responseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveSessionAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSessionTeam" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',

    CONSTRAINT "LiveSessionTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSessionTeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,

    CONSTRAINT "LiveSessionTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveSession_classroomId_status_idx" ON "LiveSession"("classroomId", "status");

-- CreateIndex
CREATE INDEX "LiveSession_teacherId_idx" ON "LiveSession"("teacherId");

-- CreateIndex
CREATE INDEX "LiveSessionAnswer_sessionId_questionId_idx" ON "LiveSessionAnswer"("sessionId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSessionAnswer_sessionId_questionId_studentEnrollmentId_key" ON "LiveSessionAnswer"("sessionId", "questionId", "studentEnrollmentId");

-- CreateIndex
CREATE INDEX "LiveSessionTeam_sessionId_idx" ON "LiveSessionTeam"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSessionTeamMember_teamId_studentEnrollmentId_key" ON "LiveSessionTeamMember"("teamId", "studentEnrollmentId");

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassroomActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionAnswer" ADD CONSTRAINT "LiveSessionAnswer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionAnswer" ADD CONSTRAINT "LiveSessionAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ActivityQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionAnswer" ADD CONSTRAINT "LiveSessionAnswer_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionAnswer" ADD CONSTRAINT "LiveSessionAnswer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "LiveSessionTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionTeam" ADD CONSTRAINT "LiveSessionTeam_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionTeamMember" ADD CONSTRAINT "LiveSessionTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "LiveSessionTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSessionTeamMember" ADD CONSTRAINT "LiveSessionTeamMember_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
