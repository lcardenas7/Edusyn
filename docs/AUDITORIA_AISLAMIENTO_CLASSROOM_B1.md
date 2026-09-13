# Auditoría de aislamiento · Classroom Bloque 1

Fecha: 2026-09-12 · Autor: Kimi · Base: `origin/staging` en `2ebb2515`
(la auditoría empezó sobre `a61fba2d`; la rama se rebaseó a `165d07e6` y después a `2ebb2515`,
ambas limpias — los hashes anteriores a esta edición citados por Astra, p. ej. `9ac64f02` o
`48ec81c5`, identifican los mismos cambios antes de los rebases).
Rama: `codex/blindaje-classroom-b1-kimi` · Worktree propio (`worktrees/classroom-b1-kimi`), sin
reutilizar los de Attendance ni de otros bloques.

Alcance: **17 de las 98 rutas** de `apps/api/src/modules/classroom` — las 6 de aulas y las 11 de
actividades y destinatarios que el encargo del Bloque 1 delimita. Las otras 81 (secciones,
materiales, anuncios, entregas, rúbricas, Live Quiz, Edusyn Play, etc.) **no se han tocado** y
siguen con su excepción documentada.

---

## 1. Inventario reconciliado

Recontado sobre la base: **17 declaraciones HTTP**, exactamente como decía el encargo.

| Fichero (antes) | Rutas movidas |
|---|---|
| `classroom.controller.ts` | 17 (6 de aulas + 11 de actividades/destinatarios) |

Estado en la tabla de partida: 0 resoluciones directas y 17 excepciones `pending-audit` de
Classroom. El recuento coincide; no hay diferencias que justificar.

Estado final: las 17 rutas viven ahora en `classroom-b1.controller.ts`, cada una con su llamada
directa e incondicional a `requireInstitutionId` (es lo que lee el contrato estructural), y los 17
manejadores antiguos están **borrados** del controlador original (imports y decoradores restantes,
byte a byte idénticos). Las 17 entradas de `institution-route-exceptions.json` se retiraron en el
commit `9ac64f02` (solo ese fichero, 102 líneas eliminadas) y el contrato estructural quedó en
verde (13/13). **Classroom NO está cerrado: va 17/98** — las otras 81 rutas conservan su
excepción `pending-audit`.

---

## 2. Las 17 rutas, una por una

`REQ` = la ruta llama a `requireInstitutionId` de forma directa e incondicional. Todas lo hacen
ahora. «Cadena completa» = `classroom.institutionId` + `teacherAssignment.institutionId` +
`academicYear.institutionId` + `group.{campus,grade}.institutionId` + `subject.area.institutionId`.

### Aulas

| # | Ruta | Roles | Qué pasaba antes | Qué pasa ahora |
|---|---|---|---|---|
| 1 | `GET /classrooms` | DOCENTE, COORDINADOR, ESTUDIANTE, ACUDIENTE | **El query `?role` decidía la rama**: `?role=student` → vista estudiante; cualquier otra cosa (incluido omitirlo) → vista docente. Un estudiante que no enviara el query atravesaba la rama de docente (borradores y conteos docentes); cualquiera podía autoconcederse la rama que quisiera. La consulta de aulas no filtraba por `institutionId` ni `isPersonal` (dependía solo de los ids de asignación) y el conteo de estudiantes no acotaba por institución. | REQ. El query `role` **deja de leerse**: la rama la decide el JWT (ESTUDIANTE → vista de estudiante; el resto → vista docente). Aulas acotadas por institución + `isPersonal: false` + asignaciones vigentes del docente en ESTA institución; estudiante solo por sus matrículas ACTIVAS con cadena íntegra. |
| 2 | `GET /classrooms/available-assignments` | DOCENTE, COORDINADOR | Resolvía institución y filtraba por docente, pero sin validar la cadena de la asignación (año, grupo/sede/grado, materia/área). | REQ. Asignaciones vigentes del docente acotadas por institución en las cuatro relaciones. |
| 3 | `POST /classrooms` | DOCENTE, COORDINADOR | Resolvía institución y exigía `teacherId` propio, pero un ajeno respondía **403** (confirmaba existencia) y no se validaba la cadena relacional de la asignación. Cuerpo sin DTO (sin lista blanca). | REQ + `assignmentInScope` (cadena completa + vigente) → ajena/inexistente/incoherente responde **404**; solo ENTONCES ownership → 403 si la asignación es de otro docente del mismo colegio. DTO con lista blanca (`whitelist`). |
| 4 | `GET /classrooms/:id` | DOCENTE, COORDINADOR, ESTUDIANTE, ACUDIENTE | **El defecto más grave del bloque**: `findUnique({ where: { id } })` y se devolvía el aula COMPLETA —secciones, materiales, anuncios, conteos, datos del docente— **sin comprobar institución ni permiso alguno**. Cualquier usuario autenticado con cualquiera de los 4 roles leía el aula de cualquier colegio. | REQ + `classroomInScope` (cadena completa; ajena/inexistente/incoherente/personal → **404** indistinguible, ANTES de cualquier lectura rica) + `assertCanViewClassroom`: docente asignado, SuperAdmin, rol administrativo institucional, o estudiante con matrícula ACTIVA compatible (institución + año + grupo del aula). La lectura rica se repite acotada por `institutionId` (defensa en profundidad). |
| 5 | `PUT /classrooms/:id` | DOCENTE, COORDINADOR | Ownership por `teacherId` sobre `findUnique` por id: un aula ajena respondía **403** (existencia confirmada) y la escritura era un `update` por id desnudo, sin institución ni cadena. | REQ + `classroomInScope` → **404**; ownership → 403 solo dentro del colegio. Escritura con `updateMany` acotado (`id` + `institutionId`) con `count === 1`, dentro de `$transaction` que revalida. DTO con lista blanca. |
| 6 | `GET /classrooms/:id/students` | DOCENTE, COORDINADOR | Ownership por `teacherId`, aula ajena → 403. La lista de matrículas se armaba por `groupId`+`academicYearId`+`status` **sin institución** y devolvía PII (nombre, email) del grupo. | REQ + `classroomInScope` → 404 + ownership → 403. Matrículas acotadas por `institutionId` + `student.institutionId` + cadena año/grupo. |

