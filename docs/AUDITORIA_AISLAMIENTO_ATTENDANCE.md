# Auditoría de aislamiento · Attendance

Fecha: 2026-09-11 · Autor: Claude · Base: `origin/staging` en `587cfc0b`
Rama: `codex/blindaje-attendance-claude` · Worktree propio, sin reutilizar el de `learning-route`.

Alcance: `apps/api/src/modules/attendance` completo — asistencia por asignatura, asistencia de
tutoría, reportes y auditoría forense. La corrección previa que usó Matrículas cubría solo
`AttendanceService.getStudentSummary`; no se ha extendido esa evidencia al resto.

---

## 1. Inventario reconciliado

Recontado sobre la base: **17 declaraciones HTTP**, exactamente como decía el encargo.

| Fichero | Rutas |
|---|---|
| `attendance.controller.ts` | 10 |
| `tutoring-attendance.controller.ts` | 7 |

Estado en la tabla de partida: 1 resolución directa (`summary`) y 16 excepciones `pending-audit`.
El recuento coincide; no hay diferencias que justificar.

Estado final: **17 de 17 con resolución directa**, 0 excepciones de Attendance.

---

## 2. Las 17 rutas, una por una

`REQ` = la ruta llama a `requireInstitutionId` de forma directa e incondicional (es lo que lee el
contrato estructural). Todas lo hacen ahora.

### `attendance.controller.ts`

| # | Ruta | Roles | Qué pasaba antes | Qué pasa ahora |
|---|---|---|---|---|
| 1 | `POST /attendance` | SUPERADMIN, ADMIN_INSTITUTIONAL, COORDINADOR, DOCENTE | La institución NO se resolvía. `recordBulk` cargaba `teacherAssignment` por id y deducía de esa fila el colegio y el año: con el id de otra institución se escribía asistencia **y auditoría** dentro de ella. `upsert` por la clave única `(teacherAssignmentId, studentEnrollmentId, date)`. Las matrículas no se validaban. | REQ. `assignmentInScope` (id + institución + `academicYear.institutionId` + `group.campus.institutionId`). Todas las matrículas deben ser del colegio, del grupo y del año de la asignación. Escritura con `updateMany` acotado + `create`, dentro de `$transaction` que revalida la asignación. Auditoría en la misma transacción. |
| 2 | `PUT /attendance/:id` | SUPERADMIN, ADMIN_INSTITUTIONAL, COORDINADOR, DOCENTE | Cargaba el registro por id y lo actualizaba por id: se editaba asistencia ajena y se escribía auditoría en el colegio ajeno. | REQ. `findFirst` acotado por institución **y por las relaciones** (`teacherAssignment.institutionId`, `studentEnrollment.institutionId`), `updateMany` acotado con `count === 1`, auditoría dentro de la transacción. Solo se editan `status` y `observations` (DTO con lista blanca). |
| 3 | `GET /attendance/by-assignment/:teacherAssignmentId` | SUPERADMIN, ADMIN_INSTITUTIONAL, COORDINADOR, DOCENTE | Id sin contexto: devolvía la asistencia de una asignación ajena. | REQ + `assignmentInScope` + `institutionId` en el `where`. Fecha inválida → 400. |
| 4 | `GET /attendance/by-student/:studentEnrollmentId` | …, ESTUDIANTE | Id sin contexto. Además un ESTUDIANTE leía la matrícula de un compañero. | REQ + `enrollmentInScope` + `institutionId` en el `where`. Un actor sin alcance institucional solo puede consultar la matrícula ligada a su `userId`; si no, **404**. |
| 5 | `GET /attendance/summary/:studentEnrollmentId` | …, ESTUDIANTE | Única ruta que ya resolvía institución (parche de Matrículas). Pero un ESTUDIANTE seguía pudiendo pedir la matrícula de un compañero, y el período no se validaba contra el colegio. | REQ + identidad del estudiante + el `academicTerm` debe ser del colegio **y del mismo año** que la matrícula. |
| 6 | `GET /attendance/report/consolidated` | SUPERADMIN, ADMIN_INSTITUTIONAL, COORDINADOR, RECTOR | Aceptaba `institutionId` por query **para cualquier usuario** y, si no llegaba, el reporte se armaba solo con el año: con el año de otro colegio devolvía sus datos. | REQ con la query pasada al resolvedor, que solo la honra para SuperAdmin. `institutionId` deja de ser opcional en el servicio. Año y materia validados; matrículas, registros, asignaciones y materias acotados. |
| 7 | `GET /attendance/report/teacher-compliance` | …, DOCENTE | Listaba asignaciones por año sin institución; los horarios (`scheduleEntry`) y el rango del año se consultaban sin acotar. | REQ. Año, grupo y materia validados antes de listar. `teacherAssignment`, `attendanceRecord` y `scheduleEntry` acotados. Se conserva el límite existente: un docente solo ve su propio cumplimiento. |
| 8 | `GET /attendance/report/:teacherAssignmentId` | SUPERADMIN, ADMIN_INSTITUTIONAL, COORDINADOR, DOCENTE | Id sin contexto y, si no existía, `throw new Error('Teacher assignment not found')` → **500**. | REQ + `assignmentInScope` → **404**. Matrículas y registros incluidos acotados. Fechas inválidas → 400. |
| 9 | `GET /attendance/report-by-group/:groupId` | …, RECTOR, DOCENTE | Grupo, año y materia sin contexto, en varias fases sin alcance propio. | REQ + `groupInScope` (por sede) + `yearInScope` + `subjectInScope` (por área). Registros acotados por institución y por `teacherAssignment.institutionId`. |
| 10 | `GET /attendance/detailed-report` | SUPERADMIN, ADMIN_INSTITUTIONAL, COORDINADOR, RECTOR | Año, grupo, materia, docente y matrícula sin contexto; `count` y `findMany` sin institución. | REQ + validación de año, grupo, materia y matrícula. `whereClause` con `institutionId`, `studentEnrollment` acotado por institución y sede, y `teacherAssignment: { institutionId }` **siempre**, haya o no filtros. |

