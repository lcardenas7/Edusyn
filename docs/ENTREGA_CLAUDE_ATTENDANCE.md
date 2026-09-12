# Entrega · Blindaje de Attendance (Claude)

Fecha: 2026-09-11 · Para: Astra (integración)
Encargo: `docs/ENCARGO_CLAUDE_BLINDAJE_ATTENDANCE.md`
Auditoría completa: `docs/AUDITORIA_AISLAMIENTO_ATTENDANCE.md`

---

## 0. Lo esencial en diez líneas

- Base: `origin/staging` en **`587cfc0b`** (ya con `learning-route` integrado y el parche
  transaccional `eaa57408`). Worktree **nuevo**; no se reutilizó la rama de `learning-route`.
- Rama: **`codex/blindaje-attendance-claude`**. Sin push a `staging` ni a `main`.
- 17 rutas auditadas, 17 con resolución directa. 16 excepciones retiradas, 0 reclasificadas.
- 123 pruebas nuevas (67 de servicio + 56 HTTP) sobre un fixture A/B exclusivo.
- Suite API completa en verde tras el commit de excepciones; web, tipos y build también.
- No se tocó Matrículas, Plantillas, APD, Classroom, Evaluation, Observer, R1, EduLab, el esquema
  Prisma, migraciones ni RLS. `ESTADO_BLINDAJE.md` y `REGISTRO_DESPLIEGUES.md` **sin tocar**.
- Tres cambios de comportamiento deliberados (sección 5) que conviene leer antes de integrar.

---

## 1. Commits, en orden

| # | Hash | Qué contiene | Ficheros |
|---|---|---|---|
| 1 | `c21effa5` | `fix(attendance): la institución la pone el actor en asistencia por asignatura` | `attendance.service.ts`, `attendance.controller.ts` |
| 2 | `c370c1df` | `fix(attendance): blinda la asistencia de tutoría y su configuración` | `tutoring-attendance.service.ts`, `tutoring-attendance.controller.ts` |
| 3 | `9b5ce285` | `fix(attendance): la auditoría de asistencia deja de ocultar sus fallos` | `attendance-audit.service.ts` |
| 4 | `a1212e70` | `test(attendance): laboratorio A/B por servicio y HTTP de las 17 rutas` | `test/fixtures/attendance.fixture.ts`, `attendance.isolation.spec.ts`, `attendance.http-isolation.spec.ts` |
| 5 | *(este doc)* | `docs(security): auditoría y entrega del blindaje de Attendance` | `docs/AUDITORIA_AISLAMIENTO_ATTENDANCE.md`, `docs/ENTREGA_CLAUDE_ATTENDANCE.md` |
| 6 | **punta de la rama** | `chore(security): retira las 16 excepciones de Attendance resueltas` | **solo** `apps/api/src/common/security/institution-route-exceptions.json` |

**El commit 6 es el único que toca el fichero de excepciones y no toca nada más**, como pide el
encargo. Los commits 1–5 dejan el contrato estructural en rojo a propósito (las excepciones
declaradas quedan obsoletas en cuanto la ruta resuelve directamente); el 6 lo cierra.

Cada commit compila por separado. Si prefieres integrar por partes, el orden 1 → 2 → 3 es
independiente entre sí; el 4 necesita 1–3; el 6 necesita 1 y 2.

---

## 2. Qué cambió exactamente, para revisarlo rápido

### Ficheros tocados (los únicos)

```
apps/api/src/modules/attendance/attendance.controller.ts
apps/api/src/modules/attendance/attendance.service.ts
apps/api/src/modules/attendance/attendance-audit.service.ts
apps/api/src/modules/attendance/tutoring-attendance.controller.ts
apps/api/src/modules/attendance/tutoring-attendance.service.ts
apps/api/src/modules/attendance/attendance.isolation.spec.ts        (nuevo)
apps/api/src/modules/attendance/attendance.http-isolation.spec.ts   (nuevo)
apps/api/test/fixtures/attendance.fixture.ts                        (nuevo)
apps/api/src/common/security/institution-route-exceptions.json      (solo commit 6)
docs/AUDITORIA_AISLAMIENTO_ATTENDANCE.md                            (nuevo)
docs/ENTREGA_CLAUDE_ATTENDANCE.md                                   (nuevo)
```

No se tocaron los DTOs ni `attendance.module.ts`: no hizo falta. El DTO ya tenía lista blanca de
campos editables (`status`, `observations`) y con `forbidNonWhitelisted` en `main.ts` un cuerpo con
`institutionId` falsificado responde 400 por sí solo (hay prueba).

### Los tres defectos de raíz

1. **`AttendanceService.recordBulk` deducía el colegio del recurso del cliente.** Cargaba
   `teacherAssignment` por id, sin institución, y de esa fila sacaba `institutionId` y
   `academicYearId`. Con el id de una asignación de otro colegio se escribían registros de
   asistencia **y filas de auditoría forense** dentro de esa institución.
