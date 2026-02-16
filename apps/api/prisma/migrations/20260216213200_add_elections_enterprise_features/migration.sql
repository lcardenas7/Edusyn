-- Add enterprise features to ElectionProcess
ALTER TABLE "ElectionProcess" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ElectionProcess" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
ALTER TABLE "ElectionProcess" ADD COLUMN IF NOT EXISTS "lockedById" TEXT;
ALTER TABLE "ElectionProcess" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "ElectionProcess" ADD COLUMN IF NOT EXISTS "closedById" TEXT;
ALTER TABLE "ElectionProcess" ADD COLUMN IF NOT EXISTS "closureSignature" TEXT;
ALTER TABLE "ElectionProcess" ADD COLUMN IF NOT EXISTS "finalSnapshot" JSONB;
ALTER TABLE "ElectionProcess" ADD COLUMN IF NOT EXISTS "finalHash" TEXT;

-- Add foreign key constraints for lockedBy and closedBy
ALTER TABLE "ElectionProcess" ADD CONSTRAINT "ElectionProcess_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ElectionProcess" ADD CONSTRAINT "ElectionProcess_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create ElectionAuditLog table
CREATE TABLE IF NOT EXISTS "ElectionAuditLog" (
    "id" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "electionId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorIp" TEXT,
    "payload" JSONB,
    "previousState" JSONB,
    "newState" JSONB,
    "checksum" TEXT NOT NULL,
    "previousLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionAuditLog_pkey" PRIMARY KEY ("id")
);

-- Add indexes for ElectionAuditLog
CREATE INDEX IF NOT EXISTS "ElectionAuditLog_processId_idx" ON "ElectionAuditLog"("processId");
CREATE INDEX IF NOT EXISTS "ElectionAuditLog_electionId_idx" ON "ElectionAuditLog"("electionId");
CREATE INDEX IF NOT EXISTS "ElectionAuditLog_action_idx" ON "ElectionAuditLog"("action");
CREATE INDEX IF NOT EXISTS "ElectionAuditLog_createdAt_idx" ON "ElectionAuditLog"("createdAt");

-- Add foreign key for ElectionAuditLog -> ElectionProcess
ALTER TABLE "ElectionAuditLog" ADD CONSTRAINT "ElectionAuditLog_processId_fkey" FOREIGN KEY ("processId") REFERENCES "ElectionProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create ElectionAuditAction enum type if not exists
DO $$ BEGIN
    CREATE TYPE "ElectionAuditAction" AS ENUM (
        'PROCESS_CREATED',
        'PROCESS_STATUS_CHANGED',
        'PROCESS_LOCKED',
        'PROCESS_CLOSED',
        'CANDIDATE_REGISTERED',
        'CANDIDATE_APPROVED',
        'CANDIDATE_REJECTED',
        'CANDIDATE_UPDATED',
        'VOTE_CAST',
        'VOTE_ATTEMPTED_DUPLICATE',
        'VOTE_ATTEMPTED_INVALID',
        'RESULTS_CALCULATED',
        'RESULTS_SNAPSHOT_CREATED',
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'INTEGRITY_CHECK_FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Alter column to use enum type
ALTER TABLE "ElectionAuditLog" ALTER COLUMN "action" TYPE "ElectionAuditAction" USING "action"::"ElectionAuditAction";
