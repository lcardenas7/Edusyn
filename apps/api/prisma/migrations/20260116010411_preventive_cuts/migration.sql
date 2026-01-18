-- CreateEnum
CREATE TYPE "PreventiveAlertStatus" AS ENUM ('OPEN', 'IN_RECOVERY', 'RESOLVED');

-- CreateTable
CREATE TABLE "PreventiveCutConfig" (
    "id" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "cutoffDate" TIMESTAMP(3) NOT NULL,
    "riskThresholdScore" DECIMAL(3,1) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreventiveCutConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreventiveAlert" (
    "id" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "cutoffDate" TIMESTAMP(3) NOT NULL,
    "computedGrade" DECIMAL(3,1),
    "performanceLevel" "PerformanceLevel",
    "status" "PreventiveAlertStatus" NOT NULL DEFAULT 'OPEN',
    "recoveryPlan" TEXT,
    "meetingAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreventiveAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreventiveCutConfig_academicTermId_key" ON "PreventiveCutConfig"("academicTermId");

-- CreateIndex
CREATE INDEX "PreventiveAlert_teacherAssignmentId_idx" ON "PreventiveAlert"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "PreventiveAlert_studentEnrollmentId_idx" ON "PreventiveAlert"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "PreventiveAlert_academicTermId_idx" ON "PreventiveAlert"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "PreventiveAlert_teacherAssignmentId_studentEnrollmentId_aca_key" ON "PreventiveAlert"("teacherAssignmentId", "studentEnrollmentId", "academicTermId");

-- AddForeignKey
ALTER TABLE "PreventiveCutConfig" ADD CONSTRAINT "PreventiveCutConfig_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveAlert" ADD CONSTRAINT "PreventiveAlert_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveAlert" ADD CONSTRAINT "PreventiveAlert_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreventiveAlert" ADD CONSTRAINT "PreventiveAlert_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