2. **`TutoringAttendanceService.recordBulk` hacía lo mismo con el grupo**, y además la regla de
   «solo el director de grupo» se evaluaba contra el director de ese grupo ajeno: un administrador
   de A podía registrar tutoría en B.
3. **`assertCanReadGroupReport` comprobaba el permiso interno antes que la frontera institucional**,
   así que un grupo de otro colegio respondía 403 en vez de 404 y con eso confirmaba su existencia.

El resto de rutas compartía el mismo patrón más suave: identificadores sin contexto obligatorio y
fases posteriores del reporte (matrículas, registros, materias, horarios, asignaciones) consultadas
sin alcance propio.

### Guardas compartidas añadidas

`fecha`, `fechaOpcional`, `assignmentInScope`, `enrollmentInScope`, `yearInScope`, `groupInScope`,
`subjectInScope`. Son privadas y mínimas; se ejecutan antes de cualquier colección, agregado,
reporte, auditoría o escritura.

Dos detalles del esquema que conviene tener presentes al revisar:

- `Group` **no tiene** `institutionId` → se acota por `campus.institutionId`.
- `Subject` **no tiene** `institutionId` → se acota por `area.institutionId`.

Donde la fila sí lleva `institutionId`, se filtra **además** por la relación, por FKs históricas
incoherentes (lección 2 de `eaa57408`).

---

## 3. Excepciones: claves exactas retiradas

Las **16** entradas, todas `kind: "pending-audit"`, quedan obsoletas **por resolución directa**:
la ruta llama ahora a `requireInstitutionId` de forma incondicional y el inventario la marca
`resolved`. Ninguna se reclasificó a `non-institutional`: todas consultan o mutan datos
institucionales, así que no habría evidencia para hacerlo.

```
modules/attendance/attendance.controller.ts#AttendanceController.getByAssignmentAndDate @Get('by-assignment/:teacherAssignmentId')
modules/attendance/attendance.controller.ts#AttendanceController.getByStudent @Get('by-student/:studentEnrollmentId')
modules/attendance/attendance.controller.ts#AttendanceController.getConsolidatedReport @Get('report/consolidated')
modules/attendance/attendance.controller.ts#AttendanceController.getDetailedReport @Get('detailed-report')
modules/attendance/attendance.controller.ts#AttendanceController.getGroupAttendanceReport @Get('report/:teacherAssignmentId')
modules/attendance/attendance.controller.ts#AttendanceController.getReportByGroup @Get('report-by-group/:groupId')
modules/attendance/attendance.controller.ts#AttendanceController.getTeacherComplianceReport @Get('report/teacher-compliance')
modules/attendance/attendance.controller.ts#AttendanceController.recordBulk @Post()
modules/attendance/attendance.controller.ts#AttendanceController.update @Put(':id')
modules/attendance/tutoring-attendance.controller.ts#TutoringAttendanceController.getByGroupAndDate @Get('by-group')
modules/attendance/tutoring-attendance.controller.ts#TutoringAttendanceController.getDetailedReport @Get('detailed-report')
modules/attendance/tutoring-attendance.controller.ts#TutoringAttendanceController.getReportByGroup @Get('report-by-group')
modules/attendance/tutoring-attendance.controller.ts#TutoringAttendanceController.getStatus @Get('status')
modules/attendance/tutoring-attendance.controller.ts#TutoringAttendanceController.getStudentSummary @Get('student-summary')
modules/attendance/tutoring-attendance.controller.ts#TutoringAttendanceController.recordBulk @Post('record')
modules/attendance/tutoring-attendance.controller.ts#TutoringAttendanceController.toggleTutoring @Post('toggle')
```

`AttendanceController.getStudentSummary @Get('summary/:studentEnrollmentId')` no estaba en el
fichero: era la única resolución directa de partida. Sigue sin estar.

### Inventario global antes / después

| | Antes | Después |
|---|---|---|
| Excepciones totales en el fichero | **806** | **790** |
| Excepciones de Attendance | 16 | **0** |
| Rutas de Attendance con resolución directa | 1 de 17 | **17 de 17** |

No se regeneró la lista ni se tocó ninguna huella de otro módulo: el commit 6 es una eliminación de
16 objetos, nada más.

---

## 4. Cómo reproducir la verificación

Desde la raíz del worktree:

```bash
cd apps/api && npx jest
```

```bash
cd apps/api && npx tsc --noEmit
```

```bash
cd apps/api && npx nest build
```

```bash
cd apps/web && npx tsc --noEmit
```

```bash
cd apps/web && npx vitest run
```

Resultados obtenidos en esta rama:

| Comando | Resultado |
|---|---|
| `npx jest` (api) | 96 suites · **1908** pruebas · verdes con el commit 6 aplicado |
| `npx jest src/modules/attendance` | 2 suites · **123** pruebas · verdes |
| `npx jest src/common/security` | 13 pruebas · verdes con el commit 6 aplicado |
| `npx tsc --noEmit` (api) | limpio |
| `npx nest build` (api) | correcto |
| `npx tsc --noEmit` (web) | limpio |
| `npx vitest run` (web) | 22 ficheros · **214** pruebas · verdes |

