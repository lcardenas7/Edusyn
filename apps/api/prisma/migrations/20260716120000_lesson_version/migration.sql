-- Snapshots de la lección para autoguardado, recuperación e historial (Motor de
-- Lecciones, Prioridad 1). 100% aditivo. Sin institutionId (se scopea vía Lesson).

CREATE TYPE "LessonVersionKind" AS ENUM ('AUTOSAVE', 'MANUAL', 'PUBLISH');

CREATE TABLE "LessonVersion" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "kind" "LessonVersionKind" NOT NULL DEFAULT 'AUTOSAVE',
    "label" TEXT,
    "snapshot" JSONB NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LessonVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LessonVersion_lessonId_createdAt_idx" ON "LessonVersion"("lessonId", "createdAt");

ALTER TABLE "LessonVersion" ADD CONSTRAINT "LessonVersion_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
