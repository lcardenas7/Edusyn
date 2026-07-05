# DISEÑO DE CÓDIGO — MODELO CUALITATIVO (1.5) + FIX A-11 (2)

> **Naturaleza:** Diseño técnico (ETAPA 2). NO es implementación — es la especificación a aprobar antes de tocar código (ETAPA 3).
> **Subordinado a:** `CONSTITUCION_MODULO_NOTAS.md` + `CONSTITUCION_NOTAS_ANEXO_CUALITATIVO.md`.
> **Contexto:** Bloques A–D ya implementados. `PeriodFinalGrade` es el valor canónico (respeta `isManualOverride` C-1 + recuperación).
> **Principio de diseño:** **CONSOLIDAR, no agregar.** No crear un 4.º mecanismo cualitativo; unificar los que existen.

---

# PARTE I — MODELO CUALITATIVO (diseño de código)

## I.0 Estado actual del código (base del diseño)

**Fragmentación de la "nota cualitativa" (3 mecanismos, todos derivados del número):**
- `SubjectPerformance` (texto base por saber COG/PROC/ACT) → `PerformanceGenerator` calcula nivel **desde la nota** vía `PerformanceScale`. **Lee `StudentGrade` legacy (Q-1).**
- `StudentAchievement.performanceLevel` — "calculado desde la nota"; con `suggestedText`/`approvedText` + `suggestedJudgment`/`approvedJudgment` (patrón docente-aprueba).
- Report engine (`generateQualitativeReport`) → `qualitativeLevel`/`qualitativeObservation` tomados del **logro** (`reports.service:2817-2828`).

**Fragmentación de la "escala de niveles" (4 representaciones):**
- `academicLevelsConfig` (JSON en institución; por nivel: `gradingScaleType` NUMERIC/QUALITATIVE, `performanceLevels[]`, `qualitativeLevels[]`).
- Tabla `PerformanceScale` (institución → `level` enum + `minScore`/`maxScore`).
- Enum `PerformanceLevel` (SUPERIOR/ALTO/BASICO/BAJO).
- `qualitativeLevels[]` derivado en `InstitutionRulesContext`.

**Colisión de terminología:** modelo `Dimension` (desarrollo, preescolar) vs enum `PerformanceDimension` (saberes COG/PROC/ACT).

**Patrones buenos a conservar/extender:** `EnrollmentDimension` (snapshot inmutable = config temporal), `PerformanceManualEdit` (override auditado de texto), `StudentAchievement.suggested/approved`.

## I.1 Estrategia: 4 fases incrementales (cada una desplegable sola)

```
Q-0  Arreglar Q-1        (sin migración)  ← desbloquea desempeños con la planilla moderna
Q-1  Escala unificada     (migración)     ← una sola fuente de verdad de "niveles"
Q-2  Valoración directa   (migración)     ← la capa de evidencia cualitativa que falta
Q-3  Narrativa + IA       (código)        ← learning stories, borrador IA, override auditado
```

---

## Q-0 · Arreglar Q-1 (sin migración) — PRIORITARIO

**Problema:** `performance-generator.service.ts:134` lee `studentGrade.findMany` (legacy). Si el docente usa la planilla moderna (`PartialGrade`), el generador ve 0 notas → todos "BAJO".

**Diseño:** que `PerformanceGenerator` obtenga los scores por dimensión desde la **misma fuente canónica que el resto** — `PartialGrade` agrupado por `componentType`, con *fallback* a `StudentGrade` (igual que `student-grades.calculateTermGrade:159-204` ya hace).

Cambio concreto en `calculateDimensionScores` / `generateStudentPerformances`:
```
// ANTES: this.prisma.studentGrade.findMany({ ... evaluativeActivity.component ... })
// DESPUÉS (mismo patrón que calculateTermGrade):
const partials = await this.prisma.partialGrade.findMany({
  where: { studentEnrollmentId, teacherAssignmentId: ta.id, academicTermId },
});
// map componentType → COGNITIVO/PROCEDIMENTAL/ACTITUDINAL (misma heurística COG/PROC/ACT/SABER/HACER/SER)
// fallback a StudentGrade solo si partials.length === 0
```
- **Sin migración**, sin cambio de esquema, sin tocar el boletín.
- **Reutiliza** la heurística de mapeo `componentCode → dimensión` que ya existe (líneas 212-221).
- **Compatibilidad:** instituciones legacy que aún usan `StudentGrade` siguen por el *fallback*.

**Pruebas Q-0:** docente digita en planilla (PartialGrade) → desempeños muestran el nivel correcto (no "BAJO"). Institución legacy con StudentGrade → sin cambios.

---

## Q-1 · Escala de valoración unificada (migración)

**Problema:** 4 representaciones de "niveles" que pueden divergir.

**Diseño — consolidar en `PerformanceScale` como fuente única, enriquecida:**

