# AUDITORÍA FUNCIONAL DEL NÚCLEO ACADÉMICO DE EDUSYN

> **Tipo de documento:** Certificación funcional / Fuente de verdad del núcleo académico
> **Alcance:** Configuración institucional, calificaciones, porcentajes, logros, recuperaciones, asistencia, observador, matrículas, promoción, boletines, cierre académico.
> **Método:** Auditoría anclada en el código real (`apps/api/src`, `schema.prisma` de 6.269 líneas, ~200 modelos), no en supuestos.
> **Roles del auditor:** Principal PM (SIS/LMS) · Software Architect · QA Lead · Analista Funcional · Director Académico LATAM · Auditor de Calidad.
> **Fecha:** 2026-06-30 · **Rama:** `staging`
> **Veredicto global:** 🟡 **NO LISTO para producción a 3.000–5.000 estudiantes sin remediar los riesgos críticos de la Sección 3.**

---

## NOTA DE MÉTODO Y HONESTIDAD

Esta auditoría se basa en lectura directa de:

- Los 5 motores puros (`engines/*.engine.ts`) y su contexto (`InstitutionRulesContext.ts`).
- Servicios clave: `partial-grades`, `period-final-grades`, `attendance`, `grades-bulk-import`, `reports`, `recovery-snapshot`, `grade-change`, `academic-year-lifecycle`.
- El esquema de datos completo (modelos y enums).

**No se ejecutó la aplicación ni se corrieron pruebas.** Donde un hallazgo se basa en lectura parcial o inferencia, está marcado con `⚠ verificar`. Donde está confirmado en código, se cita el archivo. Cada institución debe correr la batería de la Sección 11 en staging antes de aceptar el veredicto.

---

# 1. ESTADO ACTUAL DEL NÚCLEO

## 1.1 Arquitectura — lo que está bien hecho

Edusyn tiene una **arquitectura de motores puros** (sin acceso a BD) que es, conceptualmente, **superior a la media del mercado SIS latinoamericano**:

| Motor | Archivo | Qué resuelve |
|---|---|---|
| Reglas académicas | `academic-rules.engine.ts` | Normaliza cualquier escala (0–5, 0–10, 0–100) a %, niveles de desempeño, reprobación, nota requerida para aprobar |
| Promoción | `promotion.engine.ts` | PROMOTED / AT_RISK / NOT_PROMOTED con razones, configurable por institución |
| Recuperación | `recovery.engine.ts` | Elegibilidad y nota requerida según tipo de impacto (REPLACE / AVERAGE / ADJUST) |
| Boletín | `report-card.engine.ts` | Motor único que se adapta a 3 estructuras (DIMENSIONS / SUBJECTS_ONLY / AREAS_SUBJECTS) |
| Asistencia | `AttendanceSchedulingEngine.ts` | Clases esperadas según horario real |

**Fortalezas confirmadas:**

1. **Cero hardcoding de escala.** Todo deriva de `InstitutionRulesContext` (`minGradeValue`, `maxGradeValue`, `minPassingGrade`, etc.). Soporta 0–5, 0–10, 0–100 sin tocar código.
2. **Multi-estructura real.** Preescolar (cualitativo por dimensiones), primaria/bachillerato (cuantitativo plano o jerárquico áreas→asignaturas) conviven en una misma plataforma.
3. **Boletines versionados y congelables.** Existen `TermReportCardSnapshot` (con `version`) y `TermReopeningRecord`. Los boletines **se congelan** como snapshot y la reapertura **deja rastro**. Esto es un diferenciador serio y poco común.
4. **Cierre de período con guard.** `AcademicTerm.status = FINALIZED` bloquea edición de notas (`guardTermNotFinalized` en `partial-grades` y `period-final-grades`).
5. **Importación con previsualización (dry-run).** `grades-bulk-import.service.ts` tiene `previewImport()` que reporta estudiantes nuevos, no encontrados, materias faltantes y advertencias **antes** de aplicar. Patrón correcto.
6. **Cambio de grado normativo.** `grade-change.service.ts` distingue SAME_GRADE / PROMOTION / DEMOTION con validaciones y exigencia de acta (Decreto 1290).
7. **Multi-tenant** con contexto de institución e interceptores de tenant.