### Actividades y destinatarios

| # | Ruta | Roles | Qué pasaba antes | Qué pasa ahora |
|---|---|---|---|---|
| 7 | `POST /classrooms/:id/activities` | DOCENTE, COORDINADOR | Ownership por `teacherId` (ajena → 403), sin cadena institucional. Cuerpo sin DTO. | REQ + `classroomInScope` → 404 + `assertCanManageClassroom` → 403. Creación dentro de `$transaction`. DTO con lista blanca (acepta además `shuffleQuestions`, `showResults`, `maxAttempts`, `timeLimitMinutes`, que el front ya enviaba). |
| 8 | `GET /classrooms/:id/activities` | DOCENTE, COORDINADOR, ESTUDIANTE, ACUDIENTE | **`?role` decidía la rama** (mismo defecto que la ruta 1): el estudiante que omitía el query veía borradores, respuestas internas y conteos de entregas del docente. Sin cadena institucional. | REQ + `classroomInScope` → 404. Rama derivada del JWT. La rama estudiante exige matrícula ACTIVA compatible verificada → si no, **404**; solo actividades publicadas, sin conteos internos. ACUDIENTE → 404 (ver §5). |
| 9 | `GET /classrooms/activities/:activityId` | DOCENTE, COORDINADOR, ESTUDIANTE, ACUDIENTE | `findUnique` por id + ownership solo para gestión; lectura sin institución y **`?role` otra vez** como selector de privilegio. | REQ + `activityInScope` (actividad colgando de un aula con cadena completa) → 404. Rama por JWT; estudiante sin matrícula compatible → 404. |
| 10 | `PUT /classrooms/activities/:activityId` | DOCENTE, COORDINADOR | Ownership por `teacherId`; `update` por id desnudo; sin institución. | REQ + `activityInScope` → 404 + manage → 403. `updateMany` acotado con `count === 1` en `$transaction`. DTO con lista blanca (mismos 4 campos extra inertes que en crear). |
| 11 | `PUT /classrooms/activities/:activityId/publish` | DOCENTE, COORDINADOR | Ownership por `teacherId`; `update` desnudo. `scheduledPublishAt` sin validación de colegio (la procesa el cron, fuera de alcance). | REQ + `activityInScope` → 404 + manage → 403. `updateMany` acotado en `$transaction`. Regla funcional de `scheduledPublishAt` conservada. |
| 12 | `PUT /classrooms/activities/:activityId/unpublish` | DOCENTE, COORDINADOR | Ídem. | Ídem que 11, con la regla funcional de despublicar conservada. |
| 13 | `PUT /classrooms/activities/:activityId/dependencies` | DOCENTE, COORDINADOR | Ownership por `teacherId`; los prerrequisitos se aceptaban por id **sin validar existencia ni colegio**, y solo se comprobaba «misma aula» parcialmente. | REQ + `activityInScope` → 404 + manage → 403 + `assertDependenciesValid`: cada prerrequisito existe y cuelga de aula de la institución (404 antes de revelar), no es la propia actividad (400) y pertenece a la MISMA aula (400). Reescritura atómica en `$transaction`; detección de ciclos conservada sobre el grafo existente. |
| 14 | `PUT /classrooms/activities/:activityId/assign-students` | DOCENTE, COORDINADOR | **Segundo defecto grave**: tras el ownership, `deleteMany` + `createMany` con los `studentEnrollmentIds` del cuerpo **sin validar ni uno** —matrículas de otro colegio, de otro grupo o inexistentes— y **sin transacción**: un fallo a mitad dejaba la actividad sin destinatarios. | REQ + `activityInScope` → 404 + manage → 403 + `enrollmentInScope` por CADA id (misma institución, año y grupo del aula, estudiante de la institución, cadena íntegra; cualquiera ajena/inexistente → 404 y **nada se escribe**). `deleteMany`+`createMany` dentro de `$transaction` que revalida; un lote mixto revierte completo. |
| 15 | `GET /classrooms/activities/:activityId/assignments` | DOCENTE, COORDINADOR | Ownership por `teacherId`; lista de destinatarios sin acotar por institución. | REQ + `activityInScope` → 404 + manage → 403. Lectura acotada además por `studentEnrollment.institutionId`. |
| 16 | `GET /classrooms/:id/students-for-assignment` | DOCENTE, COORDINADOR | `findUnique` por id + comparación de `teacherId` (ajena → 403); matrículas del grupo por `status: 'ACTIVE'` **sin año académico ni institución** (mezclaba años y, con una fila incoherente, colegios). | REQ + `classroomInScope` → 404 + manage → 403. Matrículas por año **y** grupo del aula + `institutionId` + `student.institutionId` + cadena íntegra. |
| 17 | `DELETE /classrooms/activities/:activityId` | DOCENTE, COORDINADOR | Ownership por `teacherId`; borrado por id desnudo. `force` como bandera funcional. | REQ + `activityInScope` → 404 + manage → 403. Borrado acotado en `$transaction`. `force` se conserva (es funcional, no un selector de privilegio como `role`). |

