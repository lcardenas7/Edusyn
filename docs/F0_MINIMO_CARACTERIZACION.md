# F0-MÍNIMO — Caracterización de los servicios compartidos

**Ejecutado el 2026-08-16.** · **F0 NO está completa.** · **F2 sigue ABIERTA.** · **C-1, C-2 y C-4 NO están corregidas.**

Subconjunto de F0 acotado a lo que C-1/C-2/C-4 necesitan tocar. Su propósito es **fijar el
comportamiento actual antes de modificarlo**, para poder demostrar después —y no sólo
afirmar— que el comportamiento cuantitativo no cambió.

Archivo: `apps/api/src/modules/reports/f0-baseline.spec.ts` · **30 pruebas** · sin base de datos.

---

## 1. Qué se caracterizó y qué no

| Servicio | Cobertura previa | Ahora | Motivo |
|---|---|---|---|
| `validateTermGrades` | **0** | 7 pruebas | Base de C-1 |
| `closeTerm` | **0** | 4 pruebas | Base de C-1 |
| `getCompletenessStatus` | **0** | 8 pruebas | Base de C-2 |
| `finalizeTerm` | **0** | 11 pruebas | Base de C-4 |
| `buildGroupReportCards` | **0** | **sustituido por un doble** | Caracterizarlo entero es F0 completa. Para C-4 basta fijar qué hace `finalizeTerm` **con** su salida |
| `reSnapshotTerm` · `academic-data-source.service.ts` | **0** | **sin caracterizar** | Los toca C-4, pero exceden el alcance autorizado |

---

## 2. Línea base cuantitativa fijada

### `validateTermGrades`
- **Universo:** grupos con matrícula `ACTIVE` en el año × asignaturas de `TeacherAssignment` × matrículas `ACTIVE`.
- **Predicado único:** existe `PeriodFinalGrade(enrollment, subject, term)`.
- Salida: `totalExpected`, `totalFound`, `totalMissing`, `completionPercent`, `isComplete`, `missing` (tope 100), `hasMore`.
- Un grupo sin estudiantes o sin asignaturas **se omite**; el resultado global puede dar 100 % por ausencia de universo.
- `NotFoundException` si el período no existe.

### `closeTerm`
- Sólo desde `OPEN`; `CLOSED`/`FINALIZED`/`DRAFT` → `BadRequest`.
- Exige `isComplete === true`; si no, `BadRequest` **sin cambiar de estado**.
- Éxito → `status = 'CLOSED'`.

### `getCompletenessStatus`
- Dos ejes independientes: notas (`PeriodFinalGrade`) y aprendizajes (`StudentAchievement`).
- Porcentajes por asignatura, grupo e institución; nombres de los estudiantes faltantes.
- Responsable expuesto por asignatura (`teacherName`); **no hay agregación por docente**.
- `NotFound` si el año no tiene períodos; resumen vacío si no hay grupos.

### `finalizeTerm`
- Exige `CLOSED`. `version = max + 1`. Estado final `FINALIZED` + `finalizedAt`.
- Promedio general: media de notas no nulas de áreas **no `INFORMATIVE`**, redondeada a 1 decimal.
- `failedCount` vía `isFailing`; `promotionStatus` = `PENDIENTE` (sin notas computables) · `APRUEBA` (0 reprobadas) · `NO_APRUEBA`.
- Ranking descendente por promedio, sólo entre quienes tienen promedio; el resto queda con `rank = null`.

---

## 3. Comportamiento actual de `DIMENSIONS` — registrado, **no corregido**

`validateTermGrades` **es ciego a `Grade.academicStructure`**: no lo selecciona en ninguna
consulta y no consulta ninguna fuente cualitativa. Un grupo `DIMENSIONS` se mide con el mismo
predicado `PeriodFinalGrade`, que Transición nunca produce. **Ésta es la causa raíz de C-1**, y
queda congelada como línea base.

---

