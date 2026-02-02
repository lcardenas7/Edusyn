-- CreateEnum
CREATE TYPE "InstitutionalDocumentCategory" AS ENUM ('MANUAL', 'REGLAMENTO', 'FORMATO', 'CIRCULAR', 'PEI', 'SIEE', 'OTRO');

-- CreateEnum
CREATE TYPE "ManagementArea" AS ENUM ('ACADEMICA', 'DIRECTIVA', 'COMUNITARIA', 'ADMINISTRATIVA');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('BAJA', 'NORMAL', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "TaskCategory" AS ENUM ('PLANEACION', 'SEGUIMIENTO', 'EVIDENCIA', 'REUNION', 'CAPACITACION', 'PROYECTO', 'OTRO');

-- CreateEnum
CREATE TYPE "TaskAssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "InstitutionalDocument" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "InstitutionalDocumentCategory" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT NOT NULL,
    "visibleToRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementLeader" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "area" "ManagementArea" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementLeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementTask" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "leaderId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagementTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "status" "TaskAssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "responseNote" TEXT,
    "evidenceUrl" TEXT,
    "evidenceFileName" TEXT,
    "evidenceFileSize" INTEGER,
    "evidenceMimeType" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionStorageUsage" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "documentsUsage" BIGINT NOT NULL DEFAULT 0,
    "evidencesUsage" BIGINT NOT NULL DEFAULT 0,
    "galleryUsage" BIGINT NOT NULL DEFAULT 0,
    "otherUsage" BIGINT NOT NULL DEFAULT 0,
    "documentsLimit" BIGINT NOT NULL DEFAULT 524288000,
    "evidencesLimit" BIGINT NOT NULL DEFAULT 1073741824,
    "galleryLimit" BIGINT NOT NULL DEFAULT 104857600,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionStorageUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstitutionalDocument_institutionId_idx" ON "InstitutionalDocument"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionalDocument_category_idx" ON "InstitutionalDocument"("category");

-- CreateIndex
CREATE INDEX "InstitutionalDocument_isActive_idx" ON "InstitutionalDocument"("isActive");

-- CreateIndex
CREATE INDEX "ManagementLeader_institutionId_idx" ON "ManagementLeader"("institutionId");

-- CreateIndex
CREATE INDEX "ManagementLeader_userId_idx" ON "ManagementLeader"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementLeader_institutionId_userId_area_key" ON "ManagementLeader"("institutionId", "userId", "area");

-- CreateIndex
CREATE INDEX "ManagementTask_institutionId_idx" ON "ManagementTask"("institutionId");

-- CreateIndex
CREATE INDEX "ManagementTask_createdById_idx" ON "ManagementTask"("createdById");

-- CreateIndex
CREATE INDEX "ManagementTask_dueDate_idx" ON "ManagementTask"("dueDate");

-- CreateIndex
CREATE INDEX "ManagementTask_priority_idx" ON "ManagementTask"("priority");

-- CreateIndex
CREATE INDEX "TaskAssignment_taskId_idx" ON "TaskAssignment"("taskId");

-- CreateIndex
CREATE INDEX "TaskAssignment_assigneeId_idx" ON "TaskAssignment"("assigneeId");

-- CreateIndex
CREATE INDEX "TaskAssignment_status_idx" ON "TaskAssignment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignment_taskId_assigneeId_key" ON "TaskAssignment"("taskId", "assigneeId");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionStorageUsage_institutionId_key" ON "InstitutionStorageUsage"("institutionId");

-- AddForeignKey
ALTER TABLE "InstitutionalDocument" ADD CONSTRAINT "InstitutionalDocument_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionalDocument" ADD CONSTRAINT "InstitutionalDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementLeader" ADD CONSTRAINT "ManagementLeader_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementLeader" ADD CONSTRAINT "ManagementLeader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementLeader" ADD CONSTRAINT "ManagementLeader_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementTask" ADD CONSTRAINT "ManagementTask_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementTask" ADD CONSTRAINT "ManagementTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementTask" ADD CONSTRAINT "ManagementTask_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "ManagementLeader"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ManagementTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionStorageUsage" ADD CONSTRAINT "InstitutionStorageUsage_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
