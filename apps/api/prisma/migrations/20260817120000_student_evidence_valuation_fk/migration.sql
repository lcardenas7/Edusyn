-- F2 · Integridad estructural de las valoraciones por imprescindible.
--
-- Cierra el vector que produjo la pérdida silenciosa documentada en F1: hasta hoy
-- StudentEvidenceValuation.achievementEvidenceId no tenía clave foránea, así que
-- borrar una evidencia dejaba valoraciones apuntando a un id inexistente sin
-- cascada y sin error.
--
-- RESTRICT, no CASCADE: una evidencia con valoraciones NO puede borrarse. Para
-- sacarla del catálogo existe el retiro lógico (D-12), que conserva la fila y su
-- historia. SET NULL es imposible: la columna es NOT NULL.
--
-- Precondición verificada antes de aplicar: 0 filas huérfanas.
-- Migración ADITIVA y exclusivamente estructural. No crea índices (ya existe
-- StudentEvidenceValuation_achievementEvidenceId_idx). No toca datos.
-- No resuelve el drift de índices preexistente, que queda intacto a propósito.

-- AddForeignKey
ALTER TABLE "StudentEvidenceValuation" ADD CONSTRAINT "StudentEvidenceValuation_achievementEvidenceId_fkey" FOREIGN KEY ("achievementEvidenceId") REFERENCES "AchievementEvidence"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
