# Bancos de preguntas — reconciliación selectiva

Fecha: 2026-10-20. Candidato separado en `codex/bancos-produccion-20261020`, sobre `8b4d6b52` (lote de dependencias preparado, aún pendiente de promoción al crear esta rama).

## Problema y comportamiento resultante

Main contenía ocho bancos de 6.º, ocho de 7.º y uno de Historia de 8.º, pero `officialCatalog` e `importOfficial` reconocían exclusivamente el grado sexto. Por eso diez pruebas existentes fallaban, aunque buena parte de los contenidos sí estaba incluida en el código.

Se reutiliza la implementación de staging: `deriveGradeNumber` reconoce el grado del aula y la compatibilidad admite su grado o hasta dos grados inferiores. Nunca ofrece bancos de grados superiores. La importación conserva el grado destino y el ámbito de la institución/aula autenticadas; no cambia las guardas ni el servicio de acceso institucional.

Se añaden únicamente los catálogos de Arte/Cultura y Ciencia/Naturaleza de 8.º presentes en staging, con 150 preguntas cada uno. Comparación programática por `catalogId` y JSON completo confirma que los **17 bancos anteriores se conservan sin cambios**. Resultado: 19 bancos y 2.850 preguntas, de los cuales 300 son las adiciones. No se importan ni se modifican colecciones de ninguna institución en la base de datos.

## Alcance técnico

- `question-bank.service.ts`: helper de compatibilidad compartido con staging; catálogo e importación usan la misma regla.
- `official-duel-banks.ts`: solo adiciones de los dos bancos. El diff no elimina líneas del catálogo anterior.
- No hay migración, cambios de frontend, cambios de esquema, publicación automática de cuestionarios ni modificación de puntuaciones.
- Las dependencias locales se reutilizan desde el worktree del lote de seguridad mediante junction dentro del mismo workspace; no se regenera Prisma a través del enlace ni se alteran sus fuentes.

## Evidencia y límites

Las 27 pruebas existentes de `question-bank.service.spec.ts` pasan después del cambio. El estado previo documentado tenía diez fallos en esa misma suite; no se editan ni eliminan pruebas para conseguir el resultado.

Verificación completa posterior: **77 suites / 1.453 pruebas API aprobadas, cero fallos**, con reporte `coverage/bank-reconciliation-api.json`; tipos API y web aprobados. La primera ejecución completa también aprobó los casos, pero falló al guardar el JSON porque faltaba la carpeta; se creó el directorio y la repetición terminó correctamente con `success: true`. No se atribuye al código ese fallo de escritura del reporte.

La preparación no implica despliegue. El lote permanece separado hasta comprobar tipos/suite general y la publicación previa de las dependencias. Las rutas nuevas de banco y Duelos siguen formando parte del inventario de aislamiento HTTP pendiente; estas pruebas de servicio no acreditan cierre multi-tenant global ni RLS.
