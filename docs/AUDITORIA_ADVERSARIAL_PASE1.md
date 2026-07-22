# Auditoría Adversarial — Pase 1: Núcleo Académico + Seguridad Multi-tenant

> **Rol:** QA / Software Architect / Chaos Engineer / Auditor Académico
> **Objetivo:** demostrar cómo se rompe Edusyn antes de que lo haga una institución real.
> **Fecha:** 2026-07-21 · **Rama:** `staging`

---

## ⚠️ Nota de honestidad metodológica (léela primero)

Este informe **NO es una simulación fabricada** de 1.500 estudiantes. Un informe que afirmara "simulamos el año completo y encontramos X" sin ejecutar carga real sería inútil y peligroso para software académico. Lo que contiene es una **auditoría de código real**, con evidencia `archivo:línea`, de los caminos donde un error afecta de verdad la promoción/reprobación:

- Motor de promoción y de notas (períodos → anual).
- Recuperaciones y su propagación a la nota canónica.
- Aislamiento entre instituciones (multi-tenant / IDOR).
- Concurrencia y atomicidad en el guardado de planillas.

**Cobertura de este pase (honesta):**

| Área | Estado |
|------|--------|
| Motor de notas (parcial→período→anual), escalas, redondeo | ✅ Auditado a fondo |
| Recuperaciones (detección, resultado, revisión, propagación) | ✅ Auditado a fondo |
| Seguridad multi-tenant / IDOR en rutas de notas | ✅ Auditado a fondo |
| Concurrencia/atomicidad del guardado de planilla | ✅ Auditado a fondo |
| Promoción (motor puro) | ✅ Auditado; falta auditar el *feeder* de datos |
| Matrículas, docentes, ABP, Valeria, UX pantalla-por-pantalla | ⏳ Requiere Pase 2 + entorno vivo |
| Concurrencia/chaos a escala real, N+1 bajo carga | ⏳ Requiere entorno de staging con carga sintética |

Lo que **no** pude verificar sin entorno vivo lo digo explícitamente y lo dejo como plan del Pase 2, no como hallazgo inventado.

---

## Resumen ejecutivo

Encontré **un problema de seguridad sistémico de alta gravedad** (IDOR multi-tenant en las rutas de notas) y **varios errores de corrección académica** que pueden inflar o falsear notas de período/anuales. El subsistema de planilla (`partial-grades`) está, en cambio, notablemente bien construido en concurrencia de celda (bloqueo optimista + auditoría forense) — el problema ahí es de **atomicidad del lote**, no de la celda.

Señal de arquitectura de fondo: **coexisten dos subsistemas de notas** (`modules/academic/grades.*` y `modules/evaluation/*`) y **dos motores de cálculo** que renormalizan ponderaciones de la misma forma discutible. Unificarlos es la refactorización de mayor impacto.

**Conteo:** 3 críticos · 4 altos · 4 medios · varios menores/deuda.

---

# 🔴 Errores críticos

### C-1 · IDOR multi-tenant: el `TenantGuard` no protege recursos identificados por su propio ID

**Descripción.** El `TenantGuard` está registrado global (`app.module.ts` → `APP_GUARD`), pero **solo bloquea cuando el request trae `institutionId` explícito** en query/body/params:

```ts
// tenant.guard.ts:56-69
const requestInstitutionId =
  request.query?.institutionId || request.body?.institutionId || request.params?.institutionId;
if (requestInstitutionId && requestInstitutionId !== jwtInstitutionId) { throw Forbidden }
```

Si el endpoint identifica el recurso por `studentEnrollmentId`, `teacherAssignmentId`, `evaluativeActivityId`, `id` de recuperación, etc. (que es lo normal), **el guard no valida nada**. Los servicios de notas tampoco filtran por institución: derivan el `institutionId` *del propio recurso* y lo estampan.

Evidencia:
- `student-grades.controller.ts:27-49` → `POST /student-grades`, `GET /by-student` sin scoping.
- `student-grades.service.ts:10-31` → toma `dto.studentEnrollmentId`, lee `enr!.institutionId` del recurso y escribe.
- `partial-grades.controller.ts:26-54` → mismo patrón (`upsert`, `bulk`, `by-assignment`, `by-student`).
- **76 endpoints** reciben IDs de recurso (`studentEnrollmentId`/`teacherAssignmentId`/`studentId`/`groupId`) directamente por query/body (grep en `*.controller.ts`).

