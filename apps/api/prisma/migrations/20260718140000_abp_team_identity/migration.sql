-- Etapa 3 · Fundación de equipo: los estudiantes eligen nombre + avatar; el cambio de
-- nombre requiere aprobación del docente. Todo aditivo y seguro.

-- Estado de identidad del equipo.
CREATE TYPE "AbpTeamIdentityState" AS ENUM ('DRAFT', 'CONFIRMED', 'RENAME_PENDING');

ALTER TABLE "AbpTeam"
  ADD COLUMN "identityState" "AbpTeamIdentityState" NOT NULL DEFAULT 'CONFIRMED',
  ADD COLUMN "proposedName" TEXT;

-- Avatar elegido por cada estudiante (de un set curado).
ALTER TABLE "AbpTeamMember" ADD COLUMN "avatarId" TEXT;