Sin el commit 6, la única prueba roja de toda la suite es la de inventario del contrato
estructural, con 16 mensajes `Remove obsolete exception`. Es el comportamiento esperado.

### Prueba de mutación (hecha y revertida)

Se retiró la guarda institucional de `assignmentInScope` dejando `where: { id: teacherAssignmentId }`.
Resultado: **8 pruebas en rojo** en las dos direcciones y en las dos capas. Fichero restaurado,
`123/123` de nuevo en verde. El script temporal no se publica.

Dato útil: con esa mutación, `POST /attendance` cruzado **siguió devolviendo 404**, porque la
validación de matrículas lo ataja igual. Las dos guardas hacen falta por separado.

---

## 5. Lo que debes decidir antes de integrar

Tres cambios de comportamiento, deliberados, con su motivo:

1. **La auditoría ya no se traga sus fallos** (commit `9b5ce285`). La regla escrita en el fichero
   era «auditar NUNCA debe romper el registro de asistencia», pero como los dos llamadores escriben
   asistencia y auditoría en la misma transacción, tragarse el error dejaba la nota cambiada y cero
   rastro de quién la cambió: una escritura parcial presentada como éxito, justo lo que el encargo
   prohíbe. Ahora se registra en el log **y** se propaga, y la transacción revierte.
   *Si producto prefiere la regla anterior, el punto exacto a revertir son las tres líneas del
   `catch` en `attendance-audit.service.ts`.*
2. **Grupo ajeno en tutoría: 403 → 404.** Un cliente que distinguía ambos casos verá un cambio.
3. **Asignación inexistente o ajena en `report/:id`: 500 → 404.**

Y un parche que **no** pude aplicar por estar fuera de los ficheros permitidos:

> **Parche externo mínimo propuesto para `apps/api/src/common/utils/institution-resolver.ts`:**
> `requireInstitutionId` lanza `new Error('No se pudo determinar la institución…')`, que Nest
> traduce a **500**. Debería ser una `BadRequestException` (400): una sesión sin institución es una
> petición inválida, no un fallo del servidor. Es un cambio de una línea y afecta a todo el
> proyecto, por eso lo dejo propuesto y no hecho.
>
> Mientras tanto, en los dos controladores de Attendance hay un `exigeContexto(req, …)` que llama a
> `resolveInstitutionId` y lanza 400 si no hay institución, **antes** de la llamada literal a
> `requireInstitutionId`. La llamada literal se conserva sin envolver a propósito: es la evidencia
> que lee `institution-route-inventory.ts`, y envolverla en un helper hacía que el contrato marcara
> las 17 rutas como `Missing requireInstitutionId`. Para un usuario normal `resolveInstitutionId` no
> consulta la base (lee el claim del JWT), así que no añade coste.

---

## 6. Fila propuesta para `ESTADO_BLINDAJE.md`

*(no la he escrito yo; la dejo redactada para que la integres)*

| Módulo | Rutas | Resueltas | Excepciones | Estado | Evidencia |
|---|---|---|---|---|---|
| Attendance | 17 | 17 | 0 | Cerrado en aplicación (RLS y autorización fina aparte) | `docs/AUDITORIA_AISLAMIENTO_ATTENDANCE.md` · 123 pruebas A/B · rama `codex/blindaje-attendance-claude` |

## 7. Fila propuesta para la bitácora de despliegues

*(solo cuando se publique; yo no he empujado nada)*

| Fecha | Rama | Commits | Migración | Nota |
|---|---|---|---|---|
| *(pendiente)* | `staging` | `c21effa5`…`(punta)` | No | Blindaje multi-tenant de Attendance: 17 rutas con institución del actor, guardas de alcance, escrituras atómicas y 16 excepciones retiradas. Sin cambios de esquema. |

---

## 8. Qué NO cubre

- **PostgreSQL y RLS.** Lo demostrado es la guarda de la **aplicación**. Sin esquema, sin
  migraciones, sin políticas, sin conexión a staging ni a producción.
- **Autorización fina dentro del mismo colegio.** Siete huecos enumerados en el Bloque 4 de la
  auditoría (por ejemplo: un DOCENTE puede registrar asistencia de cualquier asignación de su
  colegio, no solo de las suyas). No se han tocado: el encargo prohíbe ampliar o inventar permisos.
- **`institution-resolver.ts`** y su fallback a `InstitutionUser`: fuera de alcance, ver el parche
  propuesto arriba.
- **Despliegue Railway.** Nada empujado.
- **Frontend.** `apps/web` sin cambios; solo se verificó que compila y pasa.
- **Datos históricos ya incoherentes.** Las guardas impiden crear nuevas incoherencias y filtran las
  existentes, pero no reparan filas mal ligadas.
- **Rendimiento** de las guardas en volumen real: no medido.
- **`tutoring-attendance` no tiene auditoría forense** equivalente a `AttendanceAuditEvent`. No la
  he añadido porque sería una función nueva, no un blindaje. Queda señalado.
