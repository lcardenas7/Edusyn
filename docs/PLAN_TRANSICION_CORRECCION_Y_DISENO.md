# Plan de corrección y diseño — Modalidad cualitativa (DIMENSIONS) y su integración al ciclo académico

> **Documento de análisis y plan. No se implementó nada.** Sin cambios en Prisma, migraciones, servicios, endpoints ni UI.
> Fuente técnica de verdad: `docs/AUDITORIA_TRANSICION_COMPLETITUD_Y_CONFIGURACION.md` + verificación directa del árbol actual.

Fecha: 2026-08-16 · Rama: `main`

**Etiquetas de pertenencia:** `[NÚCLEO EDUSYN]` `[MODALIDAD]` `[CONFIGURACIÓN INSTITUCIONAL]` `[BOLETÍN/PRESENTACIÓN]` `[DATOS]` `[REGLA ESPECÍFICA]` (deuda)
**Evidencia:** `[CONFIRMADO]` `[INFERIDO]` `[NO ENCONTRADO]` `[DECISIÓN PENDIENTE]`

> ### ⚠️ Regla de interpretación de datos (vigente para toda la auditoría)
>
> **I.E.D. La Esperanza del Sur todavía NO usa el sistema académicamente.** Todos sus
> estudiantes, matrículas, períodos, aprendizajes, evidencias, valoraciones, boletines y
> configuraciones deben considerarse **DATOS DE PRUEBA** creados durante la auditoría y el
> desarrollo, salvo indicación explícita en contrario.
>
> **Las demás instituciones del despliegue SÍ tienen información real.**
>
> Consecuencias:
> - Un hallazgo sobre datos de esta institución **no es un incidente académico**: es la
>   demostración de un defecto. Sigue siendo válido para descubrir bugs, inconsistencias,
>   flujos incorrectos y problemas de integridad o configuración.
> - **No se diseñan soluciones para "reparar" estos datos.** El objetivo es construir bien
>   el sistema *antes* de que la institución empiece a usarlo.
> - **Ninguna migración, limpieza o backfill puede ejecutarse de forma global.** Debe
>   acotarse por institución, porque el resto del despliegue sí contiene datos reales.
>
> Prioridad de trabajo: `INTEGRIDAD → SEMÁNTICA → CONFIGURACIÓN MULTIINSTITUCIONAL →
> COMPLETITUD → GOBIERNO DEL PERÍODO → SNAPSHOT → BOLETÍN → AUDITORÍA`.
> **No** recuperación de información académica histórica.

---

## 0. HALLAZGO QUE CAMBIA LA PRIORIDAD DEL PLAN

Antes de entrar en materia, un dato que condiciona todo lo demás y que descubrí al verificar el punto 5 de su regla de aislamiento ("qué pruebas existentes garantizan que cuantitativo permanece igual"):

**[CONFIRMADO] Los cinco servicios compartidos que este plan necesita tocar tienen cobertura de pruebas CERO.**

| Servicio compartido a modificar | ¿Prueba? |
|---|---|
| `validateTermGrades` | **Ninguna** |
| `closeTerm` | **Ninguna** |
| `finalizeTerm` | **Ninguna** |
| `getCompletenessStatus` | **Ninguna** |
| `buildGroupReportCards` | **Ninguna** |

Las 16 specs del repositorio cubren otras zonas: `partial-grades.create`, `student-grades.service`, `term-grade-at-date`, `passing-grade`, `grades.service`, `reports.failed-subjects`, `performance-scale.util`, `academic-year-lifecycle.service`, `templates.service`, importadores, `institution-config.service`, `superadmin.service`, `excel-report.helper`, `performance-generator.service`.

**Consecuencia para el plan:** su regla "no romper cuantitativo" no se puede *garantizar* hoy por pruebas en estos cinco puntos. Por tanto la Fase 0 de este plan no es una corrección funcional, sino **escribir pruebas de caracterización** que fijen el comportamiento cuantitativo actual de esos cinco servicios. Sin eso, cualquier cambio en ellos es una apuesta.

---

## 1. MODELO ACTUAL

### 1.1 Estructura

```
Area
 └── Subject (subjectType = PRESCHOOL_DIMENSION)        ◄── DIMENSIÓN  [DATOS]
      │        se dicta vía TeacherAssignment
      └── Achievement                                    ◄── PROPÓSITO  [DATOS]
           │   catálogo: gradeId + subjectId + academicYearId
           │             teacherAssignmentId = null
           │             academicTermId = null → ANUAL
           ├── AchievementEvidence                       ◄── IMPRESCINDIBLE  [DATOS]
           │     └── StudentEvidenceValuation            ◄── valoración EVIDENCE (por período)
           ├── AchievementLevelDescriptor                ◄── descriptor por nivel
           └── StudentAchievement                        ◄── valoración PURPOSE (por período)

Subject (subjectType = CONVIVENCIA)
 └── ConvivenciaEntry.items: Json [{text, level}]        ◄── desempeños libres + valoración
```

**[CONFIRMADO]** `Dimension`, `TemplateDimension` y `EnrollmentDimension` son modelos muertos: cero uso en servicios; único acceso en `apps/api/prisma/seed.ts:648-652`. **La dimensión real es `Subject`.** No se migrará.

### 1.2 Comportamiento actual verificado

| Aspecto | Estado |
|---|---|
| Catálogo anual, valoración por período | **Correcto y ya implementado.** `StudentAchievement.academicTermId` y `StudentEvidenceValuation.academicTermId` existen precisamente para eso. No se duplica catálogo por período. |
| Selección de modo | `AchievementConfig.valuationScope` (`PURPOSE` \| `EVIDENCE`), **por institución**, efectivo sólo si `Grade.academicStructure = DIMENSIONS` (`reports.service.ts:2958`) |
| Valoración del propósito en modo EVIDENCE | **No existe**: `performanceLevel: null` explícito (`reports.service.ts:3320`) |
| Boletín | `transicion-propositos`; en EVIDENCE una fila por propósito (sin nivel) + una fila por imprescindible (con nivel) |
| Nombre de la dimensión en el boletín | **No se imprime** en filas académicas; sólo en la fila de Convivencia (`reportCardTemplates.ts:492`) |
| Completitud | **0 % permanente** para Transición (C-2) |
| Cierre | **Imposible** con grupos DIMENSIONS (C-1) |
| Bloqueo tras FINALIZED | **Ninguno** sobre datos cualitativos |
| Auditoría | **Ninguna** sobre datos cualitativos |