---

## 3. Cadenas relacionales del esquema

Comprobadas contra `schema.prisma`, no asumidas:

- `Classroom` **sí** tiene `institutionId` propio (a diferencia de `Group` en Attendance).
- `Group` **no tiene** `institutionId`: se valida por `group.campus.institutionId` **y**
  `group.grade.institutionId`. (La cadena acordada para Classroom es `group.{campus,grade}`;
  no se exige `shift` — ver `docs/PLAN_BLINDAJE_CLASSROOM.md`.)
- `Subject` **no tiene** `institutionId`: se valida por `subject.area.institutionId`.
- `TeacherAssignment`, `AcademicYear`, `StudentEnrollment`, `Student`, `ClassroomActivity` sí
  llevan `institutionId` propio… **y aun así** se filtra también por la relación, porque hay FKs
  históricas que pueden no ser coherentes (lección 2 de `eaa57408`). El fixture incluye una fila
  incoherente por cada cadena crítica y las pruebas demuestran que responden 404 **para su propia
  institución**.
- Aulas personales de Edusyn Play (`isPersonal`/`ownerUserId`) no son institucionales: estas 17
  rutas responden 404 para ellas, indistinguible de un id ajeno.
- `Guardian` **no tiene `userId`**: no existe forma de acreditar la relación acudiente→estudiante
  (ver §5).

Guardas compartidas (`classroom-tenant-access.service.ts`; aceptan `tx` para ejecutarse dentro de
la transacción interactiva con el mismo cliente):

| Guarda | Acota por | Falla con |
|---|---|---|
| `classroomInScope` | cadena completa del aula + `isPersonal: false` | 404 |
| `activityInScope` | actividad → aula con cadena completa | 404 |
| `assignmentInScope` | cadena completa + `endDate: null` | 404 |
| `assertCanManageClassroom` / `assertCanUseAssignment` | `teacherId` del JWT | 403 |
| `assertCanViewClassroom` | docente asignado / SuperAdmin / rol admin / matrícula ACTIVA | 403 o 404 según rol |
| `studentEnrollmentInClassroom` | estudiante del actor + institución + año + grupo del aula | (null → 404) |
| `enrollmentInScope` | institución + año + grupo del aula + estudiante de la institución | 404 |
| `assertDependenciesValid` | existencia + institución + misma aula | 404 / 400 |

---

## 4. Huecos de autorización fina (enumerados, NO modificados)

El encargo prohíbe inventar o ampliar permisos internos. Lo que sigue queda **igual que antes**
y se declara como pendiente para una decisión de producto:

1. La **gestión** de aula y actividades (crear desde asignación, editar, publicar, destinatarios,
   dependencias, borrar) sigue siendo **solo del docente asignado**: COORDINADOR/RECTOR/
   ADMIN_INSTITUTIONAL que no sean el docente reciben 403, exactamente como antes. No se amplió.
2. A la inversa, un **COORDINADOR** (rol admitido por `@Roles`) puede intentar gestionar y recibe
   403 salvo que sea el docente de la asignación: comportamiento preexistente conservado.
3. La vista del aula para roles administrativos (ADMIN_INSTITUTIONAL/RECTOR/COORDINADOR) es de
   **todo el colegio**, no de sus dependencias concretas: ya era así en la práctica (antes era
   peor: era de todo el sistema) y no se ha inventado un límite más fino.
4. Ninguna de estas rutas distingue permisos entre docentes del mismo colegio más allá del
   ownership por `teacherId` que ya existía.

Ninguno de estos huecos cruza colegios: son de autorización dentro de la misma institución.

---

## 5. Cambios de comportamiento deliberados

Todos derivados de las reglas del encargo (404 indistinguible en la frontera; el rol jamás del
cliente; ninguna escritura parcial):

1. **El query `role` deja de existir** en `GET /classrooms`, `GET /classrooms/:id/activities` y
   `GET /classrooms/activities/:activityId`. Enviarlo como `student`, `teacher` o un valor
   inventado **no cambia la rama ni el permiso** (probado expresamente). Un ESTUDIANTE real que
   antes omitía el query y caía en la rama docente ahora recibe su vista de estudiante.
2. **ACUDIENTE pasa de «leer cualquier aula» a 404.** El esquema no vincula `Guardian` con
   cuentas de usuario (no hay `userId`), así que no se puede acreditar la relación
   acudiente→estudiante; se responde 404 para no revelar existencia. Antes un ACUDIENTE leía el
   aula completa de cualquier colegio por id.
3. **Estudiante sin matrícula compatible → 404** en las rutas de vista (antes: acceso por id
   sin más). Estudiante A no ve a otro estudiante de A fuera de su aula ni nada de B.
4. **Ids ajenos pasan de 403 a 404** en gestión y vista: el 403 anterior confirmaba la existencia
   del aula/actividad de otro colegio. El 403 se reserva para falta de permiso **dentro** del
   colegio (p. ej. el otro docente de A contra el aula del docente compartido).
