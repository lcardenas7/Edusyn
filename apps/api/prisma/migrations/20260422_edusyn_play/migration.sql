-- Edusyn Play: Modo Docente Personal + Invitados (Kahoot/Nearpod-like)
-- 100% aditivo. Nada destructivo. Seguro para aplicar en producción sin ventana.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. NUEVOS ENUMS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE "InstitutionType" AS ENUM ('SCHOOL', 'UNIVERSITY', 'PERSONAL');
CREATE TYPE "AccountMode"     AS ENUM ('INSTITUTIONAL', 'PERSONAL', 'HYBRID');
CREATE TYPE "GuestMode"       AS ENUM ('DISABLED', 'MIXED', 'GUESTS_ONLY');
CREATE TYPE "LessonPlayMode"  AS ENUM ('SCORM', 'LIVE');

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. COLUMNAS ADITIVAS EN TABLAS EXISTENTES (todas con DEFAULT)
-- ═══════════════════════════════════════════════════════════════════════════

-- Institution
ALTER TABLE "Institution"
  ADD COLUMN "type"        "InstitutionType" NOT NULL DEFAULT 'SCHOOL',
  ADD COLUMN "isHidden"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ownerUserId" TEXT;

-- User
ALTER TABLE "User"
  ADD COLUMN "accountMode" "AccountMode" NOT NULL DEFAULT 'INSTITUTIONAL';

-- Classroom
ALTER TABLE "Classroom"
  ADD COLUMN "ownerUserId" TEXT,
  ADD COLUMN "isPersonal"  BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Classroom_ownerUserId_idx" ON "Classroom"("ownerUserId");
CREATE INDEX "Classroom_isPersonal_idx"  ON "Classroom"("isPersonal");

-- LiveSession
ALTER TABLE "LiveSession"
  ADD COLUMN "joinCode"    TEXT,
  ADD COLUMN "guestMode"   "GuestMode" NOT NULL DEFAULT 'DISABLED',
  ADD COLUMN "publicUrl"   TEXT,
  ADD COLUMN "guestsCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "LiveSession_joinCode_key" ON "LiveSession"("joinCode");
CREATE INDEX "LiveSession_joinCode_idx" ON "LiveSession"("joinCode");

-- Lesson
ALTER TABLE "Lesson"
  ADD COLUMN "playMode" "LessonPlayMode" NOT NULL DEFAULT 'SCORM';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. TABLAS NUEVAS
-- ═══════════════════════════════════════════════════════════════════════════

