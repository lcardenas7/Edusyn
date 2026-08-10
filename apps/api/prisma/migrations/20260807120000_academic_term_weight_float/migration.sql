-- Períodos con pesos decimales: 3 períodos de 33.33% no se pueden representar con
-- Int (se truncaban a 33 y la suma nunca daba 100). weightPercentage pasa a Float.
-- Aditiva y no destructiva: los valores enteros existentes se convierten a double.

ALTER TABLE "AcademicTerm"
  ALTER COLUMN "weightPercentage" TYPE DOUBLE PRECISION USING "weightPercentage"::double precision;