## 4. Defectos congelados a propósito

Estas pruebas afirman comportamiento **incorrecto**. Cuando se corrija el defecto, **deben
fallar**: ese fallo es la señal de que el cambio surtió efecto, no un accidente.

| Prueba | Defecto congelado | Se libera en |
|---|---|---|
| `validateTermGrades` es ciego a `academicStructure` | Causa raíz de C-1 | **C-1** |
| Cerrar no registra actor ni fecha | Sin trazabilidad del cierre | F3 (B-2) |
| El eje de aprendizajes exige `achievement.teacherAssignment` | El catálogo compartido nunca cuenta | **C-2a** |
| `StudentEvidenceValuation` no se consulta jamás | Modo `EVIDENCE` sin eje que medir | **C-2b** |
| `AchievementConfig.valuationScope` no se consulta | La completitud ignora la modalidad | **C-2** |
| El snapshot no congela `reportContent`/`academicStructure`/`displayConfig` | El boletín cambia al finalizar | **C-4** |
| `snapshotType` siempre `INITIAL_CLOSE` | Cierre y corrección indistinguibles | F3 |
| Un grupo que falla se traga y el término queda `FINALIZED` | Éxito reportado sin snapshots | F3 (B-3) |
| Snapshots creados uno a uno, sin transacción | Finalización no atómica | F3 (B-4) |

---

## 5. Dependencias descubiertas

1. **`isFailing` recibe contexto INSTITUCIONAL, no del grado.** `finalizeTerm` llama a
   `institutionContext.getContext(institutionId)` y `isFailing` decide con
   `ctx.academicStructure`. La estructura real es **por grado** (`Grade.academicStructure`).
   En una institución mixta —preescolar + primaria, como I.E.D. La Esperanza— el contexto
   institucional puede no corresponder al grado que se está evaluando. Caracterizado, **no corregido**.
2. **`getCompletenessStatus` pide un `_count` que nunca usa**: el conteo de estudiantes sale de
   la lista de matrículas, no del `_count` incluido en la consulta de grupos.
3. **C-4 son tres lugares, no uno**: `finalizeTerm`, `reSnapshotTerm` y la reconstrucción de
   `AcademicDataSourceService.getGroupReportCardData`. Sólo el primero quedó caracterizado.
4. **`closeTerm` depende por completo de `validateTermGrades`**: cambiar el universo o el
   predicado de uno cambia el portón de cierre del otro, para todas las instituciones.

---

## 6. Riesgos que permanecen

| # | Riesgo |
|---|---|
| 1 | **`buildGroupReportCards` sigue sin caracterizar.** Es el corazón del boletín y quedó sustituido por un doble. C-4 lo toca indirectamente |
| 2 | **`reSnapshotTerm` y `academic-data-source.service.ts` sin cobertura**, y C-4 debe modificarlos |
| 3 | Las pruebas son **unitarias con Prisma simulado**: fijan la lógica, no el SQL ni el comportamiento contra base real |
| 4 | **H-20 sigue abierto**: no se cierra por tener unitarias en verde |
| 5 | El cambio de universo `TeacherAssignment → EnrollmentSubject` **sigue siendo F4** y fuera de alcance; si se colara en C-1 movería las cifras de las 4 instituciones con datos reales |

---

## 7. Garantía de no intervención

**Cero escrituras sobre producción.** No se ejecutaron migraciones, `INSERT`, `UPDATE`, `DELETE`,
cierres, finalizaciones, generación de snapshots ni backfill. Las pruebas no tocan base de datos:
todo es Prisma simulado. **No se consultó producción en este paso.**

Intactos: las 12 filas huérfanas · las 15 valoraciones · la guarda de F1 · la migración
`20260816120000_evidence_logical_retirement` ya aplicada · el esquema.