## 1.2 Madurez por módulo (semáforo)

| Módulo | Estado | Comentario |
|---|---|---|
| Estructura institucional (años, períodos, sedes, grados, grupos, áreas, asignaturas, plantillas) | 🟢 Maduro | Modelado completo, plantillas académicas reutilizables |
| Escalas / niveles de desempeño | 🟢 Maduro | `PerformanceScale`, niveles configurables |
| Calificaciones (parciales → final) | 🟡 Funciona, con riesgos | **Modelo dual** y semántica "0 = borrar" (ver §3.1, §3.2) |
| Porcentajes / pesos | 🟡 Parcial | Sin versionado ni recálculo retroactivo al cambiarlos (§3.3) |
| Boletines | 🟢 Maduro | Snapshots + versiones + reapertura |
| Logros | 🟢 Maduro | Banco institucional, config de visualización, juicios valorativos |
| Recuperaciones | 🟢 Bueno | Motor + snapshots post-recuperación |
| Promoción | 🟢 Bueno | Motor conectado a cierre de año |
| Asistencia | 🟡 Parcial | Sin cierre, sin guard de período, sin auditoría (§3.4) |
| Observador | 🟢 Bueno | Compromisos, citaciones, remisiones, evidencias, actas |
| Matrículas / movimientos | 🟢 Bueno | `EnrollmentEvent` registra movimientos |
| Importaciones masivas | 🟡 Parcial | Notas y usuarios sí; faltan asistencia, logros, observador (§3.6) |
| **Auditoría transversal** | 🔴 **Crítico** | Solo existe en APD, elecciones y permisos. **No en notas, asistencia, matrícula, recuperación** (§3.5) |
| Backups / papelera / rollback | 🔴 **Crítico** | Sin papelera ni recuperación ante borrado accidental (§3.7) |

---

# 2. MAPA DE DEPENDENCIAS

```
AÑO LECTIVO
  └─ CALENDARIO ──> PERÍODOS (AcademicTerm) ──> [status: DRAFT/ACTIVE/FINALIZED]
                          │
SEDE ─ JORNADA ─ GRADO ─ GRUPO                  │ (congela notas)
                   │                            │
                   ├─ ESTUDIANTE ─ MATRÍCULA ───┤
                   │      │                      │
                   │      └─ ACUDIENTE           │
                   │                             │
ÁREA ─ ASIGNATURA ─┴─ ASIGNACIÓN DOCENTE (TeacherAssignment)
                          │
                          ├─ PLAN DE EVALUACIÓN ─ COMPONENTES ─ PESOS %
                          │           │
                          ▼           ▼
              PARTIAL GRADE ──(recompute)──> PERIOD FINAL GRADE ──┐
                          │                         ▲ (también     │
                          │                          escritura     │
                          │                          MANUAL)       ▼
              ASISTENCIA ──────────────────────────────────> BOLETÍN (snapshot/version)
                          │                                        │
              RECUPERACIÓN ──(snapshot post-rec)──────────────────┤
                          │                                        ▼
              LOGROS ─────┴───────────────────────────────> PROMOCIÓN ─> CIERRE AÑO
                                                                          └─> MATRÍCULA AÑO+1
```

## 2.1 Acciones que DEBEN disparar recálculo (y hoy no todas lo hacen)

| Acción | Debe recalcular | ¿Lo hace hoy? |
|---|---|---|
| Editar/borrar nota parcial | `PeriodFinalGrade` del estudiante | ✅ Sí (`recomputePeriodFinalGrade`) |
| Cambiar peso/% de un componente | TODAS las finales ya calculadas de ese grupo+asignatura | ❌ **No** — quedan obsoletas hasta re-guardar |
| Cambiar escala de valoración | Niveles de desempeño de TODOS los boletines | ⚠ verificar — recalcula al regenerar boletín, no las finales almacenadas |
| Cambiar nota mínima aprobatoria | Estado reprobado/aprobado, promoción, elegibilidad de recuperación | ⚠ se evalúa al vuelo en boletín; finales almacenadas no cambian |
| Mover estudiante de grupo | Asociación de notas/asistencia/observador al nuevo grupo | ⚠ verificar comportamiento (§ Caso 11) |
| Cambiar docente | Migración de notas al nuevo `TeacherAssignment` | ✅ Sí, pero con borrado silencioso (§3.1) |
| Recuperación aprobada | `PeriodFinalGrade` + snapshot post-recuperación | ✅ Sí |