### `tutoring-attendance.controller.ts`

| # | Ruta | Roles | Qué pasaba antes | Qué pasa ahora |
|---|---|---|---|---|
| 11 | `GET /tutoring-attendance/status` | SUPERADMIN, ADMIN_INSTITUTIONAL, COORDINADOR, RECTOR, DOCENTE | `resolveInstitutionId` + 400 manual. Correcta de fondo, pero sin la llamada que el contrato reconoce. | REQ. `institutionId` de query solo lo honra el resolvedor para SuperAdmin. Los grupos siguen acotándose por `campus.institutionId`. |
| 12 | `POST /tutoring-attendance/record` | ídem | **Defecto principal de tutoría**: la institución salía del grupo del cuerpo. Con un grupo ajeno se escribía tutoría en otra institución y la regla de «solo el director» se comprobaba contra el director de ese grupo ajeno. `upsert` por clave única. | REQ. El grupo debe ser del colegio del actor (`groupInScope`), las matrículas del colegio **y de ese grupo**, escritura con `updateMany`/`create` en una `$transaction` que revalida el grupo. El `teacherId` lo pone el JWT, no el cuerpo. |
| 13 | `GET /tutoring-attendance/by-group` | ídem | Sin institución: leía la tutoría de un grupo ajeno. | REQ + `groupInScope` + `institutionId` en el `where`. Fecha inválida → 400. |
| 14 | `GET /tutoring-attendance/student-summary` | ídem | Sin institución. | REQ + `enrollmentInScope` + `institutionId` en el `where`. |
| 15 | `GET /tutoring-attendance/report-by-group` | ídem | `assertCanReadGroupReport` cargaba el grupo por id y comprobaba el permiso interno: un grupo **ajeno** respondía **403**, confirmando que existía. El reporte tampoco recibía institución. | REQ. La frontera institucional va primero y es indistinguible de «no existe»: **404**. El 403 de «solo el director de grupo» se conserva, pero solo dentro del colegio. |
| 16 | `GET /tutoring-attendance/detailed-report` | ídem | Resolvía institución, pero ni el año ni el grupo ni la matrícula se validaban contra ella. | REQ + `yearInScope` / `groupInScope` / `enrollmentInScope`. Se conserva el acotamiento del docente a sus grupos dirigidos. |
| 17 | `POST /tutoring-attendance/toggle` | SUPERADMIN, ADMIN_INSTITUTIONAL | Resolvía institución, pero escribía con `update` por id del módulo. | REQ + `updateMany` acotado por `institutionId` con `count === 1`. Roles intactos. |

---

## 3. Cadenas relacionales del esquema

Comprobadas contra `schema.prisma`, no asumidas:

- `Group` **no tiene** `institutionId`. Su institución es `group.campus.institutionId`.
- `Subject` **no tiene** `institutionId`. Su institución es `subject.area.institutionId`.
- `TeacherAssignment`, `StudentEnrollment`, `AttendanceRecord`, `TutoringAttendance`,
  `AttendanceAuditEvent`, `ScheduleEntry`, `AcademicYear`, `AcademicTerm` e `InstitutionModule`
  sí llevan `institutionId` propio.

Donde la fila lleva `institutionId` **también** se filtra por la relación, porque hay FKs
históricas que pueden no ser coherentes (es la lección 2 de `eaa57408`). Ejemplo:
`assignmentInScope` exige a la vez `institutionId`, `academicYear.institutionId` y
`group.campus.institutionId`.

Guardas compartidas añadidas (privadas, mínimas, antes de cualquier colección o escritura):

| Guarda | Acota por | Falla con |
|---|---|---|
| `fecha` / `fechaOpcional` | valor de fecha | 400 |
| `assignmentInScope` | institución + año + grupo/sede | 404 |
| `enrollmentInScope` | institución + grupo/sede | 404 |
| `yearInScope` | institución | 404 |
| `groupInScope` | sede → institución | 404 |
| `subjectInScope` | área → institución | 404 |

---

## 4. Bloque 4 · Huecos de autorización fina (enumerados, NO modificados)

El encargo prohíbe inventar o ampliar permisos internos. Lo que sigue queda **igual que antes**
y se declara como pendiente para una decisión de producto:

1. `POST /attendance` y `PUT /attendance/:id` permiten a un **DOCENTE** registrar o corregir
   asistencia de **cualquier asignación de su colegio**, no solo de las suyas.
2. `GET /attendance/by-assignment/:id` y `GET /attendance/report/:id` dejan a un DOCENTE leer la
   asistencia de cualquier asignación del colegio.
3. `GET /attendance/report-by-group/:groupId` deja a un DOCENTE leer cualquier grupo del colegio.
4. `GET /attendance/by-student/:id` y `GET /attendance/summary/:id` dejan a un DOCENTE consultar a
   cualquier estudiante del colegio.
5. En tutoría, `by-group` y `student-summary` admiten DOCENTE **sin** comprobar dirección de
   grupo; solo `report-by-group` y `detailed-report` la comprueban.
6. `GET /attendance/report/teacher-compliance` sí restringe al docente a su propio `teacherId`.
   Es el único límite fino existente y se ha conservado.
7. Ningún rol de familia/acudiente está admitido en estas 17 rutas.

Ninguno de estos huecos cruza colegios: son de autorización dentro de la misma institución.

---

## 5. Cambios de comportamiento deliberados

Tres, y solo tres. Todos por la regla del encargo de no dejar escrituras parciales ni errores
genéricos:

1. **La auditoría deja de tragarse sus fallos.** `AttendanceAuditService.recordMany` capturaba
   cualquier error, lo escribía en el log y seguía, bajo la regla «auditar nunca debe romper el
   registro de asistencia». Sus dos llamadores escriben asistencia y auditoría en la MISMA
   transacción, así que el resultado real era: nota cambiada, cero rastro de quién la cambió. Ahora
   el error se registra **y se propaga**; la transacción revierte. Commit `9b5ce285`.
2. **Un grupo ajeno en tutoría pasa de 403 a 404.** Antes el 403 confirmaba la existencia del
   grupo de otro colegio.
3. **`getGroupAttendanceReport` pasa de 500 a 404** cuando la asignación no existe o es ajena.

Además, **ausencia de contexto institucional pasa de 500 a 400** en las 17 rutas. `requireInstitutionId`
lanza un `Error` genérico y Nest lo traduce a 500; el resolvedor está fuera de los ficheros que este
encargo permite tocar, así que la comprobación se hace en los controladores de Attendance con
`exigeContexto`, **antes** de la llamada literal a `requireInstitutionId` (que se conserva sin
envolver porque es la evidencia que lee el contrato estructural). Ver el parche externo propuesto
en la entrega.

---

## 6. Pruebas

Fixture A/B exclusivo: `apps/api/test/fixtures/attendance.fixture.ts`.

Doble de Prisma que **aplica filtros de verdad**: igualdad, `in`, `notIn`, `not`, `gte/gt/lte/lt`,
`contains`, `OR`/`AND`/`NOT` y **filtros por relación** anidados. Dos detalles que aquí importan:

- **Fechas por valor.** Asistencia filtra por `date` exacta y por rangos. Comparar objetos `Date`
  con `===` daría siempre falso y los reportes saldrían vacíos sin que ninguna prueba lo note.