**Cómo reproducirlo.**
1. Inicia sesión como `DOCENTE` de la Institución A (JWT válido).
2. Obtén un `studentEnrollmentId` y `evaluativeActivityId` de la Institución B (secuenciales/enumerables o filtrados por otra vista).
3. `POST /student-grades { studentEnrollmentId: <B>, evaluativeActivityId: <B>, score: 1.0 }`.
4. El `TenantGuard` pasa (no hay `institutionId` en el body), el servicio estampa el `institutionId` **correcto de B** y escribe la nota. → Corrupción cross-institución silenciosa.
5. Variante lectura: `GET /student-grades/by-student?studentEnrollmentId=<cualquiera>` devuelve las notas de cualquier estudiante de cualquier institución. Como `by-student` incluye rol `ESTUDIANTE`/`ACUDIENTE`, **un estudiante puede leer las notas de otro** (escalamiento horizontal).

**Impacto.** Lectura y escritura cruzada de notas entre instituciones y entre estudiantes; alteración de calificaciones ajenas; violación de privacidad (habeas data). En un producto SaaS multi-institución esto es el riesgo #1.

**Riesgo.** Probabilidad media (requiere conocer/enumerar IDs cuid — no triviales, pero sí filtrables por muchas vistas) · Impacto crítico.

**Prioridad.** P0 — bloqueante para producción.

**Solución recomendada.**
- Añadir verificación de pertenencia en cada servicio de notas: resolver el `institutionId` del recurso y compararlo con `req.resolvedInstitutionId`; si difiere → 403. No confiar en que el request "declare" su institución.
- Para `DOCENTE`, además verificar **autorización sobre el recurso** (que el `teacherAssignmentId` pertenezca al docente, o que sea coordinador/admin). Hoy cualquier docente puede calificar cualquier asignatura de su propia institución.
- Estratégico: introducir un **Prisma middleware / extension** que inyecte `institutionId = resolvedInstitutionId` como filtro obligatorio en los modelos tenant-scoped, o repositorios que exijan el tenant. Es la única forma de cerrar 76 endpoints sin parchear uno por uno.

---

### C-2 · `bulkUpsert` de planilla no es transaccional → pérdida de notas ante interrupción (Chaos)

**Descripción.** `PartialGradesService.bulkUpsert` (`partial-grades.service.ts:121-327`) ejecuta, **sin `$transaction`**, y en este orden:
1. Guarda de FINALIZED por período.
2. **Migración por cambio de docente**: `deleteMany` de notas del docente anterior en conflicto + `updateMany` para migrar el resto.
3. Bucle de `upsert`/`delete` celda por celda.
4. `recomputePeriodFinalGrade` por cada combinación.

Si la conexión se cae o un `upsert` falla a mitad (Escenario 10: red/BD/refresh/doble submit), quedan **escrituras parciales**: las notas del docente anterior ya fueron **borradas** (paso 2), pero las nuevas aún no existen (paso 3), y `PeriodFinalGrade` puede recalcularse sobre datos incompletos.

**Cómo reproducirlo.** Docente nuevo hereda un grupo con notas previas; guarda la planilla completa; corta la red (o mata el proceso) tras el `deleteMany` de conflictos y antes de terminar el bucle. Resultado: notas del docente anterior perdidas y las nuevas ausentes.

**Impacto.** Pérdida real de calificaciones ya digitadas. La auditoría forense registra el DELETE (bien), pero el dato operativo se pierde y el boletín queda incompleto.

**Riesgo.** Probabilidad media-alta bajo carga/redes inestables · Impacto alto.

**Prioridad.** P0/P1.

**Solución recomendada.** Envolver todo `bulkUpsert` (migración + upserts + recompute) en un único `prisma.$transaction`, con nivel de aislamiento adecuado y timeout. La auditoría forense se emite tras commit exitoso.

---

### C-3 · La "migración por cambio de docente" roba notas a un co-docente activo

**Descripción.** En `bulkUpsert`, la migración considera "asignaciones históricas" a **todas** las demás asignaciones del mismo `grupo+materia+año`, **sin filtrar por `endDate`**:

