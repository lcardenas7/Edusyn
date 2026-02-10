-- CreateTable
CREATE TABLE "InstitutionRoleCapability" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionRoleCapability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstitutionRoleCapability_institutionId_idx" ON "InstitutionRoleCapability"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionRoleCapability_institutionId_role_idx" ON "InstitutionRoleCapability"("institutionId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionRoleCapability_institutionId_role_capabilityKey_key" ON "InstitutionRoleCapability"("institutionId", "role", "capabilityKey");

-- AddForeignKey
ALTER TABLE "InstitutionRoleCapability" ADD CONSTRAINT "InstitutionRoleCapability_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
