ALTER TABLE "MathEvent" ADD COLUMN "showCorrectAnswers" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showExplanations" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "MathEventReaction" (
  "id" TEXT NOT NULL,
  "institutionId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "senderEnrollmentId" TEXT NOT NULL,
  "recipientEnrollmentId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MathEventReaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MathEventReaction_kind_check" CHECK ("kind" IN ('APPLAUSE','BRILLIANT','FAIR_PLAY','KEEP_GOING')),
  CONSTRAINT "MathEventReaction_no_self_check" CHECK ("senderEnrollmentId" <> "recipientEnrollmentId")
);
CREATE UNIQUE INDEX "MathEventReaction_sender_recipient_key"
  ON "MathEventReaction"("eventId", "senderEnrollmentId", "recipientEnrollmentId");
CREATE INDEX "MathEventReaction_recipient_idx"
  ON "MathEventReaction"("institutionId", "eventId", "recipientEnrollmentId");
ALTER TABLE "MathEventReaction" ADD CONSTRAINT "MathEventReaction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MathEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MathEventReaction" ADD CONSTRAINT "MathEventReaction_senderEnrollmentId_fkey" FOREIGN KEY ("senderEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MathEventReaction" ADD CONSTRAINT "MathEventReaction_recipientEnrollmentId_fkey" FOREIGN KEY ("recipientEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