5. **Aulas personales de Edusyn Play → 404** en estas rutas (antes se colaban si el id encajaba).
6. **DTOs con lista blanca** (`whitelist: true`, `forbidNonWhitelisted`): campos falsificados en
   el cuerpo (p. ej. `institutionId`, `teacherId`, `studentEnrollmentIds` con forma errónea)
   reciben **400**. Los DTOs de crear/editar actividad aceptan además `shuffleQuestions`,
   `showResults`, `maxAttempts` y `timeLimitMinutes` porque el front ya los enviaba; se aplican
   igual que antes.
7. **`assignStudentsToActivity` es atómico**: un lote con una sola matrícula ajena, inexistente o
   de otro grupo/año **falla completo** (404) y no toca los destinatarios actuales; antes borraba
   primero y creaba después sin validar nada.

Además, un defecto funcional encontrado por el fixture durante el blindaje y corregido en
`7f1d9417`: los listados (`listForTeacher`/`listForStudent`) consultaban las aulas sin
`institutionId` ni `isPersonal`, y `getClassroomStudentsForAssignment` listaba matrículas sin año
ni `student.institutionId`. Con filas incoherentes o aulas personales, esas consultas cruzaban
colegios. Las pruebas de servicio los fijan.

---

## 6. Pruebas

Fixture A/B exclusivo: `apps/api/test/fixtures/classroom-b1.fixture.ts`. Instituciones A y B, el
mismo usuario docente vinculado a ambas (para que `userId` no oculte la falta de institución), otro
docente dentro de A, aulas/asignaciones/grupos/grados/sedes/jornadas/años/materias/áreas de A y B,
estudiantes compatible/otro grupo/otro año/otro estudiante de A/estudiante de B, actividades
publicadas, borradores, dirigidas y con dependencias, destinatarios de A y B, un aula personal de
Edusyn Play y **una fila histórica incoherente por cada cadena crítica** (aula de A con asignación
de B, aula de A con grupo de sede de B, matrícula que dice A con estudiante de B).

El doble de Prisma **aplica filtros de verdad** (igualdad, `in`, `not`, comparaciones, `contains`,
`OR`/`AND`/`NOT`, relaciones anidadas) y entrega un `tx` **distinto** del cliente raíz en
`$transaction`: toma instantánea, revierte si el callback lanza, y **falla expresamente** si dentro
del callback se usa el cliente raíz —así las escrituras fuera de la transacción no pueden pasar
inadvertidas.

| Suite | Pruebas | Qué demuestra |
|---|---|---|
| `classroom-b1.isolation.spec.ts` | 44 | Rechazo por servicio en ambas direcciones A→B/B→A (15 operaciones × 2), 404 indistinguible, filas incoherentes, aula personal, ACUDIENTE, SuperAdmin, docente compartido con el mismo `userId`, atomicidad de lotes mixtos, proyección de estudiante, destinatario incoherente y casos legítimos con contenido y conteos comprobables. |
| `classroom-b1.http-isolation.spec.ts` | 54 | Las 17 rutas por HTTP real con `JwtAuthGuard`, estrategia JWT (tokens firmados localmente), `RolesGuard` y `ValidationPipe` reales; solo Prisma es doble. Matriz de 15 rutas con id en ambas direcciones, `role` como query (student/teacher/inventado/ausente), `institutionId` y `teacherId` falsificados en cuerpo, sin token, roles no autorizados, proyecciones con FK cruzada (A→B, B→A e intra-colegio), estudiante no asignado y casos legítimos. |
| `classroom-b1-adversarial-review.spec.ts` | 5 | Las 5 filtraciones de proyección de la segunda revisión de Astra (cherry-pick de `7460d706`): fallaban contra la entrega anterior y pasan tras la corrección (§11). |

Total: **103 pruebas** de aislamiento del bloque (49 de servicio + 54 HTTP).

Cobertura afirmada también sobre lo que **no** ocurrió: `noWrites` (ningún método de escritura en
ningún modelo tras un intento cruzado), cero lecturas PII secundarias (`student`/
`studentEnrollment`) antes del 404, y conteo de filas por institución antes/después.

### Pruebas de mutación (código restaurado y suite en verde tras cada una)

**Mutación 1 — guarda aula→institución retirada.** Se dejó `classroomInScope` con
`where: { id }` únicamente. Resultado: **21 pruebas en rojo** (20 nuevas + el contrato
estructural ya rojo por las excepciones pendientes):

- Servicio (11): `update`, `getStudents`, `createActivity` y `listActivities` cruzados en ambas
  direcciones (8); las dos filas incoherentes respondiendo 200 para su propia institución (2);
  el otro docente de A recibiendo 403 **fuera** de su colegio en vez de 404 (1).
- HTTP (9): `PUT /classrooms/:id`, `GET /classrooms/:id/students`,
  `POST /classrooms/:id/activities` y `GET /classrooms/:id/activities` con id del otro colegio,
  en ambas direcciones (8); más el caso «el otro docente de A recibe 403 dentro de su colegio y
  404 fuera» (1).

