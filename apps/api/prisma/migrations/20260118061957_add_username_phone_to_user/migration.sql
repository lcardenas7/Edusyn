/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AreaCalculationType" AS ENUM ('SINGLE_SUBJECT', 'AVERAGE', 'WEIGHTED_AVERAGE', 'CUSTOM_FORMULA');

-- AlterTable
ALTER TABLE "Area" ADD COLUMN     "calculationType" "AreaCalculationType" NOT NULL DEFAULT 'AVERAGE',
ADD COLUMN     "customFormula" TEXT,
ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "username" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