---

## 2. MODELO OBJETIVO (esta institución)

`[REGLA ESPECÍFICA]` → resuelta como `[CONFIGURACIÓN INSTITUCIONAL]`, sin ramificación de código:

```
academicStructure = DIMENSIONS                    [MODALIDAD]
valuationScope    = EVIDENCE                      [CONFIGURACIÓN INSTITUCIONAL]
4 dimensiones × 1 propósito × N imprescindibles   [DATOS]
3 períodos                                        [DATOS]
Convivencia: desempeños libres valorados          [MODALIDAD] + [DATOS]
```

El ciclo objetivo, idéntico al cuantitativo:

```
UNIVERSO (EnrollmentSubject + GroupSubjectException)
   → EXPANSIÓN A OBLIGACIONES SEGÚN MODALIDAD
   → COMPLETITUD COMÚN
   → DECLARACIÓN DOCENTE
   → CIERRE (CLOSED)
   → FINALIZACIÓN (FINALIZED + snapshot)
   → BOLETÍN (render desde snapshot)
   → REAPERTURA CON MOTIVO
   → CORRECCIÓN AUDITADA
   → NUEVA VERSIÓN DE SNAPSHOT
```

**Ninguna pieza de este ciclo es nueva salvo dos: excepción y declaración docente.**

---

## 3. CAPACIDAD MULTIINSTITUCIONAL

`PURPOSE` **no se elimina ni se degrada**. Matriz que debe seguir siendo expresable:

| Institución | `academicStructure` | `valuationScope` | Obligación | Satisfecha por |
|---|---|---|---|---|
| A (ésta) | `DIMENSIONS` | `EVIDENCE` | (matrícula × imprescindible × período) | `StudentEvidenceValuation` |
| B | `DIMENSIONS` | `PURPOSE` | (matrícula × propósito × período) | `StudentAchievement` |
| C | `AREAS_SUBJECTS` | *(no aplica)* | (matrícula × asignatura × período) | `PeriodFinalGrade` |
| D | `SUBJECTS_ONLY` | *(no aplica)* | (matrícula × asignatura × período) | `PeriodFinalGrade` |

Lo que garantiza la capacidad es que **el motor no pregunte por la institución, sino por la modalidad + configuración**, y que la única pieza variable sea una función de expansión:

```
expandirObligaciones(enrollment, subject, term, modalidad, config) → Obligación[]
estaSatisfecha(obligación) → boolean
```

Ambas resueltas por tabla de despacho, nunca por `if (institución === …)`.

### 3.1 Techo multiinstitucional detectado

**[CONFIRMADO] Escalas cualitativas de más de 4 niveles son imposibles hoy.**
- `PerformanceLevel` es un enum de 4 valores (`SUPERIOR/ALTO/BASICO/BAJO`) y es el tipo de `StudentAchievement.performanceLevel` y `StudentEvidenceValuation.performanceLevel`.
- La plantilla mapea escala↔enum por posición con `PERF_SLOTS` que sólo contempla 2, 3 y 4 niveles y **cae silenciosamente a 4** (`reportCardTemplates.ts:417-425`).
- Una institución con escala de 5 niveles obtiene un mapeo incorrecto sin ningún error.

No se corrige en este plan (no lo necesita esta institución), pero queda registrado como límite conocido → **D-11**.

---

## 4. SEPARACIÓN CON CUANTITATIVO

### 4.1 NO TOCAR — sin excepción

`PeriodFinalGrade` · `PartialGrade` · `recalculateFinalGrade` · `EvaluationPlan` / `EvaluationComponent` / pesos · `PerformanceScale` como escala numérica · `isFailing` / `academic-rules.engine` · `PeriodRecovery` y `RecoverySnapshotService` · `FinalComponent*` · importadores de notas.

### 4.2 Servicios compartidos — análisis exigido por su regla de aislamiento

#### S-1 · `validateTermGrades` + `closeTerm` — **[IMPACTO POTENCIAL EN CUANTITATIVO: MEDIO]**

1. **Qué se comparte:** único validador de cierre para toda la institución.
2. **Comportamiento cuantitativo actual:** recorre todos los grupos con matrícula activa y todas las asignaturas de `TeacherAssignment`; exige `PeriodFinalGrade` para cada par (matrícula, asignatura). `closeTerm` aborta si falta uno.
3. **Qué necesita Transición:** que para grupos `DIMENSIONS` la obligación no sea `PeriodFinalGrade` sino la valoración cualitativa correspondiente al `valuationScope`.
4. **Por qué la abstracción no cambia el cuantitativo:** el despacho es por `Grade.academicStructure`. Para `AREAS_SUBJECTS` y `SUBJECTS_ONLY` la rama es literalmente la actual. Un grupo cuantitativo no puede entrar en la rama `DIMENSIONS`.
   ⚠️ **Salvedad honesta:** cambiar el universo de `TeacherAssignment` a `EnrollmentSubject` **sí altera el cuantitativo** — corrige A-2 y A-3, pero cambia números que hoy el coordinador ve. Por eso se separa en dos pasos (§13, F1 vs F3).
5. **Pruebas que lo garantizan hoy:** **NINGUNA.** → prerequisito: caracterización.

#### S-2 · `getCompletenessStatus` — **[IMPACTO: MEDIO]**

Mismo análisis. Hoy Transición reporta 0 %; cualquier corrección **cambia el porcentaje institucional agregado** que se muestra al coordinador. No rompe cuantitativo, pero mueve una cifra visible: debe comunicarse, no colarse. Pruebas hoy: **ninguna**.

#### S-3 · `buildGroupReportCards` — **[IMPACTO: BAJO]**

Ya está ramificado por `evidenceMode` desde `f41fd4e`. Añadir `reportContent` al snapshot es aditivo. El riesgo real es el tamaño del JSON congelado, no la corrección. Pruebas hoy: **ninguna**.

#### S-4 · `finalizeTerm` — **[IMPACTO: BAJO en comportamiento, ALTO en operación]**

Congelar `reportContent` es aditivo y no altera notas. Pero volver `finalizeTerm` transaccional y hacer que **falle** si un grupo falla cambia el comportamiento operativo: hoy termina en éxito con grupos sin snapshot. Es la corrección deseada, y debe anunciarse.