Detalle útil para quien revise: bajo esta mutación, las rutas que cuelgan de `activityInScope`
(publicar, dependencias, destinatarios, borrado…) **siguieron en 404**, porque esa guarda valida
la cadena del aula por su cuenta, y `GET /classrooms/:id` cruzado siguió en 404 porque la lectura
rica se repite con `institutionId`. Es defensa en profundidad real, no redundancia: la mutación
solo rompió las rutas que dependían exclusivamente de `classroomInScope`.

**Mutación 2 — rol derivado del query.** Se reintrodujo `?role` en `GET /classrooms`,
`GET /classrooms/:id/activities` y `GET /classrooms/activities/:activityId`, sobrescribiendo los
roles del actor con lo que enviara el cliente (`student` → rama estudiante; cualquier otro valor →
rama docente). Resultado: **5 pruebas en rojo** (4 nuevas + el contrato):

- `?role=student no cambia la rama ni el permiso`
- `?role=teacher no cambia la rama ni el permiso`
- `?role=inventado no cambia la rama ni el permiso`
- `la respuesta del estudiante es idéntica con y sin el query role`

Bajo la mutación, un estudiante con `?role=teacher` (o cualquier valor) recibía la rama docente
con borradores y conteos internos —exactamente el defecto original. Tras restaurar, la suite focal
volvió a su referencia. No se publican scripts temporales; las mutaciones se aplicaron con edición
directa y se revirtieron con `git checkout --`.

---

## 7. Verificación ejecutada

Estado final de la rama (tras la segunda fase correctiva, §11, y el rebase sobre `2ebb2515`):

| Comando | Resultado |
|---|---|
| `jest --runInBand classroom-b1 institution-route-contract` (apps/api) | 106 suites, **2293 pruebas**, todas verdes — incluido el contrato estructural (13/13) |
| Suite API completa `--runInBand` | 106 suites, **2293 pruebas**, todas verdes |
| `npx tsc --noEmit` (apps/api) | limpio |
| `npm run build` (apps/api) | correcto |
| `vitest run` (apps/web) | 22 ficheros, **214 pruebas**, verdes |
| `npx tsc --noEmit` (apps/web) | limpio |
| `git diff --check origin/staging...HEAD` | limpio |

Historial de cifras: primera entrega 2239/1 (la única roja el contrato con los 17 «Remove obsolete
exception» esperados); primera fase correctiva 104/2255; segunda fase correctiva **106/2293**
(105/2279 al heredar Taller de staging + 1 suite/5 pruebas del spec adversarial de Astra + 9
pruebas HTTP nuevas de esta fase). Mutaciones: 1 → 21 rojas (20 nuevas) → restaurada; 2 → 5 rojas
(4 nuevas) → restaurada; fase correctiva 1: (a) 3 rojas, (b) 2 rojas; fase correctiva 2: (a)–(f)
2/2/2/2/1/1 rojas (detalle §11). `git diff` vacío en `apps/api/src` tras cada restauración (solo
queda `package-lock.json`, suciedad preexistente de `npm install`, no comprometida ni descartada).

Nota: varias ejecuciones de la suite murieron a mitad con el código de salida 3221226505
(0xC0000409) o 127 (fallos transitorios del proceso en Windows, sin relación con el código); la
repetición inmediata —o jest invocado directamente con el `node.exe` del runtime— dio el
resultado completo y consistente.

---

## 8. Qué NO cubre esta auditoría

- **Las otras 81 rutas de Classroom.** Secciones, materiales, anuncios, entregas, rúbricas, Live
  Quiz, Edusyn Play y demás conservan su excepción `pending-audit` y su comportamiento anterior.
  **Classroom va 17/98; el bloque NO cierra el módulo.**
- **El cron `processScheduledPublications`.** Publica actividades programadas sin actor ni
  institución resuelta; queda pendiente para otro bloque.
- **PostgreSQL y RLS.** Todo lo demostrado es la guarda de la **aplicación**. No se ha tocado el
  esquema, ni migraciones, ni políticas RLS, ni staging/producción.
- **Storage / archivos.** Los materiales y entregas con fichero no se han auditado.
- **Autorización fina dentro del colegio.** Los huecos del §4 siguen abiertos por decisión
  explícita del encargo.
- **Rendimiento.** Las guardas añaden consultas de validación acotadas y baratas, no medidas en
  volumen real.
- **Datos históricos ya incoherentes.** Las guardas impiden crear nuevas incoherencias y filtran
  las existentes en lectura, pero no reparan filas mal ligadas que ya estén en la base (p. ej. el
  destinatario incoherente preexistente se filtra al leer, no se borra).
- **`ESTADO_BLINDAJE.md` y `REGISTRO_DESPLIEGUES.md`.** No se han editado; los actualiza Astra al
  integrar.

---

## 9. Ficheros

Hashes **tras el rebase final sobre `2ebb2515`** (los dos rebases reescribieron la rama; los
hashes citados en las revisiones de Astra identifican los mismos cambios antes de los rebases):

