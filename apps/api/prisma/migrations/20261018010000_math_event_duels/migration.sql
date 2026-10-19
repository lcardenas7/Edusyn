CREATE TYPE "MathEventStatus" AS ENUM ('DRAFT','PUBLISHED','CLOSED');
CREATE TYPE "MathEventDuelStatus" AS ENUM ('INVITED','ACTIVE','COMPLETED','DECLINED','EXPIRED');
CREATE TABLE "MathEvent" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "status" "MathEventStatus" NOT NULL DEFAULT 'DRAFT',
  "startsAt" TIMESTAMP(3) NOT NULL, "endsAt" TIMESTAMP(3) NOT NULL,
  "eligibleGrades" JSONB NOT NULL, "dailyMatchLimit" INTEGER NOT NULL DEFAULT 25,
  "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "MathEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MathEventParticipant" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "eventId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL, "avatarCode" TEXT NOT NULL DEFAULT 'star',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "available" BOOLEAN NOT NULL DEFAULT false,
  "presenceUntil" TIMESTAMP(3), CONSTRAINT "MathEventParticipant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MathEventQuestion" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "eventId" TEXT NOT NULL,
  "sourceItemId" TEXT, "code" TEXT, "type" "QuestionType" NOT NULL, "text" TEXT NOT NULL,
  "options" JSONB NOT NULL, "correctAnswer" TEXT NOT NULL, "explanation" TEXT,
  "topic" TEXT, "conceptKey" TEXT NOT NULL, "difficulty" TEXT NOT NULL DEFAULT 'INTERMEDIATE',
  CONSTRAINT "MathEventQuestion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MathEventDuel" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "eventId" TEXT NOT NULL,
  "inviterEnrollmentId" TEXT NOT NULL, "inviteeEnrollmentId" TEXT NOT NULL,
  "pairKey" TEXT NOT NULL, "mode" TEXT NOT NULL DEFAULT 'DIRECT',
  "status" "MathEventDuelStatus" NOT NULL DEFAULT 'INVITED', "questions" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), CONSTRAINT "MathEventDuel_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MathEventDuelAnswer" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "duelId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL, "ordinal" INTEGER NOT NULL, "answer" TEXT NOT NULL,
  "isCorrect" BOOLEAN NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MathEventDuelAnswer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MathEventQuestionSeen" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "eventId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL, "questionId" TEXT NOT NULL, "conceptKey" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MathEventQuestionSeen_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MathEventPushSubscription" (
  "id" TEXT NOT NULL, "institutionId" TEXT NOT NULL, "eventId" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL, "endpoint" TEXT NOT NULL, "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "MathEventPushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MathEvent_institutionId_status_startsAt_endsAt_idx" ON "MathEvent"("institutionId","status","startsAt","endsAt");