#### S-5 · `guardTermNotFinalized` — **[IMPACTO: NINGUNO]**

Existen 3 copias idénticas (`partial-grades`, `period-final-grades`, `evaluation-plans`). Extraer a utilidad compartida y **aplicarla además** a los modelos cualitativos es puramente aditivo para el cuantitativo: mismo predicado, mismo mensaje, mismos modelos ya protegidos.

#### S-6 · `GradeAuditService` — **[IMPACTO: NINGUNO]**

Ya es genérico (`source`, `previousValue`/`newValue` Json) y atrapa sus propios errores por diseño (`grade-audit.service.ts:69`). Añadir nuevos `source` no toca el camino de `PARTIAL_GRADE`. **Preservar esa política de no-propagación.**

#### S-7 · `AcademicDataSourceService` — **[IMPACTO: NINGUNO]**

Es agnóstico de modalidad: opera sobre el DTO de `buildGroupReportCards`. No requiere cambios.

#### S-8 · `PerformanceScale` — **[IMPACTO: ALTO si se toca]**

Es **compartido entre la escala numérica cuantitativa y el enum cualitativo**. `buildGroupReportCards:2827` lo lee para ambos. **No tocar en este plan.** El endpoint `POST /performance-scale/upsert` que se salta `validateScaleRanges` es un defecto real, pero pertenece al dominio cuantitativo y se trata por separado (§12, H-9).

---

## 5. COMPLETITUD

### 5.1 Universo — `[NÚCLEO EDUSYN]`

**[CONFIRMADO] `EnrollmentSubject` es una fuente válida y ya consciente de excepciones.** Se puebla en `enrollment.service.ts:1216` a partir de `templatesService.getEffectiveStructureForGroup`, que **ya aplica `GroupSubjectException`** (`EXCLUDE` filtra, `MODIFY` ajusta). Se puebla para **todos** los grupos, incluidos `DIMENSIONS`.

**[CONFIRMADO] Riesgo de dato:** la creación del snapshot de matrícula es *best-effort* — está envuelta en `try/catch` que sólo loguea (`enrollment.service.ts`, "No fallar la matrícula si el snapshot falla"). Hay matrículas potencialmente sin `EnrollmentSubject`. Antes de usarlo como universo hay que **medir cuántas** y ofrecer reparación (§15, R-4).

### 5.2 Modelo de completitud — `[NÚCLEO EDUSYN]`

```
UNIVERSO      = EnrollmentSubject(matrícula)            ← ya consciente de GroupSubjectException
                  ↓  expandirObligaciones(modalidad, config)
OBLIGACIONES  = lista de unidades evaluables del período
                  ↓  estaSatisfecha(obligación)
ESTADO        = PENDIENTE | COMPLETO | EXCEPTUADO

completitud = satisfechas / (universo − exceptuadas)
```

Expansión por modalidad — **la única pieza variable**:

| Modalidad + config | Obligación (grano) | Satisfecha por |
|---|---|---|
| `AREAS_SUBJECTS` / `SUBJECTS_ONLY` | matrícula × asignatura × período | existe `PeriodFinalGrade` |
| `DIMENSIONS` + `PURPOSE` | matrícula × propósito × período | existe `StudentAchievement` |
| `DIMENSIONS` + `EVIDENCE` | matrícula × imprescindible × período | existe `StudentEvidenceValuation` |

Los propósitos/imprescindibles del período se resuelven desde el catálogo con el filtro correcto: `gradeId + subjectId + academicYearId`, `teacherAssignmentId = null`, `academicTermId ∈ {término, null}`. **El `null` es obligatorio** — es lo que hoy provoca C-2.

### 5.3 Estados — `[NÚCLEO EDUSYN]`

`PENDIENTE` · `COMPLETO` · `EXCEPTUADO`. **No se crea `NO_APLICA`**: la no-pertenencia se expresa por ausencia en el universo.

**Regla de presentación obligatoria:** una excepción sube el porcentaje. El panel nunca muestra un número solo: siempre `X % · N excepciones`. `[BOLETÍN/PRESENTACIÓN]` del panel, no del boletín.

---

## 6. INTEGRIDAD DE EVIDENCIAS — ✅ **CORREGIDA EN F1**

> **Registro histórico.** Esta sección describe el defecto tal como se diagnosticó **antes** de
> corregirlo. El mecanismo quedó cerrado en F1 (`docs/F1_INTEGRIDAD_EVIDENCIAS.md`): ningún
> camino del código de aplicación puede hoy dejar una valoración apuntando a una evidencia
> inexistente. El defecto fue **reproducido en producción mediante datos de prueba** de
> I.E.D. La Esperanza del Sur; no hubo afectación de información académica institucional.

### 6.1 Diagnóstico preciso (vector único)

**[CONFIRMADO] Sólo hay un camino que destruye IDs.**

| Camino | ¿Envía `evidences`? | Efecto |
|---|---|---|
| `PreschoolCatalog.savePurpose` → `PUT /achievements/:id` | **Sí, siempre, y sin `id`** (`PreschoolCatalog.tsx:139`) | **`deleteMany` + `createMany` → IDs nuevos → valoraciones huérfanas** |
| `Achievements.tsx:617` → `PUT /achievements/:id` | **No** (`{ baseDescription }`) | `data.evidences === undefined` → el bloque se salta. **Seguro** |
| `POST /:id/evidences`, `PATCH /evidences/:id`, `DELETE /evidences/:id`, reorder | n/a | **Preservan el ID. Seguros** |

La ausencia de FK en `StudentEvidenceValuation` (declarada a propósito en `schema.prisma:3166-3167`) hace que la pérdida sea **silenciosa**: no hay cascada, no hay error.

> **Actualización 2026-08-17.** Esta ausencia ya no existe. La FK
> `StudentEvidenceValuation_achievementEvidenceId_fkey` (`ON DELETE RESTRICT`,
> `ON UPDATE RESTRICT`) está aplicada en producción: la base rechaza tanto borrar una evidencia
> valorada como crear una valoración huérfana. El texto anterior describe el defecto tal como
> fue diagnosticado. Ver `docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md`.

