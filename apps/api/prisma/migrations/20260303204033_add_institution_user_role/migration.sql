-- CreateTable
CREATE TABLE "InstitutionUserRole" (
    "id" TEXT NOT NULL,
    "institutionUserId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,

    CONSTRAINT "InstitutionUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionUserRole_institutionUserId_roleId_key" ON "InstitutionUserRole"("institutionUserId", "roleId");

-- CreateIndex
CREATE INDEX "InstitutionUserRole_institutionUserId_idx" ON "InstitutionUserRole"("institutionUserId");

-- CreateIndex
CREATE INDEX "InstitutionUserRole_roleId_idx" ON "InstitutionUserRole"("roleId");

-- AddForeignKey
ALTER TABLE "InstitutionUserRole" ADD CONSTRAINT "InstitutionUserRole_institutionUserId_fkey" FOREIGN KEY ("institutionUserId") REFERENCES "InstitutionUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstitutionUserRole" ADD CONSTRAINT "InstitutionUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
