-- AlterTable
ALTER TABLE "ClassroomActivity" ADD COLUMN IF NOT EXISTS "isRestrictedToAssigned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActivityAssignment" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "studentEnrollmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityAssignment_activityId_idx" ON "ActivityAssignment"("activityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityAssignment_studentEnrollmentId_idx" ON "ActivityAssignment"("studentEnrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ActivityAssignment_activityId_studentEnrollmentId_key" ON "ActivityAssignment"("activityId", "studentEnrollmentId");

-- AddForeignKey
ALTER TABLE "ActivityAssignment" ADD CONSTRAINT "ActivityAssignment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassroomActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityAssignment" ADD CONSTRAINT "ActivityAssignment_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
