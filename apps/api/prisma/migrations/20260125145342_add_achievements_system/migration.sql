-- CreateEnum
CREATE TYPE "AttitudinalAchievementMode" AS ENUM ('GENERAL_PER_PERIOD', 'PER_ACADEMIC_ACHIEVEMENT');

-- CreateTable
CREATE TABLE "AchievementConfig" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "achievementsPerPeriod" INTEGER NOT NULL DEFAULT 1,
    "usePromotionalAchievement" BOOLEAN NOT NULL DEFAULT true,
    "useAttitudinalAchievement" BOOLEAN NOT NULL DEFAULT false,
    "attitudinalMode" "AttitudinalAchievementMode" NOT NULL DEFAULT 'GENERAL_PER_PERIOD',
    "useValueJudgments" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValueJudgmentTemplate" (
    "id" TEXT NOT NULL,
    "achievementConfigId" TEXT NOT NULL,
    "level" "PerformanceLevel" NOT NULL,
    "template" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ValueJudgmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "orderNumber" INTEGER NOT NULL DEFAULT 1,
    "baseDescription" TEXT NOT NULL,
    "isPromotional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttitudinalAchievement" (
    "id" TEXT NOT NULL,
    "teacherAssignmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "achievementId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttitudinalAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAchievement" (
    "id" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "performanceLevel" "PerformanceLevel" NOT NULL,
    "suggestedText" TEXT,
    "approvedText" TEXT,
    "isTextApproved" BOOLEAN NOT NULL DEFAULT false,
    "suggestedJudgment" TEXT,
    "approvedJudgment" TEXT,
    "isJudgmentApproved" BOOLEAN NOT NULL DEFAULT false,
    "attitudinalText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,

    CONSTRAINT "StudentAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AchievementConfig_institutionId_key" ON "AchievementConfig"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "ValueJudgmentTemplate_achievementConfigId_level_key" ON "ValueJudgmentTemplate"("achievementConfigId", "level");

-- CreateIndex
CREATE INDEX "Achievement_teacherAssignmentId_idx" ON "Achievement"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "Achievement_academicTermId_idx" ON "Achievement"("academicTermId");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_teacherAssignmentId_academicTermId_orderNumber__key" ON "Achievement"("teacherAssignmentId", "academicTermId", "orderNumber", "isPromotional");

-- CreateIndex
CREATE INDEX "AttitudinalAchievement_teacherAssignmentId_idx" ON "AttitudinalAchievement"("teacherAssignmentId");

-- CreateIndex
CREATE INDEX "AttitudinalAchievement_academicTermId_idx" ON "AttitudinalAchievement"("academicTermId");

-- CreateIndex
CREATE INDEX "StudentAchievement_studentEnrollmentId_idx" ON "StudentAchievement"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "StudentAchievement_achievementId_idx" ON "StudentAchievement"("achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAchievement_studentEnrollmentId_achievementId_key" ON "StudentAchievement"("studentEnrollmentId", "achievementId");

-- AddForeignKey
ALTER TABLE "AchievementConfig" ADD CONSTRAINT "AchievementConfig_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValueJudgmentTemplate" ADD CONSTRAINT "ValueJudgmentTemplate_achievementConfigId_fkey" FOREIGN KEY ("achievementConfigId") REFERENCES "AchievementConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttitudinalAchievement" ADD CONSTRAINT "AttitudinalAchievement_teacherAssignmentId_fkey" FOREIGN KEY ("teacherAssignmentId") REFERENCES "TeacherAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttitudinalAchievement" ADD CONSTRAINT "AttitudinalAchievement_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttitudinalAchievement" ADD CONSTRAINT "AttitudinalAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAchievement" ADD CONSTRAINT "StudentAchievement_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
