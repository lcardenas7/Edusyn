# Auditoría técnica y funcional — Completitud, Cierre, Snapshot, Auditoría, Transición y Mapa de Configuración

> **Sesión de investigación. No se modificó código, esquema, migraciones ni UI.**
> Todo lo afirmado aquí está verificado leyendo el código real (`apps/api`, `apps/web`, `schema.prisma`).
> Lo que no pudo confirmarse se marca explícitamente como **NO CONFIRMADO**.

Fecha: 2026-08-16 · Rama: `main`

---

> ## ⚠️ Dos advertencias antes de leer
>
> ### A · Regla de interpretación de datos (oficial, vigente para toda la auditoría)
>
> **I.E.D. La Esperanza del Sur está desplegada en producción pero TODAVÍA NO usa el sistema
> académicamente.** Todos sus estudiantes, matrículas, períodos, aprendizajes, evidencias,
> valoraciones, boletines y configuraciones son **DATOS DE PRUEBA** creados durante el
> desarrollo, la validación y esta auditoría, salvo indicación explícita en contrario.
>
> **`PRODUCCIÓN ≠ DATOS ACADÉMICOS REALES`.** Para esta institución:
> `producción + uso exclusivamente de pruebas = datos de prueba`.
>
> **Esta regla NO se extiende al resto del despliegue: las demás instituciones SÍ contienen
> información académica real.** En consecuencia, toda migración, limpieza, eliminación de
> huérfanos, backfill, modificación masiva o reparación de datos **debe delimitarse
> explícitamente por institución** y nunca ejecutarse de forma global sin autorización
> específica.
>
> Un hallazgo sobre datos de La Esperanza del Sur se formula como **«defecto de integridad
> reproducido en producción mediante datos de prueba»**, nunca como daño, pérdida de
> información institucional o incidente académico. Sigue siendo plenamente válido para
> descubrir bugs, inconsistencias, flujos incorrectos y problemas de integridad o
> configuración.
>
> ### B · Este documento está parcialmente desactualizado en la zona cualitativa
>
> Se redactó contra un estado del árbol anterior a `f41fd4e`, `99b096a` y `720978d`. El esquema
> actual incluye `AchievementConfig.valuationScope` (`PURPOSE` \| `EVIDENCE`), el modelo
> `StudentEvidenceValuation` y `ConvivenciaEntry.items`. Todo lo que este documento afirma
> sobre el **grano de la valoración de Transición** y sobre la convivencia como texto libre
> debe leerse corregido por:
>
> - `docs/PLAN_TRANSICION_CORRECCION_Y_DISENO.md` — modelo real, plan y decisiones abiertas
> - `docs/F1_INTEGRIDAD_EVIDENCIAS.md` — fase F1, completada y cerrada
>
> Los hallazgos **C-1 a C-6 siguen vigentes**.

---

## 1. RESUMEN EJECUTIVO

### Qué tenemos realmente

| Pieza | ¿Existe? | Estado real |
|---|---|---|
| Motor de completitud | **Sí, pero hay 5 mecanismos distintos** | Ninguno es un "motor"; el principal es un **reporte de lectura** sin estados ni excepciones |
| Cierre de período | Sí (`OPEN → CLOSED → FINALIZED`) | Sólido en concepto; **`CLOSED` no bloquea nada en el servidor** |
| Ventana de calificación (`GradingPeriodConfig.isOpen`) | Sí | **Puramente cosmética: el backend nunca la consulta al escribir** |
| Snapshot legal de boletines | Sí (`TermReportCardSnapshot`) | Bien diseñado, con versión y motor único de resolución (`AcademicDataSourceService`) |
| Reapertura con motivo | Sí (`TermReopeningRecord`) | Se graba pero **no se puede consultar desde ninguna parte** |
| Auditoría forense de notas | Sí (`GradeAuditEvent`) | **Cubre exclusivamente `PartialGrade`.** Nada más. |
| Transición (cualitativo) | Sí, bastante completo en captura y boletín | **Fuera del ciclo de cierre: no puede cerrarse ni auditarse** |
| Casos especiales / no evaluado | **NO existe** | Confirmado por búsqueda exhaustiva |

### Qué está bien

1. **`AcademicDataSourceService`** (`apps/api/src/modules/reports/academic-data-source.service.ts`) es una pieza de arquitectura correcta: una sola regla de oro (`FINALIZED + snapshot → snapshot es la única verdad`), sin fallback silencioso, con `meta.source` explícito. **Esto se debe reutilizar tal cual para Transición.**
2. El versionado de snapshots (`version` incremental por término, `snapshotType`) soporta reapertura sin destruir historia.
3. El modelo de datos de Transición ya es rico: `Achievement` (con catálogo compartido por grado), `AchievementEvidence`, `AchievementLevelDescriptor`, `StudentAchievement` (con `academicTermId` propio), `ConvivenciaEntry`. **No hace falta modelo nuevo para capturar.**
4. `buildGroupReportCards` ya emite `learningBlocks` + `convivenciaText` + `reportContent` — el boletín de Transición ya funciona en vivo.

### Qué está incompleto (los 6 hallazgos críticos)

| # | Hallazgo | Consecuencia |
|---|---|---|
| **C-1** | `closeTerm` valida completitud **sólo con `PeriodFinalGrade`**, y Transición **nunca escribe `PeriodFinalGrade`** | **Un período con un solo grupo de Transición no se puede cerrar jamás.** Y por tanto no se puede finalizar ni generar snapshot. |
| **C-2** | `getCompletenessStatus` cuenta logros vía `achievement.teacherAssignment`, pero el catálogo compartido de Transición tiene `teacherAssignmentId = null` | Transición aparece **siempre 0 % en notas y 0 % en aprendizajes**, aunque el docente lo haya llenado todo. |
| **C-3** | `GradingPeriodConfig.isOpen` / `openDate` / `closeDate` **no se consultan en ningún camino de escritura** del backend | La "ventana de calificación" es un candado de UI. Un `POST` directo escribe igual. |
| **C-4** | `finalizeTerm` **no congela** `reportContent`, `academicStructure` ni `displayConfig` en el snapshot | Al finalizar, el boletín de Transición **cambia de aspecto** (pierde etiquetas Propósito/Imprescindible, granularidad, modo de valoración). El histórico no es fiel. |
| **C-5** | `GradeAuditEvent` sólo se escribe desde `partial-grades.service.ts` | **Cero auditoría** sobre valoraciones cualitativas, evidencias, convivencia, observaciones, notas finales manuales, generación y regeneración de boletines. |
| **C-6** | `TermReopeningRecord` no tiene endpoint de lectura ni UI | El motivo de reapertura se guarda pero es invisible. No hay historial consultable. |

### Qué está duplicado

- **5 mecanismos de completitud** distintos (§3).
- **2 lugares que deciden si el contenido descriptivo sale en el boletín** (`AchievementConfig.show*InReport` vs `ReportCardConfig.showAchievements`) — §10.1.
- **2 puntos de captura** de la misma `StudentAchievement` (`/grades` y `/achievements`) — §10.5.
- **3 significados distintos de "Observación"** — §10.4.
- **Un módulo completo huérfano**: "Desempeños" (`SubjectPerformance`, `PerformanceConfig`, `PerformanceLevelComplement`, `PerformanceManualEdit`) que **el boletín nunca consulta** — §10.6.
- **2 fuentes de escala** (`Institution.academicLevelsConfig` JSON vs tabla `PerformanceScale`) — resuelto correctamente por derivación, pero con una puerta trasera — §10.7.

### Corrección a una suposición del planteamiento

> "Existe un lugar donde se configura el aprendizaje/evidencia y existe un checkbox relacionado con 'mostrar en el boletín'."

**Parcialmente incorrecto.** No hay checkbox "mostrar en boletín" por aprendizaje ni por evidencia individual. `AchievementEvidence` sólo tiene `isActive` (activo/inactivo del catálogo, no visibilidad de boletín). Los checkboxes "mostrar" son **institucionales** y viven en `/achievements → Configuración` (`showLearningInReport`, `showEvidencesInReport`, `showLevelDescriptorInReport`, `showJudgmentInReport`). La duplicidad real es contra `ReportCardConfig.showAchievements` en `/report-cards → Configuración`, y contra los toggles de vista previa de esa misma pantalla. Detalle completo en §10.1.

---

## 2. MAPA DE ARQUITECTURA

### 2.1 Cadena de boletín (modelo → servicio → API → frontend → usuario)

```
PartialGrade ──(recalculateFinalGrade)──► PeriodFinalGrade ─┐
StudentAchievement + Achievement                            │
  + AchievementEvidence + AchievementLevelDescriptor  ──────┤
ConvivenciaEntry ───────────────────────────────────────────┤
AttendanceRecord ───────────────────────────────────────────┤
StudentObservation ─────────────────────────────────────────┤
EnrollmentArea / EnrollmentSubject (estructura congelada) ──┤
AchievementConfig + ReportCardConfig (flags) ───────────────┘
                              │
                              ▼
              ReportsService.buildGroupReportCards()
              apps/api/src/modules/reports/reports.service.ts:2594
                              │
                              ▼
              AcademicDataSourceService.getGroupReportCardData()
              (decide: live vs TermReportCardSnapshot)
              apps/api/src/modules/reports/academic-data-source.service.ts:102
                              │
                              ▼
              GET /reports/report-cards/group/:groupId        (controller:486)
              GET /reports/report-card/:enrollmentId/:termId
                              │
                              ▼
              apps/web/src/lib/api.ts → reportsApi
                              │
                              ▼
              apps/web/src/pages/ReportCards.tsx
                 └─ resolveTemplateKey → reportCardTemplates.ts
                     ├─ edusyn-clasico          (buildReportCardHtml, inline)
                     ├─ preescolar-narrativo    (buildPreescolarNarrativoHtml:227)
                     ├─ transicion-propositos   (buildTransicionPropositosHtml:396)
                     └─ multiperiodo-tabular    (buildMultiperiodoTabularHtml:288)
                              │
                              ▼
              Admin / Coordinador / Docente → PDF
```

### 2.2 Cadena de ciclo de vida del período

```
AcademicTerm.status:  DRAFT → OPEN → CLOSED → FINALIZED
                                ▲                  │
                                └──── reopen ──────┘

validateTermGrades(termId)      reports.service.ts:3693   GET  /reports/terms/:id/validate-grades
closeTerm(termId)               reports.service.ts:3784   POST /reports/terms/:id/close
finalizeTerm(termId, userId)    reports.service.ts:3830   POST /reports/terms/:id/finalize
reopenFinalizedTerm(...)        reports.service.ts:3976   POST /reports/terms/:id/reopen
reSnapshotTerm(termId, userId)  reports.service.ts:4035   POST /reports/terms/:id/re-snapshot
                                │
                                ▼
        apps/web/src/pages/academic/config/windows/GradingWindows.tsx
        (validar → cerrar → finalizar → reabrir)
        apps/web/src/pages/reports/AcademicReports.tsx  (re-snapshot, dentro del reporte de completitud)
```

### 2.3 Cadena paralela e independiente: ventana de calificación

```
GradingPeriodConfig (isOpen, openDate, closeDate, allowLateEntry, lateEntryDays)
        │
        ├── POST /grading-period-config/:termId       (ADMIN/COORD)  → escribe
        ├── GET  /grading-period-config?academicYearId (ADMIN/COORD) → pantalla admin
        ├── GET  /grading-period-config/status         (+DOCENTE)    → Grades.tsx:383
        └── GET  /grading-period-config/check/:termId  (+DOCENTE)    → SIN CONSUMIDOR en apps/web
                │
                ▼
        Grades.tsx bloquea la planilla en el cliente
                │
                ▼
        ❌ NINGÚN servicio de escritura del backend llama isPeriodOpen()
```

---

## 3. MOTOR DE COMPLETITUD

### 3.1 Inventario: existen CINCO mecanismos, ninguno es un motor

| # | Nombre | Ubicación | Alcance | ¿Consumido en UI? |
|---|---|---|---|---|
| **M1** | `getCompletenessStatus` | `reports.service.ts:4189` | Institución completa: grupo × asignatura × período | **Sí** — `/reports/academic` → "Estado de Completitud" |
| **M2** | `validateTermGrades` | `reports.service.ts:3693` | Institución: falta de `PeriodFinalGrade` | **Sí** — `GradingWindows.tsx` (validar/cerrar) |
| **M3** | Semáforo de planilla | `Grades.tsx:862` (cliente) | Una asignación docente | **Sí** — sólo numérico; **oculto para cualitativo y convivencia** (`Grades.tsx:1606`) |
| **M4** | `validatePeriodAchievements` + `getUnapprovedStudentAchievements` | `achievement.service.ts:887` y `:910` | Una asignación docente | **No** — declarados en `api.ts:1001-1003`, **sin ningún llamador en `apps/web`** |
| **M5** | `getConfigCompleteness` + `OnboardingStateService` | `institution-config.service.ts:685`, `onboarding-state.service.ts` | Configuración institucional (SIEE, año, carga) | **Sí** — `/configuracion-inicial` |

