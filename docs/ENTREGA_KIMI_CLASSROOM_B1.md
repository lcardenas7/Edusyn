# Entrega · Classroom Bloque 1 (Kimi)

Fecha: 2026-09-12 · Para: Astra (integración)
Encargo: `docs/ENCARGO_KIMI_CLASSROOM_BLOQUE_1.md`
Auditoría completa: `docs/AUDITORIA_AISLAMIENTO_CLASSROOM_B1.md`

---

## 0. Lo esencial en diez líneas

- Base: `origin/staging` en **`a61fba2d`**. Worktree **propio**:
  `C:\Users\LUIS C\Edusyn\worktrees\classroom-b1-kimi`. No se reutilizó ningún otro.
- Rama: **`codex/blindaje-classroom-b1-kimi`**. Sin push a `staging` ni a `main`.
- Alcance: **17 de las 98 rutas de Classroom** (6 de aulas + 11 de actividades/destinatarios).
  **El módulo NO queda cerrado: Classroom va 17/98.**
- Las 17 rutas viven en el nuevo `classroom-b1.controller.ts`, cada una con
  `requireInstitutionId` directo e incondicional; los 17 manejadores antiguos están borrados de
  `classroom.controller.ts`.
- **Las 17 entradas de `institution-route-exceptions.json` se retiraron en `9ac64f02`** (commit
  que toca solo ese fichero) y el contrato estructural quedó en verde (13/13).
- 89 pruebas de aislamiento (44 de servicio + 45 HTTP) sobre un fixture A/B exclusivo con filas
  incoherentes por cada cadena crítica.
- Suite API completa: **2255 pruebas, todas verdes**; contrato estructural incluido.
  `tsc --noEmit` limpio; `nest build` correcto; web 214/214 y tsc web limpio.
- El fixture encontró un **defecto funcional real** en mi propio blindaje (listados sin
  `institutionId`/`isPersonal` y estudiantes-para-asignación sin año ni `student.institutionId`),
  corregido en `7f1d9417` antes de cerrar pruebas.
- La **revisión adversarial de Astra** (`docs/REVISION_ASTRA_CLASSROOM_B1_20260912.md`) encontró
  5 defectos bloqueantes en la primera entrega; corregidos en `48ec81c5` + `3d5a7869` (ver §4a).
- Cuatro mutaciones temporales ejecutadas y revertidas en total (guarda aula→institución: 20
  rojas nuevas; rol desde `?role`: 4; validación `student.institutionId`: 3; proyección de
  estudiante: 2). Producción restaurada y `git diff` vacío tras cada una.
- No se tocaron las otras 81 rutas de Classroom, otros módulos, el esquema Prisma, migraciones,
  RLS, ni `ESTADO_BLINDAJE.md` / `REGISTRO_DESPLIEGUES.md` (los actualiza Astra al integrar).

---

## 1. Commits, en orden

| # | Hash | Mensaje | Contenido |
|---|---|---|---|
| 1 | `46e13d58` | `fix(classroom): acceso institucional compartido para el bloque 1` | `classroom-tenant-access.service.ts` (nuevo), módulo, servicio, specs adaptados a las nuevas firmas |
| 2 | `d9f86f42` | `fix(classroom): blinda las 6 rutas de aulas del bloque 1` | `classroom-b1.controller.ts` (nuevo), `dto/classroom-b1.dto.ts` (nuevo), 6 manejadores borrados del controlador original, servicio |
| 3 | `9d8ae2ac` | `fix(classroom): blinda las 11 rutas de actividades y destinatarios` | 11 rutas en el nuevo controlador, 11 manejadores borrados, servicio, DTOs, `activity-gating.service.ts` (parámetro `db` opcional) |
| 4 | `7f1d9417` | `fix(classroom): las listas del bloque 1 exigen la institucion en el aula y la cadena del estudiante` | Defecto funcional encontrado por el fixture (ver §2) |
| 5 | `aa16df0f` | `test(classroom): fixture A/B y pruebas de aislamiento del bloque 1` | `test/fixtures/classroom-b1.fixture.ts`, `classroom-b1.isolation.spec.ts` (34), `classroom-b1.http-isolation.spec.ts` (40) |
| 6 | `0177a8f7` | `docs(classroom): auditoria y entrega del bloque 1` | `docs/AUDITORIA_AISLAMIENTO_CLASSROOM_B1.md`, `docs/ENTREGA_KIMI_CLASSROOM_B1.md` |
| 7 | `9ac64f02` | `fix(classroom): retira las 17 excepciones del bloque 1` | **solo** `institution-route-exceptions.json` (−102 líneas); contrato en verde |
| 8 | `48ec81c5` | `fix(classroom): cadena completa en listados y destinatarios, proyeccion de estudiante y creacion transaccional` | Corrección de los 5 defectos de la revisión de Astra (§4a) |
| 9 | `3d5a7869` | `test(classroom): laboratorio de la revision de Astra para el bloque 1` | Fixture/doble ampliados + 15 pruebas de regresión (fallan contra `9ac64f02`, pasan tras el 8) |
| 10 | *(este doc)* | `docs(classroom): correccion de la entrega del bloque 1` | Los dos docs rectificados |