```ts
// partial-grades.service.ts:151-159
const historicalAssignments = await this.prisma.teacherAssignment.findMany({
  where: { academicYearId, groupId, subjectId, id: { not: currentAssignmentId } }, // ← sin endDate
});
```

Si dos docentes co-enseñan la misma materia en el mismo grupo (dos asignaciones **activas**), al guardar, el docente A **borra en conflicto y migra hacia sí** las notas del docente B. Además esta lógica corre en **cada** `bulkUpsert` (coste y riesgo constantes).

**Cómo reproducirlo.** Crea dos `TeacherAssignment` activas para el mismo grupo+materia+año (co-docencia / desdoblamiento). Docente B digita notas. Docente A guarda su planilla → las notas de B en las mismas celdas se borran (auditadas como "reemplazo por cambio de docente") y el resto se migran al assignment de A.

**Impacto.** Pérdida/traspaso silencioso de notas entre docentes legítimamente concurrentes. Corrupción de autoría (`enteredById`).

**Riesgo.** Probabilidad media (co-docencia es común en áreas integradas / desdobles) · Impacto alto.

**Prioridad.** P1.

**Solución.** Restringir la migración a asignaciones **cerradas** (`endDate != null`) o marcadas explícitamente como reemplazo; nunca migrar entre asignaciones ambas activas. Idealmente hacer la migración un acto explícito ("transferir grupo") y no un efecto colateral de guardar la planilla.

---

# 🟠 Riesgos altos

### A-1 · Renormalización de ponderaciones: un componente/período faltante infla la nota

**Descripción.** Tanto el cálculo de período como el anual **descartan los componentes/períodos sin nota y renormalizan** al 100% del peso presente:

```ts
// student-grades.service.ts:206-215 (período) y 409-418 (anual)
const validComponents = componentResults.filter(c => c.average !== null);
const totalPercentage = validComponents.reduce((a,c)=>a+c.percentage,0);
const grade = totalPercentage>0 ? round((weightedSum*100)/totalPercentage) : null;
```
Mismo patrón en `recomputePeriodFinalGrade` (`partial-grades.service.ts:442-451`).

Ejemplo: plan COGNITIVO 40 / PROCEDIMENTAL 40 / ACTITUDINAL 20. El estudiante solo tiene 5.0 en COGNITIVO → nota de período = **5.0** (como si el 40% fuera el 100%), no 2.0. En el **cierre anual**, si falta un período, el anual se computa sobre pesos parciales y puede **promover a quien no debería**.

**Impacto.** Notas de período/anuales infladas cuando faltan componentes; distorsiona promoción y "informe parcial". Es una decisión de negocio no explicitada, no un bug obvio — pero hoy no es configurable ni auditable.

**Riesgo.** Probabilidad alta (siempre hay componentes vacíos a mitad de período) · Impacto alto en el cierre.

**Prioridad.** P1.

**Solución.** Decisión explícita de negocio: (a) tratar componente sin nota como 0, (b) renormalizar solo hasta cierta fecha y bloquear en cierre si falta un componente obligatorio, o (c) exigir 100% de peso presente para emitir nota final. Registrar la política por institución y mostrar "nota provisional (faltan componentes)" en la UI.

---

### A-2 · Doble redondeo en el límite de aprobación → aprueba quien raspa por debajo

**Descripción.** El promedio se redondea a 1 decimal **por componente**, luego se pondera, luego se **vuelve a redondear**, y la clasificación de desempeño redondea **otra vez antes de clasificar**:

```ts
// student-grades.service.ts:468 getPerformanceLevel
const roundedScore = this.roundToOneDecimal(score); // 2.95 → 3.0 → BÁSICO (aprueba)
```

Con escala por defecto (BÁSICO ≥ 3.0), un **2.95** real se convierte en **3.0 = aprobado**. El redondeo escalonado (por componente y por resultado) puede mover casos frontera 0.05–0.1.

**Impacto.** Estudiantes en la frontera exacta aprueban/reprueban según el orden de redondeo, no según su nota real. En 1.500 estudiantes, decenas caen en frontera cada período.

**Riesgo.** Probabilidad media · Impacto alto (afecta promoción individual).

**Prioridad.** P1.