M5 es de **otro dominio** (puesta en marcha), no compite. M1–M4 sí se solapan.

### 3.2 M1 — Trazabilidad completa (el que el usuario llama "el motor")

**Base de datos → Servicio → API → Frontend → Componente → Usuario:**

1. **Modelos leídos** (6 consultas, ninguna escritura):
   - `AcademicTerm` (filtro por `academicYearId`, opcional `id`) → define el eje "período".
   - `Group` con `studentEnrollments.some({academicYearId, status:'ACTIVE'})` + `grade{name,stage}` + `_count` → define el eje "grupo".
   - `TeacherAssignment` (`groupId in`, `academicYearId`) con `subject.name` y `teacher.{firstName,lastName}` → **define qué asignaturas se esperan** y quién es el responsable.
   - `PeriodFinalGrade` (`institutionId`, `academicTermId in`, enrolment `ACTIVE` + `groupId in`) → índice `groupId|subjectId|termId → Set<enrollmentId>`.
   - `StudentAchievement` filtrado por `achievement.academicTermId in termIds` **y** `achievement.teacherAssignment.{groupId in, academicYearId}` → índice equivalente.
   - `StudentEnrollment` (`ACTIVE`) → denominador y nombres.
2. **Servicio**: `ReportsService.getCompletenessStatus(institutionId, academicYearId, termId?)`.
3. **API**: `GET /reports/academic/completeness-status?academicYearId&termId` — `reports.controller.ts:475`, `@Roles('SUPERADMIN','ADMIN_INSTITUTIONAL','COORDINADOR')`. `institutionId` se toma de `req.user.institutionId` (no del query).
4. **Cliente**: `reportsApi.getCompletenessStatus` — `apps/web/src/lib/api.ts:492`.
5. **Pantalla**: `apps/web/src/pages/reports/AcademicReports.tsx`, reporte `id: 'completeness-status'`, categoría "Gestión y Seguimiento" (`:83`); carga en `:521`; render en `:2851`; exportable a Excel/PDF (`:740`, `:793`).
6. **Usuario**: Admin o Coordinador. **El docente no tiene acceso** (rol excluido).

### 3.3 ¿Qué significa "completo"?

Se calcula por **celda = (grupo, asignatura, período, estudiante)**, y se agrega hacia arriba:

```
celda        → booleano: ¿existe el registro?
asignatura   → % sobre studentCount × terms.length
grupo        → % sobre subjects.length × studentCount × terms.length
institución  → summary.overallGradeCompleteness / overallAchievementCompleteness
```

Hay **dos ejes independientes** que nunca se combinan:
- `gradeCompleteness` → ¿existe `PeriodFinalGrade(enrollment, subject, term)`?
- `achievementCompleteness` → ¿existe `StudentAchievement` para esa combinación?

**Definición operativa de "completo": el registro existe en la tabla. Nada más.**
No se evalúa si el contenido es válido, si el docente terminó, si fue aprobado (`isTextApproved`), ni si todos los aprendizajes del período están valorados (basta **uno** para que el estudiante cuente como completo en esa asignatura).

### 3.4 Estados soportados vs. estados pedidos

| Estado que usted necesita | ¿Existe en M1? |
|---|---|
| Completo | Sí (celda con registro) |
| Incompleto | Sí (celda sin registro) |
| Pendiente | **No** — indistinguible de "incompleto" |
| No aplica | **No** |
| Sin datos | **No** — se representa como incompleto |
| Porcentaje | Sí, a 3 niveles (asignatura, grupo, institución) |
| ¿Quién falta? | Sí — `missingGradeStudents[]` y `missingAchievementStudents[]` con nombre y `enrollmentId` |
| ¿Qué falta? | Sí a nivel asignatura+período; **no** a nivel de aprendizaje o evidencia concreta |
| ¿Dónde falta? | Sí — grupo / asignatura / período |
| ¿Quién es el responsable? | Sí — `teacherName` por asignatura, pero **no hay agregación por docente**: no existe la vista "docente X va al 60 %" |

### 3.5 "El docente no ha terminado" vs "terminó pero hay casos especiales"

**El sistema NO distingue estos dos casos. No existe ninguno de los dos conceptos.**

- **"El docente terminó"**: no hay ningún estado de declaración. Existe un primitivo latente y no usado: `StudentAchievement.isTextApproved` / `isJudgmentApproved` / `approvedAt` / `approvedById`. Se escribe desde `POST /achievements/students/:id/approve` y desde `saveQualitativeGrades` (`Grades.tsx:1104`, que fuerza `isTextApproved: true` automáticamente). **M1 lo ignora por completo.** Además `Grades.tsx` lo pone en `true` al guardar, con lo cual el campo pierde su valor como declaración deliberada.
- **"Casos especiales"**: no existe ningún mecanismo (§8).

Resultado: un `95 %` en el panel de completitud significa exactamente "faltan celdas", sin poder decir si faltan porque el docente va a medias o porque esos estudiantes no debían evaluarse.

### 3.6 Defectos concretos de M1

| ID | Defecto | Evidencia |
|---|---|---|
| **C-2** | Transición marca 0 % en aprendizajes | El `where` de `studentAchievement` exige `achievement.teacherAssignment.{groupId, academicYearId}`. Los propósitos del catálogo compartido se crean con `teacherAssignmentId: null` (`achievement.service.ts:208`). Nunca entran al índice. |
| **C-2b** | Transición marca 0 % en notas | Transición no genera `PeriodFinalGrade` (§7.4). |
| A-1 | Aprendizajes anuales invisibles | Además del filtro anterior, se exige `achievement.academicTermId in termIds`; los aprendizajes anuales tienen `academicTermId = null`. |
| A-2 | El universo esperado ignora la estructura de la matrícula | M1 usa `TeacherAssignment` como verdad de "qué asignaturas debe tener el grupo". Existe `getExpectedSubjectIdsByEnrollment` (`reports.service.ts:131`), que sí respeta el snapshot `EnrollmentSubject`, pero **sólo se usa en otros dos reportes** (`:1372`, `:1453`), no en M1 ni en M2. |
| A-3 | `GroupSubjectException(EXCLUDE)` se ignora | Sólo lo consultan `templates.service.ts` y `grades-bulk-import.service.ts`. M1 y M2 no. |
| A-4 | Sin agregación por docente | No hay endpoint "completitud por docente". |
| A-5 | Coste | Sin `termId`, es `grupos × asignaturas × períodos × estudiantes` en memoria, sin paginación. |

---

## 4. CIERRE Y ESTADOS

### 4.1 Los dos "cierres" que conviven

Existen **dos ejes de bloqueo totalmente independientes**, sin relación entre sí. Ésta es la primera fuente de confusión del administrador.

| | Eje A — Ciclo de vida | Eje B — Ventana de calificación |
|---|---|---|
| Modelo | `AcademicTerm.status` | `GradingPeriodConfig` (1:1 con el término) |
| Valores | `DRAFT` / `OPEN` / `CLOSED` / `FINALIZED` (default `OPEN`) | `isOpen` + `openDate` + `closeDate` + `allowLateEntry` + `lateEntryDays` |
| Quién lo mueve | `ADMIN_INSTITUTIONAL`, `SUPERADMIN` | `ADMIN_INSTITUTIONAL`, `COORDINADOR`, `SUPERADMIN` |
| Dónde en la UI | `/academic/config/windows/grading` (mitad inferior de cada tarjeta) | `/academic/config/windows/grading` (mitad superior) **y** menú `Gestión Académica → Ventanas de Calificación` (misma pantalla, dos entradas de menú) |
| ¿Bloquea el backend? | **Sólo `FINALIZED`** | **Nunca** |
| ¿Genera snapshot? | Sí (`FINALIZED`) | No |
| ¿Deja registro? | Sólo la reapertura | No |

`DRAFT` está declarado en el enum y no lo escribe ningún servicio. **NO CONFIRMADO** que sea alcanzable.

### 4.2 Qué bloquea realmente cada estado

Búsqueda exhaustiva de guardas de estado en escritura (`grep` sobre `apps/api/src`):

```
evaluation-plans.service.ts:28     if (term?.status === 'FINALIZED') throw
partial-grades.service.ts:24       if (term?.status === 'FINALIZED') throw
partial-grades.service.ts:142      (bulk) valida FINALIZED
period-final-grades.service.ts:18  if (term?.status === 'FINALIZED') throw
```

**No hay ninguna otra guarda.** Consecuencias verificadas:

- `CLOSED` **no bloquea nada**. Un docente puede seguir escribiendo notas en un período "cerrado". El único efecto de `CLOSED` es habilitar el botón "Finalizar".
- `FINALIZED` bloquea `PartialGrade`, `PeriodFinalGrade` y `EvaluationPlan`. **No bloquea**: `StudentAchievement`, `AchievementEvidence`, `Achievement`, `ConvivenciaEntry`, `AttitudinalAchievement`, `StudentObservation`, `AttendanceRecord`.
  → **En un período FINALIZED, un docente de Transición puede seguir cambiando valoraciones y convivencia sin restricción.** El boletín no cambia (lo sirve el snapshot), pero los datos vivos y el snapshot divergen en silencio y sin traza.
- `GradingPeriodConfig.isOpen` no se consulta en ningún camino de escritura. `isPeriodOpen()` sólo tiene un llamador: su propio controlador (`GET /grading-period-config/check/:termId`), que además **no tiene consumidor en el frontend**. → **C-3**.

### 4.3 Respuestas puntuales

| Pregunta | Respuesta verificada |
|---|---|
| 1. ¿Quién puede cerrar? | `POST /reports/terms/:id/close` → `SUPERADMIN`, `ADMIN_INSTITUTIONAL`. **Coordinador no.** |
| 2. ¿Quién puede abrir? | Reapertura desde `FINALIZED`: mismos dos roles. Abrir la *ventana* (`isOpen`): además `COORDINADOR`. |
| 3. ¿Qué ocurre al cerrar? | `validateTermGrades` debe dar `isComplete === true` (100 % de `PeriodFinalGrade`); si no, `BadRequestException` con el detalle. Si pasa: `status = 'CLOSED'`. **No se genera nada, no se congela nada, no se registra quién lo cerró.** |
| 4. ¿Qué puede modificar un docente después de cerrar? | **Todo.** `CLOSED` no bloquea escritura. |
| 5. ¿Qué puede modificar un administrador? | Lo mismo que el docente. Tras `FINALIZED`, ninguno puede tocar notas numéricas; ambos pueden tocar todo lo cualitativo. |
| 6. ¿Queda registro? | Sólo de la **reapertura** (`TermReopeningRecord`). El cierre y la finalización **no dejan registro propio**; de la finalización se infiere el autor por `TermReportCardSnapshot.generatedById` y la fecha por `AcademicTerm.finalizedAt`. |
| 7. ¿Quién lo cerró? | **No se guarda.** (`RecoveryPeriodConfig` sí tiene `closedById`/`closedAt`; `GradingPeriodConfig` y `AcademicTerm` no.) |
| 8. ¿Cuándo? | `AcademicTerm.finalizedAt` sólo para finalizar. Para cerrar, sólo `updatedAt`. |
| 9. ¿Cerrar la ventana ≠ finalizar el período? | **Sí, son cosas distintas y ambas se llaman "cerrar" en la UI.** Ventana = `GradingPeriodConfig.isOpen` (sin efecto real). Finalizar = `status FINALIZED` + snapshot. Entre medias existe un tercer "cerrado" (`status CLOSED`) que tampoco es ninguno de los dos. **Tres cosas, un solo nombre.** |
| 10. ¿Cerrar calificaciones ≠ generar boletines? | **No, están fusionados.** `finalizeTerm` hace las dos cosas en una sola operación atómica-en-intención: cambia el estado y genera los snapshots de todos los grupos. No existe "generar boletines" como acción separada. Lo más parecido es `reSnapshotTerm`, que es una operación de reparación. |

### 4.4 Defectos concretos del cierre