## 2.2 Procesos que JAMÁS deberían permitir edición libre

| Entidad | Regla esperada | Estado actual |
|---|---|---|
| Nota en período FINALIZED | Bloqueada salvo reapertura formal | ✅ Implementado |
| Boletín ya emitido | Inmutable; nueva versión, no sobrescritura | ✅ Snapshot versionado |
| Asistencia de período cerrado | Bloqueada o con justificación auditada | ❌ **Editable sin restricción** |
| Resultado de promoción del año cerrado | Inmutable | ⚠ verificar |
| Acta académica aprobada | Inmutable | ⚠ verificar |

---

# 3. RIESGOS

## 3.1 🔴 CRÍTICOS

### C-1 · Modelo de notas dual con dos rutas de escritura al mismo campo
**Evidencia:** `period-final-grades.service.ts` permite escribir `finalScore` **manualmente** (`upsert`, `bulkUpsert`). A la vez, `partial-grades.service.ts → recomputePeriodFinalGrade()` **sobrescribe ese mismo `finalScore`** a partir de los parciales.

**Riesgo:** Un coordinador ajusta una nota final manualmente → un docente edita después un parcial de la misma asignatura → el recompute **borra el ajuste manual sin avisar**. No hay reconciliación ni flag de "nota fijada manualmente".

**Síntoma confirmado en código:** existe `recoverLostGrades()` — una herramienta de reparación que reconstruye `PartialGrade` sintéticas desde `PeriodFinalGrade` "perdidas". Su sola existencia evidencia incidentes previos de pérdida de notas por esta dualidad.

**Impacto:** Pérdida o corrupción silenciosa de notas. Inaceptable en producción.

### C-2 · Semántica destructiva "score 0 = borrar"
**Evidencia:** En `partial-grades.bulkUpsert`: `if (grade.score > 0) { upsert } else { deleteMany }`. En `recomputePeriodFinalGrade`: `if (finalScore > 0) { upsert } else { delete }`.

**Riesgo:** Una nota legítima de **0.0** (estudiante que no presentó, fraude, escala 0–100) **no se puede registrar**: el sistema la interpreta como "borrar". El estudiante aparece sin nota en vez de con cero. Distorsiona promedios, promoción y reportes MEN.

**Impacto:** Imposibilidad de modelar el caso más común de pérdida de materia. Crítico para escalas 0–100 y 0–10.

### C-3 · Borrado silencioso de notas en cambio de docente
**Evidencia:** `partial-grades.bulkUpsert` (líneas ~75–146): al guardar, busca asignaciones históricas del mismo grupo+materia y, ante conflicto de llave, ejecuta `deleteMany(conflictIds)` — "el valor del docente actual gana".

**Riesgo:** Si dos docentes registraron la misma actividad/índice, las notas del anterior se **eliminan sin confirmación ni respaldo**.

**Impacto:** Pérdida de datos en un escenario común (relevo de docente a mitad de período).

### C-4 · Ausencia de auditoría en el núcleo académico
**Evidencia:** Solo hay `AuditLog` en APD, elecciones y permisos (`apd-audit`, `election-audit`, `permissions`). **No existe** historial de cambios para notas, asistencia, matrícula ni recuperaciones. Se guarda `enteredById` (quién fue el último), pero **no** "quién cambió de X a Y y cuándo".

**Riesgo:** Ante un reclamo ("mi hijo tenía 4.0 y ahora 2.0") es **imposible** reconstruir qué pasó. Sin defensa legal ni trazabilidad.

**Impacto:** Inadmisible para una institución regulada. Bloqueante de producción.

### C-5 · Sin papelera, soft-delete uniforme ni rollback de borrados
**Evidencia:** El schema tiene `onDelete: Cascade` (236 ocurrencias de `deletedAt`/Cascade combinadas). Hay cascadas: borrar una matrícula puede **arrastrar** notas, asistencia y observador.

**Riesgo:** Un admin borra un grupo/estudiante/matrícula por error → cascada destruye historia académica sin recuperación. No hay "papelera de 30 días".

