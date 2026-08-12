# Diseño — Boletín de Transición configurable (Propósitos e Imprescindibles)

> **Estado:** spec para aprobar antes de implementar.
> **Origen:** caso I.E.D. La Esperanza del Sur (INEDES) — transición. Debe ser **configurable**: otras instituciones NO lo usan así.
> **Base reusada:** módulo [[aprendizajes-evidencias-modulo]] + [[evaluacion-preescolar-configurable]]. Estructura académica `DIMENSIONS` (cualitativo).

---

## 1. Mapeo conceptual (confirmado con el usuario)

| En la foto | Qué es | Pieza en Edusyn |
|---|---|---|
| **Dimensión** (Socioafectiva, Comunicativa, Cognitiva, Corporal) | La asignatura de transición, con I.H. y valoración | `Subject` (marcado como dimensión) + `TeacherAssignment.weeklyHours` |
| **Propósito** (texto en negrita) | El aprendizaje/desempeño de esa dimensión (1 por dimensión) | **Aprendizaje** = `Achievement.baseDescription` |
| **Imprescindibles** (viñetas) | Los sub-ítems del propósito | **Evidencias** = `AchievementEvidence` |
| **L / EP / I** | Valoración cualitativa (por propósito/dimensión) | `StudentAchievement.performanceLevel` + escala de `academicLevelsConfig` |
| **I.hs** | Intensidad horaria de la dimensión (Convivencia → 0) | `TeacherAssignment.weeklyHours` (+ regla de "0") |
| **Inas** | Inasistencias del estudiante (total) | asistencia (con opción de mostrar 0 o en blanco) |
| **Convivencia** | Dimensión especial editable por el docente | `Subject` especial + flags |

**Regla de oro:** el boletín de transición NO muestra "dimensión/área/asignatura"; muestra **Propósito** (negrita) e **Imprescindibles** (viñetas). Los nombres "Propósito/Imprescindible" son **etiquetas configurables**.

---

## 2. Decisiones confirmadas

1. Propósito = Aprendizaje; Imprescindible = Evidencia. Etiquetas configurables por institución.
2. **Admin precarga** los propósitos+imprescindibles (fijos por período, **compartidos por el grado** de transición); el **docente solo marca el nivel** (L/EP/I), no puede agregar/editar.
3. **Convivencia** es la excepción: el docente **sí la escribe** (no viene precargada). Nombre configurable (default "Convivencia"). I.H. mostrada **0**.
4. Valoración **por Propósito** (una por propósito/dimensión).
5. **Sin promedio** (no es cuantitativo). **Puesto**: opcional/configurable, calculado por el sistema a partir de la valoración cualitativa.
6. **Inas**: lee asistencia del estudiante; si es 0, configurable mostrar "0" o dejar en blanco.

---

## 3. Configuración institucional (nueva)

**En `AchievementConfig`** (comportamiento del módulo):
- `learningLabelSingular` / `learningLabelPlural` — default "Aprendizaje/Aprendizajes". INEDES: "Propósito/Propósitos".
- `evidenceLabelSingular` / `evidenceLabelPlural` — default "Evidencia/Evidencias". INEDES: "Imprescindible/Imprescindibles".
- `learningCatalogMode`: `TEACHER_MANAGED` (default, actual) | `ADMIN_FIXED` (admin precarga; docente solo valora).

**En `ReportCardConfig`** (boletín):
- `preschoolShowRank` (bool) — mostrar Puesto en preescolar.
- `preschoolRankMode` — cómo calcular el puesto desde la valoración cualitativa (ver §6).
- `showZeroAbsences` (bool) — en la columna Inas: mostrar "0" o dejar en blanco.

**Selección de plantilla:** vía `ReportCardTemplateSelection` (ya existe), apuntando el grado/estructura de transición al nuevo formato (§5).

Todas con default que preserva el comportamiento actual (aditivo).

---

## 4. Modelo de datos (reuso + adiciones mínimas)

**Se reusa:** `Achievement` (=Propósito), `AchievementEvidence` (=Imprescindibles), `StudentAchievement` (=valoración cualitativa), `Subject`/`TeacherAssignment` (dimensiones + I.H.).

**Adiciones (aditivas):**
- `Subject.isImplicitHours Boolean @default(false)` — si true, el boletín muestra I.H. **0** aunque tenga horas asignadas (para Convivencia). *(Alternativa: `Subject.displayHours Int?` para forzar un valor mostrado; a decidir.)*
- `Achievement.isTeacherEditable Boolean @default(false)` — en modo `ADMIN_FIXED`, permite que el docente edite/escriba ESTE propósito (Convivencia) aunque los demás estén bloqueados.
- (Opcional) marca de dimensión en `Subject` si aún no existe (`dimensionCode`), para sembrar/mostrar dimensiones — ya contemplado en [[evaluacion-preescolar-configurable]].

**Precarga por grado (admin):** el admin define los 4 propósitos+imprescindibles y se aplican a **todos los grupos** de transición. Implementación propuesta: reusar el flujo de "duplicar a grupos" ya existente (crea el `Achievement` en cada `TeacherAssignment` de la dimensión). En `ADMIN_FIXED` el docente los ve **solo lectura** y únicamente marca el nivel.

---

## 5. Nuevo formato de boletín: `transicion-propositos`

Nuevo template en el catálogo (seleccionable, institución-agnóstico), estructura como la foto (el diseño lo mejoramos):