> **Actualizado el 2026-08-17 — no altera lo hecho en F0.** Lo anterior describe el estado en la
> fecha de este paso. Después, y con autorización propia, las 12 huérfanas se eliminaron (quedan
> **0 huérfanas** y **3 `StudentEvidenceValuation` válidas**) y se aplicó la FK
> `StudentEvidenceValuation_achievementEvidenceId_fkey` con `ON DELETE RESTRICT` ·
> `ON UPDATE RESTRICT`. Estado actual: **C-1 ✅ · C-2 ✅ · C-4 ✅ · D-12 ✅ · F0 🟡 parcial ·
> F2 🟡 abierta**; C-1/C-2/C-4 **no desplegadas**.
> Ver `docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md`.

**Único archivo creado:** `apps/api/src/modules/reports/f0-baseline.spec.ts`. Ningún archivo de
producción modificado en este paso.

---

# AMPLIACIÓN PARA C-4 — 2026-08-16

Segunda tanda, autorizada exclusivamente para caracterizar C-4 **sin implementarlo**.
Archivo: `apps/api/src/modules/reports/c4-snapshot-baseline.spec.ts` · **18 pruebas**.

**C-4 sigue SIN IMPLEMENTAR. F0 sigue PARCIAL.**

## A-1. Componentes caracterizados

| Componente | Cobertura |
|---|---|
| `finalizeTerm` | Inventario **exacto** de las 18 claves del payload + ausencia de los tres campos |
| `reSnapshotTerm` | Payload completo · exigencia de `FINALIZED` · versión `max+1` · ventana `OPEN` temporal |
| `AcademicDataSourceService` | 10 pruebas: snapshot vs. vivo, reconstrucción de grupo, camino individual, snapshots históricos |
| `buildGroupReportCards` | **Sólo la pregunta de C-4** (de dónde sale `reportContent`), por caracterización estática + comportamiento del camino `FINALIZED`. **No se caracterizó el generador completo** — excede el alcance autorizado |

## A-2. Mapa de los tres campos

| Campo | `finalizeTerm` | `reSnapshotTerm` | En el snapshot | `AcademicDataSource` grupo | `AcademicDataSource` individual | `buildGroupReportCards` |
|---|---|---|---|---|---|---|
| `reportContent` | ❌ descarta | ❌ descarta | ausente | ❌ **ni lo reconstruye** | ✅ lo serviría (crudo) | ✅ lo produce (config **viva**) |
| `academicStructure` | ❌ descarta | ❌ descarta | ausente | ✅ lo lee → `undefined` | ✅ crudo | ✅ lo produce |
| `displayConfig` | ❌ descarta | ❌ descarta | ausente | ✅ lo lee → `undefined` | ✅ crudo | ✅ lo produce |

## A-3. Respuesta a la pregunta de C-4

> ¿El boletín final consume los datos congelados del snapshot o vuelve a consultar configuración viva?

**Ninguna de las dos.** En `OPEN`/`CLOSED` el generador consulta configuración **viva**
(`achievementConfig.findUnique` + `reportCardConfig.findUnique`) y `reportContent` llega al
consumidor. En `FINALIZED` **no se llama al generador** —luego no hay consulta viva— y el snapshot
**no contiene** el campo: el boletín finalizado simplemente **no recibe `reportContent`**.

## A-4. Hallazgo nuevo — C-4 tiene una asimetría no prevista

El plan asumía tres lugares a corregir. La caracterización revela un matiz que **cambia el alcance**:

- **`AcademicDataSourceService.getGroupReportCardData` omite `reportContent` de la reconstrucción.**
  Está demostrado con un snapshot que **sí** lo contiene: aun así no llega al consumidor. Corregir
  sólo los escritores (`finalizeTerm`, `reSnapshotTerm`) **no bastaría** para el camino de grupo.
- **`getStudentReportCardData` devuelve el snapshot crudo**, así que ese camino sí lo serviría.

→ Los dos caminos de boletín se comportarían distinto ante el mismo snapshot. **No corregido.**