**Solución.** Definir una política única de redondeo: redondear **una sola vez** al final, o clasificar con la nota sin redondear y documentar la regla (media-arriba vs. truncamiento) por institución. Añadir tests de frontera (2.94, 2.95, 2.99, 3.0).

---

### A-3 · Las reglas de área WEIGHTED y DOMINANT están inertes (valores hardcodeados)

**Descripción.** En la detección de recuperaciones, el peso y la dominancia de cada asignatura están **fijados a constantes**:

```ts
// period-recovery.service.ts:95-101
weight: 1.0,       // "Peso por defecto, se obtiene de plantillas"
isDominant: false, // "Por defecto, se obtiene de plantillas"
```

Por tanto `calculateAreaAverage`:
- `WEIGHTED` se comporta idéntico a `AVERAGE` (todos pesan 1.0).
- `DOMINANT` nunca encuentra dominante → cae a promedio.
- La regla de aprobación `DOMINANT_SUBJECT` nunca activa la asignatura dominante.

**Impacto.** Instituciones que configuran áreas ponderadas o con asignatura dominante obtienen **detección de recuperación incorrecta** — no coincide con su reglamento (Escenario 6). Silencioso: no hay error, solo resultados equivocados.

**Riesgo.** Probabilidad media (depende de cuántas instituciones usen áreas ponderadas) · Impacto alto (reglamento académico).

**Prioridad.** P1.

**Solución.** Cargar `weight`/`isDominant` reales desde la plantilla/config de área en lugar de constantes, o desactivar explícitamente esas opciones en la UI hasta implementarlas (no ofrecer configuración que el motor ignora).

---

### A-4 · La recuperación sobrescribe la nota canónica sin evento de auditoría forense

**Descripción.** El sistema tiene `GradeAuditService` (auditoría forense) y está bien cableado en `partial-grades` (CREATE/UPDATE/DELETE). Pero **las recuperaciones mutan `PeriodFinalGrade.finalScore` con `updateMany` sin emitir ningún evento de auditoría**:

```ts
// period-recovery.service.ts:499-511 (registerResult) y 572-585 (reviewResult)
await this.prisma.periodFinalGrade.updateMany({ where {...}, data: { finalScore } });
// ← no hay this.gradeAudit.record(...)
```

El grep confirma que `grade-audit` no se invoca en el módulo `recovery`.

**Impacto.** La nota final de período **cambia** por recuperación pero el rastro forense (quién/cuándo/valor anterior→nuevo) no queda en `GradeAuditEvent`. La nota original se preserva en `PeriodRecovery.originalScore`, pero la línea de tiempo canónica de la nota tiene un salto sin trazar. Contradice el diseño "GradeAuditEvent forense" (memoria `superadmin-auditoria-notas`).

**Riesgo.** Probabilidad alta (toda recuperación aprobada) · Impacto alto (integridad/forense).

**Prioridad.** P1.

**Solución.** Emitir `gradeAudit.record({ action:'UPDATE', reason:'RECUPERACION', previousScore, newScore })` en `registerResult`/`reviewResult` al propagar a `PeriodFinalGrade`. Considerar además marcar `PeriodFinalGrade` con un flag `modifiedByRecovery`.

---

# 🟡 Riesgos medios

### M-1 · IDOR por `id` en recuperaciones + validación con la institución equivocada

**Descripción.** `registerResult`, `updateActivity`, `reviewResult` cargan la recuperación **solo por `id`**, sin verificar que pertenezca al tenant del solicitante (`period-recovery.service.ts:428-514`). `registerResult` recibe `institutionId` del JWT y valida reglas/impacto con **ese** tenant, pero luego escribe sobre el `PeriodFinalGrade` del estudiante (que puede ser de otra institución). Un coordinador puede revisar/aprobar recuperaciones de otra institución conociendo el `id`.

**Impacto.** Escritura cross-tenant + cálculo de impacto con reglas del tenant equivocado.
**Riesgo.** Prob. media · Impacto alto → **medio** por dificultad de obtener el `id`.
**Prioridad.** P1 (mismo patrón que C-1).
**Solución.** Verificar `recovery.institutionId === req.resolvedInstitutionId` antes de operar; usar siempre la institución del recurso para las reglas.

### M-2 · Código muerto en el motor de promoción enmascara un estado real

