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
- **Las 17 entradas de `institution-route-exceptions.json` NO se han retirado**: el encargo las
  reserva a un commit separado de la fase de integración. Por eso el contrato estructural sigue en
  rojo a propósito con exactamente 17 mensajes `Remove obsolete exception`.
- 74 pruebas nuevas (34 de servicio + 40 HTTP) sobre un fixture A/B exclusivo con filas
  incoherentes por cada cadena crítica.
- Suite API completa: 2240 pruebas, 2239 verdes; la única roja es la del contrato por las 17
  excepciones pendientes (esperado). `tsc --noEmit` limpio.
- El fixture encontró un **defecto funcional real** en mi propio blindaje (listados sin
  `institutionId`/`isPersonal` y estudiantes-para-asignación sin año ni `student.institutionId`),
  corregido en `7f1d9417` antes de cerrar pruebas.
- Dos mutaciones temporales ejecutadas y revertidas (guarda aula→institución: 20 pruebas nuevas en
  rojo; rol desde `?role`: 4 nuevas en rojo). Producción restaurada y `git diff` vacío.
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
| 6 | *(este doc)* | `docs(classroom): auditoria y entrega del bloque 1` | `docs/AUDITORIA_AISLAMIENTO_CLASSROOM_B1.md`, `docs/ENTREGA_KIMI_CLASSROOM_B1.md` |
| 7 | **NO existe** | retirada de las 17 excepciones | **Pendiente: fase de integración (Astra).** Será un commit separado que toque **solo** `institution-route-exceptions.json`. |

Los commits 1–6 dejan el contrato estructural en rojo a propósito (17 `Remove obsolete
exception`); el commit 7, cuando se haga, lo cerrará para estas 17 rutas.

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

Desde `apps/api` del worktree:

```bash
npm test -- --runInBand classroom-b1
npx tsc --noEmit
```

Resultados obtenidos en esta rama (2026-09-12):

| Comando | Resultado |
|---|---|
| `npm test -- --runInBand classroom-b1` | 104 suites · **2240** pruebas · 2239 verdes; la única roja es `institution-route-contract.spec.ts` con exactamente los **17** `Remove obsolete exception` esperados |
| `npx tsc --noEmit` | limpio |
| Referencia → mutación 1 → restauración | 2239/1 → 21 rojas → 2239/1 |
| Referencia → mutación 2 → restauración | 2239/1 → 5 rojas → 2239/1 |
| `git diff` en `apps/api/src` tras las mutaciones | vacío |

### Pruebas de mutación (resumen; detalle y lista completa en la auditoría, §6)

- **Mutación 1** (`classroomInScope` reducido a `where: { id }`): **20 pruebas nuevas en rojo**
  (11 de servicio + 9 HTTP). Las rutas colgadas de `activityInScope` y la lectura rica de
  `getById` siguieron en 404 por defensa en profundidad: cada guarda hace falta por separado.
- **Mutación 2** (`?role` vuelve a decidir la rama en las 3 rutas de lista/detalle): **4 pruebas
  nuevas en rojo**, las cuatro de `?role=student/teacher/inventado/ausente`. Bajo la mutación, un
  estudiante con `?role=teacher` recuperaba la rama docente: el defecto original, reproducido.

No se publican scripts temporales; ambas mutaciones se revirtieron con `git checkout --`.

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

## 5. Pendiente explícito (no es parte de esta entrega)

- **Commit de retirada de las 17 excepciones** de
  `apps/api/src/common/security/institution-route-exceptions.json`: commit separado, solo ese
  fichero, en la fase de integración. Las otras 81 huellas de Classroom y las del resto de módulos
  no se tocan.
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
| Classroom | 98 | 17 (Bloque 1) | 81 pendientes + 17 por retirar | Bloque 1 blindado en aplicación; módulo NO cerrado | `docs/AUDITORIA_AISLAMIENTO_CLASSROOM_B1.md` · 74 pruebas A/B · rama `codex/blindaje-classroom-b1-kimi` |

---

## 7. Worktree y rama

- Worktree: `C:\Users\LUIS C\Edusyn\worktrees\classroom-b1-kimi`
- Rama: `codex/blindaje-classroom-b1-kimi` (base `a61fba2d`)
- Nada empujado a `staging` ni a `main`; ningún otro worktree tocado.
