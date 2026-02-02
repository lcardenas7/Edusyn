SELECT g.id, g.name, gr.name as grade_name, s.name as shift_name 
FROM "Group" g 
LEFT JOIN "Grade" gr ON g."gradeId" = gr.id 
LEFT JOIN "Shift" s ON g."shiftId" = s.id 
ORDER BY gr.number, g.name;
