-- AlterTable: Add parentId to Message for thread/reply support
ALTER TABLE "Message" ADD COLUMN "parentId" TEXT;

-- CreateIndex
CREATE INDEX "Message_parentId_idx" ON "Message"("parentId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add signatureImageUrl to User
ALTER TABLE "User" ADD COLUMN "signatureImageUrl" TEXT;