- **Reversión real.** `$transaction` toma una instantánea y la restaura si la función lanza. La
  instantánea es superficial por fila, para no romper las referencias a relaciones embebidas ni
  convertir las fechas en cadenas (lo que haría un `JSON.parse(JSON.stringify(...))`).
- La relación inversa matrícula → registros es **no enumerable**: se puede filtrar y leer como en
  Prisma, pero no forma una referencia circular al serializar la respuesta.

| Suite | Pruebas | Qué demuestra |
|---|---|---|
| `attendance.isolation.spec.ts` | 67 | Rechazo por servicio en ambas direcciones, guardas antes de datos secundarios, fechas inválidas, atomicidad y aritmética legítima. |
| `attendance.http-isolation.spec.ts` | 56 | Las 17 rutas por HTTP real, con JWT, `RolesGuard` y `ValidationPipe` reales; solo Prisma es doble. |

Cobertura afirmada **también sobre lo que no ocurrió**: `noWrites` (ningún método de escritura en
ningún modelo), `noAudit` (ninguna fila forense en el colegio atacado) y conteo de filas por
institución antes/después.

Matriz HTTP: 15 de las 17 rutas se prueban con identificadores del otro colegio en las dos
direcciones (30 casos). Las otras dos —`status` y `toggle`— reciben `institutionId` y su respuesta
legítima no es 404: se prueban afirmando que **lo ignoran** y que la configuración del otro colegio
no se toca (4 casos). Además: identidad de estudiante (4), roles no permitidos (5), sin token (1),
`institutionId` falsificado en cuerpo (2), `teacherId` falsificado (1), ausencia de contexto (1),
fechas inválidas (3), y casos legítimos con aritmética (5).

### Prueba de mutación

Se retiró temporalmente la guarda institucional de `assignmentInScope` (dejando solo
`where: { id }`). Resultado: **8 pruebas en rojo** —`by-assignment` y `report/:id` en las dos
direcciones, por servicio y por HTTP—. El fichero se restauró y la suite volvió a verde
(123/123 en el módulo). El script temporal no se publica.

Detalle útil para quien revise: bajo esa mutación, `POST /attendance` cruzado **siguió en 404**,
porque la validación de matrículas lo ataja igualmente. Es defensa en profundidad real, no
redundancia: las dos guardas hacen falta por separado.

---

## 7. Verificación ejecutada

| Comando | Resultado |
|---|---|
| `npx jest` (apps/api) | 96 suites, **1908 pruebas**; 1907 verdes y 1 roja: el contrato estructural, que queda en verde con el commit final de excepciones |
| `npx tsc --noEmit` (apps/api) | limpio |
| `npx tsc --noEmit` (apps/web) | limpio |
| `npx vitest run` (apps/web) | 22 ficheros, **214 pruebas**, verdes |
| `npx nest build` (apps/api) | correcto |
| `npx jest src/common/security` | 13 pruebas; la de inventario exige el commit de excepciones |

---

## 8. Qué NO cubre esta auditoría

- **PostgreSQL y RLS.** Todo lo demostrado aquí es la guarda de la **aplicación**. No se ha tocado
  el esquema, ni migraciones, ni políticas RLS, ni se ha conectado a staging o producción.
- **Autorización fina dentro del colegio.** Los siete huecos del Bloque 4 siguen abiertos por
  decisión explícita del encargo.
- **El resolvedor `institution-resolver.ts`.** Está fuera de los ficheros permitidos. Su fallback a
  `InstitutionUser` y su `Error` genérico se han acotado solo en el borde de Attendance.
- **Despliegue Railway.** No se ha empujado nada a `staging` ni a `main`.
- **Frontend.** No se ha tocado `apps/web`; solo se ha verificado que sigue compilando y en verde.
- **Datos históricos ya incoherentes.** Las guardas impiden crear nuevas incoherencias y filtran las
  existentes, pero no reparan filas mal ligadas que ya estén en la base.
- **Rendimiento.** Las guardas añaden consultas de validación acotadas y baratas, pero no se ha
  medido su coste en volumen real.
- **Otros módulos.** Matrículas, Plantillas, APD, Classroom, Evaluation, Observer, R1 y EduLab no
  se han tocado. Ninguna firma pública usada por Matrículas ha cambiado de forma incompatible:
  `getStudentSummary(studentEnrollmentId, institutionId, academicTermId?)` conserva su firma.