**Descripción.** En `promotion.engine.ts:94-106`, la rama `onlySubjectIssue` dentro de `if (blocked)` es **inalcanzable**: si promedio y asistencia están OK y las materias perdidas están dentro del límite, `blocked` nunca se pone `true`. La rama AT_RISK "por materias dentro del límite" solo se alcanza por el `else if` de la línea 107.

**Impacto.** No es un error de resultado hoy, pero es lógica confusa que oculta la intención y puede romperse en el próximo cambio. Además, la **Regla 1** bloquea por `finalAverage < minPassingGrade` — en el modelo colombiano (Decreto 1290) la promoción suele depender del **nº de áreas reprobadas**, no del promedio global. Verificar que esto sea intencional y configurable.
**Riesgo.** Bajo-medio.
**Prioridad.** P2.
**Solución.** Eliminar la rama muerta; escribir tabla de verdad de estados con tests; confirmar la semántica "promedio vs áreas perdidas" con el reglamento.

### M-3 · `getPerformanceLevel` usa `findFirst` sin `orderBy` (no determinista ante solape)

**Descripción.** `student-grades.service.ts:470` clasifica con `findFirst({ minScore<=x, maxScore>=x })` sin orden. Si dos filas de `PerformanceScale` solapan, el nivel devuelto es arbitrario. **Mitigado** porque `validateScaleRanges` se aplica al guardar config (`institution-config.service.ts:319`), pero la tabla `PerformanceScale` derivada podría escribirse por otra vía sin esa validación.

**Impacto.** Nivel de desempeño ("Superior/Alto/...") inconsistente en boletín ante datos de escala mal formados.
**Riesgo.** Bajo (hay validación upstream) · **Prioridad** P2.
**Solución.** Defensa en profundidad: `orderBy` determinista + validar rangos también al derivar/persistir `PerformanceScale`.

### M-4 · `enr!` / `ta!` (non-null assertion) → 500 en vez de 404 con ID inexistente

**Descripción.** `student-grades.service.ts:24` (`enr!`) y `partial-grades.service.ts:44,95` (`ta!`) asumen que el recurso existe. Con un ID inválido lanzan TypeError → 500.
**Impacto.** Ruido de errores, mala UX de API, dificulta distinguir "no existe" de "fallo".
**Prioridad.** P3. **Solución.** Validar y lanzar `NotFoundException`/`BadRequestException` explícito.

---

# 🔵 Riesgos bajos / observaciones

- **`recoverLostGrades`** (`partial-grades.service.ts:583`) elige la asignación con `findFirst` — si hay varias, puede adjuntar la nota sintética al docente equivocado. Herramienta de admin, bajo impacto.
- **`recomputePeriodFinalGrade`** atribuye `enteredById = assignment.teacherId` aun para notas migradas de otro docente → autoría imprecisa.
- **Redondeo** definido localmente (`Math.round(x*10)/10`) y duplicado en varios servicios — debería ser una utilidad única compartida.

---

# 🧩 Problemas de concurrencia

- ✅ **Bien:** la celda de planilla usa **bloqueo optimista** (`expectedUpdatedAt`) y reporta conflicto en vez de sobrescribir (`partial-grades.service.ts:63-77`). Es la parte más madura del sistema.
- 🔴 **Mal:** el **lote** no es atómico (C-2) y la migración por docente crea condiciones de carrera destructivas entre co-docentes (C-3).
- ⏳ **No verificado sin entorno vivo:** 50 docentes guardando en paralelo sobre el mismo período, deadlocks de Postgres, saturación del pool de conexiones bajo `Promise.all` masivos (`student-grades.bulkUpsert` dispara N upserts en paralelo, `student-grades.service.ts:34`). Recomiendo prueba de carga en staging (ver Pase 2).

---

# 🎓 Problemas académicos (consolidado)

| # | Problema | Efecto en el estudiante |
|---|----------|-------------------------|
| A-1 | Renormalización de pesos | Nota inflada si falta un componente/período |
| A-2 | Doble redondeo en frontera | Aprueba/reprueba por 0.05 |
| A-3 | Reglas de área WEIGHTED/DOMINANT inertes | Recuperación detectada mal vs. reglamento |
| A-4 | Recuperación sin auditoría forense | Cambio de nota sin rastro canónico |
| M-2 | Promoción por promedio vs. áreas | Semántica posiblemente no conforme a Dec.1290 |

