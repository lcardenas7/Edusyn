# C-2 — Completitud cualitativa para grados `DIMENSIONS`

**Implementada el 2026-08-16.** · **F2 sigue ABIERTA.** · **F0 sigue PARCIAL.** · **C-1 y C-4 sin implementar.**

Archivo tocado: `apps/api/src/modules/reports/reports.service.ts` → `getCompletenessStatus`.
Sin cambios de esquema, sin migraciones, sin frontend.

---

## 1. Comportamiento antes / después

| | Antes | Después |
|---|---|---|
| `AREAS_SUBJECTS` / `SUBJECTS_ONLY` | Notas por `PeriodFinalGrade`; aprendizajes por `StudentAchievement` **exigiendo** `achievement.teacherAssignment` y `academicTermId` | **Idéntico. Sin un solo cambio.** |
| `DIMENSIONS` | Medido con el filtro cuantitativo → el catálogo compartido (`teacherAssignmentId = null`, `academicTermId = null`) nunca entraba → **0 % permanente** | Eje propio que respeta `AchievementConfig.valuationScope` |
| Modo `EVIDENCE` | `StudentEvidenceValuation` **no se consultaba en ninguna línea** → no había eje que medir | Se mide sobre `StudentEvidenceValuation`, aplicando la regla de vigencia de D-12 |

## 2. Cómo se decide

```
grupo.grade.academicStructure === 'DIMENSIONS'
   ├── NO  → índice cuantitativo de siempre (intacto)
   └── SÍ  → índice cualitativo
             AchievementConfig.valuationScope
               ├── PURPOSE  → obligación = propósito       · satisfecha por StudentAchievement
               └── EVIDENCE → obligación = imprescindible  · satisfecha por StudentEvidenceValuation
                              filtrado por isEvidenceVigente() de D-12
```

**Grano de la obligación** (plan §5.2): un estudiante cuenta como diligenciado en una dimensión
sólo cuando cubrió **todas** sus obligaciones de ese período. Cubrir una de tres no es estar al día.

**Catálogo esperado:** propósitos por-asignación (`teacherAssignmentId in TAs del grupo`,
`academicTermId in términos`) **más** catálogo compartido (`teacherAssignmentId = null`,
`gradeId in grados`, `academicYearId`, `academicTermId in términos o null`). Mismo criterio que
`getAchievementsByAssignment`, para que planilla y completitud no discrepen.

**Propósito anual vs. por-período:** uno con `academicTermId = null` se exige en todos los
períodos; uno con período concreto sólo en el suyo.

**Dimensión sin obligaciones configuradas:** no hay nada que exigir y no resta completitud.
Es coherente con el lado cuantitativo, donde un grupo sin universo también da 100 %.

## 3. Aislamiento respecto del cuantitativo

- La consulta cuantitativa de `studentAchievement` **conserva su filtro original**. El eje
  cualitativo es una consulta **aparte**, y sólo se ejecuta si hay grupos `DIMENSIONS`.
- El universo sigue saliendo de `TeacherAssignment`. **No se tocó `EnrollmentSubject`**: ese
  cambio es F4 (R-2/A-2) y queda prohibido aquí.
- Único cambio compartido: se añadieron `id` y `academicStructure` al `select` del grado en la
  consulta de grupos. Es aditivo; no altera filtro ni orden.
- **Las 30 pruebas de caracterización de F0-MÍNIMO siguen pasando sin modificarse.** Es la
  prueba de que la línea base cuantitativa no se movió.

## 4. Pruebas

`apps/api/src/modules/reports/c2-completeness-dimensions.spec.ts` · **11 pruebas**.