**Impacto:** Pérdida irreversible. Caso 18 del enunciado sin solución hoy.

### C-6 · Falta de transaccionalidad en operaciones compuestas de notas
**Evidencia:** `partial-grades.bulkUpsert` ejecuta secuencialmente: migración de notas → upserts/deletes → recompute, **sin `$transaction`**. (Asistencia sí usa transacción.)

**Riesgo:** Un fallo a mitad (timeout, caída) deja el estado inconsistente: parciales migrados pero finales sin recalcular, o conflictos borrados sin que entren los nuevos.

**Impacto:** Corrupción parcial difícil de detectar.

## 3.2 🟠 MEDIOS

### M-1 · Lógica de cálculo duplicada y redondeo hardcoded
`recomputePeriodFinalGrade` implementa su **propio** promedio ponderado y `Math.round(x*10)/10` (1 decimal fijo), en vez de usar el motor puro. El boletín usa el motor. → Dos fuentes de verdad para el mismo número y redondeo no configurable (algunas instituciones redondean a entero, otras truncan).

### M-2 · Cambiar porcentajes no recalcula notas existentes
No hay versionado de `EvaluationPlanComponentWeight` ni recálculo masivo al cambiar un peso. Las finales quedan calculadas con el peso viejo hasta que alguien re-guarde parciales de cada estudiante (Caso 9).

### M-3 · Asistencia sin cierre ni guard de período
`attendance.update` no valida `FINALIZED`. La asistencia de un período cerrado se puede alterar libremente y sin rastro, afectando indicadores de promoción ya emitidos.

### M-4 · Rendimiento: bucles secuenciales a 3.000–5.000 estudiantes
`bulkUpsert` (notas y finales) y `recordBulk` iteran registro por registro con consultas anidadas (p. ej. `findUnique` de `institutionId` dentro de cada `upsert`). A escala de un colegio grande (× materias × períodos) son miles de round-trips → timeouts. Falta procesamiento por lotes / jobs en segundo plano.

### M-5 · Migración de notas por docente se ejecuta en cada guardado
La lógica de migración histórica corre en **cada** `bulkUpsert`, no solo cuando hay cambio real de docente. Costo y riesgo innecesarios en cada planilla guardada.

## 3.3 🟡 MENORES

- **MN-1** N+1: `findUnique(institutionId)` por cada upsert en lugar de resolverlo una vez.
- **MN-2** `console.error` para fallos de recompute en vez de logger estructurado/alerta.
- **MN-3** Falta validación de rango de nota contra la escala institucional en el punto de escritura (¿se puede guardar 7.5 en escala 0–5?). ⚠ verificar en DTO.
- **MN-4** `bulkUpsert` de finales no usa transacción ni reporta filas fallidas individualmente.
- **MN-5** No hay "razón de cambio" obligatoria al editar una nota tras primer guardado.

---

# 4. CASOS NO CONTEMPLADOS (vacíos funcionales)

Procesos que las plataformas educativas maduras tienen y que **no aparecen** en el código revisado:

1. **Historial de cambios de nota** con valor anterior/nuevo, autor, fecha y motivo (C-4).
2. **Papelera / soft-delete uniforme** con restauración (C-5).
3. **Cierre de asistencia** por período (M-3).
4. **Recálculo masivo** al cambiar pesos/escala (M-2).
5. **Nota cero legítima** distinguible de "sin registrar" (C-2).
6. **Flag "nota fijada manualmente"** que proteja ajustes de coordinación (C-1).
7. **Estado de digitación por planilla** ("borrador" vs. "entregada por el docente") — hoy no hay flujo de entrega/aprobación de planillas.
8. **Justificaciones de inasistencia como entidad** (con adjunto, aprobador y efecto sobre el % de promoción) — hoy solo hay `observations` libre. ⚠ verificar enum `AttendanceStatus`.
9. **Migración asistida desde otra plataforma** (mapeo de escalas, validación de integridad referencial, conciliación) — solo hay import de Excel propio.
10. **Reglas de promoción por área/grupo de grados** (p. ej. "media reprueba con 1 área, primaria con 3") — el motor usa un único `maxFailedSubjectsForPromotion` global por institución. ⚠ verificar si hay override por grado.
11. **Plan de mejoramiento / nivelación** como flujo separado de "recuperación".
12. **Concurrencia de digitación** (dos docentes/coordinador editando la misma planilla) — sin bloqueo optimista (`updatedAt`/version check).
13. **Reportes MEN / SIMAT** consistentes con cierres congelados (existe `men-reports`; ⚠ verificar que lea snapshots y no datos vivos).
14. **Definición de "tercero" en notas** (terceros, supletorios, habilitaciones distintos de recuperación).