| ID | Defecto |
|---|---|
| **C-1** | `closeTerm` es inalcanzable con Transición: `validateTermGrades` exige `PeriodFinalGrade` para **toda** asignatura de **todo** grupo con matrícula activa, incluidos los grupos `DIMENSIONS`, que nunca la producen. |
| **C-3** | La ventana de calificación es un candado de UI. |
| B-1 | `CLOSED` es un estado sin semántica de bloqueo. |
| B-2 | El cierre no registra actor ni fecha. |
| B-3 | `finalizeTerm` **captura y descarta errores por grupo** (`catch { console.error }`, `:3947`). Si un grupo falla, el término queda `FINALIZED` **sin snapshots para ese grupo**. `AcademicDataSourceService` lo detecta después y lanza `ConflictException` con mensaje `[INTEGRITY]` (`:121`). Es decir: el defecto se convierte en un error visible mucho más tarde, al intentar imprimir. |
| B-4 | Los snapshots se crean uno a uno con `create()` en bucle, **sin transacción** (`:3943`). Una caída a mitad deja el término parcialmente fotografiado. |
| B-5 | `reSnapshotTerm` pone el término en `OPEN` temporalmente para poder leer datos vivos (`:4082`) y lo restaura en `finally`. Durante esa ventana, **cualquier escritura concurrente pasa la guarda de `FINALIZED`**. |

---

## 5. SNAPSHOT Y GENERACIÓN

### 5.1 Antes de finalizar — ¿datos vivos?

**Sí.** `AcademicDataSourceService.resolveTermInfo` → si `status !== 'FINALIZED'`, se llama a `buildLiveFn` (que es `buildGroupReportCards`). Aplica igual a `OPEN` y a `CLOSED`.

Para reportes analíticos (`getTermGradeData`), si se consulta el año completo y hay mezcla de estados, **se usa live para todo** deliberadamente, para no mezclar fuentes (`academic-data-source.service.ts:305`).

### 5.2 Durante la generación — qué se congela

`finalizeTerm` (`reports.service.ts:3910-3940`) guarda, **por estudiante**, este JSON en `TermReportCardSnapshot.data`:

| Campo congelado | Contenido | ¿Cubre Transición? |
|---|---|---|
| `institution`, `academicYear`, `term` | Cabecera | Sí |
| `student`, `group` | Identidad + director de grupo | Sí |
| `areaGrades` | Áreas → asignaturas, **incluyendo** `learningBlocks`, `convivenciaText`, `displayHours`, `subjectType`, `qualitativeObservation`, `judgment` | **Sí** |
| `subjectGrades` | Versión plana de lo anterior | Sí |
| `structureSource` | `'snapshot'` \| `'calculated'` | Sí |
| `attendance` | Totales del período | Sí |
| `achievements` | Lista de `StudentAchievement` resueltos (descripción, nivel, evidencias, descriptor, juicio, observación) | **Sí** |
| `observations` | Hasta 10 `StudentObservation` del período | Sí |
| `rank`, `totalStudentsRanked`, `generalAverage`, `approvedSubjectsCount`, `failedSubjectsCount`, `promotionStatus` | Derivados | Se calculan pero para Transición quedan `null`/`PENDIENTE` (no hay notas numéricas) |
| **`academicStructure`** | — | ❌ **NO se guarda** |
| **`displayConfig`** | — | ❌ **NO se guarda** |
| **`reportContent`** | — | ❌ **NO se guarda** |

**C-4 en detalle.** `buildGroupReportCards` devuelve `academicStructure`, `displayConfig` y `reportContent` en la raíz (`:3368-3370`), y `getReportCardData` los reenvía al cliente en el camino live (`:179-181`). Pero `finalizeTerm` **no los incluye** en `data`. Y `AcademicDataSourceService.getGroupReportCardData` los reconstruye leyéndolos del snapshot (`:141-142`) → llegan `undefined`; `reportContent` ni siquiera se reconstruye.

Impacto medible en el boletín de Transición:

| Consumidor | Comportamiento en vivo | Comportamiento tras FINALIZED |
|---|---|---|
| `buildTransicionPropositosHtml` `rc.learningLabelSingular` / `evidenceLabelPlural` (`reportCardTemplates.ts:398-400`) | "Propósito" / "Imprescindibles" | vuelve a "Aprendizaje" / "Evidencias" |
| `rc.showEvidences !== false` (`:456`) | respeta la configuración | `undefined !== false` → **las evidencias se muestran siempre**, aunque estén desactivadas |
| `rc.showLevelDescriptor` (`:460`) | respeta la configuración | `undefined` → **el descriptor desaparece siempre** |
| `rc.preschoolLevelDisplay` (`:429`) | `SINGLE` o `COLUMNS` | vuelve a `COLUMNS` |
| `rc.showZeroAbsences` (`:413`) | respeta la configuración | vuelve a ocultar el 0 |
| `ctx.achievementContent` (`ReportCards.tsx:903`) | objeto con flags | `undefined` → `renderLearningBlocks` cae al **fallback histórico** (`reportCardTemplates.ts:119`) y muestra sólo la narrativa |

Es decir: **el documento oficial congelado no se parece al que el administrador aprobó.** Éste es el defecto más grave para Transición después de C-1.

### 5.3 Después de generar — qué consulta el boletín

`FINALIZED` → **snapshot y sólo snapshot**, sin fallback ni comparación. Si no hay snapshot para el estudiante o el grupo, se lanza `ConflictException` con log `[INTEGRITY]`. Esta política es correcta y está bien documentada en el propio archivo.

Excepción a tener presente: `getReportCardYear` (boletín multiperíodo, `:249`) llama a `getReportCardData` **período a período**, por lo que mezcla naturalmente snapshot (períodos finalizados) y live (período en curso). Es el comportamiento deseado, pero significa que un boletín multiperíodo **no es un documento congelado**.

### 5.4 Identificación de la generación

| Pregunta | Respuesta |
|---|---|
| ¿Quién genera? | `SUPERADMIN` / `ADMIN_INSTITUTIONAL`, vía `GradingWindows.tsx` |
| ¿Cuándo? | `TermReportCardSnapshot.generatedAt` (default `now()`) + `AcademicTerm.finalizedAt` |
| ¿Cuántos boletines? | Uno por (estudiante `ACTIVE`, término, versión). El retorno trae `totalSnapshots`. |
| ¿Por estudiante? | Sí — `studentEnrollmentId` |
| ¿Por período? | Sí — `academicTermId` |
| ¿Qué versión? | `version` = `max(version) + 1` **por término** (no por estudiante) |
| ¿Quién lo generó? | `generatedById` → relación `SnapshotGeneratedBy` a `User` |
| ¿Cómo se identifica? | Clave única `(academicTermId, studentEnrollmentId, version)` + `snapshotType` |
| ¿`snapshotType` se usa? | `finalizeTerm` y `reSnapshotTerm` escriben **siempre `INITIAL_CLOSE`**. Sólo `RecoverySnapshotService` escribe `POST_RECOVERY`. **`FINAL_CLOSE` y `REOPENED` están declarados y nunca se escriben.** |

### 5.5 Consecuencia del punto anterior

Como una re-finalización tras reapertura también escribe `INITIAL_CLOSE`, **es imposible distinguir por tipo un cierre original de una corrección**. Sólo queda la correlación indirecta `TermReopeningRecord.previousVersion` ↔ `version`. Sumado a §6.3 (no hay lectura de esos registros), el historial es reconstruible sólo por consulta directa a la base de datos.

---

## 6. REAPERTURA Y CORRECCIÓN

### 6.1 El flujo real

```
FINALIZED
   │  POST /reports/terms/:id/reopen  { reason }   (ADMIN | SUPERADMIN)
   │  · exige status === 'FINALIZED'
   │  · exige reason.trim().length >= 10
   │  · crea TermReopeningRecord{ academicTermId, reopenedById, reason, previousVersion }
   │  · status = 'OPEN', finalizedAt = null
   │  · ❌ NO toca los snapshots existentes (correcto)
   ▼
 OPEN  ── el docente corrige ──►  ❌ ningún registro de qué cambió (salvo PartialGrade, §7)
   │
   │  POST /reports/terms/:id/close    → vuelve a exigir 100 % de PeriodFinalGrade
   ▼
CLOSED
   │  POST /reports/terms/:id/finalize → version = max+1, snapshotType = 'INITIAL_CLOSE'
   ▼
FINALIZED (v2)
```

**Atajo existente:** `POST /reports/terms/:id/re-snapshot` regenera snapshots **sin** salir de `FINALIZED` y **sin** crear `TermReopeningRecord`. Está expuesto en `AcademicReports.tsx:2863` dentro del reporte de completitud, con un `confirmDialog`. Es una herramienta de reparación técnica presentada como un botón operativo normal, y **es un camino de regeneración sin motivo ni auditoría**.

### 6.2 Respuestas puntuales

| Pregunta | Respuesta |
|---|---|
| ¿Quién puede reabrir? | `SUPERADMIN`, `ADMIN_INSTITUTIONAL` |
| ¿Qué motivo se exige? | Texto libre, mínimo 10 caracteres. Sin catálogo de causales, sin acta, sin adjunto. |
| ¿Qué queda registrado? | `id`, `academicTermId`, `reopenedById`, `reason`, `previousVersion`, `reopenedAt` |
| ¿Qué versión anterior queda relacionada? | `previousVersion` (número, no FK al snapshot) |
| ¿Qué ocurre con el snapshot anterior? | **Se conserva íntegro.** Nunca se borra ni se marca. |
| ¿Cómo se genera la nueva versión? | Sólo tras `close` + `finalize`; `version = max+1` |
| ¿Cómo queda el historial? | En la tabla, correcto y completo |
| ¿El usuario puede consultarlo? | **No.** — **C-6** |

### 6.3 C-6 en detalle

`TermReopeningRecord` se **escribe** en `reports.service.ts:4000` y se **lee** en un solo sitio: `academic-data-source.service.ts:344`, y sólo para un `count()` que alimenta `meta.wasReopened` y un `console.warn`. **No existe ningún endpoint que liste los registros de reapertura, ni ninguna pantalla que los muestre.** Tampoco existe endpoint para listar versiones de snapshot. `ReportsService` conserva además dos métodos privados muertos (`getSnapshotForStudent:4539`, `getSnapshotsForTerm:4555`) que duplican la lógica ya centralizada en `AcademicDataSourceService`.

### 6.4 ¿Cubre lo cualitativo?

| Dato | ¿Se congela en el snapshot? | ¿Se bloquea al FINALIZED? | ¿Se audita el cambio? |
|---|---|---|---|
| Notas cuantitativas (`PeriodFinalGrade`) | Sí | **Sí** | Sólo el `PartialGrade` origen |
| Notas parciales (`PartialGrade`) | No directamente (sí su cálculo) | **Sí** | **Sí** |
| Valoración cualitativa (`StudentAchievement`) | Sí (`areaGrades[].subjects[].learningBlocks`, `achievements[]`) | **No** | **No** |
| Aprendizaje / propósito (`Achievement`) | Sí (texto embebido) | **No** | **No** |
| Evidencia (`AchievementEvidence`) | Sí (texto embebido) | **No** | **No** |
| Descriptor por nivel (`AchievementLevelDescriptor`) | Sí (resuelto) | **No** | **No** |
| Convivencia (`ConvivenciaEntry`) | Sí (`subjects[].convivenciaText`) | **No** | **No** |
| Observación del docente (`StudentAchievement.observation`) | Sí | **No** | **No** |
| Observador (`StudentObservation`) | Sí (10 primeras) | **No** | **No** |
| Asistencia (`AttendanceRecord`) | Sí (totales) | **No** | Sí (`AttendanceAuditEvent`) |
| Flags de presentación (`reportContent`) | **NO** | n/a | **No** |

**Conclusión:** la reapertura funciona como mecanismo de *estado*, pero la **corrección de lo cualitativo no está ni bloqueada ni auditada**. El snapshot protege el documento; nada protege el dato.

---

## 7. AUDITORÍA — INVENTARIO VERIFICADO

### 7.1 Qué escribe `GradeAuditEvent`

Búsqueda exhaustiva (`grep -rn "gradeAudit\.\|gradeAuditEvent" apps/api/src`):

```
grade-audit.service.ts:47                → único punto de escritura (createMany)
partial-grades.service.ts:110, 118       → CREATE / UPDATE en upsert individual
partial-grades.service.ts:218, 295, 735  → recordMany en resolución de conflictos y borrados
partial-grades.service.ts:605            → un caso adicional
```

