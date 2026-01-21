-- CreateEnum
CREATE TYPE "PermissionAuditAction" AS ENUM ('GRANT', 'REVOKE', 'EXPIRE', 'ROLE_ASSIGN', 'ROLE_REMOVE', 'RULE_CHANGE', 'PERIOD_OPEN', 'PERIOD_CLOSE', 'WINDOW_OPEN', 'WINDOW_CLOSE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SystemModule" ADD VALUE 'USERS';
ALTER TYPE "SystemModule" ADD VALUE 'CONFIG';

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "address" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "InstitutionModule" ADD COLUMN     "features" TEXT[];

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "function" TEXT NOT NULL,
    "subFunction" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleBasePermission" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleBasePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserExtraPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,

    CONSTRAINT "UserExtraPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PermissionAuditLog" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "action" "PermissionAuditAction" NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "permissionId" TEXT,
    "oldRole" TEXT,
    "newRole" TEXT,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,

    CONSTRAINT "PermissionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "RoleBasePermission_role_idx" ON "RoleBasePermission"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RoleBasePermission_role_permissionId_key" ON "RoleBasePermission"("role", "permissionId");

-- CreateIndex
CREATE INDEX "UserExtraPermission_userId_idx" ON "UserExtraPermission"("userId");

-- CreateIndex
CREATE INDEX "UserExtraPermission_validTo_idx" ON "UserExtraPermission"("validTo");

-- CreateIndex
CREATE UNIQUE INDEX "UserExtraPermission_userId_permissionId_key" ON "UserExtraPermission"("userId", "permissionId");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_institutionId_performedAt_idx" ON "PermissionAuditLog"("institutionId", "performedAt");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_targetUserId_idx" ON "PermissionAuditLog"("targetUserId");

-- CreateIndex
CREATE INDEX "PermissionAuditLog_action_idx" ON "PermissionAuditLog"("action");

-- AddForeignKey
ALTER TABLE "RoleBasePermission" ADD CONSTRAINT "RoleBasePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExtraPermission" ADD CONSTRAINT "UserExtraPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExtraPermission" ADD CONSTRAINT "UserExtraPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExtraPermission" ADD CONSTRAINT "UserExtraPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserExtraPermission" ADD CONSTRAINT "UserExtraPermission_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionAuditLog" ADD CONSTRAINT "PermissionAuditLog_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