**Mecanismo del defecto:** basta editar el texto de un propósito para que sus imprescindibles se recreen con ids nuevos y las valoraciones previas queden apuntando a filas inexistentes, en cualquier período.

**Verificación:** el mecanismo fue **reproducido en producción mediante datos de prueba** (12 de 15 valoraciones, 2 matrículas, 1 período `OPEN`, I.E.D. La Esperanza del Sur). Confirma el defecto; **no constituye pérdida de información académica institucional** — ver la regla de interpretación al inicio de este documento.

### 6.2 Respuesta a sus 8 preguntas

1. **Cómo se identifican hoy:** `cuid()` autogenerado. No hay clave natural ni código estable.
2. **Cómo se editan:** dos vías — reemplazo total (destructiva) y granular por id (segura). Ambas expuestas.
3. **Qué histórico existe:** `StudentEvidenceValuation` por (matrícula × evidencia × período). **[NO CONFIRMADO] el volumen de huérfanos actuales** — requiere consulta en staging/producción (§15, R-1).
4. **¿Debe conservarse el ID?** **Sí.** Es la identidad referenciada por el histórico. La edición de texto no debe cambiar identidad.
5. **¿Versionado?** No hace falta versionar la evidencia para arreglar el bug. Sí conviene **borrado lógico**: `isActive` ya existe y `deleteEvidence` hoy hace borrado físico. → **D-12**.
6. **¿FK?** Sí, deseable — pero **sólo después** de limpiar huérfanos, o la migración falla. → **Hecho (2026-08-17)**: huérfanas eliminadas, FK aplicada con `RESTRICT`.
7. **Cómo migrar:** §6.3.
8. **Cómo no romper cuantitativo:** `AchievementEvidence` y `StudentEvidenceValuation` **no son leídos por ningún camino cuantitativo**. Impacto: **NINGUNO**.

### 6.3 Secuencia de corrección (orden no negociable)

```
Paso 1  CERRAR EL VECTOR — sin tocar el esquema                          ✅ HECHO (F1)
        updateAchievement reconcilia por id en lugar de deleteMany+createMany:
          · evidencia con id existente → update de texto/orden
          · evidencia sin id           → empareja por texto; si no, create
          · existente ausente          → baja SOLO si no tiene valoraciones
        + PreschoolCatalog envía el id de cada evidencia.
        + misma guarda en DELETE /achievements/evidences/:id.
        Corrige cualquier llamador presente y futuro.       [IMPACTO CUANTITATIVO: NINGUNO]

Paso 2  MEDIR                                                            ✅ HECHO (F1)
        12 huérfanas de 15 · 1 institución · 2 matrículas · 1 período OPEN · 0 snapshots.
        Todas ellas, DATOS DE PRUEBA.

Paso 3  RECUPERAR                                                        ❌ NO REQUERIDO (D-13 cerrada)
        Las huérfanas son datos de prueba: no hay información académica institucional
        que reconstruir. No se implementa ningún mecanismo de recuperación.

Paso 4  BLINDAR — cambio de esquema, sólo tras 1-3                       ✅ COMPLETADO (F2)
        ✅ FK + relación Prisma en StudentEvidenceValuation.achievementEvidenceId
           Aplicada en producción el 2026-08-17.
           StudentEvidenceValuation_achievementEvidenceId_fkey
           ON DELETE RESTRICT · ON UPDATE RESTRICT
           Migración 20260817120000_student_evidence_valuation_fk
           88 migraciones aplicadas · migrate status: base al día con el historial.
           Detalle: docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md
        ✅ Relaciones de alcance a StudentEnrollment / AcademicTerm / Institution
           Aplicadas en producción el 2026-08-17 (actualización de esa misma fecha;
           el ⏳ anterior era cierto hasta ese momento).
           StudentEvidenceValuation_studentEnrollmentId_fkey  CASCADE  / CASCADE
           StudentEvidenceValuation_academicTermId_fkey       CASCADE  / CASCADE
           StudentEvidenceValuation_institutionId_fkey        RESTRICT / CASCADE
           Migración 20260817180000_student_evidence_valuation_scope_fks
           Políticas derivadas de las cinco tablas de historia académica, no elegidas.
           Detalle: docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md §4.2
        ✔ Las 12 filas huérfanas se eliminaron previamente, con autorización explícita
          y acotada a I.E.D. La Esperanza del Sur. Quedan 0 huérfanas y 3
          StudentEvidenceValuation válidas, así que ya no bloquean ninguna migración.
```

---

## 7. CIERRE Y FINALIZACIÓN

**No se crea máquina de estados nueva.** Se reutiliza `AcademicTerm.status` (`OPEN → CLOSED → FINALIZED` + reapertura).

| Corrección | Detalle | Etiqueta |
|---|---|---|
| C-1 | `validateTermGrades` despacha por `Grade.academicStructure`; para `DIMENSIONS` exige la valoración del `valuationScope` vigente | `[NÚCLEO EDUSYN]` |
| C-3a | `CLOSED` deja de ser decorativo: bloquea escritura ordinaria (docente), permite corrección administrativa | `[NÚCLEO EDUSYN]` |
| C-3b | `FINALIZED` protege **todos** los modelos académicos, no sólo tres: `StudentAchievement`, `StudentEvidenceValuation`, `ConvivenciaEntry`, `Achievement`, `AchievementEvidence`, `AttitudinalAchievement` | `[NÚCLEO EDUSYN]` |
| C-3c | `GradingPeriodConfig.isOpen` verificado en servidor, con bypass explícito para admin/coordinación | `[NÚCLEO EDUSYN]` |
| B-2 | Registrar actor y fecha de cierre (`RecoveryPeriodConfig` ya tiene el patrón `closedById`/`closedAt`) | `[NÚCLEO EDUSYN]` |
| B-3/B-4 | `finalizeTerm` transaccional por grupo; **no** marcar `FINALIZED` si algún grupo falló | `[NÚCLEO EDUSYN]` |
| §5.5 | `snapshotType` correcto: `REOPENED` tras reapertura; hoy siempre `INITIAL_CLOSE` | `[NÚCLEO EDUSYN]` |

**Principio que se respeta:** no debe existir un estado en el que el período esté finalizado y el resultado académico aún pueda cambiar sin reapertura. Hoy ese estado existe y es la situación normal de Transición.

---

## 8. SNAPSHOT