**No hay ningún otro llamador en todo el backend.** Además, `source` nunca se pasa en ninguna llamada → **el 100 % de los eventos tiene `source = 'PARTIAL_GRADE'`** (el default del modelo). El campo `source` está preparado para más orígenes pero está sin usar.

### 7.2 Inventario solicitado

| Información | ¿Auditada? | ¿Dónde? | ¿Qué registra? |
|---|---|---|---|
| **Nota cuantitativa (`PartialGrade`)** | **Sí** | `GradeAuditEvent` vía `partial-grades.service.ts` | acción, actor (id/nombre/rol), estudiante, asignación, término, componente, actividad, `previousScore`, `newScore`, timestamp |
| **Nota final (`PeriodFinalGrade`)** | **No** | — | Ni la escritura manual (`period-final-grades.service.ts:34`) ni el recálculo (`partial-grades.service.ts:503`) ni el import (`grades-bulk-import`, `historical-grades-import`) ni la recuperación (`period-recovery.service.ts:500,573`) generan evento |
| **Valoración cualitativa (`StudentAchievement`)** | **No** | — | Sólo `approvedById` / `approvedAt` en la propia fila (estado, no historia) |
| **Aprendizaje (`Achievement`)** | **No** | — | — |
| **Evidencia (`AchievementEvidence`)** | **No** | — | Peor: `updateAchievement` hace `deleteMany` + `createMany` (`achievement.service.ts:339-344`), destruyendo el histórico de IDs sin dejar rastro |
| **Descriptor por nivel** | **No** | — | Mismo patrón destructivo (`:328-333`) |
| **Convivencia (`ConvivenciaEntry`)** | **No** | — | Sólo `createdById` + `updatedAt`, sobrescritos en cada upsert |
| **Observación de aprendizaje** | **No** | — | — |
| **Observación del observador (`StudentObservation`)** | Parcial | Modelo propio con `author`, `status` (`ObserverEntryStatus`) | Es un registro de seguimiento, no una auditoría de cambios |
| **Casos especiales** | n/a | — | **No existe el concepto** (§8) |
| **Reapertura** | **Sí** | `TermReopeningRecord` | actor, motivo, versión previa, fecha. **Sin lectura expuesta (C-6)** |
| **Cierre (`CLOSED`)** | **No** | — | Ni actor ni fecha |
| **Generación de boletín (`finalizeTerm`)** | **Parcial** | `TermReportCardSnapshot.generatedById` + `generatedAt`, `AcademicTerm.finalizedAt` | Se infiere del artefacto, no hay evento propio |
| **Regeneración (`reSnapshotTerm`)** | **Parcial** | Igual que arriba, nueva `version` | **Indistinguible de una finalización normal** (mismo `snapshotType`), sin motivo |
| **Asistencia** | **Sí** | `AttendanceAuditEvent` (`attendance-audit.service.ts:37`) | Modelo espejo de `GradeAuditEvent` |
| **Permisos** | Sí | `PermissionAuditLog` | Fuera de alcance |
| **Matrícula** | Sí | `EnrollmentEvent` (con `previousValue`/`newValue`/`reason`/`academicActId`) | **Es el mejor modelo de auditoría del sistema y el patrón a imitar** |

### 7.3 Dónde se consulta la auditoría

Sólo desde SuperAdmin: `superadmin.service.ts:548-610` (`getGradeAuditLog`, contadores y últimos 5 eventos). **El administrador institucional no tiene ninguna vista de auditoría de notas.**

### 7.4 Nota de diseño correcta que conviene preservar

`GradeAuditService.recordMany` atrapa sus propios errores y sólo loguea: *"auditar NUNCA debe romper el guardado de la nota"* (`grade-audit.service.ts:69`). Es una decisión deliberada y buena. Al extender la auditoría, mantenerla.

---

## 8. CASOS ESPECIALES

### 8.1 Veredicto

**NO EXISTE ningún mecanismo de caso especial, no-evaluado, N/A, excepción, justificación ni exclusión de completitud a nivel de estudiante.** Verificado por búsqueda exhaustiva de `NO_EVALUADO`, `NOT_EVALUATED`, `notEvaluated`, `EXONERAD`, `exempt`, `isExempt`, `NO_APLICA`, `NOT_APPLICABLE` en `apps/api/src`, `apps/web/src` y `schema.prisma`. Los únicos aciertos son de dominios ajenos (`PaymentStatus.EXEMPT`, `dianStatus` de facturación).

### 8.2 Lo que sí existe y qué cubre cada cosa

| Mecanismo | Granularidad | Qué hace | ¿Sirve como caso especial? |
|---|---|---|---|
| `EnrollmentStatus` (`ACTIVE`, `WITHDRAWN`, `TRANSFERRED`, `PROMOTED`, `REPEATED`, `GRADUATED`) | Estudiante × año | Todo el sistema filtra `status: 'ACTIVE'`. Un retirado **desaparece** de completitud, de boletines y de snapshots. | **Parcialmente, y mal.** Sirve para "retirado", pero es todo-o-nada: no hay "estuvo hasta el P2". El snapshot de períodos anteriores ya generados sí lo conserva; los que se generen después, no. |
| `EnrollmentEvent` | Estudiante × evento | Auditoría legal de movimientos con `reason`, `previousValue`/`newValue` y `academicActId` | Sirve como **modelo de referencia**, no como excepción de evaluación |
| `GroupSubjectException` (`EXCLUDE`/`INCLUDE`/`MODIFY`) | **Grupo** × asignatura × año | Excepción de plan de estudios | **No** — es de grupo, no de estudiante; y **ni M1 ni M2 lo consultan** |
| `EnrollmentArea` / `EnrollmentSubject` | Estudiante × año | Estructura académica congelada al matricular | **Es la infraestructura correcta para expresar "qué se le exige a este estudiante"**, pero M1 y M2 la ignoran |
| `AcademicAct` / `PromotionStatus` | Estudiante | Actas y promoción excepcional | Fin de año, no período |
| `PedagogicalSupportPlan` / `EducationalSupportProfile` | Estudiante | Acompañamiento e inclusión | Documenta el apoyo, **no exime de la valoración** |

### 8.3 Cómo se resuelve hoy en la práctica

Un estudiante que ingresó tarde, no asistió o no debe evaluarse **queda como celda faltante indistinguible de una omisión del docente**, y **bloquea `closeTerm` al 100 %**. La única salida operativa hoy es inventar una nota o retirar la matrícula — ambas dañan el histórico.

**Confirmación explícita: no hay nada reutilizable para casos especiales. Aquí sí hay que crear.** Pero debe crearse **una sola vez**, transversal a cuantitativo y cualitativo, y consumido por un único motor de completitud (§19).

---

## 9. MAPA DE CONFIGURACIÓN — QUÉ / DÓNDE / QUIÉN / QUÉ CONTROLA / FUENTE DE VERDAD

### 9.1 Navegación real (`apps/web/src/components/Layout.tsx`)

```
Configuración inicial                        /configuracion-inicial          [ADMIN, RECTOR]
Configuración                                                                [ADMIN, RECTOR]
 ├─ Configuración Institucional               /institution                   → InstitutionHub (6 tarjetas)
 │   ├─ 1 Información General                 /institution/profile
 │   ├─ 2 Estructura Organizacional           /institution/structure
 │   ├─ 3 Configuración Académica (SIEE)      /academic                      → AcademicHub
 │   ├─ 4 Catálogo Académico                  /academic-catalog
 │   ├─ 5 Año Académico                       /academic-year-wizard
 │   └─ 6 Usuarios                            /staff
 ├─ Configuración SIEE                        /academic                      ← MISMO destino que 3
 │   ├─ Niveles y Escala de Valoración        /academic/config/levels
 │   ├─ Procesos y Pesos                      /academic/config/scale
 │   ├─ Períodos Académicos                   /academic/config/periods
 │   ├─ Ventanas de Calificación              /academic/config/windows/grading
 │   └─ Ventanas de Recuperación              /academic/config/windows/recovery
 └─ Permisos de Reportes                      /capabilities-config           [ADMIN]

Plan de Estudios                                                             [ADMIN, COORD]
 ├─ Asistente / Catálogo / Plantillas / Carga Académica

Gestión Académica                                                            [ADMIN, COORD, DOCENTE]
 ├─ Calificaciones                            /grades
 ├─ Nota Final Período                        /period-final-grades
 ├─ Aprendizajes y Evidencias                 /achievements   ◄── ¡config de boletín aquí!
 ├─ Recuperaciones                            /recoveries
 ├─ Ventanas de Calificación                  /academic/config/windows/grading  ← DUPLICADO de menú
 └─ Ventanas de Recuperación                  /academic/config/windows/recovery ← DUPLICADO de menú

Reportes
 ├─ Informes                                  /reports  →  /reports/academic → "Estado de Completitud"
 └─ Boletines                                 /report-cards   ◄── ¡otra config de boletín aquí!
```

### 9.2 Tabla maestra

