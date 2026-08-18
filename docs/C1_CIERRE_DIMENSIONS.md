# C-1 — Cierre de períodos con grados `DIMENSIONS`

**Implementada el 2026-08-16.** · **F2 sigue ABIERTA.** · Sin esquema, sin migraciones, sin frontend, sin escrituras en producción.

---

## 1. El defecto

`validateTermGrades` medía la completitud con un **único predicado** —existe
`PeriodFinalGrade`— para todas las modalidades, y **nunca leía `Grade.academicStructure`**
(la consulta de grupos hacía `select: { id, name }`).

Transición no produce `PeriodFinalGrade`. Y como la función recorre **todos los grupos de la
institución**, un solo grupo de preescolar dejaba `isComplete = false` y **bloqueaba el cierre del
período para el colegio entero**.

## 2. Qué se cambió

| Archivo | Cambio |
|---|---|
| `reports.service.ts` — nuevo `buildQualitativeCompletenessIndex` | **Helper compartido**: fuente única de las reglas de obligación cualitativa |
| `reports.service.ts` — `getCompletenessStatus` | El bloque cualitativo de C-2 se **movió** al helper; llama a él |
| `reports.service.ts` — `validateTermGrades` | Añade `grade.academicStructure` al `select` · despacha por estructura · pase cualitativo diferido |
| `closeTerm` | **Sin cambios** |

## 3. El helper compartido

```
getCompletenessStatus (C-2, panel)  ─┐
                                     ├──►  buildQualitativeCompletenessIndex
validateTermGrades   (C-1, cierre)  ─┘
```

Entrada mínima: `institutionId`, `academicYearId`, `terms[{id,order}]`,
`teacherAssignmentIds`, y por grupo `{ id, gradeId, subjectIds, enrollmentIds }`.
Salida: `Map<"groupId|subjectId|termId", Set<enrollmentId diligenciados>>`.

**No absorbe nada cuantitativo**: no conoce `PeriodFinalGrade`, `EnrollmentSubject`,
`EnrollmentArea`, `closeTerm`, `finalizeTerm`, snapshots ni `isFailing`.

Panel y cierre deciden ahora con el mismo criterio; antes eran dos implementaciones
independientes del mismo concepto y podían discrepar.

## 4. Despacho en `validateTermGrades`

```
Grade.academicStructure
   ├── AREAS_SUBJECTS ──┐
   ├── SUBJECTS_ONLY  ──┴──► bloque cuantitativo ACTUAL, intacto
   └── DIMENSIONS ─────────► se aparta y se resuelve en un pase posterior,
                             en LOTE, con el helper compartido
```

El grupo `DIMENSIONS` se aparta **antes** de la consulta de `PeriodFinalGrade`: el camino
cuantitativo no ejecuta ni una consulta de más. El pase diferido permite además resolver todas
las obligaciones en lote en vez de grupo a grupo.

`missing[]` conserva su forma `{ group, student, subject }`: la UI y el mensaje de `closeTerm`
no cambian.

## 5. ⚠️ Corrección de correctitud descubierta al extraer el helper

En C-2, `termOrderById` se construía **sólo con los períodos consultados**. Al validar **un
único** período —que es justo lo que hace `validateTermGrades`— el orden del término de retiro
no estaba disponible, `isEvidenceVigente()` fallaba **abierto** y **una evidencia ya retirada
seguía contando como obligación, bloqueando el cierre**.

El helper resuelve ahora los órdenes de los períodos de retiro (reutilizando
`resolveRetirementTermOrders`) y los fusiona con los consultados.

- **La regla no cambió** (`P.order < T.order`): se le suministran los datos que necesitaba.
- **Efecto colateral en C-2**: una consulta de completitud acotada a un solo período posterior
  al retiro ahora responde correctamente. Antes contaba de más.
- Las 11 pruebas de C-2 pasan **sin modificarse**.

## 6. Aislamiento del cuantitativo

Cinco pruebas `[CONTRATO CUANTITATIVO]` lo blindan. La central: con un grupo
`AREAS_SUBJECTS`, los modelos `achievementConfig`, `achievement`, `studentAchievement` y
`studentEvidenceValuation` **no existen en el mock** — si el camino cuantitativo los tocara,
la prueba reventaría. Igual con `enrollmentSubject` y `enrollmentArea` (F4, prohibidos aquí).

## 7. Prueba convertida

Una sola: `f0-baseline` → «[DEFECTO CONGELADO · C-1] el servicio es CIEGO a
`Grade.academicStructure`» → **[CORREGIDO por C-1] el servicio LEE `Grade.academicStructure`**.
Falló al implementar, que es la señal esperada. Se verificó antes de convertirla que las demás
pruebas cuantitativas de F0 seguían verdes, descartando contaminación.

## 8. Rendimiento

La rama `DIMENSIONS` añade, **una sola vez por validación** (no por grupo):
`teacherAssignment.findMany` + `achievementConfig.findUnique` + `achievement.findMany` +
`academicTerm.findMany` (órdenes de retiro) + una de valoraciones = **5 consultas fijas**.

A cambio, esos grupos **dejan de ejecutar** su `periodFinalGrade.findMany`. Con una sola
institución `DIMENSIONS` y un grado, el efecto neto es despreciable. **No se introduce ningún
N+1 nuevo**: el pase es en lote. El N+1 preexistente del camino cuantitativo (3 consultas por
grupo) **no se tocó**, por regla explícita.

## 9. Fuera de alcance, sin corregir

- **`isFailing`**: recibe contexto institucional. Confirmado que `institution-context.service.ts:128`
  inicializa `academicStructure` con el default `'AREAS_SUBJECTS'` y **nunca lo reasigna**, así que
  la rama «DIMENSIONS nunca reprueba» está muerta y los estudiantes de preescolar pueden marcarse
  como reprobados en snapshots. **No participa en el cierre**; afecta a `finalizeTerm`,
  `reSnapshotTerm` y el boletín. Hallazgo separado.
- El N+1 del camino cuantitativo.
- `EnrollmentSubject` / `EnrollmentArea` como universo (F4/R-2/A-2).

## 10. Estado

| | |
|---|---|
| **C-1** | ✅ Implementada |
| **C-2** | ✅ · **C-4** ✅ · **D-12** ✅ |
| **F0** | 🟡 Parcial |
| **F2** | 🟡 **ABIERTA** |

*Actualizado el 2026-08-17.* La FK de `StudentEvidenceValuation → AchievementEvidence` **ya no
está bloqueada ni pendiente**: las 12 huérfanas se eliminaron previamente (quedan 0 huérfanas y
3 valoraciones válidas) y la FK se aplicó con `ON DELETE RESTRICT` · `ON UPDATE RESTRICT`
(migración `20260817120000_student_evidence_valuation_fk`) —
`docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md`.

`deleteAchievement` quedó protegido con **tres guardas de servicio** (`StudentAchievement`,
`StudentEvidenceValuation`, `AttitudinalAchievement`) — ver
`docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md` §4.1.

*Actualización del mismo 2026-08-17, posterior a la nota anterior:* las tres FK de alcance
(`studentEnrollmentId` `CASCADE`/`CASCADE`, `academicTermId` `CASCADE`/`CASCADE`,
`institutionId` `RESTRICT`/`CASCADE`) **ya se aplicaron** — migración
`20260817180000_student_evidence_valuation_scope_fks`, **H-2 resuelto**.

F2 sigue abierta únicamente por el despliegue de C-1/C-2/C-4.
**D-18** (retiro lógico de `Achievement`) **no está implementado**.

**C-1, C-2 y C-4 NO están desplegadas a producción.**