---

# 5. AUTOMATIZACIONES SUGERIDAS

| Proceso | Automatización | Tipo |
|---|---|---|
| Cambio de peso/escala | Job en segundo plano que recalcula todas las finales afectadas + notifica | Prevención de inconsistencia |
| Digitación de notas | Detección de nota faltante / outlier (nota muy fuera del patrón del estudiante) | Sugerencia |
| Cierre de período | Checklist automático: % planillas entregadas, estudiantes sin nota, asistencia sin cerrar → bloquea cierre si falta | Prevención |
| Borrado de entidad académica | Confirmación + soft-delete + ventana de restauración 30 días | Prevención (C-5) |
| Recuperaciones | Detección automática de elegibles (nota < mínima) y generación de listas | Detección |
| Promoción | Pre-cálculo y reporte de AT_RISK / NOT_PROMOTED para comisión de evaluación | Sugerencia (ya hay motor) |
| Importación | Conciliación automática duplicados por documento + preview obligatorio | Prevención (parcial hoy) |
| Asistencia | Alerta a acudiente al N-ésimo retardo/falla (existe `PreventiveAlert`) | Detección |
| Inconsistencias de nota | Validación nightly: finales sin parciales, parciales sin plan, finales fuera de escala | Detección |
| Auditoría | Captura automática de antes/después en cada escritura de nota/asistencia/matrícula | Trazabilidad (C-4) |

**Asistentes IA aplicables** (la plataforma ya tiene orquestador de IA): generación de planes de mejoramiento, redacción de observaciones del observador, detección de patrones de riesgo académico, asistente de migración (mapeo de columnas Excel → modelo).

---

# 6. EXPERIENCIA DEL ADMINISTRADOR — recomendaciones

El núcleo es potente pero **asume un administrador experto**. Para un colegio real se necesita:

1. **Asistente de configuración inicial paso a paso** (wizard): año → calendario → períodos → escala → estructura → grados/grupos → áreas/asignaturas → docentes → matrícula. Con validación de completitud en cada paso.
2. **Centro de importaciones unificado** con: plantilla descargable, preview obligatorio, reporte de errores por fila, confirmación, y **deshacer** la importación.
3. **Panel de salud de datos**: estudiantes sin grupo, notas fuera de escala, finales sin parciales, períodos sin cerrar, planillas no entregadas.
4. **Bitácora visible** (cuando exista C-4): "quién cambió qué" filtrable por estudiante/docente/fecha.
5. **Papelera** con restauración.
6. **Simulador de cierre**: "qué pasaría si cierro este período" antes de congelar.
7. **Plantillas por tipo de colegio** (preescolar / primaria / bachillerato / media técnica) que precargan estructura y escala.

---

# 7. SIMULACIÓN DE LOS 20 CASOS REALES

