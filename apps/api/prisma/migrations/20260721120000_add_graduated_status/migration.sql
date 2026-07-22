-- YC-2: estado y evento de GRADUACIÓN al cierre de año (último grado aprobado).
-- Aditivo y no destructivo. En Postgres 12+ ADD VALUE puede ejecutarse en
-- transacción; el nuevo valor no puede USARSE en la misma transacción que lo crea
-- (aquí solo se declara, el uso ocurre en runtime posterior).

ALTER TYPE "EnrollmentStatus" ADD VALUE IF NOT EXISTS 'GRADUATED';
ALTER TYPE "EnrollmentEventType" ADD VALUE IF NOT EXISTS 'GRADUATED';
