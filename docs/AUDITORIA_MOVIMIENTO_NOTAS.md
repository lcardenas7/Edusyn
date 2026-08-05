# Manejo de notas y datos al mover un estudiante (curso / grado)

> Análisis para decidir cómo tratar notas, asistencia, boletines y el *snapshot*
> académico cuando se mueve una matrícula — **antes del snapshot** (datos crudos),
> **el snapshot** mismo, y **después** (boletines / promoción). No es implementación:
> es el mapa + la recomendación + las decisiones de política pendientes.

## 1. Qué cuelga de la matrícula y cómo se calcula la nota

El cálculo de nota **NO usa el snapshot**: opera sobre `teacherAssignmentId` (la
asignación docente del **grupo actual**). El *snapshot* (`EnrollmentArea` /
`EnrollmentSubject`) define **qué áreas/asignaturas existen, sus pesos, reglas de
aprobación y el docente** — y lo consumen los **boletines y el promedio ponderado**.

| Dato | Llave real | ¿A qué se ata? |
|---|---|---|
| `PartialGrade` (parciales/componentes) | `enrollment + teacherAssignmentId + term` | grupo (TA) |
| `StudentGrade` (nota de actividad) | `enrollment + evaluativeActivityId` | actividad → TA (grupo) |
| `FinalComponentGrade` | `enrollment + teacherAssignmentId + component` | grupo (TA) |
| `AttendanceRecord` | `enrollment + teacherAssignmentId` | grupo (TA) |
| `TutoringAttendance` | `enrollment + groupId` | grupo |
| `PeriodFinalGrade` (nota final de período) | `enrollment + term + **subjectId**` | **asignatura** (no TA) |
| `EnrollmentArea/Subject` (**snapshot**) | `enrollment` | foto de la estructura |
| `TermReportCardSnapshot` (boletín congelado) | `enrollment + term` | boletín del período |

**Consecuencia clave:** al cambiar de grupo, las notas por actividad/parcial quedan
"colgadas" del docente/actividades del grupo viejo. `PeriodFinalGrade` se ata a
`subjectId`, así que **sobrevive sola si la asignatura es la misma** (mismo grado),
pero es **inválida si cambia el grado** (otra malla, otras asignaturas).

## 2. Los tres escenarios (son distintos y hoy se tratan igual)

- **A — Mismo grado, otro grupo (curso):** misma malla. Las notas **deben seguir** al
  estudiante, re-apuntadas al TA del nuevo grupo por asignatura. Snapshot se regenera
  (puede cambiar el docente).
- **B — Cambio de grado académico (promoción/rebaja):** malla distinta. Las notas del
  grado anterior son **histórico de ese grado**; el nuevo grado arranca limpio. Snapshot
  se regenera a la nueva malla. No se migran notas.
- **C — Corrección administrativa (cambio de grado por error de matrícula):** el
  estudiante estaba en el grado equivocado. Las notas del grado equivocado **no aplican**
  a la malla correcta. Snapshot se regenera; qué pasa con las notas viejas → **decisión de
  política** (§5).

## 3. Estado actual (los defectos)

1. **La UI de "Cambiar Grupo/Grado" usa `GradeChangeService.changeGrade`**, que hace un
   `update({ groupId })` **seco**: **no regenera el snapshot** y **no migra ni asistencia
   ni notas**. Es el peor de los caminos y aplica a **todos** los movimientos de la UI.
2. **`EnrollmentService.changeGroup`** (el endpoint `/enrollments/:id/change-group`, que la
   UI de mover **no** llama) sí regenera snapshot y migra parciales/asistencia, pero tiene
   huecos:
   - `StudentGrade` **no** se re-apunta (queda en las actividades del TA viejo → el
     gradebook del nuevo docente no las ve, y el cálculo anual del nuevo TA **no las suma**).
   - `FinalComponentGrade` **no** se migra.
   - `TermReportCardSnapshot` (boletines ya generados) queda **viejo**.
3. **Snapshot desactualizado = síntoma más grave hoy:** tras cualquier movimiento por la
   UI, la "foto" de áreas/asignaturas/pesos/docente sigue siendo la del grupo anterior →
   boletines, promedios y promoción usan la estructura equivocada.

## 4. Manejo recomendado por escenario

Marco: **(a) datos crudos** (parciales/actividades/asistencia/componentes) · **(b) el
snapshot** · **(c) derivados** (PeriodFinalGrade, boletines, promoción).