## A-5. `[DEFECTO CONGELADO · C-4]`

| # | Defecto | Prueba |
|---|---|---|
| 1 | `finalizeTerm` descarta los tres campos aunque el generador los produce | A |
| 2 | `reSnapshotTerm` los pierde igual | B |
| 3 | **La reconstrucción de grupo omite `reportContent` aunque esté en el snapshot** | C |
| 4 | Snapshot histórico sin los tres → `undefined`, sin valor por defecto | C |
| 5 | En `FINALIZED` no hay ni configuración viva ni dato congelado | D |

Marcado aparte, **fuera de C-4**: `reSnapshotTerm` abre el período a `OPEN` y lo restaura a
`FINALIZED`; durante esa ventana cualquier escritura concurrente pasaría la guarda. Pertenece a F3.

## A-6. Qué sigue SIN cobertura

- `buildGroupReportCards` como generador completo (deliberado: excede F0-MÍNIMO).
- `getReportCardYear` (boletín multiperíodo), que mezcla snapshot y vivo período a período.
- Las plantillas del frontend, que son las consumidoras finales de `reportContent`.
- `RecoverySnapshotService`, que escribe snapshots `POST_RECOVERY` con su propio payload.

## A-7. Producción

**Cero migraciones, cero escrituras, cero consultas contra producción.** Todo con Prisma
simulado. Sin tocar lógica de producción: el único archivo creado es la spec.

---

# MAPA COMPLETO DE RUTAS DE LECTURA DEL SNAPSHOT — 2026-08-16

Tercera tanda de caracterización. Archivo: `apps/api/src/modules/reports/c4-read-routes.spec.ts`
· **11 pruebas**. **C-4 sigue SIN IMPLEMENTAR.**

## B-1. Hallazgo principal: no existe un contrato único de snapshot

**Tres escritores, dos formas de payload.** La ruta de lectura no distingue quién lo escribió.

| Escritor | `snapshotType` | `reportContent` | `academicStructure` | `displayConfig` |
|---|---|---|---|---|
| `finalizeTerm` | `INITIAL_CLOSE` | ❌ | ❌ | ❌ |
| `reSnapshotTerm` | `INITIAL_CLOSE` | ❌ | ❌ | ❌ |
| **`RecoverySnapshotService`** | `POST_RECOVERY` | ❌ | ✅ **sí** | ✅ **sí** |

**Consecuencia demostrada:** `loadSnapshotsForTerm` toma la última versión sin filtrar por tipo.
Un período que pasó por recuperación devuelve `academicStructure` y `displayConfig`; el mismo
período antes de la recuperación los devuelve `undefined`. **El boletín cambia de forma según si
hubo recuperación**, leyendo por la misma ruta.

## B-2. Mapa de rutas de lectura

| Ruta | Consumidor real | Del snapshot | Reconstruye | Config viva |
|---|---|---|---|---|
| `getStudentReportCardData` → `getReportCardData` | **el documento HTML de cada estudiante** (`reportsApi.getReportCard`) | **todo, crudo** | nada | sólo en `OPEN`/`CLOSED` |
| `getGroupReportCardData` → `generateBulkReportCards` | endpoint `/report-cards/bulk` — **declarado en `api.ts` pero sin consumidor en la UI** | campos enumerados | `academicStructure`, `displayConfig`, derivados con `?? null` | sólo en `OPEN`/`CLOSED` |
| `getGroupReportCardData` → `getGroupReportCardList` | **la tabla de estudiantes**, no el documento | ídem | ídem | ídem |
| `getReportCardYear` | plantilla `multiperiodo-tabular` | compone llamando a `getReportCardData` período a período | `academicStructure`/`displayConfig` **del último período** | por período |
| `getTermGradeData` | reportes analíticos | extrae `GradeRow` de `areaGrades` | — | — |
| `RecoverySnapshotService.compareSnapshots` | comparación inicial vs. post-recuperación | campos concretos, no los tres | — | — |