Los commits 1–6 dejaban el contrato estructural en rojo a propósito (17 `Remove obsolete
exception`); el 7 lo cerró. El 8 corrige producción y el 9 aporta el laboratorio que lo demuestra
(al igual que el contrato en su momento, el commit 8 deja rojas solo las aserciones que el 9
actualiza: el laboratorio y la corrección se verificaron juntos antes de separar los commits).

`package-lock.json` aparece modificado en el worktree desde antes del bloque (artefacto de
`npm install`); **no está comprometido** en ningún commit.

---

## 2. Qué cambió exactamente, para revisarlo rápido

### Ficheros tocados (los únicos)

```
apps/api/src/modules/classroom/classroom-tenant-access.service.ts   (nuevo)
apps/api/src/modules/classroom/classroom-b1.controller.ts           (nuevo, 17 rutas)
apps/api/src/modules/classroom/dto/classroom-b1.dto.ts              (nuevo)
apps/api/src/modules/classroom/classroom.controller.ts              (17 manejadores borrados)
apps/api/src/modules/classroom/classroom.service.ts                 (17 métodos reescritos a actor explícito)
apps/api/src/modules/classroom/classroom.module.ts                  (registro del controlador/servicio)
apps/api/src/modules/classroom/classroom.service.spec.ts            (adaptado a las firmas)
apps/api/src/modules/classroom/classroom-copy-contract.spec.ts      (adaptado a las firmas)
apps/api/src/modules/classroom/gating/activity-gating.service.ts    (parámetro db opcional)
apps/api/src/modules/classroom/classroom-b1.isolation.spec.ts       (nuevo, 34)
apps/api/src/modules/classroom/classroom-b1.http-isolation.spec.ts  (nuevo, 40)
apps/api/test/fixtures/classroom-b1.fixture.ts                      (nuevo)
docs/AUDITORIA_AISLAMIENTO_CLASSROOM_B1.md                          (nuevo)
docs/ENTREGA_KIMI_CLASSROOM_B1.md                                   (nuevo)
```

Los imports y decoradores supervivientes de `classroom.controller.ts` quedaron byte a byte
idénticos (verificado por diff); solo se borraron los 17 manejadores movidos.

### Los defectos de raíz

1. **`getById` leía cualquier aula de cualquier colegio sin comprobación alguna**:
   `findUnique({ where: { id } })` y respuesta completa (secciones, materiales, anuncios, docente)
   para cualquier usuario autenticado con cualquiera de los 4 roles.
2. **El query `?role` era un selector de privilegio controlado por el cliente** en
   `GET /classrooms`, `GET /classrooms/:id/activities` y `GET /classrooms/activities/:activityId`:
   omitirlo (o enviar `teacher`/cualquier valor) empujaba a un estudiante por la rama docente, con
   borradores, respuestas internas y conteos de entregas.
3. **`assignStudentsToActivity` aceptaba `studentEnrollmentIds` arbitrarios sin validar ninguno**
   y reescribía destinatarios con `deleteMany`+`createMany` **sin transacción**: ids de otro
   colegio quedaban escritos y un fallo intermedio dejaba la actividad sin destinatarios.
4. **Escrituras por id desnudo** (`update`/`deleteMany` sin `institutionId`) en actualización de
   aula y ciclo de vida de actividades.
5. **Ninguna cadena relacional se validaba en ninguna parte**: ni `group.campus/grade`, ni
   `subject.area`, ni `academicYear`, ni coherencia de la asignación con el aula.

