-- Sistema de dependencias de actividades (grafo de prerrequisitos del Aula Virtual).
-- Aditiva y retrocompatible: sin reglas, el aula funciona igual que hoy.

-- CreateEnum
-- El enum vivía en schema.prisma pero nunca se migró a la BD; se crea con guard
-- idempotente por si algún entorno ya lo tuviera creado manualmente.
DO $$ BEGIN
  CREATE TYPE "ActivityUnlockCondition" AS ENUM ('SUBMITTED', 'GRADED', 'MIN_SCORE', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE "ActivityDependency" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,
    "condition" "ActivityUnlockCondition" NOT NULL DEFAULT 'SUBMITTED',
    "minScore" DECIMAL(7,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityDependency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityDependency_activityId_prerequisiteId_key" ON "ActivityDependency"("activityId", "prerequisiteId");
CREATE INDEX "ActivityDependency_activityId_idx" ON "ActivityDependency"("activityId");
CREATE INDEX "ActivityDependency_prerequisiteId_idx" ON "ActivityDependency"("prerequisiteId");

-- AddForeignKey (Cascade en ambos extremos: borrar prerrequisito borra el edge => fail-open)
ALTER TABLE "ActivityDependency" ADD CONSTRAINT "ActivityDependency_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ClassroomActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityDependency" ADD CONSTRAINT "ActivityDependency_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "ClassroomActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
