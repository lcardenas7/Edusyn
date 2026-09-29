-- Corrige solamente copias oficiales aún intactas de los 3 bancos afectados.
-- Se condiciona por catálogo, enunciado y respuesta anterior para respetar ediciones docentes.
UPDATE "QuestionBankItem" AS item
SET "correctAnswer" = CASE WHEN item."correctAnswer" LIKE 'Falso%' THEN 'Falso' ELSE 'Verdadero' END, "updatedAt" = NOW()
FROM "QuestionBankCollection" AS collection
WHERE item."collectionId" = collection."id"
  AND collection."officialCatalogId" = 'edusyn-geografia-grade-6-v1'
  AND item."type" = 'TRUE_FALSE'
  AND item."correctAnswer" IN ('Verdadero.  ', 'Falso.  ');

UPDATE "QuestionBankItem" AS item
SET "text" = '¿Qué parte de una noticia resume el hecho principal en pocas palabras?',
    "options" = '["Pie de foto", "Intertítulo", "Epígrafe", "Titular"]'::jsonb,
    "correctAnswer" = 'Titular',
    "explanation" = 'El titular presenta de forma breve el hecho o tema central de una noticia.',
    "updatedAt" = NOW()
FROM "QuestionBankCollection" AS collection
WHERE item."collectionId" = collection."id"
  AND collection."officialCatalogId" = 'edusyn-lengua-literatura-grade-6-v1'
  AND item."text" = '¿Cuál opción escribe correctamente el nombre de una ciudad colombiana?'
  AND item."options" = '["medellín", "Medellin", "MEDELLÍN ciudad", "Medellín"]'::jsonb
  AND item."correctAnswer" = 'Medellín';

UPDATE "QuestionBankItem" AS item
SET "text" = 'Una reseña califica una película como excelente, pero no explica por qué. ¿Qué le falta para sostener esa opinión?',
    "options" = '["Un título más llamativo", "Más nombres de personajes", "Un resumen del final", "Razones o evidencias"]'::jsonb,
    "correctAnswer" = 'Razones o evidencias',
    "explanation" = 'Una opinión se vuelve más convincente cuando se acompaña de razones o evidencias pertinentes.',
    "updatedAt" = NOW()
FROM "QuestionBankCollection" AS collection
WHERE item."collectionId" = collection."id"
  AND collection."officialCatalogId" = 'edusyn-lengua-literatura-grade-7-v1'
  AND item."text" = '¿Cuál opción escribe correctamente una pregunta indirecta dentro de una afirmación?'
  AND item."options" = '["No sé ¿dónde queda la biblioteca?", "No sé donde queda la biblioteca.", "No sé: dónde queda la biblioteca?", "No sé dónde queda la biblioteca."]'::jsonb
  AND item."correctAnswer" = 'No sé dónde queda la biblioteca.';

UPDATE "QuestionBankItem" AS item
SET "text" = 'En el programa de una obra, ¿qué sección indica quién interpreta cada personaje?',
    "options" = '["Acotación", "Escenografía", "Diálogo", "Reparto"]'::jsonb,
    "correctAnswer" = 'Reparto',
    "explanation" = 'El reparto relaciona a los intérpretes con los personajes que representan.',
    "updatedAt" = NOW()
FROM "QuestionBankCollection" AS collection
WHERE item."collectionId" = collection."id"
  AND collection."officialCatalogId" = 'edusyn-lengua-literatura-grade-7-v1'
  AND item."text" = '¿Cuál opción escribe correctamente el nombre de una ciudad colombiana?'
  AND item."options" = '["medellín", "MEDELLÍN?", "MedelliN", "Medellín"]'::jsonb
  AND item."correctAnswer" = 'Medellín';