---

# 🔐 Problemas de seguridad (consolidado)

- **C-1** IDOR multi-tenant sistémico (rutas de notas) — **P0**.
- **M-1** IDOR por `id` en recuperaciones — **P1**.
- Falta **autorización a nivel de recurso** para `DOCENTE` (cualquier docente califica cualquier asignatura de su institución).
- Roles amplios en lectura (`by-student` permite `ESTUDIANTE`/`ACUDIENTE` sin comprobar que sea *su* matrícula) → escalamiento horizontal.

---

# 🏗️ Recomendaciones de arquitectura

1. **Tenant enforcement en la capa de datos**, no en el guard: Prisma extension que exija/inyecte `institutionId = resolvedInstitutionId`. Cierra los 76 endpoints de una vez.
2. **Un solo motor de notas.** Hoy hay dos (`academic/grades` y `evaluation/*`) con la misma renormalización duplicada. Unificar en un servicio puro y testeado (fuente única para boletín, MEN, promoción, dashboard).
3. **Política de redondeo y de "componente faltante" como configuración institucional explícita**, no como comportamiento implícito del código.
4. **Auditoría forense obligatoria en todo write de nota canónica** (incluida recuperación y cambio manual C-1), vía un único punto de escritura de `PeriodFinalGrade`.
5. **Migración de notas por cambio de docente como operación explícita y transaccional**, no efecto colateral del guardado.

---

# ⚡ Quick Wins (bajo esfuerzo, alto valor)

1. Filtrar la migración por `endDate != null` (C-3) — 1 línea, evita robo de notas entre co-docentes.
2. Emitir `gradeAudit.record` en `registerResult`/`reviewResult` (A-4).
3. Añadir `orderBy` determinista en `getPerformanceLevel` (M-3).
4. Reemplazar `enr!`/`ta!` por `NotFoundException` (M-4).
5. Borrar la rama muerta del motor de promoción + test de tabla de verdad (M-2).

---

# 🧾 Deuda técnica

- Dos subsistemas de notas y dos implementaciones de la misma fórmula ponderada.
- Redondeo duplicado en ≥3 servicios.
- `getAreaConfig` usa `$queryRaw` crudo a `Institution` (columnas `areaCalculationType`...) en paralelo al ORM — acopla a nombres de columna y evita el tipado.
- Configuración de área ofrecida en UI que el motor ignora (A-3).

---

# 🚧 Riesgos para producción (bloqueantes)

| Bloqueante | Motivo |
|------------|--------|
| **C-1** | Cualquier docente/estudiante puede leer/escribir notas de otra institución/estudiante. Inaceptable en SaaS multi-institución. |
| **C-2** | Guardado de planilla no atómico → pérdida de notas ante red inestable (Railway/red escolar). |
| **A-1 / A-2** | El motor puede promover/reprobar mal en frontera y con componentes faltantes. |

---

# 📋 Plan del Pase 2 (lo que falta y requiere entorno vivo)

Mapeado a tus 16 escenarios, esto **no** lo audité aún y **no** debe darse por bueno:

- **Esc. 2/3 (Matrículas/Docentes):** duplicados, huérfanos al retirar/trasladar, integridad al eliminar docente con notas.
- **Esc. 4/14 (Aula/ABP):** estados muertos, acciones sin salida, gating de fases (auditoría de código UI + walkthrough).
- **Esc. 9/10 (Concurrencia/Chaos a escala):** prueba de carga real en staging (k6/artillery): 50 docentes × mismo período, medición de deadlocks y pool.
- **Esc. 11 (Seguridad):** barrido de los 76 endpoints IDOR + fuzz de JWT/roles.
- **Esc. 12 (Rendimiento):** detección de N+1 (el `resolveCanonicalPeriodGrade` por período × estudiante en boletín de grupo huele a N+1).
- **Esc. 13/15 (UX/Valeria):** recorrido pantalla-por-pantalla con el entorno corriendo.
- **Esc. 16 (Cambio de año):** el más crítico — aún no auditado; requiere leer el proceso de cierre/promoción/graduación e histórico.

---

*Fin del Pase 1. Cada hallazgo tiene evidencia `archivo:línea` verificable en la rama `staging`. Ninguna afirmación de este informe proviene de una simulación fabricada.*