| Funcionalidad | Menú actual | Pantalla / pestaña | Campo / modelo | ¿Duplicidad? | Fuente de verdad **real hoy** |
|---|---|---|---|---|---|
| **Aprendizajes (catálogo del docente)** | Gestión Académica → Aprendizajes y Evidencias | `/achievements` → "Aprendizajes y Evidencias" | `Achievement` (`teacherAssignmentId` + `academicTermId`) | No | `Achievement` |
| **Aprendizajes (catálogo compartido Transición)** | Gestión Académica → Aprendizajes y Evidencias | `/achievements` → "Catálogo de Transición" (**solo admin**) | `Achievement` (`gradeId`+`subjectId`+`academicYearId`, `teacherAssignmentId = null`) | **Sí, dos alcances del mismo modelo** | `Achievement`. Alcance decidido por qué campos vengan llenos |
| **Evidencias** | ídem | Ambas pestañas | `AchievementEvidence` (`text`, `orderNumber`, `isActive`) | No | `AchievementEvidence` |
| **Descriptor por nivel (L/EP/I)** | ídem | Ambas pestañas | `AchievementLevelDescriptor` | No | `AchievementLevelDescriptor` |
| **Mostrar aprendizaje en boletín** | Gestión Académica → Aprendizajes y Evidencias | `/achievements` → **Configuración** (`Achievements.tsx:1711`) | `AchievementConfig.showLearningInReport` | **Sí** (ver §10.1) | Ambigua |
| **Mostrar evidencia en boletín** | ídem | ídem (`:1712`) | `AchievementConfig.showEvidencesInReport` | **Sí** | Ambigua |
| **Mostrar descriptor de nivel** | ídem | ídem (`:1713`) | `AchievementConfig.showLevelDescriptorInReport` | **Sí** | Ambigua |
| **Mostrar juicio valorativo** | ídem | ídem (`:1714`) | `AchievementConfig.showJudgmentInReport` | **Sí** | Ambigua |
| **Granularidad (uno / todos)** | ídem | ídem (`:1734`) | `AchievementConfig.reportLearningGranularity` | No | `AchievementConfig` |
| **"Aprendizajes por asignatura" (columna)** | Reportes → Boletines | `/report-cards` → Configuración (`ReportCards.tsx:1946`) | `ReportCardConfig.showAchievements` | **Sí** — es el otro lado de la duplicidad | `ReportCardConfig` (sólo plantilla clásica) |
| **Modelo de registro** | Gestión Académica → Aprendizajes y Evidencias | `/achievements` → Configuración (`:1596`) | `AchievementConfig.registrationModel` | No | Sólo lo respeta la UI |
| **Modo de descriptor** | ídem | ídem (`:1573`) | `AchievementConfig.descriptorMode` | No | Lo respeta `Grades.tsx:1094` |
| **Etiquetas (Propósito / Imprescindible)** | Gestión Académica → Aprendizajes y Evidencias | `/achievements` → **Catálogo de Transición** (`PreschoolCatalog.tsx:179`) | `AchievementConfig.learningLabel*` / `evidenceLabel*` | **Sí, separadas de la pestaña Configuración** aunque están en el mismo modelo | `AchievementConfig` |
| **Quién administra el catálogo** | ídem | `/achievements` → Catálogo de Transición (`:185`) | `AchievementConfig.learningCatalogMode` | — | **INERTE** (§10.8) |
| **Juicios valorativos (on/off + plantillas)** | Gestión Académica → Aprendizajes y Evidencias | `/achievements` → Configuración (`:1561`, `:1750`) | `AchievementConfig.useValueJudgments` + `ValueJudgmentTemplate` | No | `AchievementConfig` |
| **Observación por estudiante (on/off)** | ídem | `/achievements` → Configuración (`:1803`) | `AchievementConfig.useObservations` + `ObservationTemplate` | **Sí, conflicto de nombre** (§10.4) | `AchievementConfig` |
| **Observaciones del director en boletín** | Reportes → Boletines | `/report-cards` → Configuración (`:1950`) | `ReportCardConfig.showObservations` → muestra `StudentObservation` | **Sí, mismo nombre, otro dato** | `ReportCardConfig` |
| **Convivencia (captura)** | Gestión Académica → Calificaciones | `/grades` con asignatura `subjectType = CONVIVENCIA` | `ConvivenciaEntry` | No | `ConvivenciaEntry` |
| **Convivencia (existencia de la asignatura)** | Plan de Estudios → Catálogo Académico | `/academic-catalog` | `Subject.subjectType = CONVIVENCIA` | **Configuración oculta** (§11) | `Subject` |
| **Escala numérica + niveles + nota mínima** | Configuración SIEE | `/academic/config/levels` | `Institution.academicLevelsConfig` (JSON, por nivel educativo) | **Sí** con `PerformanceScale` (§10.7) | `academicLevelsConfig` (la tabla se deriva) |
| **Escala cualitativa L/EP/I** | Configuración SIEE | `/academic/config/levels` | `academicLevelsConfig[].qualitativeLevels` | No | `academicLevelsConfig` |
| **Componentes / procesos y pesos** | Configuración SIEE | `/academic/config/scale` | `Institution.gradingConfig.evaluationProcesses` + `EvaluationComponent` | **Sí** con `EvaluationPlan` por asignación | Institucional, salvo que exista `EvaluationPlan` |
| **Estructura académica del grado** | Configuración SIEE | `/academic/config/levels` (`Levels.tsx:91`) | `Grade.academicStructure` (`DIMENSIONS`…) | No | `Grade.academicStructure` — **decide todo el layout del boletín** |
| **Períodos (nombre, peso, fechas)** | Configuración SIEE | `/academic/config/periods` | `AcademicTerm` (vía `POST /academic-terms/sync`) | **Sí** con modelo `Period`, huérfano | `AcademicTerm` |
| **Ventana de calificación** | SIEE **y** Gestión Académica | `/academic/config/windows/grading` (parte superior) | `GradingPeriodConfig` | Duplicidad **de menú** | `GradingPeriodConfig` — **sin efecto real (C-3)** |
| **Cierre / Finalización / Reapertura** | SIEE **y** Gestión Académica | `/academic/config/windows/grading` (parte inferior) | `AcademicTerm.status` | Duplicidad de menú | `AcademicTerm.status` |
| **Regenerar snapshots** | Reportes → Informes | `/reports/academic` → Estado de Completitud (`:2863`) | `TermReportCardSnapshot` | **Ubicación anómala** | — |
| **Liberar boletines a docentes** | Reportes → Boletines | `/report-cards` (banner, `:1298`) | `AcademicTerm.bulletinsReleasedForTeachers` | No | `AcademicTerm` |
| **Plantilla de boletín (banco de formatos)** | Reportes → Boletines | `/report-cards` → Configuración (`:1738`) | `ReportCardTemplateSelection` + `ReportCardConfig.defaultTemplateKey` | No | Resolución: grado → estructura → default → `edusyn-clasico` (`reports.service.ts:3570`) |
| **Encabezado, colores, firmas** | Reportes → Boletines | `/report-cards` → Configuración | `ReportCardConfig` | No | `ReportCardConfig` |
| **Valoración de Transición: COLUMNS/SINGLE** | Reportes → Boletines | `/report-cards` → Configuración | `ReportCardConfig.preschoolLevelDisplay` | **Sí, es contenido descriptivo pero vive con el diseño** | `ReportCardConfig` |
| **Puesto e inasistencias en preescolar** | ídem | ídem | `ReportCardConfig.preschoolShowRank`, `preschoolRankWeights`, `showZeroAbsences` | ídem | `ReportCardConfig` |
| **Desempeños (módulo paralelo)** | Ruta `/performances`, **sin entrada de menú** | — | `PerformanceConfig`, `SubjectPerformance`, `PerformanceLevelComplement` | **Módulo huérfano** (§10.6) | Ninguna — no llega al boletín |

---

## 10. DUPLICIDADES Y CONFUSIONES

### 10.1 ⚠️ CASO PRINCIPAL — "Mostrar en boletín": `AchievementConfig` vs `ReportCardConfig`

**Ubicación 1** — `Gestión Académica → Aprendizajes y Evidencias → Configuración`
`AchievementConfig.showLearningInReport`, `showEvidencesInReport`, `showLevelDescriptorInReport`, `showJudgmentInReport`, `reportLearningGranularity`
Rol: `ADMIN_INSTITUTIONAL`, `COORDINADOR`.

**Ubicación 2** — `Reportes → Boletines → Configuración`
`ReportCardConfig.showAchievements` — etiqueta literal en pantalla: **"Aprendizajes por asignatura"**.
Rol: `ADMIN_INSTITUTIONAL`, `COORDINADOR`.

**Ubicación 3** — la misma pantalla de Boletines, bloque "Vista previa del formato": cuatro casillas con los mismos nombres (`showLearning`, `showEvidences`, `showLevelDescriptor`, `showJudgment`) que son **estado local del componente** y no persisten nada. La propia UI lo advierte con un aviso ámbar (`ReportCards.tsx:1786`).

**Servicio que las lee:**
- `reports.service.ts:2912` construye `reportContent` **exclusivamente** desde `AchievementConfig` (+ 4 campos de preescolar de `ReportCardConfig`).
- `ReportCards.tsx:508` lee `config.showAchievements` desde `ReportCardConfig` para la plantilla clásica.

**Prioridad real — y aquí está la trampa: depende de la plantilla.**

| Plantilla | ¿Respeta `ReportCardConfig.showAchievements`? | ¿Respeta `AchievementConfig.show*`? | Resultado si difieren |
|---|---|---|---|
| `edusyn-clasico` | **Sí** — quita la columna entera | Sí, dentro de la columna | **AND lógico.** `showAchievements = false` gana siempre y anula las cuatro casillas |
| `preescolar-narrativo` | **No** | Sí (vía `renderLearningBlocks`) | Sólo manda `AchievementConfig` |
| `transicion-propositos` | **No** | **Parcialmente** — ver abajo | Sólo manda `AchievementConfig`, y de forma incompleta |
| `multiperiodo-tabular` | No | No | Ninguna de las dos |

**Peor aún, dentro de `transicion-propositos` (`reportCardTemplates.ts:396`):**
- `rc.showEvidences !== false` → si el flag no está definido, **muestra**. Default invertido respecto al modelo (`showEvidencesInReport @default(false)`).
- `rc.showLevelDescriptor` → default **oculta**.
- **`rc.showLearning` no se consulta nunca.** El propósito siempre se imprime.
  → **"Mostrar aprendizaje en boletín" es una configuración INERTE en el boletín de Transición.**

**Diagrama del caso que usted planteó:**

```
Mostrar aprendizaje en boletín
├── Configuración A: /achievements → Configuración
│     └── AchievementConfig.showLearningInReport
├── Configuración B: /report-cards → Configuración
│     └── ReportCardConfig.showAchievements  ("Aprendizajes por asignatura")
└── Configuración C: /report-cards → Vista previa
      └── estado local, no persiste

Servicio del boletín:
  buildGroupReportCards → reportContent  ← SÓLO lee A
  ReportCards.buildReportCardHtml        ← lee B (sólo edusyn-clasico)
  reportCardTemplates.renderLearningBlocks ← lee A vía ctx.achievementContent
  buildTransicionPropositosHtml          ← lee A vía data.reportContent, PERO ignora showLearning

Resultado:
  · edusyn-clasico:        B=false ⇒ no sale nada, A no importa.  B=true ⇒ manda A.
  · preescolar-narrativo:  manda A.  B no tiene efecto.
  · transicion-propositos: manda A para evidencias y descriptor; showLearning IGNORADO.
  · tras FINALIZED:        A desaparece del snapshot ⇒ defaults accidentales (C-4).
```

**Fuente de verdad que debería ser:** `AchievementConfig` para **qué contenido** (aprendizaje / evidencias / descriptor / juicio / granularidad); `ReportCardConfig` sólo para **cómo se ve** (plantilla, colores, encabezado, firmas). `ReportCardConfig.showAchievements` debería desaparecer o convertirse en un espejo de sólo lectura.

**Recomendación:** unificar en `AchievementConfig`, eliminar `ReportCardConfig.showAchievements` del formulario, y **congelar `reportContent` dentro del snapshot** para que la decisión quede fijada en el documento (resuelve C-4).

### 10.2 Etiquetas Propósito/Imprescindible separadas de sus propios flags

`learningLabelSingular/Plural` y `evidenceLabelSingular/Plural` viven en `AchievementConfig` — el mismo modelo que `showLearningInReport` — pero se editan en **otra pestaña** (`Catálogo de Transición`, `PreschoolCatalog.tsx:179`), con **otro botón de guardar** (`achievementConfigApi.upsert` parcial, `:99`).
**Tipo: CONFIGURACIÓN CONFUSA.** Mismo modelo, dos formularios, dos guardados. Un admin que renombra "Aprendizaje" → "Propósito" en una pestaña y activa `showEvidencesInReport` en la otra no tiene forma de saber que está tocando la misma fila.
**Recomendación: unificar** en la pestaña Configuración, con una sección "Transición / Preescolar".

### 10.3 Presentación de Transición repartida entre dos modelos

`preschoolLevelDisplay`, `preschoolShowRank`, `preschoolRankWeights`, `showZeroAbsences` viven en `ReportCardConfig` y se editan en `/report-cards`. Pero `reports.service.ts:2924-2928` los **inyecta dentro de `reportContent`**, junto a los de `AchievementConfig`, y el template los consume indistintamente como `rc.*`.
**Tipo: CONFIGURACIÓN RELACIONADA PERO DISTINTA, mal separada.** Son decisiones de presentación (correcto que estén en `ReportCardConfig`), pero el administrador debe visitar dos menús para configurar "el boletín de Transición".
**Recomendación: VINCULAR** — dejar el dato donde está y crear una vista única "Boletín de Transición" que edite ambos modelos.

### 10.4 Tres cosas distintas llamadas "Observación"

| # | Concepto | Modelo | Dónde se configura | Dónde se captura | Dónde sale |
|---|---|---|---|---|---|
| 1 | Observación pedagógica por estudiante y aprendizaje | `StudentAchievement.observation` | `/achievements → Configuración` (`useObservations`) | `/grades` (panel cualitativo) y `/achievements` | Columna descriptiva (`qualitativeObservation`) |
| 2 | Plantilla de observación por nivel | `ObservationTemplate` | `/achievements → Configuración` | — | Autocompleta #1 (`autoFillObservations`) |
| 3 | Observación del observador / director | `StudentObservation` | `/report-cards → Configuración` (`showObservations`) | `/observer` | Bloque "Observaciones" al pie |

Un administrador que desactiva "Observaciones" en Boletines cree estar apagando #1 y en realidad apaga #3.
**Tipo: CONFIGURACIÓN CONFUSA por nomenclatura.**
**Recomendación:** renombrar visiblemente — #1 "Observación pedagógica", #3 "Anotaciones del observador".

### 10.5 Dos puntos de captura de la misma valoración

`StudentAchievement` se escribe desde:
- `/grades` → `QualitativeGradesPanel` → `saveQualitativeGrades` (`Grades.tsx:1063`) — matriz aprendizaje × estudiante, fija `isTextApproved: true` automáticamente.
- `/achievements` → tarjeta por estudiante — flujo "Editar y Aprobar" con `isTextApproved` deliberado.

Ambos llegan al mismo `POST /achievements/students/upsert`.
**Tipo: DUPLICACIÓN funcional con semánticas incompatibles.** El primero destruye el valor del segundo: si el docente usa `/grades`, todo queda "aprobado" sin que nadie lo haya aprobado.
**Recomendación:** definir `/grades` como el punto de captura masiva y `/achievements` como el de curaduría; y **no** fijar `isTextApproved` automáticamente si se va a usar como señal de "el docente terminó".

### 10.6 Módulo "Desempeños" completamente huérfano

`PerformanceConfig`, `SubjectPerformance`, `PerformanceLevelComplement`, `PerformanceManualEdit`, el módulo `apps/api/src/modules/performance/` (4 servicios) y la página `/performances` + `/students/performances`.

