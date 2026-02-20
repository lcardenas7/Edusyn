-- AlterTable: Add parentId to Message for thread/reply support
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "parentId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_parentId_idx" ON "Message"("parentId");

-- AddForeignKey (drop first if exists to be idempotent)
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_parentId_fkey";
ALTER TABLE "Message" ADD CONSTRAINT "Message_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add signatureImageUrl to User (may already exist)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signatureImageUrl" TEXT;
