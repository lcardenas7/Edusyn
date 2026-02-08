-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "companionId" TEXT,
ADD COLUMN     "directorId" TEXT;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_companionId_fkey" FOREIGN KEY ("companionId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
