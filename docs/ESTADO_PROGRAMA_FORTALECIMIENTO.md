# Estado del Programa de Fortalecimiento del Núcleo Académico

> Documento único de referencia. Consolida el trabajo de integridad, auditoría, borrado seguro y
> concurrencia hecho sobre el núcleo académico (notas y asistencia) para operar con instituciones reales.
> Complementa (no repite) el detalle de: `AUDITORIA_NUCLEO_ACADEMICO.md` (Fase 1, diagnóstico),
> `AUDITORIA_OPERACIONAL_FASE2.md` (Fase 2, certificación operacional), `CONSTITUCION_MODULO_NOTAS.md`,
> `DISENO_C5_PAPELERA.md`, `FLUJO_RELEVO_DOCENTE.md`.
>
> **Estado: ✅ TODO EN PRODUCCIÓN** (desplegado 2026-07-01, merge `main` `2a502d6`).

---

## Bloque A — Integridad de notas

| Riesgo | Qué se arregló |
|---|---|
| **C-1** — el recálculo automático pisaba en silencio un ajuste manual de la nota final | `PeriodFinalGrade.isManualOverride`: si una final fue fijada a mano, el recompute la respeta y no la sobreescribe. UX: badge 🔒 "fijada manualmente" en la planilla y en Notas Finales. |
| **C-2** — "0 = borrar" (no se podía registrar una nota real de 0.0) | `null` = sin nota (borra la celda); cualquier número, **incluido 0**, se guarda. Corregido en backend, planilla, e importación por Excel. |
| **C-3** — al cambiar de docente, las notas del anterior se borraban sin rastro en caso de conflicto | Se auditan (motivo explícito) antes de ser reemplazadas por las del docente actual. |
| **C-6** — falta de transaccionalidad en el guardado masivo de notas | Ya estaba cubierto: `TenantContextInterceptor` (global) envuelve cada request autenticado en una transacción; un fallo a mitad de camino hace rollback completo. |

## Bloque B — Auditoría forense

- **`GradeAuditEvent`** (notas) y **`AttendanceAuditEvent`** (asistencia): tablas append-only con quién/cuándo/acción/valor anterior→nuevo.
- Cubren: creación, edición y borrado de notas (planilla), y edición/creación de asistencia.
- **Panel de observabilidad en SuperAdmin**: estadísticas de uso + registro de auditoría, por institución y general (`/superadmin/audit-logs`).
- Migraciones **RLS-defensivas**: activan Row Level Security solo si la función `current_institution_id()` existe en la base; si no, se omite sin fallar (el aislamiento sigue garantizado a nivel de aplicación).
- **Límite honesto**: es *forward-only* — captura desde que se desplegó, no reconstruye historial anterior.

## Bloque C — Borrados destructivos (C-5a)

- Revisión de los ~20 endpoints DELETE del núcleo académico: la mayoría **ya bloqueaban** el borrado si había historia (Grupo, Grado, Área, Asignatura, Estudiante con soft-delete, Año lectivo solo en DRAFT).
- **Gaps reales cerrados**: `TeacherAssignment.delete` y `.deleteAll` solo revisaban notas, no asistencia → ahora bloquean si hay notas **o** asistencia asociadas.
- Papelera completa (soft-delete + restauración universal) quedó documentada como **mejora opcional no bloqueante** (`DISENO_C5_PAPELERA.md`), no se implementó — no era necesaria para cerrar el riesgo real.

## Bloque D — Concurrencia

1. **Guardado por diferencias**: la planilla solo envía las celdas que cambiaron respecto al snapshot cargado (no la planilla completa) → dos personas editando celdas distintas no se pisan.
2. **Detección de conflicto en la misma celda**: usa `updatedAt` (ya existente, sin migración) como token optimista. Si alguien más cambió esa celda exacta mientras editabas, no se sobreescribe — se muestra el valor real del servidor y se avisa con un toast para que decidas si reintentar.

## Relevo docente (continuidad)

- `replaceTeacher` y `transferFullLoad` ("Transferir Carga" en `/academic-load`) ahora migran **notas y asistencia** a la asignación del docente reemplazo (antes solo el horario).
- Flujo completo (rutas y clicks) documentado en `FLUJO_RELEVO_DOCENTE.md`.

## Otros arreglos de esta ronda

- **SuperAdmin**: separación Rector/Administrador al crear institución (mismo o distinto, con login opcional del rector). Menú lateral corregido (cada ítem abre la vista correcta).
- **Consistencia de datos**: orden y formato de nombre de estudiante unificado entre la planilla, "Ingresar Nota Final" y el Aula Virtual (usa el nombre canónico que ya calculaba el backend).
- **Fix**: selector de Asignatura en "Ingresar Nota Final de Período" quedaba deshabilitado (cargaba de una relación que no traía datos; ahora usa las asignaciones docentes, igual que la planilla).

---

## Trabajo adicional incluido en el mismo despliegue (no forma parte del programa de integridad, pero estaba en `staging`)

- **Aula Virtual**: estado de trabajo visual, filtros accionables, jerarquía por urgencia (`REDISENO_AULA_VIRTUAL_2026.md`).
- **Orquestador de IA por institución** (free/premium, cuota, medición y caché).
- **Estudio — Diseño Pedagógico IA** (E0+E1): cimientos del "Activo Pedagógico Vivo" (`DISENO_PEDAGOGICO_IA.md`).

---

## Despliegue a producción (2026-07-01)

- Merge `staging` → `main` (commit `2a502d6`), push a `origin/main`.
- 5 migraciones nuevas aplicadas en producción, **todas exitosas**, 0 fallidas: `pedagogical_design_e0`, `ai_orchestrator_plan`, `grade_audit_events`, `period_final_grade_manual_override`, `attendance_audit_events`.
- Verificado (solo lectura, antes y después): producción no tiene `current_institution_id()` — las migraciones de auditoría se aplicaron en modo defensivo (sin RLS forzado); 5 instituciones reales, datos intactos.
- Servicios `api` y `web` de producción: deploy status `SUCCESS`, sin errores en logs de arranque.

## Documentos relacionados
- `AUDITORIA_NUCLEO_ACADEMICO.md` — diagnóstico original (Fase 1, los C-x/M-x referenciados aquí).
- `AUDITORIA_OPERACIONAL_FASE2.md` — certificación operacional para producción (checklist ⭐ del piloto).
- `CONSTITUCION_MODULO_NOTAS.md` — modelo conceptual de 3 capas (Evidencia → Derivación → Publicación).
- `DISENO_C5_PAPELERA.md` — diseño de papelera/soft-delete (parcialmente implementado, resto opcional).
- `FLUJO_RELEVO_DOCENTE.md` — flujo operativo paso a paso del reemplazo de docente.