Extender `PerformanceScale` (no crear tabla nueva) para que sea una **escala de proficiencia completa**:
```
model PerformanceScale {
  id, institutionId, level (PerformanceLevel)   // se conserva
  minScore, maxScore                             // se conserva (rango numérico → nivel)
  // NUEVOS (nullable, backfill):
  label        String?   // nombre visible ("Superior", "En proceso")
  descriptor   String?   @db.Text  // descriptor pedagógico del nivel (IB/SBG)
  order        Int?      // orden canónico
  isApproved   Boolean?  // ¿este nivel aprueba?
  isQualitativeOnly Boolean @default(false) // nivel sin rango numérico (cualitativo puro)
  @@unique([institutionId, level])
}
```

- **`qualitativeLevels[]`** del `academicLevelsConfig` y del rules context pasan a **derivarse de `PerformanceScale`** (con `isQualitativeOnly=true` para niveles sin rango). Se elimina la duplicación.
- **Migración:** backfill de `label`/`order`/`isApproved` desde el enum y desde `academicLevelsConfig` existente; `descriptor` opcional (vacío hasta que la institución lo llene).
- **Compatibilidad:** los nuevos campos son nullable → el código actual sigue funcionando; los consumidores nuevos usan `label`/`descriptor`/`order` si están.
- El **motor** (`academic-rules.engine.getPerformanceLevel`) ya resuelve nivel desde rangos; solo se le alimenta la escala enriquecida.

**Riesgo/decisión:** NO eliminamos el enum `PerformanceLevel` (lo usan muchas relaciones, p.ej. `StudentAchievement.performanceLevel`). La escala unificada **envuelve** el enum, no lo reemplaza — evita una migración masiva y de alto riesgo. `PerformanceScale` se vuelve el diccionario de presentación/semántica del enum.

**Pruebas Q-1:** boletín y desempeños muestran `label`/`descriptor` de la escala; institución sin descriptores → cae al label del enum (sin romper).

---

## Q-2 · Valoración cualitativa directa (migración) — la evidencia que falta

**Problema:** no existe entrada cualitativa **directa** (todo se deriva del número). Para preescolar real y para evaluación por competencias, el docente debe poder **asignar un nivel + narrativa por estudiante** sin pasar por una nota.

**Diseño — nuevo modelo de EVIDENCIA (Capa 1 de la Constitución):**
```
model QualitativeValuation {
  id, institutionId
  studentEnrollmentId
  teacherAssignmentId          // docente responsable (RN-10)
  academicTermId
  // Objeto valorado: dimensión de desarrollo O competencia/indicador
  dimensionId   String?        // FK Dimension (preescolar) — nullable
  subjectId     String?        // para cursos por competencias — nullable
  // La valoración:
  level         PerformanceLevel   // nivel desde la escala unificada (Q-1)
  narrative     String? @db.Text   // learning story / observación (basada en fortalezas)
  // Auditoría de override (patrón PerformanceManualEdit generalizado):
  source        String   // 'DIRECT' | 'AI_DRAFT_APPROVED' | 'DERIVED_FROM_GRADE'
  enteredById   String
  updatedById   String?
  createdAt, updatedAt
  @@unique([studentEnrollmentId, teacherAssignmentId, academicTermId, dimensionId, subjectId])
}
```
- Es **evidencia canónica** por `(estudiante, dimensión|competencia, período)` → cumple INV-Q5 (una valoración canónica).
- **Distingue "sin valorar" (no hay fila) de "nivel más bajo"** → INV-Q1.
- El **boletín cualitativo** (`generateQualitativeReport`) pasa a leer `QualitativeValuation` como fuente, con *fallback* al mecanismo actual (logros/derivado) para no romper instituciones que aún no lo usan.
- **Preescolar (DIMENSIONS):** `dimensionId` presente, `subjectId` null. El nivel se asigna directo (no desde número).
- **Cursos numéricos:** siguen derivando el nivel del número; opcionalmente el docente puede fijar `QualitativeValuation` como override auditado.

**Migración:** crear tabla nueva (aditiva, sin tocar datos existentes). Sin backfill obligatorio.

**Planilla cualitativa (frontend + endpoints):** vista por grupo/período donde el docente asigna nivel + narrativa por estudiante y dimensión/competencia. Reutiliza el patrón de guardado por diferencias + token optimista del **Bloque D** (concurrencia ya resuelta).

**Pruebas Q-2:** preescolar valora sin número → boletín cualitativo correcto; "sin valorar" ≠ "BAJO"; concurrencia (dos docentes) sin pisarse.

---

## Q-3 · Narrativa + IA + fortalezas (código, sin migración nueva)

- **Borrador de narrativa por IA** (orquestador existente) a partir de evidencia real (logros, asistencia, desempeño, observador) → el docente **aprueba/edita** → se guarda en `QualitativeValuation.narrative` con `source='AI_DRAFT_APPROVED'` (nunca como hecho sin autoría; INV-Q3).
- **Sugerencia de nivel** por IA → el docente confirma (nunca decide sola).
- Reutiliza el patrón `StudentAchievement.suggested/approved`.

**Pruebas Q-3:** IA genera borrador; edición del docente queda auditada; nada se publica sin aprobación.

