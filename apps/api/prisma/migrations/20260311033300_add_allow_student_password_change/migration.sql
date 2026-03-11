-- AlterTable: Add allowStudentPasswordChange to Institution (default true = students can change)
ALTER TABLE "Institution" ADD COLUMN "allowStudentPasswordChange" BOOLEAN NOT NULL DEFAULT true;
