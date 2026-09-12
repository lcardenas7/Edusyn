# Plan medido de blindaje de Classroom

Fecha: 2026-09-12. Estado: **0/98 rutas cerradas**. Este documento organiza el trabajo; no acredita aislamiento.

## Medición

Classroom concentra las 98 rutas en un controlador: 31 GET, 32 POST, 24 PUT y 11 DELETE. El
controlador delega 67 rutas en `ClassroomService`, 19 en `LessonService` y 12 en
`AttitudinalService`. Los servicios tienen aproximadamente 3.418, 929 y 768 líneas. Los servicios
de gating y completion no exponen rutas, pero participan en actividades, entregas y progreso.

Las 98 rutas continúan como `pending-audit`: 69 llaman al helper privado `resolveCtx`, 29 ni
siquiera lo llaman y ninguna tiene la resolución directa que exige el contrato. Solo siete
transportan hoy el `institutionId` al servicio; las otras 62 que resuelven contexto lo descartan y
delegan únicamente con el usuario o un id de recurso. La institución activa es imprescindible
porque un mismo docente puede estar ligado a más de un colegio.

El cron de publicación programada no cuenta como ruta y ejecuta un `updateMany` global. También
debe quedar aislado antes de declarar cerrado el módulo.

## Partición exhaustiva

| Unidad | Rutas | Riesgo principal |
|---|---:|---|
| Aulas y membresía | 6 | detalle, estudiantes y asignaciones |
| Secciones | 3 | estructura y borrados |
| Materiales | 3 | enlaces de archivos |
| Anuncios | 4 | adjuntos y copia |
| Actividades | 11 | publicación, dependencias y destinatarios |
| Entregas | 9 | contenido, archivos, feedback y notas |
| Contextos | 4 | contenido de preguntas |
| Preguntas | 6 | respuestas correctas e importación |
| Quiz e ICFES | 6 | intentos, respuestas y resultados |
| Foro | 6 | PII, autoría y moderación |
| Copias y duplicados | 5 | mezcla de origen/destino |
| Sincronización de planilla | 4 | escritura de notas y período |
| Rúbricas actitudinales | 6 | catálogo institucional |
| Evaluación actitudinal | 6 | pares, resultados y planilla |
| Autoría de lecciones | 10 | contenido, versiones, IA y recuperación |
| Slides | 5 | contenido y multimedia |
| Progreso de lecciones | 4 | progreso individual y grupal |
| **Total** | **98** | |

## Defectos confirmados para abrir el trabajo

- `GET /classrooms/:id` carga el aula por id sin comprobar acceso al aula.
- `GET /classrooms/:id/activities` confía en `?role=student`; si el cliente omite el parámetro
  puede entrar por la rama docente y ver actividades no publicadas y conteos internos.
- Las sincronizaciones de nota necesitan comprobar aula, asignación, período, año, grupo,
  matrícula y actor dentro de la misma institución.
- Las copias comprueban principalmente `teacherId`, pero no que origen, destino y actor usen la
  misma institución. Replican contenido de muchas tablas y deben ser el último bloque.
- Varias rutas de lecciones y actitudinales buscan la matrícula activa más reciente por usuario sin
  institución ni compatibilidad con el aula solicitada.
- Preguntas y contextos requieren separar lo que puede leer un estudiante de las respuestas que
  solo puede ver el docente.

## Orden de cierre

1. Crear un acceso institucional compartido con actor `{ userId, institutionId }`, cadenas aula,
   actividad, entrega, lección, matrícula y rúbrica, y fixture A/B. No retirar excepciones todavía.
2. Cerrar aulas + actividades: **17/98**.
3. Cerrar entregas + quiz + progreso: **36/98** acumuladas.
4. Cerrar planilla + rúbricas + actitudinal: **52/98** acumuladas.
5. Cerrar secciones, materiales, anuncios, contextos, preguntas, autoría y slides: **87/98**.
6. Cerrar foro: **93/98**.
7. Cerrar copias: **98/98**.
8. Auditar el cron; luego ejecutar PostgreSQL sintético/RLS como evidencia separada.

Cada unidad requiere resolución directa en sus rutas, institución pasada al servicio, relaciones
completas, guarda y escritura con el mismo `tx`, cruces A→B/B→A, ids secundarios cruzados, cero
efectos y HTTP real de Nest. El estado se expresa siempre como `n/98`; separar archivos o terminar
un servicio no permite decir “Classroom cerrado”.

El primer tramo quedó delegado de forma encadenada en
`docs/ENCARGO_CLAUDE_CLASSROOM_BLOQUE_1.md`: Claude lo inicia en un worktree nuevo solo después de
que Observer esté integrado en `origin/staging`.

## Pruebas existentes

El módulo tenía 16 pruebas antes de este plan: dos de copia funcional, dos de servicio y doce del
grafo puro. No había laboratorio A/B, pruebas HTTP del controlador, membresía, notas, entregas,
archivos, lecciones, actitudinal ni cron.