Verificado: **`apps/api/src/modules/reports/` no referencia `subjectPerformance`, `performanceLevelComplement` ni `performanceGenerator` en ninguna línea.** Genera textos descriptivos por dimensión (Cognitivo/Procedimental/Actitudinal) que **nunca llegan al boletín**. No tiene entrada en el menú lateral.

Es un intento anterior de resolver el mismo problema que hoy resuelve "Aprendizajes y Evidencias". Nota adicional: `PerformanceManualEdit` **sí** registra `originalText`, `editedText`, `reason` y `editedById` — el módulo muerto tiene mejor auditoría que el vivo.
**Tipo: CONFIGURACIÓN REDUNDANTE / código muerto.**
**Recomendación:** decidir explícitamente su destino. Si se elimina, **rescatar antes el patrón de `PerformanceManualEdit`** para la auditoría cualitativa (§19).

### 10.7 Dos fuentes de escala de desempeño

`Institution.academicLevelsConfig` (JSON, editado en `/academic/config/levels`) vs tabla `PerformanceScale` (leída por `buildGroupReportCards:2827` y por todo el motor de niveles).

La relación **está bien resuelta**: `syncScaleFromConfig` (`institution-config.service.ts:357`) deriva la tabla del JSON con precedencia `gradingConfig.performanceLevels` → `academicLevelsConfig[].performanceLevels` → default 0–5, valida solapes/huecos de forma bloqueante y escribe en `$transaction`.

**Pero existe una puerta trasera:** `POST /performance-scale/upsert` (`performance-scale.controller.ts:19`, roles ADMIN/COORD) escribe la tabla directamente, **sin validación de rangos y sin tocar el JSON**. La siguiente sincronización la sobrescribe.
**Tipo: CONFIGURACIÓN REDUNDANTE con riesgo de deriva.**
**Recomendación:** eliminar o restringir ese endpoint; el JSON es la fuente de verdad.

### 10.8 Configuraciones inertes (se guardan, no hacen nada en el servidor)

| Campo | Dónde se edita | Estado verificado |
|---|---|---|
| `AchievementConfig.learningCatalogMode` | `/achievements → Catálogo de Transición` | **Totalmente inerte.** Sólo aparece en el propio servicio de config. La protección real del catálogo es `canManageCatalog(req)` (`achievement.controller.ts:27`), un chequeo de **rol**, no de este campo. Un admin que ponga `ADMIN_FIXED` no cambia absolutamente nada. |
| `AchievementConfig.registrationModel` | `/achievements → Configuración` | Sólo lo respeta la UI (`Achievements.tsx:1184`). El backend acepta evidencias en cualquier modo. |
| `AchievementConfig.showLearningInReport` | `/achievements → Configuración` | **Inerte en `transicion-propositos`** (§10.1) |
| `GradingPeriodConfig.isOpen` + fechas | `/academic/config/windows/grading` | **Inerte en el servidor (C-3)** |
| `ReportCardConfig.evaluationType` | — | Marcado `DEPRECADO` en el propio esquema (`schema.prisma:4783`) |
| `ReportCardSnapshotType.FINAL_CLOSE` / `REOPENED` | — | Declarados, nunca escritos |
| `AcademicTermStatus.DRAFT` | — | Declarado, ningún servicio lo escribe |
| Modelo `Period` | — | Coexiste con `AcademicTerm`; **NO CONFIRMADO** que tenga escritor activo |

### 10.9 Duplicidad de menú

`Ventanas de Calificación` y `Ventanas de Recuperación` aparecen en **dos** ramas (`Configuración → Configuración SIEE` y `Gestión Académica`) apuntando a la misma ruta. El propio código lo justifica en un comentario (`Layout.tsx:196`). Es un **VÍNCULO deliberado y correcto**, pero con distinto público (ADMIN/RECTOR vs ADMIN/COORD) y sin señal visual de que es la misma pantalla. Además `InstitutionHub` tarjeta 3 y `Configuración → Configuración SIEE` van ambos a `/academic`.

---

## 11. PROBLEMAS DE UX / ARQUITECTURA

| # | Problema | Detalle |
|---|---|---|
| U-1 | **"Cerrar" significa tres cosas** | Ventana (`isOpen`), estado `CLOSED`, y `FINALIZED`. Las tres viven en la misma pantalla, una debajo de otra, y ninguna se llama distinto. |
| U-2 | **La configuración del boletín está partida en dos menús alejados** | Contenido en `Gestión Académica`, presentación en `Reportes`. Para configurar el boletín de Transición hay que visitar `/achievements → Configuración`, `/achievements → Catálogo de Transición` y `/report-cards → Configuración`. |
| U-3 | **Sin retroalimentación de precedencia** | Nada avisa de que `ReportCardConfig.showAchievements = false` anula las cuatro casillas de Aprendizajes en la plantilla clásica. |
| U-4 | **Configuraciones que mienten** | `isOpen`, `learningCatalogMode`, `registrationModel`, `showLearningInReport` en Transición: se guardan con "✓ Configuración guardada" y no producen ningún efecto. |
| U-5 | **Dependencia oculta: `Grade.academicStructure`** | Decide toda la evaluación y el layout del boletín, y se configura en `/academic/config/levels` como un detalle secundario (`Levels.tsx:91`). `Grades.tsx:1811` incluso muestra un aviso pidiendo al admin "ejecutar la opción Corregir estructura de preescolar" — síntoma de que este dato se desincroniza. |
| U-6 | **Dependencia oculta: `Subject.subjectType`** | Que Convivencia funcione depende de que la asignatura tenga `subjectType = CONVIVENCIA` en el Catálogo Académico, sin ninguna pista en la UI de Aprendizajes ni de Boletines. |
| U-7 | **Acción de reparación disfrazada de operación normal** | "Regenerar Snapshots" vive dentro de un **reporte** (`/reports/academic` → Estado de Completitud) y crea documentos oficiales nuevos sin motivo ni auditoría. |
| U-8 | **El panel de completitud no le sirve al docente** | Rol excluido del endpoint. El docente sólo tiene el semáforo de su planilla, que además está **oculto en Transición**. |
| U-9 | **El error de completitud llega demasiado tarde** | El admin descubre que faltan notas al intentar cerrar, no antes. `validateTermGrades` sí existe como paso previo en la UI, pero devuelve una lista plana truncada a 100 elementos, sin agrupar por docente. |
| U-10 | **Fallo silencioso al finalizar** | `finalizeTerm` reporta `success: true` aunque grupos enteros hayan fallado; sólo queda un `console.error`. |
| U-11 | **Nomenclatura mezclada en el código** | `Achievement` = "aprendizaje" o "propósito"; `AchievementEvidence` = "evidencia" o "imprescindible" (los mensajes de error dicen literalmente "Imprescindible no encontrado", `achievement.service.ts:380`, incluso para instituciones que no usan esa etiqueta). Renombrado a medias. |
| U-12 | **`isTextApproved` fijado automáticamente** | Destruye el único primitivo latente de "el docente declaró que terminó". |

---

## 12. FUENTE DE VERDAD — PROPUESTA

| Configuración | Fuente de verdad **hoy** | Fuente de verdad **que debería ser** | Acción |
|---|---|---|---|
| Qué contenido descriptivo sale en el boletín | **Ambigua** (`AchievementConfig` + `ReportCardConfig` según plantilla) | `AchievementConfig.show*InReport` + `reportLearningGranularity` | **Unificar**; eliminar `ReportCardConfig.showAchievements` |
| Cómo se ve el boletín | `ReportCardConfig` + `ReportCardTemplateSelection` | Igual | Mantener |
| Presentación de Transición (`preschool*`, `showZeroAbsences`) | `ReportCardConfig` | `ReportCardConfig` | Mantener el dato; **vincular** la edición en una vista "Boletín de Transición" |
| Etiquetas Propósito / Imprescindible | `AchievementConfig` (editado en otra pestaña) | `AchievementConfig` | **Unificar formulario** |
| Catálogo de aprendizajes/propósitos | `Achievement` | `Achievement` | Mantener |
| Quién puede editar el catálogo | Rol (`canManageCatalog`) | `AchievementConfig.learningCatalogMode` **+** rol | **Activar** el campo o eliminarlo |
| Escala de desempeño | `Institution.academicLevelsConfig` → derivada a `PerformanceScale` | Igual | **Cerrar** el endpoint directo de `PerformanceScale` |
| Escala cualitativa L/EP/I | `academicLevelsConfig[].qualitativeLevels` | Igual | Mantener |
| Estructura académica del grado | `Grade.academicStructure` | Igual | **Elevarla** a decisión visible de primer nivel |
| Qué asignaturas se le exigen a un estudiante | `TeacherAssignment` (M1/M2) | `EnrollmentSubject` / `EnrollmentArea` **+** `GroupSubjectException` **+** excepciones por estudiante | **Refactorizar** M1/M2 |
| Si se pueden escribir notas | `AcademicTerm.status` (sólo `FINALIZED`) | `AcademicTerm.status` **y** `GradingPeriodConfig`, **ambos verificados en el servidor** | **Extender** las guardas |
| Verdad del boletín tras finalizar | `TermReportCardSnapshot` vía `AcademicDataSourceService` | Igual, **con `reportContent` incluido** | **Extender** el payload |
| Qué cambió y quién lo cambió | `GradeAuditEvent` (sólo `PartialGrade`) | `GradeAuditEvent` con `source` real para todos los orígenes | **Extender** |
| Historia de reaperturas y versiones | `TermReopeningRecord` + `TermReportCardSnapshot.version` | Igual, **con lectura expuesta** | **Extender** (endpoint + UI) |
| Casos especiales | **No existe** | Modelo nuevo, uno solo, transversal | **Crear** |

---

## 13. FLUJO ACTUAL (cómo funciona HOY, extremo a extremo)

### 13.1 Cuantitativo

1. **Configuración.** Admin: institución → estructura → SIEE (niveles/escala, procesos y pesos, períodos) → catálogo y plan de estudios → año académico → carga docente. Coordinador: abre la ventana de calificación (**sin efecto en el servidor**).
2. **Diligenciamiento.** Docente en `/grades`: registra `PartialGrade` por componente. Cada guardado dispara `recalculateFinalGrade` → `PeriodFinalGrade` y **escribe `GradeAuditEvent`**. Semáforo local de completitud.
3. **Completitud.** Admin/Coordinador en `/reports/academic` → "Estado de Completitud": % de notas y de aprendizajes por grupo/asignatura/período, con lista de estudiantes faltantes.
4. **Validación y cierre.** `/academic/config/windows/grading`: "Validar" → `validateTermGrades`; si 100 %, "Cerrar" → `CLOSED`. **`CLOSED` no bloquea nada en el servidor.**
5. **Generación.** "Finalizar" → `finalizeTerm`: construye los boletines de todos los grupos, congela un JSON por estudiante con `version = max+1`, pasa a `FINALIZED`. Errores por grupo se registran en consola y se ignoran.
6. **Consulta.** `/report-cards`: `AcademicDataSourceService` sirve snapshot. Bloqueo de escritura de `PartialGrade`/`PeriodFinalGrade`/`EvaluationPlan`.
7. **Corrección.** "Reabrir" + motivo (≥10 car.) → `TermReopeningRecord`, vuelve a `OPEN`. Se corrige (los cambios de `PartialGrade` sí quedan auditados). Cerrar y finalizar de nuevo → v2. **El motivo no es consultable desde ninguna pantalla.**

### 13.2 Transición

1. **Configuración.** Admin marca `Grade.academicStructure = DIMENSIONS` en `/academic/config/levels`; define `qualitativeLevels` (L/EP/I); crea dimensiones como `Subject.subjectType = PRESCHOOL_DIMENSION` y, si aplica, una asignatura `CONVIVENCIA` en el Catálogo Académico; en `/achievements → Catálogo de Transición` fija etiquetas y precarga propósitos por grado+dimensión+año; en `/achievements → Configuración` activa qué sale en el boletín; en `/report-cards` elige la plantilla `transicion-propositos` y el modo de valoración.
2. **Diligenciamiento.** Docente en `/grades` (la UI detecta `DIMENSIONS`): matriz propósito × estudiante con nivel L/EP/I + observación → `StudentAchievement` (con `academicTermId` propio, lo que permite valorar por período un propósito anual). Para la asignatura Convivencia, `/grades` muestra un panel de texto libre → `ConvivenciaEntry`.
3. **Completitud.** **No hay.** El semáforo está oculto (`Grades.tsx:1606`) y el panel institucional reporta 0 %/0 % (C-2).
4. **Cierre.** **Imposible.** `validateTermGrades` exige `PeriodFinalGrade` para cada dimensión de cada estudiante y Transición nunca la produce (C-1).
5. **Boletín.** Funciona **en vivo**: `buildGroupReportCards` arma `learningBlocks` + `convivenciaText` + `reportContent`, y `buildTransicionPropositosHtml` imprime el formato de propósitos e imprescindibles.
6. **Snapshot / corrección / auditoría.** Inalcanzables por el punto 4. Y si se forzaran, el snapshot perdería `reportContent` (C-4) y no habría auditoría (C-5).

