-- Add delegated permissions fields to InstitutionUser
ALTER TABLE "InstitutionUser" ADD COLUMN IF NOT EXISTS "canManageCredentials" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InstitutionUser" ADD COLUMN IF NOT EXISTS "credentialsPermissionById" TEXT;
ALTER TABLE "InstitutionUser" ADD COLUMN IF NOT EXISTS "credentialsPermissionAt" TIMESTAMP(3);
ALTER TABLE "InstitutionUser" ADD COLUMN IF NOT EXISTS "canManageStudents" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InstitutionUser" ADD COLUMN IF NOT EXISTS "studentsPermissionById" TEXT;
ALTER TABLE "InstitutionUser" ADD COLUMN IF NOT EXISTS "studentsPermissionAt" TIMESTAMP(3);

-- Create index for canManageCredentials
CREATE INDEX IF NOT EXISTS "InstitutionUser_canManageCredentials_idx" ON "InstitutionUser"("canManageCredentials");