| # | Caso | Veredicto | Detalle |
|---|---|---|---|
| 1 | Colegio nuevo desde cero | 🟡 | Posible, pero sin wizard guiado; requiere experto. Plantillas académicas ayudan. |
| 2 | Migración desde otra plataforma | 🔴 | Solo import de Excel propio. Sin mapeo de escalas ni conciliación referencial. Vacío. |
| 3 | Llega a mitad de año con notas/asistencia/logros previos | 🟡 | Import de notas existe; asistencia/logros/observador **no** tienen import. Boletines previos no migran. |
| 4 | Ingreso masivo de estudiantes | 🟢 | Bulk upload con preview. ⚠ verificar rollback y duplicados por documento. |
| 5 | Ingreso masivo de docentes | 🟢 | `iam/bulk-upload` existe. |
| 6 | Importación de notas | 🟡 | Existe con preview; pero hereda semántica "0=borrar" (C-2) y dualidad (C-1). |
| 7 | Importación de asistencia | 🔴 | No existe importador de asistencia. |
| 8 | Importación de logros | 🔴 | No existe importador de logros (sí banco institucional manual). |
| 9 | Cambiar % tras digitar notas | 🔴 | No recalcula finales existentes (M-2). Inconsistencia silenciosa. |
| 10 | Cambio de docente | 🟠 | Migra notas, pero **borra conflictos sin respaldo** (C-3). |
| 11 | Mover estudiante de grupo con notas/asistencia/observador | 🟠 | ⚠ verificar reasociación; riesgo de notas huérfanas por llave compuesta de `TeacherAssignment`. |
| 12 | Estudiante llega a mitad de período | 🟡 | Matriculable; sin asistente para notas/asistencia parciales del tramo anterior. |
| 13 | Retiro de estudiante | 🟢 | `EnrollmentEvent` + estados de matrícula. |
| 14 | Reingreso meses después | 🟡 | ⚠ verificar reactivación de matrícula y continuidad de histórico. |
| 15 | Cambio de calendario académico | 🟡 | Modelo lo soporta; ⚠ efecto sobre asistencia esperada ya registrada. |
| 16 | Cambio de escala de valoración | 🟠 | Boletín recalcula al regenerar; finales almacenadas y reprobación no se reconvierten retroactivamente. |
| 17 | Corrección de errores humanos | 🟠 | Editable, pero **sin auditoría** (C-4) ni motivo obligatorio. |
| 18 | Borrado accidental | 🔴 | Sin papelera ni rollback (C-5). Cascadas destructivas. |
| 19 | Recuperación de información / backups | 🔴 | Backups a nivel BD existen (operativos, ver `ESTADO.md`), pero **sin** recuperación granular ni histórico de auditoría. |
| 20 | +5.000 estudiantes / rendimiento | 🟠 | Bucles secuenciales y N+1 (M-4) → riesgo de timeouts en boletines masivos e importaciones. Falta jobs en segundo plano. |

---

# 8. BATERÍA DE PRUEBAS POR MÓDULO (QA FUNCIONAL)

Para cada módulo: **qué probar · cómo · resultado esperado · errores posibles · casos límite**.

## 8.1 Calificaciones
- **Registrar nota válida** dentro de escala → se guarda y recalcula final. *Límite:* nota = máximo y = mínimo exactos.
- **Registrar 0.0 legítimo** → **DEBE** persistir como 0, no borrarse (hoy falla, C-2).
- **Editar parcial → final recalcula** → verificar redondeo según config (hoy fijo, M-1).
- **Ajuste manual de final + editar parcial después** → ¿se conserva el ajuste? (hoy no, C-1).
- **Cambio de docente con notas en conflicto** → ¿se respaldan las anteriores? (hoy se borran, C-3).
- **Guardar en período FINALIZED** → bloqueado (✅).
- *Negativo:* nota fuera de escala, nota no numérica, estudiante sin matrícula activa.

## 8.2 Porcentajes / pesos
- Cambiar peso de componente con notas ya digitadas → finales deben recalcularse o avisar (hoy no, M-2).
- Suma de pesos ≠ 100% → debe rechazarse o normalizar explícitamente. ⚠ verificar.

## 8.3 Recuperaciones
- Estudiante con nota < mínima → elegible; nota recuperación reemplaza/promedia según `impactType`.
- Recuperación tras boletín emitido → genera **snapshot post-recuperación** (✅).
- Recuperación que no alcanza mínimo → estado correcto.
- *Límite:* recuperación = nota mínima exacta; recuperación > original.

## 8.4 Asistencia
- Registro masivo → transacción (✅).
- Editar asistencia de período cerrado → debe bloquearse o auditarse (hoy no, M-3).
- Justificación con efecto en % → ⚠ verificar existencia.
- Recalcular % esperado tras cambio de horario → ⚠ verificar.

## 8.5 Boletines
- Generar → snapshot con versión.
- Regenerar tras cambio → nueva versión, no sobrescribe (✅).
- Reapertura → `TermReopeningRecord` (✅).
- Boletín de período sin notas → manejo de nulos.

