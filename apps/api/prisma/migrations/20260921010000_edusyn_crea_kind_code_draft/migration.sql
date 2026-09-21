-- Edusyn Crea: tipo de proyecto (página web o aplicación) y borrador del código por equipo.
-- Cambio aditivo: los proyectos existentes quedan como página web y los equipos sin borrador.
-- El borrador es trabajo en curso recuperable; no es una versión ni una evidencia.
CREATE TYPE "ConstruyeProjectKind" AS ENUM ('WEB', 'APP');

ALTER TABLE "ConstruyeProject"
  ADD COLUMN "kind" "ConstruyeProjectKind" NOT NULL DEFAULT 'WEB';

ALTER TABLE "ConstruyeTeam"
  ADD COLUMN "codeDraft" JSONB,
  ADD COLUMN "codeDraftRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "codeDraftUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "codeDraftEnrollmentId" TEXT;
