-- AlterTable
ALTER TABLE "StudentAchievement" ADD COLUMN     "observation" TEXT;

-- CreateTable
CREATE TABLE "ObservationTemplate" (
    "id" TEXT NOT NULL,
    "achievementConfigId" TEXT NOT NULL,
    "level" "PerformanceLevel" NOT NULL,
    "template" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObservationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ObservationTemplate_achievementConfigId_level_key" ON "ObservationTemplate"("achievementConfigId", "level");

-- AddForeignKey
ALTER TABLE "ObservationTemplate" ADD CONSTRAINT "ObservationTemplate_achievementConfigId_fkey" FOREIGN KEY ("achievementConfigId") REFERENCES "AchievementConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