### El defecto que el fixture encontró en el propio blindaje (`7f1d9417`)

Tras la primera pasada, los listados (`listForTeacher`/`listForStudent`) consultaban las aulas sin
`institutionId` ni `isPersonal: false`, y `getClassroomStudentsForAssignment` listaba matrículas
sin `academicYearId` ni `student.institutionId`. Con las filas incoherentes del fixture y el aula
personal de Edusyn Play, esas rutas cruzaban colegios o mezclaban años. Las pruebas lo pusieron en
rojo antes de la entrega y el commit lo corrige; quedan fijados por tests.

---

## 3. Cómo reproducir la verificación

Desde `apps/api` del worktree (si el `npm.cmd` de Windows muere con el transitorio 3221226505,
invocar jest directamente con el `node.exe` del runtime: mismos binarios, resultado completo):

```bash
npm test -- --runInBand classroom-b1 institution-route-contract
npm test -- --runInBand
npx tsc --noEmit
npm run build
cd ../web && npm test && npx tsc --noEmit
git diff --check origin/staging...HEAD
```

Resultados obtenidos en esta rama (2026-09-12, estado final tras la fase correctiva):

| Comando | Resultado |
|---|---|
| Focal `classroom-b1 institution-route-contract` | 104 suites · **2255** pruebas · **todas verdes** (contrato 13/13 incluido) |
| Suite API completa `--runInBand` | 104 suites · **2255** pruebas · **todas verdes** |
| `npx tsc --noEmit` (api) | limpio |
| `npm run build` (api) | correcto |
| `vitest run` (web) | 22 ficheros · **214** pruebas · verdes |
| `npx tsc --noEmit` (web) | limpio |
| `git diff --check origin/staging...HEAD` | limpio |

### Pruebas de mutación (resumen; detalle y listas completas en la auditoría, §6 y §10)

Primera entrega:
- **Mutación 1** (`classroomInScope` reducido a `where: { id }`): **20 pruebas nuevas en rojo**
  (11 de servicio + 9 HTTP). Las rutas colgadas de `activityInScope` y la lectura rica de
  `getById` siguieron en 404 por defensa en profundidad: cada guarda hace falta por separado.
- **Mutación 2** (`?role` vuelve a decidir la rama en las 3 rutas de lista/detalle): **4 pruebas
  nuevas en rojo**, las cuatro de `?role=student/teacher/inventado/ausente`. Bajo la mutación, un
  estudiante con `?role=teacher` recuperaba la rama docente: el defecto original, reproducido.

Fase correctiva:
- **Mutación (a)** (validación `student.institutionId` retirada de `getActivityAssignments`):
  **3 pruebas en rojo** (las dos nuevas de destinatario incoherente + la legítima de
  destinatarios, que vuelve a 2 filas).
- **Mutación (b)** (proyección de estudiante desactivada en `getById`): **2 pruebas en rojo**
  (las de proyección de servicio y HTTP).

No se publican scripts temporales; todas las mutaciones se revirtieron con `git checkout --` y la
suite volvió a 2255/2255 tras cada restauración.

---

## 4. Lo que debes saber antes de integrar

Cambios de comportamiento deliberados (detalle y motivo en la auditoría, §5):

1. **El query `role` deja de existir** en las 3 rutas de lista/detalle: un ESTUDIANTE real que lo
   omitía (y antes veía la vista docente) recibe ahora su vista de estudiante. Si algún cliente
   dependía de `?role=teacher` con un JWT de estudiante, pierde ese acceso: era el agujero.
2. **ACUDIENTE → 404** en las rutas de vista: `Guardian` no tiene `userId` en el esquema, así que
   no hay forma de acreditar la relación acudiente→estudiante. Antes un ACUDIENTE leía cualquier
   aula por id. Si producto quiere acceso de acudientes, hace falta primero ese vínculo en el
   esquema: es función nueva, no blindaje.
3. **Ids ajenos: 403 → 404** en gestión y vista (el 403 confirmaba existencia). El 403 se reserva
   para falta de permiso dentro del propio colegio.
4. **Aulas personales de Edusyn Play → 404** en estas 17 rutas (son exclusivamente
   institucionales).