CREATE UNIQUE INDEX "MathEventParticipant_eventId_enrollmentId_key" ON "MathEventParticipant"("eventId","enrollmentId");
CREATE INDEX "MathEventParticipant_institutionId_eventId_available_presenceUntil_idx" ON "MathEventParticipant"("institutionId","eventId","available","presenceUntil");
CREATE UNIQUE INDEX "MathEventQuestion_eventId_code_key" ON "MathEventQuestion"("eventId","code");
CREATE INDEX "MathEventQuestion_institutionId_eventId_topic_difficulty_idx" ON "MathEventQuestion"("institutionId","eventId","topic","difficulty");
CREATE INDEX "MathEventQuestion_eventId_conceptKey_idx" ON "MathEventQuestion"("eventId","conceptKey");
CREATE INDEX "MathEventDuel_institutionId_eventId_status_expiresAt_idx" ON "MathEventDuel"("institutionId","eventId","status","expiresAt");
CREATE INDEX "MathEventDuel_institutionId_inviterEnrollmentId_createdAt_idx" ON "MathEventDuel"("institutionId","inviterEnrollmentId","createdAt");
CREATE INDEX "MathEventDuel_institutionId_inviteeEnrollmentId_createdAt_idx" ON "MathEventDuel"("institutionId","inviteeEnrollmentId","createdAt");
CREATE UNIQUE INDEX "MathEventDuel_active_pair_key" ON "MathEventDuel"("institutionId","eventId","pairKey") WHERE "status" IN ('INVITED','ACTIVE');
CREATE UNIQUE INDEX "MathEventDuelAnswer_duelId_enrollmentId_ordinal_key" ON "MathEventDuelAnswer"("duelId","enrollmentId","ordinal");
CREATE INDEX "MathEventDuelAnswer_institutionId_enrollmentId_idx" ON "MathEventDuelAnswer"("institutionId","enrollmentId");
CREATE UNIQUE INDEX "MathEventQuestionSeen_eventId_enrollmentId_questionId_key" ON "MathEventQuestionSeen"("eventId","enrollmentId","questionId");
CREATE INDEX "MathEventQuestionSeen_eventId_enrollmentId_lastSeenAt_idx" ON "MathEventQuestionSeen"("eventId","enrollmentId","lastSeenAt");
CREATE INDEX "MathEventQuestionSeen_eventId_enrollmentId_conceptKey_idx" ON "MathEventQuestionSeen"("eventId","enrollmentId","conceptKey");
CREATE UNIQUE INDEX "MathEventPushSubscription_eventId_endpoint_key" ON "MathEventPushSubscription"("eventId","endpoint");
CREATE INDEX "MathEventPushSubscription_institutionId_eventId_enrollmentId_idx" ON "MathEventPushSubscription"("institutionId","eventId","enrollmentId");
ALTER TABLE "MathEventParticipant" ADD CONSTRAINT "MathEventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MathEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MathEventParticipant" ADD CONSTRAINT "MathEventParticipant_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MathEventQuestion" ADD CONSTRAINT "MathEventQuestion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MathEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MathEventDuel" ADD CONSTRAINT "MathEventDuel_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MathEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MathEventDuel" ADD CONSTRAINT "MathEventDuel_inviterEnrollmentId_fkey" FOREIGN KEY ("inviterEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MathEventDuel" ADD CONSTRAINT "MathEventDuel_inviteeEnrollmentId_fkey" FOREIGN KEY ("inviteeEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MathEventDuelAnswer" ADD CONSTRAINT "MathEventDuelAnswer_duelId_fkey" FOREIGN KEY ("duelId") REFERENCES "MathEventDuel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MathEventDuelAnswer" ADD CONSTRAINT "MathEventDuelAnswer_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MathEventQuestionSeen" ADD CONSTRAINT "MathEventQuestionSeen_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MathEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MathEventQuestionSeen" ADD CONSTRAINT "MathEventQuestionSeen_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MathEventPushSubscription" ADD CONSTRAINT "MathEventPushSubscription_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MathEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MathEventPushSubscription" ADD CONSTRAINT "MathEventPushSubscription_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
DO $$ DECLARE tab TEXT; BEGIN
 IF EXISTS (SELECT 1 FROM pg_proc WHERE proname='current_institution_id') THEN
  FOREACH tab IN ARRAY ARRAY['MathEvent','MathEventParticipant','MathEventQuestion','MathEventDuel','MathEventDuelAnswer','MathEventQuestionSeen','MathEventPushSubscription'] LOOP
   EXECUTE format('ALTER TABLE "%s" ENABLE ROW LEVEL SECURITY', tab);
   EXECUTE format('ALTER TABLE "%s" FORCE ROW LEVEL SECURITY', tab);
   EXECUTE format('CREATE POLICY tenant_isolation ON "%s" FOR ALL USING ("institutionId" = current_institution_id()) WITH CHECK ("institutionId" = current_institution_id())', tab);
  END LOOP;
 END IF;
END $$;
