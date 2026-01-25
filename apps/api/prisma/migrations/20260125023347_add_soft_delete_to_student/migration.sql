-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedReason" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SubjectLevelConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;