| Commit | Contenido |
|---|---|
| `331dfba4` | `classroom-tenant-access.service.ts` (nuevo), `classroom.module.ts`, `classroom.service.ts`, ajustes de `classroom.service.spec.ts` y `classroom-copy-contract.spec.ts` a las nuevas firmas |
| `0e207af1` | `classroom-b1.controller.ts` (nuevo) con las 6 rutas de aulas, `dto/classroom-b1.dto.ts` (nuevo), 6 manejadores borrados de `classroom.controller.ts`, servicio |
| `4e09d0bf` | Las 11 rutas de actividades/destinatarios, 11 manejadores borrados del controlador original, servicio, DTOs, `activity-gating.service.ts` (parámetro `db` opcional para usar el cliente transaccional) |
| `09ad82df` | Defecto funcional encontrado por el fixture: institución + `isPersonal` en los listados y año + `student.institutionId` en estudiantes-para-asignación |
| `6966622b` | `test/fixtures/classroom-b1.fixture.ts`, `classroom-b1.isolation.spec.ts` (34), `classroom-b1.http-isolation.spec.ts` (40) |
| `163cea0e` | Esta auditoría y la entrega |
| `3a912ef5` | Retirada de las 17 excepciones (**solo** `institution-route-exceptions.json`, −102 líneas); contrato estructural en verde |
| `9276fea8` | Correcciones de la primera revisión adversarial de Astra (§10): los 5 defectos en `classroom.service.ts` + helper `esVistaEstudiante` |
| `20a27edf` | Laboratorio ampliado (fixture + doble) y 15 pruebas nuevas de regresión de la primera revisión |
| `5644fc11` | Docs rectificados tras la primera revisión |
| `8a93b589` | **Cherry-pick de `7460d706`**: `classroom-b1-adversarial-review.spec.ts` (solo ese archivo); las 5 pruebas se reprodujeron en rojo (`5 failed, 5 total`) antes de corregir |
| `97548e42` | Correcciones de la segunda revisión (§11), **solo** `classroom.service.ts`: conteo de estudiante filtrado, actividades anidadas con `classroomId` + regla de destinatarios, coherencia de período de sección y secciones con guarda |
| `dcde7626` | +7 pruebas HTTP de regresión de la segunda revisión (A→B, B→A, no asignado, createActivity incoherente) |
| `fdc84b6f` | Fixture: `section-otro-A1` (sección de otra aula del MISMO colegio) + 2 pruebas intra-colegio |
| *(pendiente)* | Esta auditoría y la entrega actualizadas con la segunda revisión |

Desviaciones declaradas respecto al plan inicial: se eliminó el helper privado muerto
`resolveStudentEnrollment`; `ActivityGatingService.getClassroomEdges` acepta un `db` opcional
(sin cambio de comportamiento fuera de las transacciones); los DTOs de actividad aceptan los 4
campos extra que el front ya enviaba; `getActivityAssignments` filtra además por
`studentEnrollment.institutionId`.

---

## 10. Revisión adversarial de Astra — 2026-09-12

La primera entrega (punta `9ac64f02`) **no se integró**: la revisión
(`docs/REVISION_ASTRA_CLASSROOM_B1_20260912.md`) encontró 5 defectos bloqueantes. Correcciones en
`48ec81c5` (producción) y `3d5a7869` (laboratorio y pruebas). Las 15 pruebas nuevas **fallan
contra `9ac64f02`** (25 rojas en total: las 15 nuevas más las 10 cuyas aserciones cambiaron por
las nuevas filas del fixture) y **pasan tras la corrección** (2255/2255 verde).

### Los 5 defectos y su corrección

1. **`getActivityAssignments` filtraba `studentEnrollment.institutionId` pero no el estudiante,
   el año, el grupo ni la cadena.** Con un destinatario preexistente colgado de `enr-inc-A`
   (matrícula que dice A con estudiante de B, escrita cuando el alta no validaba) la lectura
   devolvía nombre y foto de un menor de B. La consulta exige ahora la cadena completa de la
   matrícula (institución + `student.institutionId` + año y grupo del aula + año/grupo íntegros).
   Regresión: el fixture añade el destinatario incoherente preexistente `aa-inc-A` y las pruebas
   de servicio y HTTP demuestran que no se devuelve (solo `aa-A1`), sin PII de B, con 404
   indistinguible de inexistente en ambas direcciones.
2. **`listForTeacher`, `listForStudent` y `getAvailableAssignments` no exigían la cadena completa
   en la consulta.** Una asignación que dice A pero cuelga de un año, grupo/sede/grado o
   materia/área de B se ofrecía y sus aulas se listaban. Las tres consultas exigen ahora
   `academicYear.institutionId`, `group.{campus,grade}.institutionId` y
   `subject.area.institutionId` (y el aula repite la cadena); `listForStudent` exige además
   `student.institutionId` en la matrícula, y el conteo de estudiantes del docente filtra
   `institutionId` + `student.institutionId` —**el número cambia de 3 a 2** para el aula del
   fixture porque antes lo inflaba la fila incoherente. Regresión: 5 asignaciones incoherentes
   nuevas (3 sin aula, 2 con aula) y el actor híbrido (sesión en A, `userId` de un estudiante de
   B) que ya no lista nada.
3. **`getById` entregaba al estudiante la carga rica cruda**: secciones y materiales ocultos y
   `_count.activities` contando borradores. Hay proyección específica de estudiante **en la
   consulta** (el controlador no tiene filtro posterior): secciones `isVisible`, materiales
   `isVisible`, actividades publicadas y visibles, `_count.activities` solo publicadas/visibles
   (3 en vez de 4) y períodos limitados al año de la institución. El docente/admin conserva la
   carga completa que usa su pantalla (2 secciones, conteo 4). Regresión: sección oculta con
   material visible dentro y material oculto en sección visible; el estudiante no recibe ninguno.
