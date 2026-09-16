-- Edusyn Crea: tarjetas de meta y de salida por sesión en la bitácora del equipo.
-- Aditiva: solo agrega un valor al enum; ninguna fila existente cambia.
ALTER TYPE "ConstruyeJournalType" ADD VALUE IF NOT EXISTS 'SESSION_NOTE';
