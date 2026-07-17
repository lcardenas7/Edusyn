-- AlterTable
ALTER TABLE "AbpMissionActivity" ADD COLUMN     "classroomActivityId" TEXT;

-- CreateIndex
CREATE INDEX "AbpMissionActivity_classroomActivityId_idx" ON "AbpMissionActivity"("classroomActivityId");

-- AddForeignKey
ALTER TABLE "AbpMissionActivity" ADD CONSTRAINT "AbpMissionActivity_classroomActivityId_fkey" FOREIGN KEY ("classroomActivityId") REFERENCES "ClassroomActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