### A — Mismo grado (curso)
- **(a)** Re-apuntar al TA del nuevo grupo por `subjectId`: `PartialGrade`,
  `AttendanceRecord`, `FinalComponentGrade`, `TutoringAttendance`. `StudentGrade`: ver §5
  (las actividades no son las mismas entre docentes → decisión).
- **(b)** Regenerar snapshot (nuevo docente/estructura efectiva del grupo).
- **(c)** `PeriodFinalGrade` sobrevive (misma `subjectId`). Invalidar/regenerar el
  `TermReportCardSnapshot` del período afectado. Recalcular promedios.

### B — Cambio de grado académico (promoción/rebaja)
- **(a)** **No migrar.** Las notas del grado anterior quedan como histórico atadas a los TA
  del grado viejo (siguen consultables por año/grado).
- **(b)** Regenerar snapshot a la malla del nuevo grado.
- **(c)** El nuevo grado arranca sin `PeriodFinalGrade` (las viejas eran de otras
  asignaturas). Boletín del nuevo grado se genera desde cero.

### C — Corrección administrativa (grado equivocado)
- **(b)** Regenerar snapshot **siempre** (es lo mínimo para que el estudiante quede
  coherente en el grado correcto).
- **(a)/(c)** Igual que B (no migrar; malla distinta), **pero** las notas del grado
  equivocado fueron capturadas por error → **decisión de política** (§5): conservarlas como
  histórico marcado, archivarlas, o eliminarlas. En todos los casos, el movimiento ya queda
  auditado (`EnrollmentEvent` con `movementType=ADMINISTRATIVE` + motivo + usuario).

## 5. Decisiones de política (necesito tu criterio)

1. **Notas del grado equivocado en una corrección administrativa (C):**
   - (i) **Conservar** como histórico (no se muestran en el grado nuevo, quedan en el año).
   - (ii) **Archivar/ocultar** (marca "anuladas por corrección", visibles solo en auditoría).
   - (iii) **Eliminar** (borrado duro — no recomendado; rompe trazabilidad).
2. **`StudentGrade` (notas por actividad) en cambio de curso (A):** las actividades del
   docente destino **no son las mismas**. ¿Migrar solo consolidados (`PartialGrade` /
   `PeriodFinalGrade`) y dejar las notas por actividad como histórico del grupo origen, o
   intentar mapear actividad↔actividad (complejo y frágil)?
3. **Boletines ya generados (`TermReportCardSnapshot`) del período en curso:** ¿regenerarlos
   automáticamente tras el movimiento, o marcarlos "requiere re-emisión"?

## 6. Plan de implementación propuesto (por fases, incremental)

- **Fase 1 — Crítico, bajo riesgo (regenerar snapshot siempre).** Inyectar
  `EnrollmentService` en `GradeChangeService` (no hay dependencia circular: `EnrollmentService`
  solo depende de Prisma/TemplatesService/YearLifecycle) y llamar
  `regenerateAcademicSnapshot(enrollmentId)` tras el cambio de grupo/grado. Esto **por sí solo
  corrige el síntoma más grave** (estructura/boletín/promedio con la malla equivocada).
- **Fase 2 — Mismo grado: migración completa.** Reusar/mejorar `migrateGradesToNewGroup`:
  re-apuntar también `FinalComponentGrade`; resolver `StudentGrade` según §5.2; disparar
  recálculo de `PeriodFinalGrade`/boletín del período.
- **Fase 3 — Cambio de grado: política de histórico.** Implementar la decisión de §5.1
  (marcar/archivar notas del grado anterior) y regeneración del boletín del nuevo grado.
- **Fase 4 — Consolidar un solo camino.** Que la UI de mover use **un** servicio con
  ramificación interna (mismo grado ⇒ migrar; cambio de grado ⇒ histórico), siempre con
  snapshot regenerado y evento de auditoría. Retirar la duplicación
  `changeGrade` vs `changeGroup`.

## 6-bis. Aula Virtual: qué ve el estudiante al moverse (revisado)

**Buena noticia: el Aula Virtual ya se comporta bien, sin construir nada.**

- Un `Classroom` cuelga de `teacherAssignmentId` (docente + asignatura + **grupo**).
- `ClassroomService.listForStudent` resuelve las clases del estudiante **dinámicamente**
  desde `enrollment.groupId` (no hay tabla de membresía estática).
- Mover **no crea una matrícula nueva**: actualiza el `groupId` de la misma matrícula.