```
[Encabezado institucional]  ·  INFORME ACADÉMICO PERÍODO: <n>
Nombre: ____   N°mat: ____   Puesto: __ (si preschoolShowRank)
Curso: Transición B   Fecha de entrega: __   Año: ____

┌─────┬──────────────────────────────────────────────┬── escala ──┬──────┐
│ I.hs│ PROPÓSITO (Descripción Valorativa)/IMPRESCIND. │ L │ EP │ I │ Inas │
├─────┼──────────────────────────────────────────────┼───┼────┼───┼──────┤
│  5  │ **<propósito socioafectiva>**                  │ ✔ │    │   │  2   │
│     │  • <imprescindible> • <imprescindible> …       │   │    │   │      │
│  0  │ **Convivencia** <texto del docente>            │   │ ✔  │   │      │
└─────┴──────────────────────────────────────────────┴───┴────┴───┴──────┘
Interpretación de la escala: L = Logrado, EP = En Proceso, I = Iniciando  (de config)
Observaciones: ________________________________________________
                         [Firma] Director de Grupo
```

- Columnas de escala (L/EP/I…) **dinámicas** desde `academicLevelsConfig` (no hardcodeadas).
- I.hs por dimensión; Convivencia muestra 0 (por `isImplicitHours`).
- Sin promedio; Puesto solo si `preschoolShowRank`.
- Reusa el pipeline de datos (`learningBlocks` ya trae aprendizaje + evidencias + nivel).

---

## 6. Puesto por valoración cualitativa (propuesta)

Sin nota numérica, el puesto se calcula ponderando la escala por su orden en `academicLevelsConfig`:
- Ej. escala L/EP/I → L=3, EP=2, I=1 (según orden/`isApproved`).
- Puntaje del estudiante = promedio (o suma) de los pesos de sus propósitos valorados.
- Se ordena descendente; **empates comparten puesto**.
- Configurable on/off (`preschoolShowRank`). *(Regla exacta a confirmar.)*

---

## 7. Plan por fases (incremental, compatible)

- **Fase A — Config + etiquetas + modo fijo:** labels configurables, `learningCatalogMode=ADMIN_FIXED`, UI docente en solo-lectura (solo marca nivel). Precarga por grado (reusa duplicar).
- **Fase B — Convivencia:** `Subject.isImplicitHours` + `Achievement.isTeacherEditable`; Convivencia editable y con I.H. 0.
- **Fase C — Boletín transición:** template `transicion-propositos` + `preschoolShowRank` + puesto cualitativo + `showZeroAbsences`. Vista previa con datos de ejemplo (ya existe la infraestructura).

Cada fase desplegable y reversible.

---

## 8. Decisiones finales (cerradas — implementación directa)

Reemplazan cualquier ambigüedad previa del doc:

1. **Dimensiones ya existen como `Subject`** (Socioafectiva/Comunicativa/Cognitiva/Corporal) dentro del área Preescolar. NO se reemplazan. Se agrega clasificación `SubjectType.PRESCHOOL_DIMENSION` para que se comporten especial en evaluación/boletín, sin crear estructura paralela.
2. **I.H.: `weeklyHours` (real, en `TeacherAssignment`) vs `displayHours` (mostrada en boletín).** Se agrega `Subject.displayHours Int?`. `null` ⇒ usar horas reales. Convivencia ⇒ `displayHours = 0`. NO se usa `isImplicitHours`.
3. **Convivencia:** `Subject` especial (`SubjectType.CONVIVENCIA`), nombre configurable (default "Convivencia"), `displayHours = 0`, sin propósitos/evidencias precargados, sin obligar L/EP/I. Texto libre por estudiante+período en **nueva entidad mínima `ConvivenciaEntry`** (no se fuerza a `Achievement`).
4. **Propósito = Achievement; Imprescindibles = AchievementEvidence; valoración = StudentAchievement** (reuso, sin módulo paralelo).
5. **Propósitos compartidos por GRADO + anuales (INEDES):** `Achievement` se extiende para poder ser **grade-scoped** (`gradeId`, `subjectId`, `academicYearId`, `teacherAssignmentId` nullable) y **anual** (`academicTermId` nullable = todos los períodos). La **valoración** (`StudentAchievement`) gana `academicTermId` para ser por período. Flexible: otras instituciones pueden seguir usando propósitos por asignación/período.
6. **Modo de edición:** `AchievementConfig.learningCatalogMode` = `TEACHER_MANAGED` (default, actual) | `ADMIN_FIXED` (INEDES). En `ADMIN_FIXED` el docente no edita propósitos/evidencias; solo valora (+ escribe Convivencia).
7. **Etiquetas configurables** en `AchievementConfig`: `learningLabelSingular/Plural`, `evidenceLabelSingular/Plural`. INEDES: Propósito(s)/Imprescindible(s).
8. **Escala dinámica** desde `academicLevelsConfig` (N columnas). Nunca `if level === "L"`.
9. **Puesto:** `ReportCardConfig.preschoolShowRank` (default **false**). Pesos por nivel **configurables** (`ReportCardConfig.preschoolRankWeights` Json, keyed por código de nivel). Empates comparten puesto (1,2,2,4). Sin valoración/incompletos/retirados: excluidos del ranking. Si está off, no se calcula.
10. **Inasistencias** del **período** evaluado (módulo de asistencia existente). `ReportCardConfig.showZeroAbsences` (default false): 0 ⇒ vacío; on ⇒ "0". >0 siempre se muestra.
11. **Plantilla:** identificador **`transicion-propositos`** (con "t", no "proposicos").
12. **Compatibilidad:** todo aditivo; se activa por config/plantilla/tipo. Instituciones que no lo usan no cambian.
