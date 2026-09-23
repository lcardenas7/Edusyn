-- Avisos de aula con destino: el estudiante recibe "hay una actividad nueva" y puede ir
-- directo a ella, en vez de tener que buscarla dentro del aula.
-- Aditiva: las tres columnas son opcionales y los mensajes existentes se quedan como están.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "link" TEXT,
                      ADD COLUMN "origin" TEXT,
                      ADD COLUMN "sourceKey" TEXT;

-- CreateIndex
-- Único para que despublicar y volver a publicar la misma actividad no avise dos veces.
CREATE UNIQUE INDEX "Message_sourceKey_key" ON "Message"("sourceKey");