## B-3. Matriz de los tres campos por ruta de lectura

| Ruta | `reportContent` | `academicStructure` | `displayConfig` |
|---|---|---|---|
| Documento por estudiante (individual) | ✅ **lo serviría crudo** | ✅ crudo | ✅ crudo |
| Reconstrucción de grupo | ❌ **ni se contempla** | ✅ del snapshot | ✅ del snapshot |
| Multiperíodo | ❌ **nunca se devuelve** | ⚠️ sólo del **último** período | ⚠️ sólo del último período |
| Reportes analíticos | n/a | n/a | n/a |

## B-4. Buena noticia para C-4

**La ruta que genera el documento es la individual, y entrega el snapshot crudo.** Verificado en
`ReportCards.tsx`: `buildStudentHtml` usa `reportsApi.getReportCard` y `getReportCardYear`; el
camino de grupo sólo alimenta la tabla. Por tanto **congelar `reportContent` en los escritores
bastaría para que el documento por estudiante lo reciba**, sin depender de arreglar la
reconstrucción de grupo.

Las plantillas degradan a valores por defecto cuando falta: `const rc = data.reportContent || {}`
y `if (!cfg || blocks.length === 0)` → comportamiento histórico.

## B-5. Nuevos `[DEFECTO CONGELADO · C-4]`

| # | Defecto |
|---|---|
| 6 | `RecoverySnapshotService` escribe `academicStructure` y `displayConfig`; `finalizeTerm` y `reSnapshotTerm` no → **dos contratos de snapshot conviviendo** |
| 7 | Un período leído por la misma ruta cambia de forma **según si pasó por recuperación** |
| 8 | `getReportCardYear` **nunca** devuelve `reportContent`, ni siquiera con el período en vivo |
| 9 | En multiperíodo, `academicStructure` y `displayConfig` salen **sólo del último período**: si ése es un snapshot antiguo, se pierden aunque los períodos anteriores los tuvieran |

## B-6. Propuesta de implementación de C-4 — **no implementada**

Orden sugerido, de menor a mayor riesgo:

```
PASO 1 · Escritores — congelar los tres campos en el payload
   · finalizeTerm            → añadir reportContent, academicStructure, displayConfig
   · reSnapshotTerm          → idéntico (mismo payload)
   · RecoverySnapshotService → añadir sólo reportContent (ya guarda los otros dos)
   Efecto: el documento por estudiante queda correcto de inmediato (B-4).
   Riesgo: BAJO. Aditivo. Crece el JSON del snapshot.

PASO 2 · Reconstrucción de grupo
   · AcademicDataSourceService.getGroupReportCardData → incluir reportContent
   Riesgo: BAJO. Hoy ese camino no alimenta ningún documento (bulk sin consumidor).

PASO 3 · Multiperíodo
   · getReportCardYear → decidir de qué período salen los tres campos y propagarlos
   ⚠ DECISIÓN FUNCIONAL PENDIENTE: ¿los del período consultado, los del más reciente
     que los tenga, o uno por período? No está documentada. NO improvisar.

PASO 4 · Fallback permanente
   · Los 2 000 snapshots existentes no se reescriben. El lector debe conservar
     indefinidamente el degradado actual. Prohibido eliminarlo en un refactor futuro.
```

**Fuera del alcance de C-4, registrados:** unificar los dos contratos de snapshot en un único
constructor de payload (hoy hay tres copias del mismo objeto) y la ventana `OPEN` de
`reSnapshotTerm`. Ambos pertenecen a F3.

## B-7. Qué sigue sin cobertura

`buildGroupReportCards` como generador completo · las plantillas del frontend ejecutadas de
verdad (sólo se verificó su degradado por lectura de código) · `compareSnapshots`.

## B-8. Producción

**Cero migraciones, cero escrituras, cero consultas contra producción.** Ningún archivo de
producción modificado: el único creado es la spec.