## I.2 Resumen de impacto Parte I
| Fase | Migración | Rompe algo | Desbloquea |
|---|---|---|---|
| Q-0 | No | No (fallback legacy) | Desempeños con planilla moderna |
| Q-1 | Sí (aditiva, nullable) | No | Escala/ descriptores unificados |
| Q-2 | Sí (tabla nueva) | No (fallback) | Valoración cualitativa directa |
| Q-3 | No | No | Narrativa IA + fortalezas |

---

# PARTE II — FIX A-11 (diseño de código concreto)

## II.1 Objetivo
Que la **promoción** lea el valor canónico (`PeriodFinalGrade`), igual que el boletín. Cumplir INV-10.

## II.2 Punto único de cambio
`StudentGradesService.calculateAnnualGrade` (`student-grades.service.ts:288`). Hoy sus `termSources` llaman `calculateTermGrade` (recompute, ignora override/recuperación). El comentario de la línea 285 ya dice *"Fuentes = períodos (PeriodFinalGrade)"* — el código se alinea a su intención.

## II.3 Diseño concreto
Nuevo helper privado + cambio en `termSources`:
```
private async resolveCanonicalPeriodGrade(
  studentEnrollmentId: string,
  teacherAssignmentId: string,
  subjectId: string,
  academicTermId: string,
): Promise<number | null> {
  // 1) Canónico: PeriodFinalGrade (respeta isManualOverride C-1 + recuperación)
  const pfg = await this.prisma.periodFinalGrade.findUnique({
    where: { studentEnrollmentId_academicTermId_subjectId: {
      studentEnrollmentId, academicTermId, subjectId } },
    select: { finalScore: true },
  });
  if (pfg) return Number(pfg.finalScore);
  // 2) Fallback: recompute (mismo comportamiento que hoy si no hay PFG)
  const recomputed = await this.calculateTermGrade(
    studentEnrollmentId, teacherAssignmentId, academicTermId);
  return recomputed.grade;
}
```
Y en `calculateAnnualGrade`, resolver `subjectId` desde la asignación (1 consulta) y usar el helper en `termSources`:
```
const { subjectId } = await this.prisma.teacherAssignment.findUnique({
  where: { id: teacherAssignmentId }, select: { subjectId: true } });
// termSources[*].grade = await resolveCanonicalPeriodGrade(enrollment, ta, subjectId, term.id)
```
`componentSources` (FinalComponentGrade) y la ponderación quedan **idénticos**.

## II.4 Radio de impacto (todos se vuelven canónicos — deseable)
`calculateAnnualGrade` alimenta: cierre de año (`computePromotions`), previsualización (`previewPromotions`), cambio de grado (`grade-change:340`), endpoint de nota anual. Un cambio → los cuatro consistentes con boletín/MEN. Preview y cierre siguen idénticos entre sí.

## II.5 Casos límite
| Caso | Comportamiento |
|---|---|
| Sin `PeriodFinalGrade` | fallback recompute (igual que hoy) |
| Override manual / recuperación | lee `PeriodFinalGrade` → correcto ✅ |
| Preescolar (DIMENSIONS) | `evaluatePromotion` auto-promueve; valor indiferente |
| FinalComponentGrade | sin cambio |
| Sin notas | `annualGrade=null`, materia perdida (igual que hoy) |

## II.6 Compatibilidad / migración / riesgos
- **Migración:** ninguna.
- **Regresión:** el valor solo cambia donde `PeriodFinalGrade` ≠ recompute → override/recuperación, donde el nuevo valor es el correcto. Caso normal: sin cambio.
- **Riesgo residual:** `PeriodFinalGrade` desactualizado → mismo valor que ya muestra el boletín (consistencia garantizada). Recomendado: prueba de reconciliación (comparar PFG vs recompute en un año real, reportar divergencias no esperadas).
- **Perf:** +1 consulta por período (ya en `Promise.all`); optimización a Bloque E/H.

## II.7 Pruebas
- Unit: `resolveCanonicalPeriodGrade` (PFG existe → PFG; no existe → recompute).
- Unit: `calculateAnnualGrade` con recuperación → nota recuperada; con override → override.
- **Integración crítica:** reprueba parciales + aprueba recuperación → `computePromotions` = **PROMOVIDO**.
- INV-10 cross-check: nota de promoción == nota del boletín (`buildGroupReportCards`).
- Consistencia: `previewPromotions` == `computePromotions`.
- Regresión: dataset normal → resultados idénticos a antes.

## II.8 Qué NO toca
Boletines, `calculateTermGrade`, `calculateTermGradeAtDate` (cortes preventivos), esquema, recuperación, componentes finales.

---

# ORDEN DE IMPLEMENTACIÓN PROPUESTO
1. **A-11** (Parte II) — pequeño, sin migración, cierra un riesgo activo en promoción. **Primero por criticidad.**
2. **Q-0** — pequeño, sin migración, desbloquea desempeños.
3. **Q-1 → Q-2 → Q-3** — cada uno con su aprobación (migraciones aditivas).

> Nota: aunque el usuario pidió diseñar "1.5 → luego 2", para **implementar** conviene A-11 primero (riesgo activo, cero migración). El diseño de ambos queda listo; el orden de ejecución se decide en la aprobación.
