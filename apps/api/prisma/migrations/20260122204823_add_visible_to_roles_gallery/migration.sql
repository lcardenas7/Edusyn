-- AlterTable
ALTER TABLE "GalleryImage" ADD COLUMN     "visibleToRoles" TEXT[] DEFAULT ARRAY[]::TEXT[];