Se reutiliza `TermReportCardSnapshot`. **No se crea otro.**

### 8.1 Qué debe congelarse — publicación, no presentación

| Bloque | Hoy | Objetivo |
|---|---|---|
| `areaGrades[].subjects[].learningBlocks` (propósito, imprescindibles, `evidenceItems[].level`, descriptor, juicio) | **Ya se congela** | Mantener |
| `convivenciaText` + `convivenciaItems` | **Ya se congela** | Mantener |
| `attendance`, `achievements`, `observations`, derivados | **Ya se congela** | Mantener |
| **`reportContent`** (flags de publicación + etiquetas + `valuationScope` + escala cualitativa) | ❌ **No se congela** | **Congelar** — resuelve C-4 |
| **`academicStructure`**, **`displayConfig`** | ❌ No se congelan, y `AcademicDataSourceService:141-142` intenta reconstruirlos → `undefined` | **Congelar** |
| Excepciones vigentes | No existen aún | Deben viajar en el snapshot para que el documento sea autoexplicativo — condicionado a **D-2** |
| Plantilla, colores, firmas, encabezado | No se congelan | **No congelar** (presentación) — sujeto a **D-3** |

### 8.2 Por qué esto resuelve C-4 de raíz

Congelar `reportContent` elimina de un golpe cinco defectos de fidelidad ya medidos: etiquetas que revierten a "Aprendizaje/Evidencia", evidencias que aparecen aunque estén desactivadas (`rc.showEvidences !== false` con `undefined`), descriptor que desaparece, `preschoolLevelDisplay` que revierte a `COLUMNS`, y `achievementContent` `undefined` que degrada la plantilla al fallback histórico.

**Corolario:** una vez congelado `reportContent`, la incoherencia de defaults `rc.showEvidences !== false` deja de ser peligrosa, pero debe corregirse igual a `=== true` para los snapshots antiguos que no lo tienen.

---

## 9. BOLETÍN — publicación vs presentación

**Regla:** *si cambio esto, ¿el boletín dice algo distinto, o dice lo mismo de otra forma?* Distinto → **Publicación** (se congela). Igual de otra forma → **Presentación** (se renderiza).

| Configuración | Vive hoy en | Veredicto | Acción |
|---|---|---|---|
| `showLearningInReport` | `AchievementConfig` | Publicación | Mantener — **y hacerla efectiva** (hoy la plantilla de Transición la ignora) |
| `showEvidencesInReport` | `AchievementConfig` | Publicación | Mantener; corregir default |
| `showLevelDescriptorInReport` | `AchievementConfig` | Publicación | Mantener |
| `showJudgmentInReport` | `AchievementConfig` | Publicación | Mantener |
| `reportLearningGranularity` | `AchievementConfig` | Publicación | **Inerte en `transicion-propositos`** (usa `learningBlocks[0]`) → integrar o excluir explícitamente de esta plantilla |
| `preschoolShowRank` / `preschoolRankWeights` | `ReportCardConfig` | **Publicación mal ubicada** | Mover conceptualmente a publicación; congelar |
| `preschoolLevelDisplay` | `ReportCardConfig` | Presentación | Mantener |
| `showZeroAbsences` | `ReportCardConfig` | Presentación | Mantener |
| **`ReportCardConfig.showAchievements`** | `ReportCardConfig` | **Duplica publicación** | **Eliminar del formulario.** Sólo la consume `edusyn-clasico`; las plantillas del banco la ignoran |
| Toggles de "vista previa" en `/report-cards` | estado local | No persiste | **Eliminar o vincular** al formulario real |

**Fuente de verdad única de publicación: `AchievementConfig`.** `ReportCardConfig` queda como presentación + plantilla.

---

## 10. CONVIVENCIA — aislada

**Se conserva tal cual.** `ConvivenciaEntry` con `items: Json [{text, level}]`, desempeños libres creados por el docente, valorados individualmente, sin catálogo.

Decisiones que **no** se toman ahora:
- Si entra en la completitud → **D-9**.
- Si sus desempeños deben ser objetos de primera clase en lugar de JSON.

**Lo único que sí se le aplica ahora**, por coherencia del ciclo y sin cambiar su forma:
- protección de escritura en `CLOSED`/`FINALIZED` (§7);
- auditoría de cambios (§11 de la auditoría original, C-5);
- congelación en snapshot (ya ocurre).

**Observación arquitectónica registrada, no accionada:** `ConvivenciaEntry.items` es la **tercera** modelación del mismo par «texto valorable + nivel» (junto a `AchievementEvidence`+`StudentEvidenceValuation` y `StudentAchievement`). Unificarlas es la simplificación estructural de fondo, pero está subordinada a D-9 y no se toca en este plan.

---

## 11. CONFIGURACIÓN — inventario con consumidor

| Configuración | Dueño | Alcance | Consumidor | ¿Funciona? | Acción |
|---|---|---|---|---|---|
| `valuationScope` | Admin | Institución (efecto por grado) | `reports.service.ts:2958`, `Grades.tsx:269` | **Sí** | **Conservar.** Revisar alcance → D-8 |
| `learningLabel*` / `evidenceLabel*` | Admin | Institución | `reportContent`, plantilla | Sí, salvo mensajes de error hardcodeados | Conservar; corregir backend |
| `showLearningInReport` | Admin | Institución | `renderLearningBlocks` sí; `transicion-propositos` **no** | **Parcial** | **Corregir** |
| `showEvidencesInReport` | Admin | Institución | plantilla (`rc.showEvidences !== false`) | Sí, default invertido | **Corregir default** |
| `showLevelDescriptorInReport` | Admin | Institución | plantilla | Sí | Conservar |
| `showJudgmentInReport` | Admin | Institución | `renderLearningBlocks` | Sí | Conservar |
| `reportLearningGranularity` | Admin | Institución | `buildLearningBlocks` sí; `transicion-propositos` **no** | **Parcial** | **Corregir o excluir** |
| `descriptorMode` | Admin | Institución | `Grades.tsx:1094` | Sí | Conservar |
| `registrationModel` | Admin | Institución | **Sólo UI** (`Achievements.tsx:1184`) | **Inerte en servidor** | **Aplicar o eliminar** |
| `learningCatalogMode` | Admin | Institución | **Ninguno**. La protección real es el rol (`canManageCatalog`) | **Inerte** | **Aplicar o eliminar** |
| `useValueJudgments`, `useObservations` | Admin | Institución | UI + plantillas | Sí | Conservar |
| `ReportCardConfig.showAchievements` | Admin | Institución | Sólo `edusyn-clasico` | **Duplicado** | **Eliminar del formulario** |
| `preschoolLevelDisplay` | Admin | Institución | plantilla (ignorado en EVIDENCE) | Parcial | Documentar |
| `preschoolShowRank` / `RankWeights` | Admin | Institución | plantilla | Sí | Reclasificar a publicación |
| `showZeroAbsences` | Admin | Institución | plantilla | Sí | Conservar |
| `GradingPeriodConfig.isOpen` + fechas | Admin/Coord | Período | **Sólo UI** | **Inerte en servidor** | **Aplicar (C-3c)** |
| `ReportCardConfig.evaluationType` | — | — | Ninguno | Deprecado en el esquema | **Eliminar** |
| `Grade.academicStructure` | Admin | Grado | Todo el motor | Sí | **Elevar visibilidad en UI** |
| `academicLevelsConfig[].qualitativeLevels` | Admin | Nivel educativo | `reportContent`, plantilla | Sí, con techo de 4 niveles | Conservar; ver D-11 |