4. **`getActivity` devolvía `_count.submissions` al estudiante** (conteo interno del docente) y
   **`listActivities` filtraba la entrega del actor por `student.userId`**. La rama estudiante
   omite `_count` (y no hay respuestas/resúmenes docentes en esa carga: las preguntas no se
   incluyen en esta consulta), y la entrega se filtra por la `studentEnrollmentId` **ya
   validada**. Regresión: `sub-A1-old`, una entrega del mismo usuario ligada a su matrícula del
   año viejo con `attemptNumber` mayor —con el filtro viejo habría sido la primera en aparecer—;
   el docente conserva `_count.submissions` (3).
5. **`create` y `createActivity` no compartían transacción entre guarda y escritura**, y
   `createActivity` aceptaba `academicTermId`, `rubricId` y `sectionId` sin validar. Ahora guarda,
   comprobación de duplicado, validaciones y escritura comparten `tx` (el doble veta el cliente
   raíz dentro del callback): la sección debe pertenecer al aula (ajena → **404**, antes 403 que
   confirmaba existencia), el período debe ser de la institución **y del año del aula** (de B o de
   otro año de A → 404), la rúbrica debe ser de la institución (de B → 404), y la unicidad de
   `Classroom.teacherAssignmentId` (`@unique`) cubre la carrera: el P2002 se traduce al 403
   funcional de «Ya existe un aula para esta asignación» sin crear vínculos cruzados. Regresión:
   ids ajenos/incompatibles → 404 sin escritura; fallo intermedio del `create` sin efecto;
   colisión P2002 traducida; todas las llamadas de ambas creaciones ocurren dentro de `tx`.

### Mutaciones temporales de la fase correctiva (restauradas, nunca committeadas)

- **(a) Validación `student.institutionId` retirada** de `getActivityAssignments`: **3 pruebas en
  rojo** —`getActivityAssignments NO devuelve el destinatario incoherente…` (servicio y HTTP) y
  `getActivityAssignments devuelve los destinatarios propios…` (vuelve a 2 filas)—. Restaurada →
  2255/2255.
- **(b) Proyección de estudiante desactivada** en `getById`: **2 pruebas en rojo** —las de
  proyección de servicio y HTTP—. Restaurada → 2255/2255.

### Cambios de comportamiento adicionales de esta fase

- El conteo de estudiantes del listado docente filtra institución y estudiante: un número antes
  contaminado por una fila incoherente puede bajar (3 → 2 en el fixture).
- Una sección que no pertenece al aula al crear actividad responde 404 (antes 403).
- El estudiante deja de recibir `_count` en `getActivity` y su `_count.activities` en `getById`
  cuenta solo publicadas/visibles.
- `create` y `createActivity` ejecutan todo dentro de una transacción interactiva.

---

## 11. Segunda revisión adversarial de Astra — 2026-09-12 (seguimiento)

La rama ya corregida (punta `ea28a4ae` sobre `165d07e6` en ese momento) **siguió sin integrarse**:
la segunda revisión (`docs/REVISION_ASTRA_CLASSROOM_B1_SEGUIMIENTO_20260912.md`, escrita sobre el
worktree `blindaje-astra`) añadió cinco pruebas adversariales en el commit `7460d706` (rama
`codex/review-classroom-b1-astra`, worktree `classroom-b1-review-astra`, que no se tocó) y las
**cinco fallaban** contra mi entrega. También detectó la cifra desactualizada `104/2255` en la
entrega (el estado real ya era 105/2279 por la herencia de Taller en staging).

Incorporación y reproducción: `git cherry-pick 7460d706` (solo
`classroom-b1-adversarial-review.spec.ts`; hash local `d1a93c7b`, `8a93b589` tras el rebase) y
reproducción exacta con `jest --runInBand --runTestsByPath
src/modules/classroom/classroom-b1-adversarial-review.spec.ts`: **`5 failed, 5 total`**. Corrección
en `97548e42` (solo `classroom.service.ts`); laboratorio en `dcde7626` y `fdc84b6f`.

### Los 5 defectos y su corrección

1. **`listForStudent` devolvía `_count.activities` sin filtrar** (4 en `class-A`: contaba el
   borrador), mientras `getById` ya proyectaba (3). El conteo del listado de estudiante se calcula
   ahora por aula con `classroomActivity.count` filtrado por `isPublished` + `isVisible` + la
   regla de destinatarios (`OR`: no restringida / asignada a la matrícula ya validada de ESA
   aula). El docente conserva su total legítimo en `listForTeacher`. Roja al reproducir:
   «el listado de aulas no cuenta borradores para estudiantes» → ahora pasa (3 para A1; el HTTP
   demuestra además 2 para A2, que no está asignado a la restringida, y 2 en `class-B` sin
   contaminación de A).
2. **`getById` anidaba las actividades de cada sección por `sectionId` + publicación/visibilidad
   SIN exigir `activity.classroomId = classroomId`.** Con `act-B-pub.sectionId = 'section-A1'`, el
   estudiante de A recibía el título `SECRETO-DE-B`. La consulta anidada exige ahora `classroomId`
   del aula en ambas ramas (docente y estudiante): la FK cruzada no se materializa. Roja al
   reproducir: «una actividad de B enlazada a una sección de A no aparece en el aula de A» → ahora
   pasa; el HTTP cubre A→B, B→A y el cruce intra-colegio (`act-otro-A` enlazada a `section-A1`).
