# Encargo encadenado para Claude — Classroom Bloque 1 (17/98)

Fecha: 2026-09-12. Ejecutar **después de entregar Observer y después de que Astra lo integre**.

## Condición de inicio

No continúes Classroom sobre la rama de Observer. Cuando Astra confirme la integración:

1. `git fetch origin staging`;
2. comprueba en `docs/ESTADO_BLINDAJE.md` que `observer` figura 28/28 y 0 pendientes;
3. crea un worktree nuevo desde ese `origin/staging` y la rama
   `codex/blindaje-classroom-b1-claude`;
4. lee `docs/ENCARGO_BLINDAJE_ASTRA.md` y `docs/PLAN_BLINDAJE_CLASSROOM.md`.

Si Observer todavía no está integrado, entrega el trabajo de Observer y detente; no inventes el
hash ni apiles Classroom en su rama.

## Alcance cerrado: exactamente 17 rutas

### Aulas (6)

- `GET /classrooms`
- `GET /classrooms/available-assignments`
- `POST /classrooms`
- `GET /classrooms/:id`
- `PUT /classrooms/:id`
- `GET /classrooms/:id/students`

### Actividades y destinatarios (11)

- `POST /classrooms/:id/activities`
- `GET /classrooms/:id/activities`
- `GET /classrooms/activities/:activityId`
- `PUT /classrooms/activities/:activityId`
- `DELETE /classrooms/activities/:activityId`
- `PUT /classrooms/activities/:activityId/publish`
- `PUT /classrooms/activities/:activityId/unpublish`
- `PUT /classrooms/activities/:activityId/dependencies`
- `PUT /classrooms/activities/:activityId/assign-students`
- `GET /classrooms/activities/:activityId/assignments`
- `GET /classrooms/:id/students-for-assignment`

No toques las otras 81 rutas, sus excepciones ni el cron. El estado final de este encargo es
`classroom 17/98`, nunca “Classroom cerrado”.

## Defectos que debes resolver

`GET :id` hoy carga el aula por id sin demostrar acceso. `GET :id/activities` confía en el query
`role=student`: omitirlo permite caer en la rama docente y ver borradores/conteos. El rol, la
institución y la identidad vienen exclusivamente del JWT y de relaciones verificadas, nunca de
query/body.

Crea un `ClassroomTenantAccessService` compartido que reciba actor explícito
`{ userId, institutionId, roles, isSuperAdmin }` y pueda reutilizarse en los siguientes bloques.
Debe validar:

- aula → asignación docente → institución/año/grupo/sede/grado/asignatura/área;
- estudiante → usuario → matrícula compatible con institución, año y grupo del aula;
- actividad → aula completa;
- destinatario de actividad → actividad y matrícula compatible;
- dependencia origen/destino → misma aula e institución, sin ciclos y sin ids ajenos;
- creación desde `teacherAssignmentId` → actor docente asignado, o rol administrativo permitido;
- SuperAdmin con destino resuelto, sin saltarse las relaciones del recurso.

Las 17 rutas deben llamar directamente a `requireInstitutionId(this.prisma as any, req)` antes de
usar ids. Pasa el contexto al servicio. Un id ajeno o una relación incoherente responde 404 antes de
PII; una falta de permiso dentro de un recurso propio puede conservar 403.

Toda escritura compuesta usa una transacción real: guarda, lectura previa, mutación y auditoría con
el mismo `tx`. Evita `update/delete` por id desnudo. El fixture debe entregar un objeto `tx`
distinto y hacer fallar cualquier uso de `this.prisma` dentro del callback.

## Pruebas obligatorias

Crea un fixture A/B exclusivo con:

- el mismo docente vinculado a A y B, para que `teacherId` no oculte la falta de institución;
- docente ajeno dentro del mismo colegio;
- aulas, asignaciones, grupos, grados, sedes, jornadas, años, materias y áreas de A/B;
- estudiantes con matrícula propia, de otro grupo, de otro año y del otro colegio;
- actividades publicadas, borradores, específicas y dependencias;
- una fila histórica incoherente en cada cadena crítica.

Añade pruebas de servicio y HTTP Nest real para las 17 rutas, A→B y B→A. Afirma 404, cero lecturas
secundarias sensibles y cero escrituras; el parámetro `role` no concede permisos; un estudiante no
ve borradores ni conteos docentes; un docente multiinstitución no cruza con el mismo `userId`; los
lotes mixtos de destinatarios/dependencias fallan completos; las transacciones revierten; fechas y
estados de publicación conservan reglas funcionales legítimas.

Haz una mutación de la guarda aula→institución y otra del rol derivado del JWT; registra qué pruebas
caen, restaura y vuelve a verde. No publiques scripts temporales.

## Entrega

Commits locales en este orden: acceso institucional compartido, aulas, actividades, fixture/pruebas,
documentación y último commit **solo** con las 17 excepciones retiradas. No hagas push a staging.
No edites `ESTADO_BLINDAJE.md` ni `REGISTRO_DESPLIEGUES.md`.

Entrega `docs/AUDITORIA_AISLAMIENTO_CLASSROOM_B1.md` y
`docs/ENTREGA_CLAUDE_CLASSROOM_B1.md` con matriz ruta por ruta, defectos, cambios de comportamiento,
Bloque 4, mutaciones, comandos/resultados y “Qué NO cubre”. Ejecuta focal + contrato, suite API,
tipos/build API y pruebas/tipos web. PostgreSQL/RLS, archivos de storage, las otras 81 rutas y el
cron permanecen expresamente pendientes.