---

## 12. HALLAZGOS

| # | Hallazgo | Gravedad |
|---|---|---|
| **H-1** | **Pérdida silenciosa de valoraciones por imprescindible** al editar el catálogo (`PreschoolCatalog` → `deleteMany`+`createMany`, sin FK) | **CORREGIDA en F1.** Reproducida y confirmada en producción — ver `docs/F1_INTEGRIDAD_EVIDENCIAS.md` |
| ~~**H-2**~~ | ~~`StudentEvidenceValuation` sin ninguna relación Prisma: tampoco cascadea al borrar matrícula, término o institución~~ | **RESUELTO (2026-08-17).** Las cuatro relaciones existen ya en la base — ver `docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md` §4.2 |
| **H-3** | C-1 · Transición no puede cerrar el período | **ALTA** |
| **H-4** | C-2 · Transición reporta 0 % de completitud | **ALTA** |
| **H-5** | C-4 · `reportContent` no se congela → el boletín oficial cambia tras finalizar | **ALTA** |
| **H-6** | C-5 · Sin auditoría en `StudentAchievement`, `StudentEvidenceValuation`, `ConvivenciaEntry`, `PeriodFinalGrade` | **ALTA** |
| **H-7** | C-3 · `CLOSED` no bloquea; `FINALIZED` no protege lo cualitativo; `isOpen` inerte | **ALTA** |
| **H-8** | **Cobertura de pruebas cero** en los 5 servicios compartidos a modificar | **ALTA** |
| **H-9** | `POST /performance-scale/upsert` escribe la escala saltándose `validateScaleRanges` | MEDIA (dominio cuantitativo) |
| **H-10** | C-6 · `TermReopeningRecord` sin lectura expuesta | MEDIA |
| **H-11** | `reSnapshotTerm` regenera documentos oficiales sin motivo ni auditoría, desde un reporte | MEDIA |
| **H-12** | `getEvidenceValuationsByAssignment` no filtra `status: 'ACTIVE'` | BAJA |
| **H-13** | `PERF_SLOTS` sólo soporta escalas de 2/3/4 niveles y cae a 4 en silencio | MEDIA (multiinstitucional) |
| **H-14** | Mensajes backend hardcodean "Imprescindible" ignorando la etiqueta configurable | BAJA |
| **H-15** | `EnrollmentSubject` se crea *best-effort*: puede haber matrículas sin universo | MEDIA |
| **H-16** | Modelos muertos `Dimension` / `TemplateDimension` / `EnrollmentDimension` | BAJA |
| **H-17** | Cambiar `valuationScope` a mitad de año deja el histórico anterior invisible, sin aviso | MEDIA |

---

## 13. CAMBIOS NECESARIOS

| # | Cambio | Clasificación | Fase |
|---|---|---|---|
| 1 | Pruebas de caracterización de los 5 servicios compartidos | `[NUEVO]` (pruebas) | **F0** |
| 2 | `updateAchievement` reconcilia evidencias por id | `[REFACTORIZAR]` | **F1** |
| 3 | `PreschoolCatalog` envía ids | `[REFACTORIZAR]` | **F1** |
| 4 | Medir huérfanos de `StudentEvidenceValuation` | `[NUEVO]` (script de diagnóstico) | **F1** |
| 5 | FK + relaciones en `StudentEvidenceValuation` | `[EXTENDER]` esquema | **F2** · ✅ **COMPLETA (2026-08-17).** `achievementEvidenceId` RESTRICT/RESTRICT + `studentEnrollmentId` CASCADE/CASCADE + `academicTermId` CASCADE/CASCADE + `institutionId` RESTRICT/CASCADE |
| 6 | `validateTermGrades` despacha por `academicStructure` | `[EXTENDER]` | **F2** |
| 7 | `getCompletenessStatus`: eje cualitativo + `teacherAssignmentId`/`academicTermId` nulos | `[EXTENDER]` | **F2** |
| 8 | Congelar `reportContent` + `academicStructure` + `displayConfig` | `[EXTENDER]` | **F2** |
| 9 | `finalizeTerm` transaccional y honesto | `[REFACTORIZAR]` | **F2** |
| 10 | `guardTermNotFinalized` a utilidad compartida + aplicar a modelos cualitativos | `[REFACTORIZAR]` + `[EXTENDER]` | **F3** |
| 11 | `CLOSED` con semántica de bloqueo | `[EXTENDER]` | **F3** |
| 12 | `isOpen` verificado en servidor | `[EXTENDER]` | **F3** |
| 13 | Nuevos `source` en `GradeAuditService` | `[EXTENDER]` | **F3** |
| 14 | Actor/fecha de cierre | `[EXTENDER]` | **F3** |
| 15 | `snapshotType` correcto | `[EXTENDER]` | **F3** |
| 16 | Motor único de completitud (universo `EnrollmentSubject`) | `[REFACTORIZAR]` | **F4** |
| 17 | **Excepción de evaluación** | `[NUEVO]` | **F5** — requiere diseño aprobado |
| 18 | **Declaración de finalización docente** | `[NUEVO]` | **F5** — requiere diseño aprobado |
| 19 | Historial de reaperturas y versiones | `[NUEVO]` (lectura) | **F5** |
| 20 | `ReportCardConfig.showAchievements` y toggles de vista previa | `[ELIMINAR]` | **F6** |
| 21 | `learningCatalogMode`, `registrationModel`, `evaluationType` | `[ELIMINAR]` o `[EXTENDER]` | **F6** |
| 22 | `PerformanceScale`, `PeriodFinalGrade`, motor de notas, recuperaciones | **`[NO TOCAR]`** | — |
| 23 | Modelos `Dimension*` | `[NO TOCAR]` ahora; candidatos a `[ELIMINAR]` | F6 |
| 24 | Módulo Desempeños (`SubjectPerformance`) | **`[NO TOCAR]`** — decidir aparte si es el mismo concepto | — |

