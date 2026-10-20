ALTER TABLE "MathEventQuestion"
ADD COLUMN "grade" INTEGER;

CREATE INDEX "MathEventQuestion_eventId_grade_difficulty_idx"
ON "MathEventQuestion"("eventId", "grade", "difficulty");
