-- CreateEnum (if not exists)
DO $$ BEGIN
    CREATE TYPE "AreaApprovalRule" AS ENUM ('AREA_AVERAGE', 'ALL_SUBJECTS_PASS', 'DOMINANT_SUBJECT_PASS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (if not exists)
DO $$ BEGIN
    CREATE TYPE "AreaRecoveryRule" AS ENUM ('INDIVIDUAL_SUBJECT', 'FULL_AREA', 'CONDITIONAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Recreate AreaCalculationType enum with new values
DO $$ BEGIN
    -- Drop old enum if exists and recreate
    DROP TYPE IF EXISTS "AreaCalculationType" CASCADE;
    CREATE TYPE "AreaCalculationType" AS ENUM ('INFORMATIVE', 'AVERAGE', 'WEIGHTED', 'DOMINANT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable Institution - Add new columns
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "academicLevelsConfig" JSONB;
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "areaApprovalRule" "AreaApprovalRule" DEFAULT 'AREA_AVERAGE';
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "areaCalculationType" "AreaCalculationType" DEFAULT 'WEIGHTED';
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "areaFailIfAnyFails" BOOLEAN DEFAULT false;
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "areaRecoveryRule" "AreaRecoveryRule" DEFAULT 'INDIVIDUAL_SUBJECT';
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "gradingConfig" JSONB;
ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "periodsConfig" JSONB;