## 8.6 Promoción / cierre
- Cierre de período con planillas incompletas → debe advertir/bloquear (hoy ⚠ verificar).
- Promoción: PROMOTED / AT_RISK / NOT_PROMOTED según motor (✅).
- Preescolar (DIMENSIONS) → promoción automática (✅).
- Reapertura de año cerrado → ⚠ verificar inmutabilidad de resultados.

## 8.7 Matrículas
- Mover de grupo con notas existentes → sin notas huérfanas (⚠).
- Retiro y reingreso → continuidad de histórico.
- Cupo lleno → bloqueo.

---

# 9. MATRIZ DE PRUEBAS (QA)

| Proceso | Precondiciones | Pasos | Resultado esperado | Resultado incorrecto (bug) | Prioridad | Riesgo | Complejidad | Impacto |
|---|---|---|---|---|---|---|---|---|
| Registrar nota 0.0 | Matrícula activa, período ACTIVE | Guardar parcial = 0 | Persiste como 0 | Se borra el registro | P0 | Alto | Baja | Alto |
| Ajuste manual + edición parcial | Final manual existente | Editar un parcial | Conserva o avisa del ajuste | Recompute borra ajuste | P0 | Alto | Media | Alto |
| Cambio docente con conflicto | 2 asignaciones, notas duplicadas | Guardar planilla nuevo docente | Respalda/concilia | Borra notas previas | P0 | Alto | Media | Alto |
| Editar nota | Nota existente | Cambiar valor | Registro en bitácora antes/después | Sin rastro | P0 | Alto | Media | Alto |
| Borrar grupo con estudiantes | Grupo con matrículas+notas | Eliminar grupo | Soft-delete + restaurable | Cascada destructiva | P0 | Alto | Media | Alto |
| Cambiar % con notas | Plan con notas digitadas | Cambiar peso | Recalcula finales o avisa | Finales obsoletas silenciosas | P1 | Alto | Media | Alto |
| Editar asistencia cerrada | Período FINALIZED | Cambiar estado asistencia | Bloqueo/auditoría | Edición libre sin rastro | P1 | Medio | Baja | Medio |
| Boletín masivo 3.000 est. | Notas completas | Generar todos | Completa sin timeout | Timeout/caída | P1 | Medio | Alta | Alto |
| Import notas con duplicados | Excel con doc repetido | Preview + aplicar | Detecta y concilia | Crea duplicado | P1 | Medio | Media | Medio |
| Reabrir período | FINALIZED | Reabrir y editar | Registro de reapertura + nueva versión boletín | Edita sin versionar | P1 | Medio | Media | Alto |
| Mover estudiante de grupo | Notas+asistencia previas | Cambiar grupo | Histórico intacto y reasociado | Notas huérfanas | P1 | Alto | Alta | Alto |
| Promoción con área pendiente | Cierre de año | Ejecutar promoción | Estado correcto + razones | Estado erróneo | P1 | Medio | Media | Alto |

---

# 10. MEJORAS PRIORITARIAS (orden de ejecución)

**Bloque 0 — Integridad de notas (antes que cualquier módulo nuevo):**
1. Resolver el **modelo dual** (C-1): definir `PeriodFinalGrade` como derivado puro **o** introducir flag `isManualOverride` que el recompute respete.
2. Eliminar la semántica **"0 = borrar"** (C-2): separar "sin nota" (`null`) de "cero" (`0`).
3. Eliminar el **borrado silencioso** en cambio de docente (C-3): conciliar con respaldo, nunca `deleteMany` sin rastro.
4. Envolver `bulkUpsert` + migración + recompute en **`$transaction`** (C-6).

**Bloque 1 — Trazabilidad y seguridad de datos:**
5. **Auditoría académica** transversal: tabla de cambios (entidad, id, campo, antes, después, autor, fecha, motivo) para notas, asistencia, matrícula, recuperación (C-4).
6. **Soft-delete + papelera** uniforme con restauración; revisar todas las cascadas (C-5).

**Bloque 2 — Coherencia de cálculo:**
7. Unificar cálculo en el **motor puro** y hacer el **redondeo configurable** (M-1).
8. **Recálculo masivo** al cambiar peso/escala, en job de segundo plano (M-2).
9. **Cierre de asistencia** + guard de período (M-3).

