# Encargo para Kimi — Classroom Bloque 1, aulas y actividades (17/98)

Fecha: 2026-09-12. Responsable de integración: Astra. Este encargo sustituye la asignación anterior
de Classroom a Claude.

## 1. Contexto y objetivo

Edusyn es una plataforma escolar multiinstitucional en producción. `staging` despliega a Railway y
`main` despliega producción. Este trabajo ocurre solamente en código y pruebas locales; no se
promueve a producción, no se manipulan datos reales y no se conecta una base compartida.

El contrato global tiene 1.113 rutas. Classroom concentra 98 y hoy aparece 0/98: ninguna llamada
directa reconocida a `requireInstitutionId`, 98 excepciones `pending-audit` y solo 16 pruebas previas,
ninguna multiinstitucional. Este bloque cierra exactamente las primeras **17 rutas**. El resultado
debe declararse `Classroom 17/98`; las otras 81 rutas y el cron siguen pendientes.

Los dos defectos confirmados son concretos: `GET /classrooms/:id` carga el aula por id sin demostrar
acceso y `GET /classrooms/:id/activities` acepta `?role=student`; omitirlo puede llevar a un
estudiante por la rama docente y mostrar borradores o conteos. Rol, identidad e institución deben
proceder de la sesión y de relaciones verificadas, nunca de query o body.

## 2. Base y forma de trabajo

1. Ejecuta `git fetch origin staging` y registra `git rev-parse origin/staging`.
2. Crea un worktree nuevo desde esa base con rama `codex/blindaje-classroom-b1-kimi`. No reutilices
   un worktree de RLS ni lleves cambios no publicados de otra línea.
3. Lee completos `docs/ENCARGO_BLINDAJE_ASTRA.md`, `docs/ESTADO_BLINDAJE.md`,
   `docs/PLAN_BLINDAJE_CLASSROOM.md`, `docs/AUDITORIA_BLOQUE_0_BLINDAJE.md` y este documento.
4. No hagas push a `staging`. Entrega commits locales, hashes y ruta del worktree.

`origin/staging` se mueve. Antes de entregar, rebasa sobre el `origin/staging` vigente, resuelve solo
conflictos propios y repite las pruebas. Nunca uses `push --force`, `reset --hard` ni mezcles WIP.

## 3. Alcance cerrado: exactamente 17 rutas

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

No cambies el comportamiento ni las excepciones de las otras 81 rutas. No toques el cron de
publicación, RLS, PostgreSQL, esquema Prisma, migraciones, storage, Inclusión/APD, Observer,
Attendance, Learning Route, R1, EduLab ni Aula Clásica.

Puedes modificar los servicios/controlador/DTOs/módulo de Classroom que sean estrictamente
necesarios para estas 17 rutas, crear un servicio de acceso institucional compartido, fixture y
pruebas. No emprendas una división física general del controlador de 98 rutas en este bloque.

## 4. Contrato de acceso obligatorio

Las 17 rutas llaman directa, incondicionalmente y en la forma reconocida por el contrato a
`requireInstitutionId(this.prisma as any, req)` antes de usar IDs. Cada llamada al servicio recibe
un actor explícito:

```ts
{ userId, institutionId, roles, isSuperAdmin }
```

Crea `ClassroomTenantAccessService` reutilizable y haz que valide:

- aula → asignación docente → institución, año, grupo, sede, grado, asignatura y área;
- estudiante → usuario → matrícula compatible con institución, año y grupo del aula;
- actividad → aula completa;
- destinatario de actividad → actividad y matrícula compatible;
- dependencia origen/destino → misma aula e institución, sin ciclos ni IDs ajenos;
- creación desde `teacherAssignmentId` → actor docente asignado o rol administrativo permitido;
- SuperAdmin → destino resuelto por el mecanismo común, sin saltarse relaciones del recurso.

No aceptes `institutionId`, `teacherId`, `studentId`, `roles` o `role` del cliente como autoridad. El
query `role` puede ignorarse o retirarse del contrato de estas rutas; nunca decide qué rama se usa.

Un id ajeno, inexistente o con relación histórica incoherente responde 404 antes de PII o consultas
secundarias sensibles. Una falta de permiso dentro de un recurso que sí pertenece a la institución
puede responder 403. Conserva roles funcionales legítimos y documenta cualquier cambio observable.

## 5. Escrituras y carreras

