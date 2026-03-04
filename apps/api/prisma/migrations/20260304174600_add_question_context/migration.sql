-- CreateTable
CREATE TABLE "QuestionContext" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "title" TEXT,
    "text" TEXT,
    "imageUrl" TEXT,
    "viewPolicy" TEXT NOT NULL DEFAULT 'ALWAYS',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuestionContext_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ActivityQuestion" ADD COLUMN "contextId" TEXT;

-- CreateIndex
CREATE INDEX "QuestionContext_activityId_idx" ON "QuestionContext"("activityId");

-- CreateIndex
CREATE INDEX "ActivityQuestion_contextId_idx" ON "ActivityQuestion"("contextId");

-- AddForeignKey
ALTER TABLE "QuestionContext" ADD CONSTRAINT "QuestionContext_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassroomActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityQuestion" ADD CONSTRAINT "ActivityQuestion_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "QuestionContext"("id") ON DELETE SET NULL ON UPDATE CASCADE;
