-- Protect activities and submissions when deleting sections
-- Change ClassroomActivity.sectionId from NOT NULL to nullable
-- Change onDelete from CASCADE to SET NULL

-- Make sectionId nullable
ALTER TABLE "ClassroomActivity" ALTER COLUMN "sectionId" DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE "ClassroomActivity" DROP CONSTRAINT IF EXISTS "ClassroomActivity_sectionId_fkey";

-- Recreate with SET NULL behavior
ALTER TABLE "ClassroomActivity" 
ADD CONSTRAINT "ClassroomActivity_sectionId_fkey" 
FOREIGN KEY ("sectionId") REFERENCES "ClassroomSection"("id") 
ON DELETE SET NULL ON UPDATE CASCADE;
