-- CreateEnum
CREATE TYPE "StaffLeaveType" AS ENUM ('AUSENCIA', 'SALIDA_TEMPRANA', 'LLEGADA_TARDE', 'PERMISO_ESPECIAL');

-- CreateEnum
CREATE TYPE "StaffLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StaffLeaveRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "type" "StaffLeaveType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "status" "StaffLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewerNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_institutionId_status_idx" ON "StaffLeaveRequest"("institutionId", "status");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_requesterId_idx" ON "StaffLeaveRequest"("requesterId");

-- CreateIndex
CREATE INDEX "StaffLeaveRequest_startDate_idx" ON "StaffLeaveRequest"("startDate");

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffLeaveRequest" ADD CONSTRAINT "StaffLeaveRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
