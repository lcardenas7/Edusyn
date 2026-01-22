-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "visibleToRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "visibleToRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];