No uses una guarda seguida de `update({ where: { id } })` o `delete({ where: { id } })`. Toda
operación compuesta ejecuta guarda, lectura previa, mutación, destinatarios/dependencias y auditoría
con el mismo cliente `tx`. Usa escrituras acotadas, comprueba `count` y devuelve 404 si el recurso
sale del alcance durante una carrera.

El doble de Prisma debe proporcionar un objeto `tx` distinto del cliente raíz y fallar si dentro del
callback se usa `this.prisma`. Lotes mixtos de destinatarios o dependencias fallan completos; no
filtran silenciosamente el elemento ajeno. Preserva las reglas funcionales de fechas, publicación,
edición y ciclos.

## 6. Fixture A/B obligatorio

Crea un fixture exclusivo bajo `apps/api/test/fixtures/` con:

- instituciones A y B;
- el mismo usuario docente vinculado a ambas, para que `userId` no oculte falta de institución;
- otro docente dentro de A;
- aulas, asignaciones, grupos, grados, sedes, jornadas, años, materias y áreas de A/B;
- estudiantes: compatible, otro grupo, otro año, otro estudiante de A y estudiante de B;
- actividades publicadas, borradores, dirigidas y con dependencias;
- destinatarios de A y B;
- una fila histórica incoherente por cada cadena crítica.

El doble debe interpretar realmente `AND`, `OR`, `NOT`, igualdad, `in`, relaciones anidadas y
filtros institucionales. Un mock que siempre devuelve la fila solicitada no acredita aislamiento.

## 7. Pruebas de servicio y HTTP

Añade pruebas de servicio y HTTP Nest real con `JwtAuthGuard`, estrategia JWT, `RolesGuard`,
`ValidationPipe`, controlador y servicios reales; solo Prisma se dobla. Cubre las 17 rutas y las dos
direcciones A→B/B→A. En cada cruce afirma:

- 404 indistinguible de inexistente;
- cero lecturas secundarias sensibles y cero escrituras;
- body/query no puede sustituir institución, docente, estudiante ni rol;
- estudiante no ve borradores, respuestas internas ni conteos docentes;
- estudiante A no ve a otro estudiante de A ni a B;
- docente compartido A/B no cruza recursos con el mismo `userId`;
- docente ajeno del mismo colegio no administra el aula de otro salvo una regla explícita vigente;
- grupos, años, asignaciones, materias, áreas y destinatarios mixtos fallan antes de escribir;
- lotes mixtos y fallos intermedios revierten por completo;
- roles no autorizados reciben el resultado correcto sin revelar existencia.

Incluye casos legítimos con contenido y conteos comprobables. Prueba expresamente que quitar el query
`role` no cambia el permiso y que enviarlo como `student`, `teacher` o un valor inventado no concede
acceso.

Haz dos mutaciones temporales: retira la guarda aula→institución y después deriva el rol desde el
query. Registra qué pruebas fallan en cada caso, restaura el código y vuelve a verde. No publiques
scripts temporales.

## 8. Contrato estructural y documentación

Solo al final, cuando producción y pruebas estén verdes, retira exactamente las 17 entradas de
Classroom de `apps/api/src/common/security/institution-route-exceptions.json` en un commit separado.
No regeneres la lista ni aceptes cambios en las otras 81 huellas.

Crea:

- `docs/AUDITORIA_AISLAMIENTO_CLASSROOM_B1.md`;
- `docs/ENTREGA_KIMI_CLASSROOM_B1.md`.

Incluye matriz de 17 rutas, antes/después, defectos raíz, relaciones comprobadas, cambios de
comportamiento, pruebas/mutaciones, comandos/resultados, ficheros y “Qué NO cubre”. No edites
`ESTADO_BLINDAJE.md` ni `REGISTRO_DESPLIEGUES.md`; Astra lo hace al integrar.

## 9. Verificación y entrega

Ejecuta en orden:

1. pruebas focales de Classroom B1 y contrato estructural;
2. suite API completa;
3. `tsc --noEmit` API;
4. `nest build` API;
5. suite web completa y `tsc --noEmit` web;
6. `git diff --check` y lista de archivos del rango de commits.

Commits locales en este orden: acceso institucional compartido, aulas, actividades, fixture/pruebas,
documentación y último commit **solo** con las 17 excepciones. Entrega hashes y ruta del worktree.

El cierre válido de este encargo es `Classroom 17/98`. PostgreSQL/RLS, storage, otras 81 rutas,
cron, permisos finos no resueltos, rendimiento y datos reales permanecen explícitamente pendientes.