3. **`getById` incluía `act-A-restr` en la sección de `enr-A2`, que no está asignado.** La
   matrícula ACTIVA verificada del actor se resuelve **antes** de la lectura rica y se usa en el
   filtro Prisma anidado (`OR`: `isRestrictedToAssigned: false` / `assignedStudents.some` con esa
   matrícula) — la misma regla que `listActivities`; nunca pertenencia por `userId` suelto. El
   `_count.activities` de estudiante aplica la misma regla. Roja al reproducir: «una actividad
   restringida no aparece en la sección de un estudiante sin asignación» → ahora pasa (el asignado
   A1 sí la ve en la sección).
4. **Una sección de A con `academicTermId = term-B` entregaba el nombre/año de B.** `getById`
   exige coherencia EN la consulta de secciones: `academicTermId` nulo O período del año y de la
   institución del aula; una FK cruzada omite la sección COMPLETA (ni el nombre ajeno viaja).
   `createActivity` exige la misma coherencia al aceptar `sectionId` (404 sin escribir), y las
   secciones devueltas en listados de estudiante pasan por la misma guarda. Roja al reproducir:
   «una sección de A con periodo de B no entrega el nombre del periodo ajeno» → ahora pasa; HTTP
   en ambas direcciones y para el docente.
5. **`getActivity('act-A-pub')` devolvía el título `Unidad B` cuando la actividad tenía
   `sectionId = section-B1`.** La relación `section` (to-one, no filtrable en el `include`) se
   resuelve ahora con guarda en una consulta aparte (`seccionesGuardadas`): `id` ∈ referenciadas +
   `classroomId` del aula + `classroom.institutionId` + coherencia de período; FK nula o cruzada →
   `section: null` **sin leer la sección ajena**. Aplicado en `getActivity` (ambas ramas),
   `listActivities` (ambas ramas, en lote) y `updateActivity` (dentro de la tx); `createActivity`
   ya validaba la sección antes de escribir. Roja al reproducir: «una actividad de A enlazada a
   una sección de B no entrega el título de B» → ahora pasa; HTTP A→B, B→A e intra-colegio.

### Pruebas HTTP añadidas (9)

En `classroom-b1.http-isolation.spec.ts`: conteo de estudiante en `GET /classrooms` (asignado 3,
no asignado 2, B sin contaminación); actividad de otra aula enlazada a sección propia en
`GET /classrooms/:id` (A→B, B→A e intra-colegio, estudiante y docente); restringida en sección
para estudiante no asignado vs asignado; sección con período cruzado omitida (A→B y B→A);
`GET /classrooms/activities/:id` con sección cruzada → `null` (A→B y B→A, estudiante y docente);
`GET /classrooms/:id/activities` resuelve la sección propia (`Unidad A`) y devuelve `null` con FK
cruzada; `createActivity` con sección propia de período incoherente → 404 sin escribir. El doble
sigue filtrando de verdad (los `where` anidados y la resolución con guarda se evalúan sobre las
filas, no sobre respuestas prefijadas).

### Mutaciones temporales de esta fase (restauradas con `git checkout --`, verde tras cada una)

| Mutación | Rojas | Pruebas que se pusieron en rojo |
|---|---|---|
| (a) Conteo de `listForStudent` sin filtro de publicación/destinatarios | **2** | adversarial «…no cuenta borradores…» + HTTP «GET /classrooms del estudiante no cuenta borradores…» |
| (b) Actividades anidadas de `getById` sin `classroomId` | **2** | adversarial «actividad de B enlazada a sección de A…» + HTTP «…otra aula enlazada a una sección propia (A→B y B→A)» |
| (c) Actividades anidadas de `getById` sin regla de destinatarios | **2** | adversarial «…restringida…estudiante sin asignación» + HTTP «…no muestra la restringida en la sección…» |
| (d) Secciones de `getById` sin coherencia de período | **2** | adversarial «…sección de A con periodo de B…» + HTTP «…omite la sección cuyo período cuelga de otro colegio…» |
| (e) Guarda de secciones (`seccionesGuardadas`) sin `classroomId` | **0 → 1** | Primera pasada **sin rojas**: la pata `classroom.institutionId` ya cubría A↔B. Se reforzó el laboratorio con `section-otro-A1` (otra aula del MISMO colegio) + 2 pruebas, y entonces: HTTP «…FK de sección cruzada dentro del MISMO colegio…». La pata de institución queda demostrada por la reproducción original (5/5 en rojo). |
| (f) `createActivity` sin coherencia de período de la sección | **1** | HTTP «createActivity rechaza una sección propia con período incoherente…» |

### Cambios de comportamiento visibles de esta fase (deliberados)

- El conteo de actividades del listado de estudiante baja: ya no cuenta borradores ni restringidas
  que no son para ese estudiante (en el fixture: 4 → 3 para A1, 2 para A2).
- Una sección cuyo período cuelga de otro año o colegio se omite completa del detalle del aula
  (docente y estudiante) en vez de mostrar el nombre ajeno.
- Una actividad con `sectionId` cruzado se sigue devolviendo con `section: null` (ni 404 ni datos
  ajenos).
- `getActivity`/`updateActivity` devuelven la sección como `{ id, title, academicTermId }` (antes
  `{ id, title }`): aditivo, la misma forma que `listActivities`.
- El fixture gana `section-otro-A1` (sección coherente del otro aula de A) para hacer demostrable
  la guarda por `classroomId` dentro de la misma institución.