---

## 14. IMPACTO EN CUANTITATIVO

| Cambio | Impacto | Por qué |
|---|---|---|
| 1 · Pruebas de caracterización | **NINGUNO** | Sólo leen |
| 2, 3, 4, 5 · Integridad de evidencias | **NINGUNO** | `AchievementEvidence` y `StudentEvidenceValuation` no los lee ningún camino cuantitativo |
| 6 · `validateTermGrades` por estructura | **MEDIO** | Toca el validador de cierre común. La rama cuantitativa queda idéntica, pero es el gate de cierre de toda la institución |
| 7 · Completitud cualitativa | **BAJO** | Aditivo; **cambia el % agregado visible** al coordinador |
| 8 · Congelar `reportContent` | **BAJO** | Aditivo al JSON. Riesgo: tamaño del snapshot |
| 9 · `finalizeTerm` transaccional | **MEDIO** | No cambia notas, pero cambia el comportamiento operativo: pasa a fallar donde antes reportaba éxito |
| 10, 11, 12 · Bloqueo de escritura | **ALTO** | Cambia quién puede escribir y cuándo, también en cuantitativo. Requiere las pruebas de F0 y despliegue por etapas |
| 13 · Auditoría | **NINGUNO** | Aditivo; el camino `PARTIAL_GRADE` no se toca |
| 14, 15 · Metadatos de cierre/snapshot | **NINGUNO** | Aditivo |
| 16 · Motor único con universo `EnrollmentSubject` | **ALTO** | **Cambia los números del cuantitativo**: corrige A-2/A-3 pero mueve cifras que hoy el coordinador da por buenas |
| 17, 18, 19 · Piezas nuevas | **BAJO** | Aditivas, salvo que la declaración se vuelva requisito de cierre |
| 20, 21 · Limpieza de configuración | **BAJO** | `showAchievements` afecta hoy a `edusyn-clasico`, que es cuantitativo |

---

## 15. RIESGOS DE MIGRACIÓN

| # | Riesgo | Mitigación |
|---|---|---|
| **R-1** | ~~Huérfanos de `StudentEvidenceValuation` ya existentes~~ | **MEDIDO (2026-08-16, producción): 12 huérfanas de 15 (80 %), 1 institución, 2 matrículas, 1 período `OPEN`, 0 snapshots.** Son **datos de prueba** (ver R-10). No requieren recuperación → D-13 cerrada |
| ~~**R-2**~~ | ~~Añadir FK **falla** si hay huérfanos~~ | **RESUELTO (2026-08-17).** Las 12 filas —todas en I.E.D. La Esperanza del Sur— se eliminaron en una acción independiente, explícita y autorizada, no como parte de una corrección funcional. Quedan **0 huérfanas** y **3 `StudentEvidenceValuation` válidas**. La FK se aplicó después, sin incidencias |
| **R-10** | **Alcance de los datos por institución** | **I.E.D. La Esperanza del Sur = datos de prueba** creados durante la auditoría/desarrollo; la institución aún no usa el sistema académicamente. **Las demás instituciones del despliegue SÍ tienen información real.** Toda migración, limpieza o backfill debe estar acotada por institución y nunca ejecutarse de forma global |
| **R-3** | Snapshots antiguos **sin `reportContent`** | El lector debe conservar el fallback actual indefinidamente. No se reescriben snapshots históricos |
| **R-4** | Matrículas **sin `EnrollmentSubject`** (creación best-effort) | Medir; script de reparación; fallback a `TeacherAssignment` con marca explícita de "universo inferido" |
| **R-5** | El % de completitud cambia el día del despliegue | Comunicar antes. Publicar ambas cifras durante una transición |
| **R-6** | Cambio de `valuationScope` con datos existentes deja histórico invisible (H-17) | Bloquear el cambio si ya hay valoraciones del año, o exigir confirmación explícita |
| **R-7** | Períodos ya `FINALIZED` con snapshots incompletos por B-3 | Detectar grupos sin snapshot antes de endurecer `finalizeTerm` |
| **R-8** | Boletines ya emitidos deben seguir imprimiéndose igual | Nunca reescribir snapshots existentes; sólo añadir campos a los nuevos |
| **R-9** | Endurecer `CLOSED`/`isOpen` puede dejar fuera a docentes en pleno período | Desplegar con bypass administrativo y ventana de gracia |

---

## 16. DECISIONES FUNCIONALES PENDIENTES

Sólo las realmente abiertas.

