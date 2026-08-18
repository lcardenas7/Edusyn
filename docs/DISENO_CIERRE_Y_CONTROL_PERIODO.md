# Cierre y Control del Período (Transición y general)

> Estado: **propuesta / spec para aprobar**. No hay código nuevo aún.
> Contexto: nace del boletín de Transición, pero aplica a todo el sistema de notas.

## 1. La visión (en palabras del usuario)

Que el sistema **se sienta como un sistema de verdad**, no como algo que "genera un documento":

1. El **docente** sabe si ya todos los estudiantes tienen su valoración y su observación de convivencia, o si falta alguien — y sabe **cuándo está todo completo**.
2. Se manejan **casos especiales**: estudiantes sin valoración porque no asisten o por otra razón (no deben bloquear el "completo").
3. Generar el boletín es un **acto deliberado** ("Generar boletines de Transición") — quedan **generados y congelados**, no que "apenas califico, sale al instante".
4. Al generar, queda **registro** de que se generaron, quién y qué información.
5. Corrección de una valoración por error → proceso que **deja registro** (aunque el atajo de "reabrir y corregir" es válido, el cambio no puede ser silencioso).

## 2. Lo que YA EXISTE (no reconstruir)

El ciclo de vida del período ya está implementado para el flujo numérico y **es genérico** (usa `buildGroupReportCards`, que cubre Transición/DIMENSIONS):

| Necesidad | Ya existe |
|---|---|
| Congelar boletines del período | `TermReportCardSnapshot` (por estudiante, versionado, `data` = boletín completo congelado) |
| Registro de generación (quién/cuándo) | `TermReportCardSnapshot.generatedById` + `generatedAt` + `snapshotType` |
| Generar/finalizar | `reports.service.finalizeTerm(termId, userId)` — exige `status=CLOSED`, snapshotea todos los grupos |
| Reapertura con motivo | `TermReopeningRecord` (`reopenedById`, **`reason`**, `previousVersion`) + `reopenTerm` |
| Re-congelar tras corrección | `reSnapshotTerm` (nueva versión) |
| Cierre de ventana de edición | `GradingPeriodConfig.isOpen` (cerrada → docente no edita) |
| Auditoría forense de notas | `GradeAuditEvent` (antes→después, actor, cuándo) — **solo cableado para numérico (`PARTIAL_GRADE`)** |
| Estados del período | `AcademicTerm.status`: OPEN → CLOSED → FINALIZED |

**Conclusión:** "generar boletines que queden registrados" y "corregir con registro" **ya son posibles hoy** vía finalizeTerm/reopenTerm. Lo que falta es **visibilidad, casos especiales, auditar lo cualitativo, y surfacer el flujo en la UX** para que se sienta como sistema.

## 3. Los huecos reales (lo que hay que construir)

### G1 — Completitud cualitativa (docente)
No existe la vista de "¿ya todos tienen valoración y convivencia?" para Transición (el panel de completitud actual es numérico). El docente necesita, por grupo y período:
- Por cada **dimensión**: cuántos estudiantes valorados / faltantes.
- **Convivencia**: cuántos con registro / faltantes.
- Un indicador global "todo completo" (contando casos especiales como resueltos).

### G2 — Casos especiales (sin valoración legítima)
Estudiante sin valoración porque no asiste / retiro / ingreso tardío. Necesita:
- Marcar el estado (p. ej. `NO_EVALUADO` con motivo) para que **no cuente como pendiente**.
- Definir cómo sale en el boletín (fila con "No evaluado / N.A." en vez de vacío).
- Decisión de producto: ¿se marca por estudiante-dimensión o por estudiante-período?

### G3 — Auditar lo cualitativo y convivencia
`GradeAuditEvent` es genérico (acepta `source`) pero **no se llama** al guardar valoraciones (`StudentAchievement`) ni convivencia (`ConvivenciaEntry`). Cablearlo con `source: 'STUDENT_ACHIEVEMENT'` y `'CONVIVENCIA'` → todo cambio (antes→después, actor) queda registrado, incluso con la ventana abierta.

### G4 — Surfacer el flujo "Generar / Cerrar" en la UX de Transición
Hoy el boletín se ve en vivo (período OPEN) → "sale al instante". Falta:
- Acción visible para el admin: "Cerrar período y **Generar boletines**" (usa `closeTerm`+`finalizeTerm`).
- Que la vista/descarga de boletín, una vez FINALIZED, lea del **snapshot** (ya lo hace: la lógica sirve snapshot si `status=FINALIZED`).
- Aviso claro de estado: "En edición" / "Cerrado" / "Generado (vN) el {fecha} por {usuario}".

### G5 — Cierre con responsable (menor)
`GradingPeriodConfig` no guarda quién/cuándo cerró la ventana (la de recuperaciones sí). Agregar `closedById`/`closedAt` para trazabilidad del cierre.

## 4. Plan por bloques (sugerido)

- **Bloque A — Auditoría cualitativa (G3).** Menor riesgo, base del "no silencioso". Cablear `GradeAuditEvent` en el upsert de `StudentAchievement` y `ConvivenciaEntry`.
- **Bloque B — Completitud cualitativa (G1).** Endpoint de completitud por grupo/período + vista en la planilla del docente (semáforo por dimensión + convivencia) y resumen para admin.
- **Bloque C — Casos especiales (G2).** Modelo + UI para marcar `NO_EVALUADO` con motivo; reflejarlo en completitud y en el boletín.
- **Bloque D — Flujo Generar/Cerrar en UX (G4) + cierre con responsable (G5).** Botón "Generar boletines", estados visibles, lectura desde snapshot, `closedBy` en la ventana.

## 5. Decisiones abiertas (para el usuario)

1. **Casos especiales (G2):** ¿marca por estudiante-dimensión o por estudiante-período? ¿Etiqueta en boletín: "No evaluado", "N.A.", otra?
2. **Quién genera (G4):** ¿solo admin/coordinador, o el docente puede "cerrar su parte" y el admin finaliza el período?
3. **Corrección post-generación:** ¿basta el flujo actual (reabrir con motivo → corregir → re-snapshot), o quieres un flujo dedicado "Solicitar corrección" con aprobación?
4. **Orden de bloques:** ¿A→B→C→D como arriba, o priorizar la completitud (B) primero por ser lo más visible para el docente?