**Resumen brutal: Transición tiene captura y boletín, pero está fuera del ciclo de gobierno del período.**

---

## 14. COMPARACIÓN CUANTITATIVO vs TRANSICIÓN

| Funcionalidad | Cuantitativo | Transición | Infraestructura reutilizable | Qué falta |
|---|---|---|---|---|
| **Completitud** | Parcial (M1: existencia de `PeriodFinalGrade`) | **No funciona** (0 % siempre, C-2) | `getCompletenessStatus` como esqueleto | Segundo eje cualitativo: `StudentAchievement` sobre el catálogo esperado, incluyendo `teacherAssignmentId = null` y `academicTermId = null` |
| **Estado docente ("terminé")** | **No existe** | **No existe** | `StudentAchievement.isTextApproved/approvedAt/approvedById` (primitivo latente, hoy autocompletado) | Modelo/estado de declaración por (docente, asignación, período), común a ambos |
| **Casos especiales** | **No existe** | **No existe** | `EnrollmentEvent` como patrón; `EnrollmentSubject` como universo esperado | Modelo nuevo de excepción por estudiante × asignatura × período, con motivo y actor |
| **Cierre** | Funciona | **Bloqueado (C-1)** | `closeTerm` + `AcademicTerm.status` | Que `validateTermGrades` sea consciente de `academicStructure` |
| **Bloqueo de escritura** | Sólo `FINALIZED`, sólo 3 modelos | **Ninguno** | Patrón `guardTermNotFinalized` (3 implementaciones idénticas) | Guarda compartida aplicada a `StudentAchievement`, `ConvivenciaEntry`, `Achievement`, `AchievementEvidence` |
| **Auditoría** | Sólo `PartialGrade` | **Ninguna** | `GradeAuditService` + campo `source` ya previsto | Nuevos `source`: `STUDENT_ACHIEVEMENT`, `CONVIVENCIA`, `PERIOD_FINAL_GRADE`, `TERM_LIFECYCLE` |
| **Snapshot** | Funciona | Funcionaría, **con C-4** | `TermReportCardSnapshot` + `AcademicDataSourceService` | Añadir `reportContent`, `academicStructure`, `displayConfig` al payload |
| **Generación** | `finalizeTerm` | Igual (bloqueada por C-1) | `finalizeTerm` | Transacción por grupo + reporte de fallos + no marcar `FINALIZED` si hubo errores |
| **Reapertura** | Funciona | Igual (bloqueada) | `TermReopeningRecord` | Nada nuevo en el modelo |
| **Corrección** | Auditada sólo en parciales | **Sin auditar ni bloquear** | — | Guardas + auditoría (filas anteriores) |
| **Historial** | Existe en BD, **invisible** | Igual | `TermReopeningRecord` + `version` | Endpoint de lectura + pantalla |

**Lectura de la tabla: la columna "Infraestructura reutilizable" está llena en 9 de 11 filas.** No hace falta construir un sistema paralelo para Transición; hace falta **corregir cinco puntos concretos y extender tres**.

---

## 15. QUÉ REUTILIZAR (sin tocar)

1. **`AcademicDataSourceService`** — motor de resolución live/snapshot. Ya es agnóstico del tipo de evaluación: opera sobre el DTO de `buildGroupReportCards`, que ya incluye lo cualitativo.
2. **`TermReportCardSnapshot`** — el modelo sirve tal cual; el problema es qué se le mete, no su forma.
3. **`TermReopeningRecord`** — el modelo es correcto y suficiente.
4. **`AcademicTerm.status`** — el ciclo `OPEN → CLOSED → FINALIZED` + reapertura es el correcto.
5. **`GradeAuditService`** — el servicio ya es genérico (`source`, `previousValue`/`newValue` como `Json`) y tiene la política correcta de no romper el guardado.
6. **`Achievement` / `AchievementEvidence` / `AchievementLevelDescriptor` / `StudentAchievement` / `ConvivenciaEntry`** — modelo de captura de Transición completo.
7. **`buildGroupReportCards`** — ya produce `learningBlocks`, `convivenciaText`, `displayHours`, `subjectType` y `reportContent`.
8. **`ReportCardTemplateSelection` + `resolveTemplateKey`** — banco de formatos con precedencia clara.
9. **`EnrollmentArea` / `EnrollmentSubject`** — la estructura por matrícula ya existe y es el universo correcto para la completitud.
10. **`EnrollmentEvent`** — patrón de auditoría a imitar (valor previo/nuevo + motivo + acta).

---

## 16. QUÉ EXTENDER

| # | Extensión | Sobre qué | Resuelve |
|---|---|---|---|
| E-1 | Segundo eje cualitativo en `getCompletenessStatus`; incluir `teacherAssignmentId = null` y `academicTermId = null` | `reports.service.ts:4280` | C-2, A-1 |
| E-2 | `validateTermGrades` consciente de `Grade.academicStructure`: `DIMENSIONS` ⇒ se exige `StudentAchievement` (+ `ConvivenciaEntry` donde aplique), no `PeriodFinalGrade` | `reports.service.ts:3693` | **C-1** |
| E-3 | Congelar `reportContent`, `academicStructure` y `displayConfig` en `TermReportCardSnapshot.data`; reconstruirlos en `AcademicDataSourceService` | `:3918` y `academic-data-source.service.ts:138` | **C-4** |
| E-4 | Guarda `guardTermNotFinalized` extendida a `StudentAchievement`, `ConvivenciaEntry`, `Achievement`, `AchievementEvidence`, `AttitudinalAchievement` | `achievement.service.ts` | C-5 (mitad) |
| E-5 | Nuevos `source` en `GradeAuditEvent`: `STUDENT_ACHIEVEMENT`, `CONVIVENCIA`, `PERIOD_FINAL_GRADE`, `ACHIEVEMENT`, `EVIDENCE`, `TERM_LIFECYCLE` | `grade-audit.service.ts` + llamadores | **C-5** |
| E-6 | Endpoints de lectura: `GET /reports/terms/:id/history` (reaperturas + versiones + quién y cuándo) | `reports.controller.ts` | **C-6** |
| E-7 | Aplicar `GradingPeriodConfig` en el servidor: llamar `isPeriodOpen` desde las guardas de escritura, con bypass para admin | `grading-period-config.service.ts:63` | **C-3** |
| E-8 | Registrar actor y fecha de cierre (`closedById`, `closedAt` en `AcademicTerm`, como ya tiene `RecoveryPeriodConfig`) | `schema.prisma:1116` | B-2 |
| E-9 | `finalizeTerm` transaccional por grupo, con reporte de fallos y **sin** marcar `FINALIZED` si hubo errores | `:3877-3950` | B-3, B-4, U-10 |
| E-10 | `snapshotType` correcto: `REOPENED` tras reapertura, `FINAL_CLOSE` en el cierre definitivo | `:3916`, `:4127` | §5.5 |
| E-11 | Congelar `learningCatalogMode` como regla real (o eliminarlo) | `achievement.controller.ts:27` | §10.8 |

---

## 17. QUÉ REFACTORIZAR

| # | Refactor | Motivo |
|---|---|---|
| R-1 | **Un solo motor de completitud.** `validateTermGrades` pasa a ser una *proyección* del mismo servicio que alimenta `getCompletenessStatus` (mismo universo, mismas reglas, mismas excepciones). Hoy son dos implementaciones con reglas distintas del mismo concepto. | Evita que "el panel dice 100 %" y "cerrar dice que faltan 12" |
| R-2 | **Universo esperado = `EnrollmentSubject` + `GroupSubjectException`**, no `TeacherAssignment`. Ya existe `getExpectedSubjectIdsByEnrollment`; extenderlo y usarlo en el motor único. | A-2, A-3 |
| R-3 | **`guardTermNotFinalized` a una sola utilidad compartida.** Hoy hay 3 copias idénticas (`evaluation-plans`, `partial-grades`, `period-final-grades`). | Mantenibilidad; garantiza que nadie olvide la guarda |
| R-4 | **Unificar el formulario de `AchievementConfig`**: etiquetas de Transición y flags de boletín en la misma pestaña. | §10.2 |
| R-5 | **`Grades.tsx` deja de fijar `isTextApproved: true`** para que ese campo pueda usarse como señal real. | U-12, §10.5 |
| R-6 | **Eliminar los métodos muertos** `getSnapshotForStudent`/`getSnapshotsForTerm` de `ReportsService` (`:4539`, `:4555`), duplicados de `AcademicDataSourceService`. | Riesgo de que alguien los use y salte el motor único |
| R-7 | **Homogeneizar defaults entre modelo y plantilla.** `rc.showEvidences !== false` debe ser `rc.showEvidences === true`, y `showLearning` debe consultarse en `transicion-propositos`. | §10.1 |
| R-8 | **Mover "Regenerar Snapshots"** del reporte de completitud a la pantalla de ciclo de vida del período, con motivo obligatorio y registro. | U-7 |
| R-9 | **Nomenclatura**: eliminar "Imprescindible"/"Logro" hardcodeados en mensajes del backend; usar las etiquetas configurables. | U-11 |

---

## 18. QUÉ ELIMINAR O UNIFICAR

| # | Elemento | Acción propuesta |
|---|---|---|
| D-1 | `ReportCardConfig.showAchievements` ("Aprendizajes por asignatura") | **Eliminar del formulario.** Fuente de verdad única: `AchievementConfig`. Si se conserva el campo por compatibilidad, dejarlo derivado. |
| D-2 | Toggles de vista previa en `/report-cards` | **Eliminar** (ya llevan un aviso ámbar admitiendo que no hacen nada) o **vincular** de verdad a `AchievementConfig` con un enlace "Editar la configuración real". |
| D-3 | Módulo "Desempeños" (`/performances`, `SubjectPerformance`, `PerformanceConfig`, `PerformanceLevelComplement`) | **Decidir explícitamente.** Recomendación: eliminar, rescatando antes el patrón de `PerformanceManualEdit`. |
| D-4 | `POST /performance-scale/upsert` | **Eliminar o restringir a SUPERADMIN**; el JSON institucional es la fuente de verdad. |
| D-5 | `AchievementConfig.learningCatalogMode` | **Activar o eliminar.** Hoy miente. |
| D-6 | `AchievementConfig.registrationModel` | **Aplicar en el backend o eliminar.** |
| D-7 | `ReportCardConfig.evaluationType` | Ya marcado deprecado — **eliminar** del esquema y del formulario. |
| D-8 | Modelo `Period` | Verificar si tiene escritores; si no, **eliminar** (coexiste con `AcademicTerm`). **NO CONFIRMADO.** |
| D-9 | Etiquetas de Transición en `PreschoolCatalog` | **Unificar** con la pestaña Configuración (R-4). |
| D-10 | Nombre "Observaciones" en `/report-cards` | **Renombrar** a "Anotaciones del observador" (§10.4). |

---

## 19. QUÉ CREAR (sólo lo que no existe)

Tres piezas. Ni una más.

### N-1 · Excepción de evaluación (caso especial)

**Justificación de que no existe:** búsqueda exhaustiva negativa (§8.1). `EnrollmentStatus` es de estudiante-año, `GroupSubjectException` es de grupo. Ninguno permite decir "a este estudiante, en esta asignatura, en este período, no se le exige valoración, por este motivo".

Forma sugerida (a diseñar en la sesión siguiente): un registro por `(studentEnrollmentId, subjectId | null, academicTermId, tipo, motivo, actor, fecha)`, con tipos del estilo `INGRESO_TARDIO`, `RETIRO`, `NO_ASISTIO`, `EVIDENCIA_INSUFICIENTE`, `NO_EVALUABLE`. Debe:
- **excluir la celda del denominador** del motor único de completitud;
- **viajar dentro del snapshot** para que el boletín pueda imprimir "N/A" con su justificación;
- **auditarse** con el mismo `GradeAuditService`.