**Bloque 3 — Escala y operación:**
10. Procesamiento **por lotes / jobs en background** para boletines e importaciones masivas (M-4).
11. **Importadores** faltantes: asistencia, logros, observador (Casos 7, 8).
12. **Asistente de migración** desde otra plataforma (Caso 2).

---

# 11. PRUEBAS OBLIGATORIAS PARA STAGING

Antes de promover a producción, ejecutar en staging con dataset realista (≥1.000 estudiantes):

- [ ] **Nota 0.0** persiste y se distingue de "sin nota".
- [ ] **Ajuste manual de final** sobrevive a edición posterior de parciales.
- [ ] **Cambio de docente** no pierde notas; existe respaldo verificable.
- [ ] **Editar una nota** deja registro de auditoría con antes/después/autor.
- [ ] **Borrar y restaurar** un grupo/estudiante desde papelera.
- [ ] **Cambiar un peso** recalcula (o avisa) todas las finales del grupo.
- [ ] **Editar asistencia** de período cerrado se bloquea o audita.
- [ ] **Generar boletines** de un grado completo sin timeout; medir tiempo.
- [ ] **Importar notas** con duplicados/errores → preview correcto + rollback.
- [ ] **Cerrar y reabrir** un período → versión nueva de boletín + registro de reapertura.
- [ ] **Promoción** de un grupo completo → estados y razones correctos.
- [ ] **Mover estudiante** de grupo conservando histórico.
- [ ] **Reportes MEN** consistentes con snapshots congelados (no datos vivos).
- [ ] **Concurrencia**: dos usuarios editando la misma planilla → sin pérdida.

---

# 12. CHECKLIST DE ACEPTACIÓN PARA PRODUCCIÓN

El núcleo académico se considera **listo para producción** cuando **todos** estos ítems están en verde:

### Integridad de datos
- [ ] No existe ruta que borre una nota sin respaldo o sin auditoría.
- [ ] La nota 0 es registrable y distinguible de "sin nota".
- [ ] Una sola fuente de verdad para la nota final (o override explícito y respetado).
- [ ] Toda operación compuesta de notas es transaccional.
- [ ] Las cascadas de borrado están revisadas; entidades académicas usan soft-delete.

### Trazabilidad
- [ ] Auditoría de cambios en notas, asistencia, matrícula y recuperación (antes/después/autor/fecha/motivo).
- [ ] Bitácora consultable por administrador.
- [ ] Papelera con restauración.

### Coherencia académica
- [ ] El redondeo y el cálculo de finales coinciden con los del boletín (motor único).
- [ ] Cambiar peso/escala recalcula o avisa explícitamente.
- [ ] Cierre de período bloquea notas **y** asistencia.
- [ ] Reapertura siempre versiona y registra.

### Operación y escala
- [ ] Boletines e importaciones masivas corren en background sin timeout a 5.000 estudiantes.
- [ ] Importadores de notas, asistencia, logros y estudiantes con preview + rollback.
- [ ] Panel de salud de datos disponible para el administrador.

### Normatividad
- [ ] Promoción configurable y conforme a Decreto 1290.
- [ ] Reportes MEN consistentes con cierres congelados.
- [ ] Cambios de grado con acta cuando la norma lo exige (✅ ya implementado).

---

## RESUMEN EJECUTIVO

Edusyn tiene un **núcleo académico arquitectónicamente sólido** (motores puros multi-escala, boletines versionados, cierre/reapertura, cambio de grado normativo) que ya supera a buena parte del mercado. **Pero no está listo para un colegio real de 3.000+ estudiantes** por seis riesgos críticos concentrados en **integridad y trazabilidad de notas**: modelo de notas dual con sobrescritura silenciosa (C-1), imposibilidad de registrar un cero (C-2), borrado de notas en cambio de docente (C-3), ausencia total de auditoría académica (C-4), falta de papelera ante borrados (C-5) y operaciones de notas no transaccionales (C-6).

**Recomendación:** congelar el desarrollo de módulos nuevos hasta cerrar el **Bloque 0 y Bloque 1** de la Sección 10. Son la diferencia entre una plataforma demostrable y una plataforma confiable para custodiar la historia académica de miles de estudiantes.
