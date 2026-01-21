/*
  Warnings:

  - Made the column `areaApprovalRule` on table `Institution` required. This step will fail if there are existing NULL values in that column.
  - Made the column `areaCalculationType` on table `Institution` required. This step will fail if there are existing NULL values in that column.
  - Made the column `areaFailIfAnyFails` on table `Institution` required. This step will fail if there are existing NULL values in that column.
  - Made the column `areaRecoveryRule` on table `Institution` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Area" ADD COLUMN     "calculationType" "AreaCalculationType" NOT NULL DEFAULT 'AVERAGE';

-- AlterTable
ALTER TABLE "Institution" ALTER COLUMN "areaApprovalRule" SET NOT NULL,
ALTER COLUMN "areaCalculationType" SET NOT NULL,
ALTER COLUMN "areaFailIfAnyFails" SET NOT NULL,
ALTER COLUMN "areaRecoveryRule" SET NOT NULL;