-- Invitados (sin cuenta) que entraron con código
CREATE TABLE "LiveSessionGuest" (
  "id"              TEXT NOT NULL,
  "sessionId"       TEXT NOT NULL,
  "sessionKind"     TEXT NOT NULL DEFAULT 'QUIZ',
  "nickname"        TEXT NOT NULL,
  "avatarEmoji"     TEXT,
  "guestToken"      TEXT NOT NULL,
  "ipHash"          TEXT,
  "userAgent"       TEXT,
  "fingerprint"     TEXT,
  "score"           INTEGER NOT NULL DEFAULT 0,
  "correctAnswers"  INTEGER NOT NULL DEFAULT 0,
  "totalAnswers"    INTEGER NOT NULL DEFAULT 0,
  "finalRank"       INTEGER,
  "percent"         DOUBLE PRECISION,
  "joinedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"      TIMESTAMP(3),
  "claimedByUserId" TEXT,
  "claimedAt"       TIMESTAMP(3),
  CONSTRAINT "LiveSessionGuest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LiveSessionGuest_guestToken_key" ON "LiveSessionGuest"("guestToken");
CREATE UNIQUE INDEX "LiveSessionGuest_sessionId_nickname_key" ON "LiveSessionGuest"("sessionId", "nickname");
CREATE INDEX "LiveSessionGuest_sessionId_idx" ON "LiveSessionGuest"("sessionId");
CREATE INDEX "LiveSessionGuest_guestToken_idx" ON "LiveSessionGuest"("guestToken");

-- Nota: LiveSessionGuest.sessionId es POLIMÓRFICO (puede apuntar a LiveSession.id
-- o LiveLessonSession.id segun sessionKind). No se crea FK formal; la integridad
-- se mantiene en la capa de aplicación (cascada manual al eliminar sesiones).

-- Respuestas de invitados
CREATE TABLE "LiveSessionGuestAnswer" (
  "id"             TEXT NOT NULL,
  "guestId"        TEXT NOT NULL,
  "questionId"     TEXT,
  "slideId"        TEXT,
  "selectedOption" TEXT,
  "answerText"     TEXT,
  "isCorrect"      BOOLEAN NOT NULL DEFAULT false,
  "pointsAwarded"  INTEGER NOT NULL DEFAULT 0,
  "timeTakenMs"    INTEGER,
  "answeredAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveSessionGuestAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveSessionGuestAnswer_guestId_idx"    ON "LiveSessionGuestAnswer"("guestId");
CREATE INDEX "LiveSessionGuestAnswer_questionId_idx" ON "LiveSessionGuestAnswer"("questionId");
CREATE INDEX "LiveSessionGuestAnswer_slideId_idx"    ON "LiveSessionGuestAnswer"("slideId");

ALTER TABLE "LiveSessionGuestAnswer"
  ADD CONSTRAINT "LiveSessionGuestAnswer_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "LiveSessionGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sesiones de Lección Live (presentación sincronizada)
CREATE TABLE "LiveLessonSession" (
  "id"                TEXT NOT NULL,
  "lessonId"          TEXT NOT NULL,
  "activityId"        TEXT NOT NULL,
  "classroomId"       TEXT NOT NULL,
  "teacherId"         TEXT NOT NULL,
  "joinCode"          TEXT NOT NULL,
  "guestMode"         "GuestMode" NOT NULL DEFAULT 'GUESTS_ONLY',
  "currentSlideIndex" INTEGER NOT NULL DEFAULT 0,
  "status"            TEXT NOT NULL DEFAULT 'LOBBY',
  "publicUrl"         TEXT,
  "guestsCount"       INTEGER NOT NULL DEFAULT 0,
  "startedAt"         TIMESTAMP(3),
  "endedAt"           TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveLessonSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LiveLessonSession_joinCode_key" ON "LiveLessonSession"("joinCode");
CREATE INDEX "LiveLessonSession_joinCode_idx"    ON "LiveLessonSession"("joinCode");
CREATE INDEX "LiveLessonSession_activityId_idx"  ON "LiveLessonSession"("activityId");
CREATE INDEX "LiveLessonSession_classroomId_idx" ON "LiveLessonSession"("classroomId");
CREATE INDEX "LiveLessonSession_teacherId_idx"   ON "LiveLessonSession"("teacherId");

ALTER TABLE "LiveLessonSession"
  ADD CONSTRAINT "LiveLessonSession_lessonId_fkey"
  FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reacciones en vivo (💡 🤔 ❤ 👏)
CREATE TABLE "LiveSessionReaction" (
  "id"         TEXT NOT NULL,
  "sessionId"  TEXT NOT NULL,
  "slideIndex" INTEGER,
  "guestId"    TEXT,
  "emoji"      TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LiveSessionReaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveSessionReaction_sessionId_slideIndex_idx" ON "LiveSessionReaction"("sessionId", "slideIndex");
CREATE INDEX "LiveSessionReaction_guestId_idx" ON "LiveSessionReaction"("guestId");

ALTER TABLE "LiveSessionReaction"
  ADD CONSTRAINT "LiveSessionReaction_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "LiveSessionGuest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Conversiones a nota (histórico para reimprimir planilla)
CREATE TABLE "GuestGradeConversion" (
  "id"              TEXT NOT NULL,
  "sessionId"       TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "maxScore"        DOUBLE PRECISION NOT NULL DEFAULT 5,
  "minScore"        DOUBLE PRECISION NOT NULL DEFAULT 1,
  "passingScore"    DOUBLE PRECISION NOT NULL DEFAULT 3,
  "method"          TEXT NOT NULL DEFAULT 'PROPORTIONAL',
  "payload"         JSONB NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestGradeConversion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuestGradeConversion_sessionId_idx"       ON "GuestGradeConversion"("sessionId");
CREATE INDEX "GuestGradeConversion_createdByUserId_idx" ON "GuestGradeConversion"("createdByUserId");

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. SEED IDEMPOTENTE: Institución única "Edusyn Play" (workspace compartido)
-- ═══════════════════════════════════════════════════════════════════════════
-- Solo se inserta si no existe. Slug estable: 'edusyn-personal'.

INSERT INTO "Institution" (
  "id", "name", "slug", "type", "isHidden", "status",
  "createdAt", "updatedAt"
)
SELECT
  'edusyn-personal-workspace',
  'Edusyn Play',
  'edusyn-personal',
  'PERSONAL',
  true,
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Institution" WHERE "slug" = 'edusyn-personal'
);