| # | Decisión |
|---|---|
| D-1 | Cuánta diferencia real hay entre modalidades más allá del predicado |
| D-2 | Si la excepción se imprime en el boletín, y si el motivo es visible al acudiente |
| D-3 | Si la presentación (plantilla, colores, firmas) debe versionarse además de la publicación |
| D-4 | Qué configuraciones afectan contenido académico oficial y por tanto deben viajar en el snapshot |
| D-5 | Si "un propósito por dimensión" es regla de institución, de modalidad, o capacidad configurable |
| D-6 | Si `PURPOSE` y `EVIDENCE` deben seguir siendo excluyentes |
| D-7 | Si el propósito puede llevar nivel propio además de sus imprescindibles: capturado o derivado |
| D-8 | Alcance de `valuationScope`: institución, nivel educativo, grado o modalidad |
| D-9 | Si convivencia entra en la completitud |
| D-10 | Si la dimensión debe aparecer en el boletín junto al propósito |
| **D-11** | Si se levanta el techo de 4 niveles del enum `PerformanceLevel` |
| **D-12** | **Retiro de una evidencia ya valorada · DECISIÓN APROBADA — PENDIENTE DE IMPLEMENTACIÓN (2026-08-16).** Opción D + J.5: **baja lógica con estado de retiro explícito y prospectivo**. El id es identidad permanente. El retiro **nunca es retroactivo**: la evidencia sigue vigente, visible y contabilizada en los períodos anteriores al retiro, y deja de exigirse y de mostrarse desde el período de retiro en adelante. Reactivación prospectiva. Nuevas valoraciones prohibidas. Snapshots nunca se alteran. Borrado físico legítimo **sólo** si jamás tuvo valoraciones — la guarda de F1 permanece intacta y **`retiredAt` no la sustituye**. `isActive` queda **deprecado**: fuente de verdad única del estado de retiro. Detalle, columna definitiva y registro de migración en `docs/F2_D12_PLAN_TECNICO.md`. **Implementada; migración `20260816120000_evidence_logical_retirement` aplicada y verificada el 2026-08-16. Sin desplegar. F2 sigue ABIERTA.** |
| ~~D-13~~ | **CERRADA — NO REQUERIDA.** Las 12 huérfanas son datos de prueba; no hay información académica institucional real que reconstruir. No se implementa recuperación de ningún tipo (automática, manual, desde snapshot, por alineación o por inferencia) |
| **D-14** | Quién crea una excepción y si requiere aprobación |
| **D-15** | Si un docente puede declarar terminado con pendientes |
| **D-16** | Si la reapertura del período invalida las declaraciones docentes |
| **D-17** | Si el cierre debe poder ser por nivel educativo/grado en lugar de institución completa |

---

## ORDEN DE EJECUCIÓN PROPUESTO

```
F0  Pruebas de caracterización (5 servicios)         · 🟡 PARCIAL — F0-MÍNIMO hecho (2026-08-16)
    └─ Caracterizados: validateTermGrades · closeTerm · getCompletenessStatus · finalizeTerm
       + ampliación C-4 (2026-08-16): reSnapshotTerm · AcademicDataSourceService
       Pendientes:     buildGroupReportCards (generador completo) · getReportCardYear
                       · plantillas del frontend · RecoverySnapshotService
       Detalle: docs/F0_MINIMO_CARACTERIZACION.md    F0 NO está completa.
F1  Detener pérdida de datos (H-1) + medir           · ✅ COMPLETADA Y CERRADA (2026-08-16)
F2  Desbloquear Transición: C-1, C-2, C-4 + FK       · 🟡 ABIERTA / PENDIENTE DE CIERRE
    ├─ D-12 (retiro lógico) ✅ implementado · migración aplicada y verificada (2026-08-16)
    ├─ C-2 (completitud cualitativa) ✅ implementado (2026-08-16)
    │    docs/C2_COMPLETITUD_CUALITATIVA.md
    ├─ C-4 (contrato de publicación congelado) ✅ implementado (2026-08-16)
    │    docs/C4_CONTRATO_PUBLICACION_SNAPSHOT.md
    ├─ C-1 (cierre con grados DIMENSIONS) ✅ implementado (2026-08-16)
    │    docs/C1_CIERRE_DIMENSIONS.md · helper cualitativo compartido con C-2
    ├─ FK de StudentEvidenceValuation → AchievementEvidence ✅ aplicada (2026-08-17)
    │    RESTRICT en DELETE y UPDATE · migración 20260817120000_student_evidence_valuation_fk
    │    docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md
    ├─ Guardas de servicio de deleteAchievement ✅ implementadas (2026-08-17)
    │    · StudentAchievement (historia académica) → ConflictException
    │    · StudentEvidenceValuation (valoraciones)  → ConflictException
    │    · AttitudinalAchievement (contenido del docente) → ConflictException
    │    Las tres, antes de cualquier operación destructiva. Sólo la segunda tiene
    │    además barrera de BD (la FK RESTRICT); las otras dos siguen CASCADE en el
    │    esquema y están protegidas únicamente en la capa de servicio.
    │    docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md §4.1
    ├─ FK de alcance de StudentEvidenceValuation ✅ aplicadas (2026-08-17) — H-2 resuelto
    │    studentEnrollmentId → StudentEnrollment  CASCADE  / CASCADE
    │    academicTermId      → AcademicTerm       CASCADE  / CASCADE
    │    institutionId       → Institution        RESTRICT / CASCADE
    │    migración 20260817180000_student_evidence_valuation_scope_fks
    │    docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md §4.2
    │    ⚠ Riesgo registrado, no resuelto: academic-terms.service.ts:77 borra períodos
    │      sin guarda, y con CASCADE el borrado arrastra en silencio. Ya ocurría con
    │      las notas cuantitativas y los snapshots. Hallazgo abierto, fuera de F2.
    ├─ Pendiente para cerrar F2:
    │    · despliegue de C-1 / C-2 / C-4 (implementadas, NO desplegadas)
    ├─ D-18 (retiro lógico de Achievement) ❌ NO implementado. Trabajo futuro:
    │    requiere resolver antes el choque con
    │    @@unique([gradeId, subjectId, academicYearId, orderNumber, isPromotional]).
    │    El boletín de períodos OPEN depende del Achievement vivo; los FINALIZED
    │    tienen snapshot.
    └─ ⚠ Drift preexistente NO resuelto (8 sentencias): 2 índices presentes en
         producción que schema.prisma no declara —uno de ellos la UNIQUE
         Achievement_code_teacherAssignmentId_key, que permanece intacta— y 6
         diferencias de nombres de índice. La migración de la FK no modificó
         ninguno de esos 8 elementos. Sin decisión tomada.
F3  Gobierno: bloqueos, auditoría, metadatos         · riesgo alto  · requiere F0
F4  Motor único de completitud                       · riesgo alto  · requiere F0-F3
F5  Excepción + declaración docente + historial      · requiere diseño funcional aprobado
F6  Limpieza de configuración                        · riesgo bajo
```

**F1 se ejecutó primero y no requirió F0**, porque no toca ningún servicio compartido con el cuantitativo. Quedó **completada y cerrada el 2026-08-16** (`docs/F1_INTEGRIDAD_EVIDENCIAS.md`). El resto de las fases sigue pendiente de autorización, y **F0 es prerequisito de F2 en adelante**.