5. **DTOs con lista blanca**: cuerpos con campos falsificados (`institutionId`, `teacherId`…)
   reciben 400. Los DTOs de actividad aceptan `shuffleQuestions`, `showResults`, `maxAttempts` y
   `timeLimitMinutes` porque el front ya los enviaba.
6. **`assignStudentsToActivity` es atómico y valida cada matrícula**: un lote mixto falla completo
   (404) sin tocar los destinatarios actuales. Un cliente que enviara ids inválidos confiando en
   que se ignoraban verá ahora un error.

Desviaciones respecto al plan inicial, todas declaradas: se eliminó el helper privado muerto
`resolveStudentEnrollment`; `ActivityGatingService.getClassroomEdges` acepta un `db` opcional;
`getActivityAssignments` filtra además por `studentEnrollment.institutionId`.

---

## 4a. Corrección tras la revisión adversarial de Astra (2026-09-12)

La primera entrega (punta `9ac64f02`) **no se integró**: la revisión
(`docs/REVISION_ASTRA_CLASSROOM_B1_20260912.md`) encontró 5 defectos bloqueantes. Detalle
completo en la auditoría, §10. Resumen:

1. **`getActivityAssignments`** ahora exige la cadena completa de la matrícula (institución +
   `student.institutionId` + año y grupo del aula): un destinatario preexistente incoherente
   (`aa-inc-A` → estudiante de B) ya no filtra PII de un menor de B.
2. **`listForTeacher`/`listForStudent`/`getAvailableAssignments`** exigen la cadena completa en
   la consulta; `listForStudent` exige `student.institutionId`; el conteo de estudiantes filtra
   institución y estudiante (**el número del fixture baja de 3 a 2**: antes lo inflaba la fila
   incoherente —cambio de comportamiento deliberado pedido por la revisión).
3. **`getById`** tiene proyección de estudiante en la consulta: sin secciones/materiales ocultos,
   `_count.activities` solo publicadas/visibles, períodos del año de la institución. El docente
   conserva su carga completa.
4. **`getActivity`** omite `_count.submissions` en la rama estudiante; **`listActivities`** filtra
   la entrega del actor por la `studentEnrollmentId` ya validada (no por `student.userId`).
5. **`create`/`createActivity`** ejecutan guarda + validaciones + escritura en una transacción;
   `sectionId`/`academicTermId`/`rubricId` ajenos o incompatibles → 404 antes de escribir
   (sección ajena: antes 403); la carrera de creación de aula la cubre el `@unique` de base y el
   P2002 se traduce al 403 funcional.

Las 15 pruebas nuevas **fallan contra `9ac64f02`** (25 rojas en total con las aserciones
actualizadas) y **pasan tras la corrección** (2255/2255). Dos mutaciones temporales más
(`student.institutionId`: 3 rojas; proyección de estudiante: 2 rojas), restauradas y en verde.

---

## 5. Pendiente explícito (no es parte de esta entrega)

- **`ESTADO_BLINDAJE.md` y `REGISTRO_DESPLIEGUES.md`**: los actualiza Astra al integrar; no los he
  editado.
- **Las otras 81 rutas de Classroom** (secciones, materiales, anuncios, entregas, rúbricas, Live
  Quiz, Edusyn Play…): conservan su excepción `pending-audit`.
- **El cron `processScheduledPublications`**, PostgreSQL/RLS, storage de archivos, permisos finos
  intra-institución no resueltos (auditoría §4), rendimiento y datos reales.

## 6. Fila propuesta para `ESTADO_BLINDAJE.md`

*(no la he escrito yo; la dejo redactada para que la integres)*

| Módulo | Rutas | Resueltas | Excepciones | Estado | Evidencia |
|---|---|---|---|---|---|
| Classroom | 98 | 17 (Bloque 1) | 81 pendientes | Bloque 1 blindado en aplicación (revisión Astra corregida); módulo NO cerrado | `docs/AUDITORIA_AISLAMIENTO_CLASSROOM_B1.md` · 89 pruebas A/B · rama `codex/blindaje-classroom-b1-kimi` |

---

## 7. Worktree y rama

- Worktree: `C:\Users\LUIS C\Edusyn\worktrees\classroom-b1-kimi`
- Rama: `codex/blindaje-classroom-b1-kimi` (base `a61fba2d`)
- Nada empujado a `staging` ni a `main`; ningún otro worktree tocado.
