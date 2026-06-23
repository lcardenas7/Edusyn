-- Ampliar precisión de columnas de puntaje para soportar valores tipo Kahoot (hasta 99999.99).
-- Cambio puramente aditivo: se incrementa la precisión sin perder datos existentes.

ALTER TABLE "ActivityQuestion"   ALTER COLUMN "points"        SET DATA TYPE DECIMAL(7,2);
ALTER TABLE "ClassroomActivity"  ALTER COLUMN "maxScore"      SET DATA TYPE DECIMAL(7,2);
ALTER TABLE "ActivitySubmission" ALTER COLUMN "score"         SET DATA TYPE DECIMAL(7,2);
ALTER TABLE "QuestionAnswer"     ALTER COLUMN "pointsEarned"  SET DATA TYPE DECIMAL(7,2);
