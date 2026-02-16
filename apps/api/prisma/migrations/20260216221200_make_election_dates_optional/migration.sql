-- Make election process date fields optional (nullable)
ALTER TABLE "ElectionProcess" ALTER COLUMN "registrationStart" DROP NOT NULL;
ALTER TABLE "ElectionProcess" ALTER COLUMN "registrationEnd" DROP NOT NULL;
ALTER TABLE "ElectionProcess" ALTER COLUMN "campaignStart" DROP NOT NULL;
ALTER TABLE "ElectionProcess" ALTER COLUMN "campaignEnd" DROP NOT NULL;
ALTER TABLE "ElectionProcess" ALTER COLUMN "votingStart" DROP NOT NULL;
ALTER TABLE "ElectionProcess" ALTER COLUMN "votingEnd" DROP NOT NULL;