| Exigencia | Prueba |
|---|---|
| 1 · `AREAS_SUBJECTS` sin cambios | Verifica además que el eje cualitativo **ni se activa** |
| 2 · `DIMENSIONS + StudentAchievement` mide bien | 1 de 2 → 50 %, con nombre del faltante |
| 3 · `DIMENSIONS + StudentEvidenceValuation` mide bien | e1 cubre 2/2, e2 cubre 1/2 → 50 % |
| 4 · Catálogo compartido participa | Propósito con `teacherAssignmentId` y `academicTermId` en `null` |
| 5 · Evidencia retirada no obliga después | Retirada desde P2: P1 la exige, P2 no |
| 5b · Prueba en negativo | Sin valorar: P1 penaliza (0 %), P2 no (100 %) |
| 6 · Evidencia vigente sí obliga | — |
| 7 · No se modifica ninguna valoración | Los mocks no exponen escritura: cualquier intento reventaría |
| 8 · Universo cuantitativo sin cambios | El filtro original sigue presente |
| 9 · Sin dependencia con `EnrollmentSubject` | Ausente del mock; usarlo reventaría |
| Extra | Exige *todos* los propósitos · propósito por-período no se exige en otro · dimensión sin obligaciones no resta |

**Resultados:** C-2 11/11 · F0-MÍNIMO 30/30 · F1 14/14 · D-12 31/31 · módulo `reports` 50/50 ·
suite completa 212 pasan / 1 falla (`institution-config`, previa y ajena) · typecheck backend y
frontend 0 errores.

## 5. Hallazgo: dos etiquetas de F0 quedaron imprecisas

Ninguna prueba de caracterización falló, pero dos quedaron mal rotuladas y **no las modifiqué**:

| Prueba en `f0-baseline.spec.ts` | Situación |
|---|---|
| `[DEFECTO CONGELADO · C-2a] el eje de aprendizajes EXIGE achievement.teacherAssignment` | Sigue siendo cierta **para el camino cuantitativo**, y ahora eso es *deliberado*, no un defecto. La etiqueta debería decir que documenta el aislamiento |
| `[DEFECTO CONGELADO · C-2b] StudentEvidenceValuation NO se consulta jamás` | Sigue siendo cierta para un grupo no-`DIMENSIONS`, pero ya no es universal |

No las toqué para no dar apariencia de haber ajustado una prueba de caracterización tras un
cambio de comportamiento. **Requiere decisión explícita** sobre si se re-etiquetan.

## 6. Lo que NO se tocó

`validateTermGrades` · `closeTerm` · `finalizeTerm` · `reSnapshotTerm` · `buildGroupReportCards` ·
`academic-data-source.service.ts` · snapshots · `isFailing` · F4/R-2/A-2 · FK de
`StudentEvidenceValuation` · las 12 filas huérfanas · H-12 · H-20 · F3/F4/F5/F6.

El hallazgo de que **`isFailing` usa el contexto institucional en lugar de la estructura del
grado** sigue documentado como pendiente y **no se corrigió**.

## 7. Cero escrituras en producción

Sin migraciones, `INSERT`, `UPDATE`, `DELETE`, backfill, cierres, finalizaciones ni generación de
snapshots. **No se consultó producción en este paso.** Las pruebas usan Prisma simulado.

Intactos: las 12 filas huérfanas · las 15 valoraciones · la guarda de F1 · la migración de D-12 ·
el esquema.

## 8. Estado

| | |
|---|---|
| **C-2** | ✅ Implementada |
| **C-4** | ❌ **Bloqueada** hasta ampliar F0 a `reSnapshotTerm` y `academic-data-source.service.ts` |
| **C-1** | ❌ Sin implementar |
| **F0** | 🟡 Parcial |
| **F2** | 🟡 **ABIERTA** |

> **Actualizado el 2026-08-17.** La tabla de arriba refleja el estado en la fecha de C-2 y se
> conserva como registro. Estado actual: **C-1 ✅ · C-2 ✅ · C-4 ✅ · D-12 ✅ · F0 🟡 parcial ·
> F2 🟡 abierta**. La FK de `StudentEvidenceValuation → AchievementEvidence` está aplicada con
> `RESTRICT` y quedan **0 huérfanas** (`docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md`).
> **C-1, C-2 y C-4 NO están desplegadas a producción.**