**Regla no negociable: uno solo, transversal a cuantitativo y cualitativo.**

### N-2 · Declaración de finalización del docente

**Justificación de que no existe:** no hay ningún estado por (docente, asignación, período). `isTextApproved` es por valoración individual y hoy se autocompleta.

Debe distinguir exactamente los dos casos que usted planteó:
- *"El docente no ha terminado"* → no ha declarado; hay celdas vacías sin excepción.
- *"El docente terminó pero hay situaciones especiales"* → declaró; las celdas vacías tienen excepción (N-1).

Y debe ser **reversible mientras el período esté `OPEN`**, y quedar registrada.

### N-3 · Lectura del historial de gobierno del período

Endpoint + pantalla que muestre, por período: versiones de snapshot (número, tipo, fecha, autor, nº de estudiantes), reaperturas (motivo, autor, fecha, versión previa) y eventos de auditoría filtrados por período. Hoy los datos existen en `TermReopeningRecord`, `TermReportCardSnapshot` y `GradeAuditEvent`, y **ninguno es consultable por el administrador institucional**.

**Nada más.** No se crea: segundo motor de completitud, segundo snapshot, segundo sistema de auditoría, segunda reapertura, segundo cierre.

---

## 20. FLUJO IDEAL DE CONFIGURACIÓN (propuesta)

El orden actual de `InstitutionHub` (6 pasos) es razonable pero **omite todo lo evaluativo-descriptivo y todo lo de boletín**. Propuesta de orden, derivada de las dependencias reales del código:

```
1. IDENTIDAD           Información general (nombre, DANE, NIT, logo, rector)
                       → alimenta el encabezado del boletín

2. ESTRUCTURA FÍSICA   Sedes → jornadas → grados → grupos
                       ⚠ EN ESTE PASO: academicStructure de cada grado
                          (DIMENSIONS / SUBJECTS_ONLY / AREAS_SUBJECTS)
                          — hoy escondido en /academic/config/levels (U-5)

3. REGLAS DE           Escala por nivel educativo (numérica y/o cualitativa L/EP/I)
   EVALUACIÓN          Nota mínima · Procesos y pesos · Reglas de área
   (SIEE)              → deriva PerformanceScale

4. PERÍODOS            Cantidad, nombres, pesos (suma 100 %), fechas

5. PLAN DE ESTUDIOS    Áreas → asignaturas → plantillas → plan por grado
                       ⚠ EN ESTE PASO: subjectType de dimensiones
                          (PRESCHOOL_DIMENSION) y de Convivencia (U-6)

6. AÑO ACADÉMICO       Crear el año · materializar períodos · matricular
                       → congela EnrollmentArea/EnrollmentSubject

7. CARGA DOCENTE       Asignar docente a grupo × asignatura

8. MODELO DESCRIPTIVO  Aprendizajes y Evidencias:
                       · modelo de registro · descriptor por nivel
                       · etiquetas (Propósito/Imprescindible)
                       · quién administra el catálogo
                       · juicios valorativos · observaciones
                       ⚠ TODO EN UNA SOLA PANTALLA (R-4)

9. CATÁLOGO            Propósitos por grado+dimensión (Transición)
   DESCRIPTIVO         o aprendizajes por docente (resto)

10. BOLETÍN            ÚNICA pantalla, dos secciones claramente separadas:
                       A) CONTENIDO — qué información aparece
                          (aprendizaje, evidencias, descriptor, juicio,
                           granularidad, observaciones, asistencia, puesto)
                          ← FUENTE ÚNICA
                       B) PRESENTACIÓN — plantilla por grado/estructura,
                          colores, encabezado, firmas, modo de valoración

11. OPERACIÓN DEL      Ventana de calificación (fechas) — CON efecto real
    PERÍODO            Panel de completitud
                       Declaración de finalización por docente
                       Excepciones (casos especiales)
                       Cierre → Generación → (Reapertura → Corrección → Regeneración)
                       Historial y auditoría
```

**Diferencia clave con hoy:** los pasos 8–10 son una sola cadena de decisión ("qué se registra → qué catálogo → qué sale y cómo se ve"), y hoy están repartidos entre `Gestión Académica → Aprendizajes y Evidencias` (dos pestañas con dos formularios) y `Reportes → Boletines`. El paso 11 hoy está partido entre `Configuración SIEE`, `Gestión Académica` y `Reportes → Informes`.

---

## 21. FLUJO PROPUESTO PARA TRANSICIÓN (mapeado a lo existente)

| Paso que usted quiere | Cómo se logra | Infraestructura |
|---|---|---|
| **1. Docente diligencia** valoraciones + aprendizajes/evidencias + convivencia | Ya funciona: `/grades` detecta `DIMENSIONS`, panel cualitativo → `StudentAchievement`; panel de convivencia → `ConvivenciaEntry` | **REUTILIZAR tal cual** |
| **2. Sistema calcula completitud** por estudiante y responsable | Motor único (R-1) con eje cualitativo (E-1) y universo desde `EnrollmentSubject` (R-2) | **EXTENDER + REFACTORIZAR** |
| **3. Casos especiales** explícitos | Modelo nuevo N-1, consumido por el motor único y viajando en el snapshot | **CREAR (único elemento nuevo de datos)** |
| **4. Docente finaliza su parte** | Declaración N-2 por (docente, asignación, período); `isTextApproved` deja de autocompletarse (R-5) | **CREAR (mínimo) + REFACTORIZAR** |
| **5. Admin revisa completitud global**: quién / qué / dónde / casos especiales | Motor único + agregación por docente (A-4) + panel que ya existe en `/reports/academic` | **EXTENDER** |
| **6. Admin cierra** | `closeTerm` con `validateTermGrades` consciente de `academicStructure` (E-2) + guardas de escritura reales sobre lo cualitativo (E-4, E-7) | **EXTENDER** — C-1 y C-3 |
| **7. Admin genera boletines** oficiales registrados | `finalizeTerm` transaccional (E-9), con `reportContent` congelado (E-3) y `snapshotType` correcto (E-10) | **EXTENDER** — C-4 |
| **8. Snapshot / versionado** | `TermReportCardSnapshot` + `AcademicDataSourceService` sin cambios de forma | **REUTILIZAR** |
| **9. Corrección excepcional**: reapertura → motivo → modificación → auditoría → nueva generación | `TermReopeningRecord` (existe) + auditoría cualitativa (E-5) + historial consultable (E-6, N-3) | **EXTENDER** — C-5, C-6 |

**Balance: 1 modelo nuevo de datos (N-1), 1 estado nuevo (N-2), 1 pantalla de lectura (N-3). Todo lo demás es corregir y extender lo que ya existe.** Se cumple la regla `REUTILIZAR → EXTENDER → REFACTORIZAR → CREAR`.

---

## 22. PLAN DE IMPLEMENTACIÓN PROPUESTO (no ejecutado)

> Orden derivado de dependencias reales, no de preferencia. **Ninguna fase se ejecuta en esta sesión.**

**FASE 0 — Desbloqueo (sin modelo nuevo).** Objetivo: que un período con Transición pueda cerrarse y finalizarse fielmente.
- E-2 (`validateTermGrades` consciente de estructura) → resuelve **C-1**
- E-1 (eje cualitativo en completitud) → resuelve **C-2**
- E-3 (congelar `reportContent`/`academicStructure`/`displayConfig`) → resuelve **C-4**
- E-9 (finalize transaccional y honesto)
- Verificación: cerrar y finalizar un período con un grupo de Transición en staging y comparar el PDF antes/después de finalizar.

**FASE 1 — Integridad y gobierno.**
- E-4 + R-3 (guarda única, aplicada también a lo cualitativo)
- E-7 (ventana de calificación con efecto real) → resuelve **C-3**
- E-8 (actor y fecha de cierre)
- E-10 (`snapshotType` correcto)

**FASE 2 — Auditoría y trazabilidad.**
- E-5 (auditar valoraciones, convivencia, notas finales, ciclo de vida) → resuelve **C-5**
- E-6 + N-3 (historial consultable) → resuelve **C-6**
- R-8 (mover "Regenerar Snapshots" con motivo obligatorio)

**FASE 3 — Motor único de completitud.**
- R-1 + R-2 (un solo motor, universo desde `EnrollmentSubject` + excepciones de grupo)
- A-4 (vista por docente)
- Retirar M3 y M4 o reimplementarlos como consumidores del motor único

**FASE 4 — Casos especiales y declaración docente.**
- N-1 (excepción de evaluación), integrada al motor único, al snapshot y a la auditoría
- N-2 (declaración de finalización) + R-5

**FASE 5 — Limpieza de configuración (UX).**
- D-1, D-2, D-9, D-10, R-4, R-7, R-9
- Decisión sobre D-3 (módulo Desempeños), D-4, D-5, D-6, D-7, D-8
- Reordenar menús según §20

**Nota de secuencia:** la Fase 0 es la única que desbloquea trabajo real de Transición y no requiere migración de esquema salvo, quizá, ninguna. Las Fases 4 y 5 sí requieren migración aditiva y cambios de UI. Conviene validar la Fase 0 en staging antes de comprometer nada de la Fase 4.

---

## ANEXO — Índice de evidencia (archivo:línea)

| Tema | Referencia |
|---|---|
| Motor de completitud principal | `apps/api/src/modules/reports/reports.service.ts:4189` |
| Endpoint de completitud | `apps/api/src/modules/reports/reports.controller.ts:475` |
| Pantalla de completitud | `apps/web/src/pages/reports/AcademicReports.tsx:83, 521, 2851` |
| Validación previa al cierre | `reports.service.ts:3693` |
| Cierre | `reports.service.ts:3784` |
| Finalización + snapshot | `reports.service.ts:3830`, payload en `:3918` |
| Reapertura | `reports.service.ts:3976` |
| Re-snapshot | `reports.service.ts:4035`, apertura temporal en `:4082` |
| Motor live/snapshot | `apps/api/src/modules/reports/academic-data-source.service.ts:102, 187, 242` |
| Reconstrucción incompleta del snapshot | `academic-data-source.service.ts:138-160` |
| Construcción del boletín | `reports.service.ts:2594`; `reportContent` en `:2912`; convivencia en `:2938`, `:3300`; `learningBlocks` en `:3259` |
| Guardas de FINALIZED | `partial-grades.service.ts:24`, `period-final-grades.service.ts:18`, `evaluation-plans.service.ts:28` |
| Ventana de calificación (inerte) | `apps/api/src/modules/academic/grading-period-config.service.ts:63`, controlador `:28` |
| Auditoría de notas | `apps/api/src/modules/evaluation/grade-audit.service.ts`; únicos llamadores en `partial-grades.service.ts:110, 118, 218, 295, 605, 735` |
| Modelos de Transición | `apps/api/prisma/schema.prisma:3042` (`Achievement`), `:3119` (`AchievementLevelDescriptor`), `:3137` (`AchievementEvidence`), `:3154` (`ConvivenciaEntry`), `:3178` (`StudentAchievement`) |
| Configuración descriptiva | `schema.prisma:2911` (`AchievementConfig`), flags en `:2958-2965` |
| Configuración de boletín | `schema.prisma:4754` (`ReportCardConfig`) |
| Snapshot y reapertura (modelos) | `schema.prisma:1162`, `:1191` |
| Ventana de calificación (modelo) | `schema.prisma:1206` |
| Captura cualitativa (docente) | `apps/web/src/pages/Grades.tsx:1063` (valoraciones), `:1127` (convivencia); semáforo `:862`, oculto en `:1606` |
| Configuración de aprendizajes | `apps/web/src/pages/Achievements.tsx:1711-1714` (flags de boletín), `:901` (pestañas) |
| Catálogo de Transición | `apps/web/src/components/achievements/PreschoolCatalog.tsx:179-191` |
| Configuración de boletín (UI) | `apps/web/src/pages/ReportCards.tsx:1946` (showAchievements), `:1786` (aviso de vista previa), `:903` (`achievementContent`) |
| Plantillas | `apps/web/src/pages/reportCardTemplates.ts:113` (`renderLearningBlocks`), `:227`, `:288`, `:396` |
| Ciclo de vida (UI) | `apps/web/src/pages/academic/config/windows/GradingWindows.tsx:110-186` |
| Navegación | `apps/web/src/components/Layout.tsx:120-290` |
| Módulo huérfano Desempeños | `apps/api/src/modules/performance/`, `schema.prisma:2850-2904` |
