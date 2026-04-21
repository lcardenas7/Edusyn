-- Per-question time limit (seconds). NULL → fallback a timeLimitOverride de la sesión.
ALTER TABLE "ActivityQuestion"
  ADD COLUMN "timeLimitSeconds" INTEGER;

-- Participantes: persiste avatar + tracking de conexión (sobrevive a reinicios/resets)
CREATE TABLE "LiveSessionParticipant" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "studentEnrollmentId" TEXT NOT NULL,
  "avatarId" TEXT,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LiveSessionParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LiveSessionParticipant_sessionId_studentEnrollmentId_key"
  ON "LiveSessionParticipant"("sessionId", "studentEnrollmentId");

CREATE INDEX "LiveSessionParticipant_sessionId_idx"
  ON "LiveSessionParticipant"("sessionId");

ALTER TABLE "LiveSessionParticipant"
  ADD CONSTRAINT "LiveSessionParticipant_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveSessionParticipant"
  ADD CONSTRAINT "LiveSessionParticipant_studentEnrollmentId_fkey"
  FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
