-- CreateTable
CREATE TABLE "AchievementBank" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "subjectId" TEXT,
    "areaId" TEXT,
    "gradeId" TEXT,
    "description" TEXT NOT NULL,
    "achievementType" "AchievementType" NOT NULL DEFAULT 'ACADEMIC',
    "performanceLevel" "PerformanceLevel",
    "category" TEXT,
    "tags" TEXT,
    "createdById" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AchievementBank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AchievementBank_institutionId_idx" ON "AchievementBank"("institutionId");

-- CreateIndex
CREATE INDEX "AchievementBank_institutionId_subjectId_idx" ON "AchievementBank"("institutionId", "subjectId");

-- CreateIndex
CREATE INDEX "AchievementBank_institutionId_areaId_idx" ON "AchievementBank"("institutionId", "areaId");

-- CreateIndex
CREATE INDEX "AchievementBank_institutionId_achievementType_idx" ON "AchievementBank"("institutionId", "achievementType");

-- CreateIndex
CREATE INDEX "AchievementBank_createdById_idx" ON "AchievementBank"("createdById");

-- AddForeignKey
ALTER TABLE "AchievementBank" ADD CONSTRAINT "AchievementBank_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementBank" ADD CONSTRAINT "AchievementBank_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementBank" ADD CONSTRAINT "AchievementBank_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementBank" ADD CONSTRAINT "AchievementBank_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementBank" ADD CONSTRAINT "AchievementBank_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