⇒ Al mover de **grado o de curso**, el estudiante ve **automáticamente** las clases y
actividades del nuevo grupo, todas **"sin realizar"** (no tiene entregas allí). Es
exactamente el comportamiento deseado.

- Sus entregas/lecciones viejas (`ActivitySubmission`, `LessonProgress`, atadas a
  `studentEnrollmentId` + actividades del grupo viejo) **quedan como histórico** bajo la
  misma matrícula; no aparecen en el grupo nuevo (son de otro `Classroom`). No estorban.
- Único matiz: `ActivityAssignment` (actividades restringidas a estudiantes) referencia
  `studentEnrollmentId`; como la actividad pertenece al aula del grupo viejo, tampoco se
  muestra en el nuevo. Sin acción requerida.

## 6-ter. Decisiones tomadas y enfoque simplificado (el que seguimos)

Filosofía acordada: **no auto-migrar notas; empezar limpio en el destino; para notas,
generar un REPORTE y que un humano (admin/docente) coloque la nota manualmente con su acta
u observación.**

| Tema | Decisión |
|---|---|
| Notas del grado equivocado (corrección administrativa) | **Conservar como histórico** (no se muestran en el grado nuevo; quedan en el año/grado anterior). |
| `StudentGrade` por actividad (cambio de curso) | **Solo consolidados** siguen; las notas por actividad quedan como histórico del grupo origen. |
| Migración automática de notas | **No.** Se genera un **reporte** y el admin/docente entra la nota manualmente en el grado correspondiente, respaldada por **acta u observación**. |
| Aula Virtual | **Automático** (dinámico por grupo). El estudiante ve el nuevo grado/curso "sin realizar". |
| Snapshot académico | **Regenerar siempre** al mover (única corrección de código imprescindible). |

**Respuesta directa a "¿y si cambia de grado y las asignaturas no son las mismas?":**
1. El Aula Virtual le muestra las asignaturas del **nuevo grado**, todas pendientes
   (automático).
2. Se **regenera el snapshot** a la malla del nuevo grado (áreas/asignaturas/pesos/reglas
   correctas). ← esto es lo que hoy falta y hay que arreglar.
3. Las notas del grado anterior **no se copian** (son otras asignaturas): quedan como
   histórico consultable.
4. Se genera un **reporte de traslado** que muestra: notas/estado del grado anterior
   (histórico) y las asignaturas del nuevo grado a diligenciar. El docente/admin **coloca
   manualmente** las notas que correspondan en el grado correcto, con su **acta**
   (promoción/rebaja) u **observación** (el motivo ya queda en el `EnrollmentEvent`).

## 7. Plan de implementación (simplificado, según lo acordado)

- **Fase 1 — Regenerar snapshot SIEMPRE (crítico, bajo riesgo).** Inyectar
  `EnrollmentService` en `GradeChangeService` y llamar `regenerateAcademicSnapshot(enrollmentId)`
  dentro de la misma transacción del cambio de grupo/grado. Corrige el síntoma más grave
  (estructura/boletín/promedio con la malla equivocada). Sin migración de notas.
- **Fase 2 — Reporte de traslado.** Un reporte (por matrícula/movimiento) que liste: grado y
  grupo anterior con su estado de notas (histórico), grado/grupo nuevo con sus asignaturas
  pendientes, y el `EnrollmentEvent` (motivo, acta/observación, usuario, fecha). Sirve como
  guía para la entrada manual. (No mueve datos; solo informa.)
- **Fase 3 (opcional) — Conveniencia mismo grado.** Solo si se pide: re-apuntar consolidados
  (`PartialGrade`) al nuevo grupo para no rehacerlos, dejando `StudentGrade` por actividad
  como histórico. `PeriodFinalGrade` ya sobrevive (llave por `subjectId`).

Nota: se descarta la migración automática compleja de notas por actividad y el mapeo
actividad↔actividad (frágil). La entrada manual con acta/observación da control y trazabilidad.

## 8. Riesgos

- Regenerar snapshot borra y recrea `EnrollmentArea` (ya lo hace `regenerateAcademicSnapshot`
  con `deleteMany` + recrear). Es idempotente; el riesgo es hacerlo dentro de una transacción
  junto al cambio de grupo para no dejar estados a medias.
- La migración de notas debe ser **transaccional** (todo o nada) para no dejar notas
  parcialmente re-apuntadas si algo falla.
- Cambiar de grado a mitad de período con boletines ya emitidos exige la decisión de §5.3
  para no mostrar promedios incoherentes.
