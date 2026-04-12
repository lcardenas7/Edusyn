-- CreateEnum
CREATE TYPE "LiveSessionDeliveryMode" AS ENUM ('SYNC', 'ASYNC_HOME');

-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN "deliveryMode" "LiveSessionDeliveryMode" NOT NULL DEFAULT 'SYNC',
ADD COLUMN "parentSessionId" TEXT,
ADD COLUMN "studentEnrollmentId" TEXT;

-- CreateIndex
CREATE INDEX "LiveSession_parentSessionId_idx" ON "LiveSession"("parentSessionId");

-- CreateIndex
CREATE INDEX "LiveSession_studentEnrollmentId_idx" ON "LiveSession"("studentEnrollmentId");

-- CreateIndex
CREATE INDEX "LiveSession_deliveryMode_status_idx" ON "LiveSession"("deliveryMode", "status");

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_parentSessionId_fkey" FOREIGN KEY ("parentSessionId") REFERENCES "LiveSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_studentEnrollmentId_fkey" FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
