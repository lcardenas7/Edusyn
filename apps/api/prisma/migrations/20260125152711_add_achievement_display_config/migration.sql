/*
  Warnings:

  - A unique constraint covering the columns `[code,teacherAssignmentId]` on the table `Achievement` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Achievement` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AchievementDisplayMode" AS ENUM ('SEPARATE', 'COMBINED');

-- CreateEnum
CREATE TYPE "AchievementDisplayFormat" AS ENUM ('LIST', 'PARAGRAPH');

-- CreateEnum
CREATE TYPE "JudgmentPosition" AS ENUM ('END_OF_EACH', 'END_OF_ALL', 'NONE');

-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('ACADEMIC', 'ATTITUDINAL', 'PROMOTIONAL');

-- AlterTable
ALTER TABLE "Achievement" ADD COLUMN     "achievementType" "AchievementType" NOT NULL DEFAULT 'ACADEMIC',
ADD COLUMN     "code" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AchievementConfig" ADD COLUMN     "displayFormat" "AchievementDisplayFormat" NOT NULL DEFAULT 'LIST',
ADD COLUMN     "displayMode" "AchievementDisplayMode" NOT NULL DEFAULT 'SEPARATE',
ADD COLUMN     "judgmentPosition" "JudgmentPosition" NOT NULL DEFAULT 'END_OF_EACH';

-- CreateIndex
CREATE INDEX "Achievement_code_idx" ON "Achievement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_teacherAssignmentId_key" ON "Achievement"("code", "teacherAssignmentId");
