# Encargo encadenado para Kimi — Classroom Bloque 2, 19 rutas

Fecha: 2026-09-12. Responsable de integración: Astra. **No empezar hasta que Astra integre
Classroom B1 corregido y `docs/ESTADO_BLINDAJE.md` diga 17/98.** La corrección B1 exigida por
`docs/REVISION_ASTRA_CLASSROOM_B1_20260912.md` tiene prioridad absoluta.

## Base y alcance

Después de esa confirmación, ejecuta `git fetch origin staging`, registra el hash, crea un
worktree nuevo desde ese `origin/staging` y rama `codex/blindaje-classroom-b2-kimi`. Lee
`docs/ENCARGO_BLINDAJE_ASTRA.md`, `docs/ESTADO_BLINDAJE.md`,
`docs/PLAN_BLINDAJE_CLASSROOM.md`, la auditoría B1 integrada y este encargo. No apiles B2 sobre la
rama B1. No hagas push a staging; Astra integra.

B2 añade **19 rutas** y deja Classroom **36/98**, todavía parcial:

### Entregas (9)

- `POST /classrooms/activities/:activityId/submit`
- `PUT /classrooms/submissions/:submissionId`
- `GET /classrooms/activities/:activityId/submissions`
- `GET /classrooms/activities/:activityId/my-submission`
- `GET /classrooms/:id/my-grades`
- `PUT /classrooms/submissions/:submissionId/grade`
- `PUT /classrooms/submissions/:submissionId/return`
- `DELETE /classrooms/submissions/:submissionId`
- `POST /classrooms/activities/:activityId/lesson/reset`

### Quiz e ICFES (6)

- `GET /classrooms/submissions/:submissionId/icfes-result`
- `GET /classrooms/activities/:activityId/icfes-results`
- `POST /classrooms/activities/:activityId/start-quiz`
- `PUT /classrooms/submissions/:submissionId/answer`
- `POST /classrooms/submissions/:submissionId/submit-quiz`
- `GET /classrooms/submissions/:submissionId/result`

### Progreso de lecciones (4)

- `GET /classrooms/lessons/:lessonId/my-progress`
- `POST /classrooms/lessons/:lessonId/start`
- `POST /classrooms/lessons/:lessonId/advance`
- `GET /classrooms/lessons/:lessonId/progress`

No tocar otras 62 rutas, cron, planilla, rúbricas, actitudinal, autoría de lecciones, copias,
storage, RLS, PostgreSQL, esquema/migraciones, Inclusión, R1, EduLab ni Aula Clásica. Puedes
extender `ClassroomTenantAccessService` del B1 y los servicios/DTOs necesarios para estas rutas.
Si moverlas a un controlador nuevo preserva las huellas de las 62 restantes, registra ambos
controladores sin colisión ni alias. No cambies los imports del controlador viejo de modo que
rehuelle la deuda restante sin revisión.

## Defectos a cerrar

El código base localiza la “matrícula activa más reciente” por `userId` para quiz y lecciones.
Eso no vincula estudiante, institución, año, grupo, aula y actividad. Resolver la matrícula **desde
la lección/actividad solicitada** y la institución del actor; si no existe una compatible, 404.
Si hay varias compatibles y el contrato no define cuál usar, no elegir por fecha: documentar la
ambigüedad y pedir decisión antes de publicar ese subflujo. Conservar el 404 para recurso ajeno y
el comportamiento funcional legítimo para recurso propio.

Toda entrega, respuesta, nota, intento, resultado, progreso, archivo lógico y reset debe validar:

- actor institucional obtenido por llamada literal directa a
  `requireInstitutionId(this.prisma as any, req)` en cada una de las 19 rutas;
- `submission → activity → classroom → teacherAssignment → institución/año/grupo/sede/grado/
  asignatura/área`;
- `lesson → activity → classroom` y `slide → lesson` cuando se envía `slideId`;
- matrícula del estudiante y `student.institutionId`, `academicYearId`, `groupId`, estado activo;
- propietario de la entrega/quiz/progreso al leer o escribir como estudiante;
- docente asignado al aula al listar, calificar, devolver, borrar, resetear o ver resultados
  colectivos; un coordinador no gana acceso por el rol solo;
- período, escala de calificación y destino de la nota compatibles con el aula, antes de escribir;
- actividad publicada, visible, asignada al estudiante y con intento permitido antes de entregar
  o empezar quiz. No confiar en flags o IDs enviados por el cliente.

No mostrar respuestas correctas, feedback no publicado, resultados de otro estudiante o conteos
docentes en endpoints de estudiante. Una descarga o `fileUrl` no autoriza por sí sola el objeto en
storage; documentar explícitamente la frontera de storage si no hay comprobación de pertenencia
implementable en este bloque.

## Atomicidad

Guarda, lecturas, cambios de estado, respuestas, nota calculada, evidencia/progreso y auditoría de
una operación compuesta usan la misma transacción real y el mismo `tx`. Nada de guarda en cliente
raíz seguida de `update({where:{id}})`. Las escrituras deben acotar la relación institucional y
comprobar `count`; un fallo intermedio revierte todos los cambios y no duplica intentos.

Para `advance`, prueba que una respuesta a slide de otra lección/aula se rechaza antes de guardar
progreso. Para quiz, prueba dos envíos concurrentes del mismo intento sin doble calificación ni
resultados incompatibles. Si la semántica no se puede garantizar sin migración, no la inventes:
entrega el bloqueo exacto con reproducción, dejando B2 parcial.

## Pruebas y entrega

Extiende fixture A/B con mismo docente en A/B, dos estudiantes del mismo grupo, matrículas de
otro grupo/año/colegio, actividad publicada/borrador/restringida, entrega, quiz, pregunta,
respuesta, lección, slide, progreso y filas históricas incoherentes. El doble de Prisma filtra de
verdad relaciones anidadas y materializa `include`; `tx` debe ser distinto del cliente raíz.

Pruebas de servicio y HTTP Nest real para las **19 rutas**, A→B/B→A, 404 antes de lecturas
secundarias o escrituras, cero cambios de A/B, acceso legítimo y estados/aritmética de notas,
respuesta de estudiante sin datos internos, lote mixto atómico, rollback, carrera e ID secundario
cruzado. Mutaciones temporales: quitar institución de la guarda de entrega y quitar
`studentEnrollmentId` del filtro de respuesta; demostrar que caen pruebas y restaurar.

Ejecuta focal B2 + contrato, suite API completa, tipos/build API, suite/tipos web y
`git diff --check`. Solo tras verde retira **exactamente 19 excepciones** en un último commit
exclusivo del JSON. No regeneres la lista. Entrega
`docs/AUDITORIA_AISLAMIENTO_CLASSROOM_B2.md` y `docs/ENTREGA_KIMI_CLASSROOM_B2.md` con matriz ruta
por ruta, defectos, cambios de comportamiento, pruebas/mutaciones, Bloque 4 y “Qué NO cubre”.
No edites `ESTADO_BLINDAJE.md` ni `REGISTRO_DESPLIEGUES.md`.

El resultado máximo de este encargo es Classroom **36/98** en aplicación. Las otras 62 rutas,
cron, RLS/PostgreSQL, storage y autorización fina declarada pendiente siguen abiertas.

