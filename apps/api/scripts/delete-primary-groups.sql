-- Eliminar grupos de primaria (Transición, Primero, Segundo, Tercero, Cuarto, Quinto)
DELETE FROM "Group" 
WHERE "gradeId" IN (
  SELECT id FROM "Grade" 
  WHERE name IN ('Transición', 'Primero', 'Segundo', 'Tercero', 'Cuarto', 'Quinto')
);

-- Verificar grupos restantes
SELECT g.name, gr.name as grade_name, s.name as shift_name 
FROM "Group" g 
LEFT JOIN "Grade" gr ON g."gradeId" = gr.id 
LEFT JOIN "Shift" s ON g."shiftId" = s.id 
ORDER BY gr.number, g.name;
