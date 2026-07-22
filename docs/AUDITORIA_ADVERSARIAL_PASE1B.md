# Auditoría Adversarial — Pase 1B: Cambio de Año + Inicio en Período ≠ 1 (carga masiva)

> Continuación de `AUDITORIA_ADVERSARIAL_PASE1.md`. Mismo método: auditoría de código real con evidencia `archivo:línea`, sin simulación fabricada.
> **Fecha:** 2026-07-21 · **Rama:** `staging`
> **Alcance:** los dos procesos más delicados según el rector — **cambio de año** (cierre→promoción→graduación→apertura) e **inicio de año en un período distinto al primero** (carga masiva de notas de períodos/años anteriores).

---

## Resumen ejecutivo

El **cierre de año** está bien diseñado en atomicidad (fase de cálculo en solo-lectura + fase de escritura en una sola transacción — `academic-year-lifecycle.service.ts:347-405`). Pero la **promoción y la graduación** tienen fallos graves: la secuencia de grados **no está filtrada por institución** (promoción cross-tenant), **no existe el estado de graduación** (los de último grado se re-matriculan en el mismo grado), y quien no tiene notas cargadas es **reprobado en silencio** — justo el caso de una institución que arranca a mitad de año.

La **carga masiva de notas confirma tu sospecha**: solo escribe en el **año ACTIVO**, no hay ruta para histórico multi-año; ignora la columna **DEFINITIVA** y recalcula la final como **promedio simple** (ignora los pesos del plan); y —lo más peligroso— acopla al import una **eliminación destructiva de estudiantes** guiada por *matching difuso de nombres*.

**Conteo:** 3 críticos · 6 altos · 4 medios.

---

# 🔴 Errores críticos

### YC-1 · Promoción cross-tenant: la secuencia de grados no filtra por institución

**Descripción.** El "siguiente grado" se calcula sobre **todos los grados de la base**, sin filtrar por institución:

```ts
// academic-year-lifecycle.service.ts:672-679 (promoteStudents) y 616-623 (previewPromotions)
const grades = await this.prisma.grade.findMany({
  select: { id: true, name: true, stage: true, number: true },   // ← SIN where institutionId
});
...
// getNextGradeFromSequence (599-607): ordena por stage+number GLOBAL y toma sorted[idx+1]
```

`getGradeOrder` = `stageOrder + number`. Si la Institución A y la B tienen ambas "Grado 6/7/8..." (lo normal), el arreglo ordenado **intercala grados de distintas instituciones** con el mismo orden. `sorted[currentIndex + 1]` puede devolver el grado de **otra institución**. Luego:

```ts
// promoteStudents:737-741
const targetGroup = await this.prisma.group.findFirst({ where: { gradeId: targetGradeId } });
// crea matrícula en ese grupo (749-762) → grupo de OTRA institución
```

**Reproducir.** Dos instituciones con la misma numeración de grados. Cierra y promueve el año de A. Para un estudiante de A en grado 6, `getNextGradeFromSequence` puede resolver al grado 7 (o 6) de B → el estudiante de A queda **matriculado en un grupo de la Institución B**.

**Impacto.** Estudiantes promovidos a grados/grupos de **otra institución**; mezcla catastrófica de datos entre tenants durante el proceso más crítico del año. Es la variante más grave del IDOR (C-1 del Pase 1) porque ocurre en escritura masiva automática.

**Riesgo.** Prob. alta en un SaaS con varias instituciones en la misma BD · Impacto crítico. **Prioridad P0.**

**Solución.** Filtrar `grade.findMany` por `institutionId` (el del año que se promueve) en `previewPromotions`, `promoteStudents` y donde se arme la secuencia. Idealmente, `getNextGradeFromSequence` debe recibir solo grados de esa institución. Añadir test que verifique que `targetGrade.institutionId === fromYear.institutionId`.

---

### YC-2 · La graduación no existe: el último grado se re-matricula en sí mismo

**Descripción.** `EnrollmentStatus` **no tiene estado `GRADUATED`** (`schema.prisma:73-79`: solo `ACTIVE/PROMOTED/REPEATED/WITHDRAWN/TRANSFERRED`). No hay lógica de graduación en el código (grep `graduat` solo aparece en una categoría de finanzas). En `promoteStudents`, un estudiante de último grado (11º/MEDIA) que aprueba recibe `PROMOTED`, y como no hay grado siguiente:

```ts
// promoteStudents:728-733
const nextGrade = this.getNextGradeFromSequence(...);  // null en el último grado
targetGradeId = nextGrade?.id || oldEnrollment.group.gradeId;  // ← cae al MISMO grado
```

→ El graduando queda **re-matriculado en 11º otra vez** en el año nuevo.

**Reproducir.** Promueve un año con estudiantes de grado 11. En el año destino aparecen matriculados de nuevo en grado 11.

**Impacto.** No hay egresados/graduados; los de último grado ensucian el año siguiente ocupando cupos de 11º; imposible generar actas de graduación, diplomas o reportes de egreso correctos (Escenario 8/16). Es un proceso **incompleto**, no solo un bug.

**Riesgo.** Prob. alta (todo colegio gradúa cada año) · Impacto alto. **Prioridad P1.**

**Solución.** Añadir estado `GRADUATED` (y `PROMOTED_COMPLETED`/egreso) al enum; en promoción, si el grado actual es terminal (sin siguiente en la secuencia de SU institución) y aprueba → `GRADUATED`, y **excluirlo** de `promoteStudents`. Registrar `EnrollmentEvent` de graduación para el histórico.

---

### BI-3 · La carga masiva de notas puede BORRAR estudiantes reales (y acudientes/documentos)

**Descripción.** `importGrades` con `deactivateMissingStudents: true` toma **todo estudiante del grado que no fue emparejado en el Excel** y lo pasa por `deactivateOrDeleteStudent` (`grades-bulk-import.service.ts:348-366`). Ese método **hace HARD DELETE** del estudiante, sus matrículas, **acudientes, documentos**, observaciones y planes de apoyo si aún no tiene notas/asistencia:

```ts
// deactivateOrDeleteStudent:941-960
await tx.studentGuardian.deleteMany({ where: { studentId } });
await tx.studentDocument.deleteMany({ where: { studentId } });
await tx.studentEnrollment.deleteMany({ where: { studentId } });
...
await tx.student.delete({ where: { id: studentId } });
```

El emparejamiento es **difuso** (documento exacto → nombre exacto → Levenshtein, `findBestStudentMatch:1272-1295`). Si el Excel trae un nombre con otra grafía o sin documento, el estudiante real **no matchea** → se elimina.

**Reproducir.** Import de notas de un grado con `deactivateMissingStudents` activado y un Excel al que le falta 1 estudiante (o con su nombre mal escrito). Ese estudiante real, si aún no tiene notas cargadas, se **borra físicamente** junto con sus acudientes y documentos.

**Impacto.** Pérdida irreversible de estudiantes matriculados por un proceso que se supone solo carga notas. Foot-gun de máxima gravedad; el preview solo advierte "serán eliminados" sin transmitir que es un borrado físico en cascada.

**Riesgo.** Prob. media-alta (Excels imperfectos son la norma) · Impacto crítico. **Prioridad P0/P1.**

**Solución.** Desacoplar por completo el borrado de estudiantes del import de notas. Como mucho, marcar "no aparece en el Excel" para revisión manual. Nunca hard-delete desde un import; nunca borrar acudientes/documentos como efecto de cargar notas. Si se mantiene, exigir confirmación explícita por estudiante y solo soft-delete.

---

# 🟠 Riesgos altos

### YC-3 · La promoción vuelca a todos en el primer grupo del grado (pierde secciones A/B/C)

**Descripción.** `promoteStudents:737` elige el grupo destino con `group.findFirst({ where: { gradeId } })` — **sin `orderBy`, sin capacidad, sin jornada, sin continuidad de sección**. Todos los promovidos de un grado caen en el **mismo** grupo (el primero que devuelva Postgres).

**Impacto.** 1.500 estudiantes / 45 grupos → al promover, cada grado colapsa en un solo grupo; se pierde la organización A/B/C, se ignoran cupos y jornada (aunque copia `shift` a la matrícula, el grupo elegido puede ser de otra jornada). Caos operativo de reorganización manual.
**Riesgo.** Prob. alta · Impacto alto. **Prioridad P1.**
**Solución.** Mapear grupo origen→destino (preservar sección/jornada), respetar capacidad y permitir override manual en el asistente de promoción.

### YC-4 · Estudiante sin notas cargadas → reprobado en silencio (crítico para inicio a mitad de año)

**Descripción.** En `buildPromotionAssessment`, si no hay notas válidas: `finalAverage = 0` y todas las materias con nota `null` cuentan como perdidas (`:557-564`). El motor lo marca `NOT_PROMOTED`. El flag `hasAcademicData` se calcula (`:583`) **pero `computePromotions` no lo usa** (`:498-500`): igual escribe `REPEATED`.

**Reproducir.** Cierra un año donde algunos estudiantes no tienen notas (matriculados tarde, o **institución que adoptó Edusyn a mitad de año y no alcanzó a cargar todo el histórico**). Todos ellos quedan `REPEATED` sin aviso.
**Impacto.** Reprobación masiva injusta por *ausencia de datos*, no por desempeño. Golpea exactamente el escenario "inicio en período ≠ 1".
**Riesgo.** Prob. alta en onboarding · Impacto alto. **Prioridad P1.**
**Solución.** Usar `hasAcademicData`: sin datos → excluir de la promoción automática y marcar `PENDING_REVIEW` (revisión manual), nunca `REPEATED` automático.

### BI-1 · La carga masiva no cubre AÑOS anteriores (confirma tu sospecha)

**Descripción.** `importGrades` fuerza el **año ACTIVO** (`getActiveAcademicYear`, `:203,788-801`) y ata las notas a `TeacherAssignment` de ese año. No hay parámetro de `academicYearId` histórico ni ruta para cargar años cerrados anteriores. Para **períodos previos del año activo** sí sirve (se importa término por término), pero **no existe** forma de cargar el histórico de años pasados (boletines/promociones previas) al adoptar el sistema.
**Impacto.** Una institución nueva no puede reconstruir su histórico multi-año; las consultas históricas y las actas de años anteriores quedan vacías.
**Riesgo.** Prob. alta en onboarding · Impacto alto. **Prioridad P1.**
**Solución.** Diseñar una ruta explícita de **importación histórica** (año + período + nota definitiva por materia) que escriba `PeriodFinalGrade`/histórico sin depender de asignaciones docentes vivas del año activo.

### BI-2 · La columna DEFINITIVA se ignora; la final se recalcula como promedio simple (3ª fórmula)

**Descripción.** `readStudentsFromSheet` lee `definitiva` (`:645`) pero `upsertPartialGrades` solo escribe COG/PROC/ACT (`:1024-1028`) y `recomputePeriodFinalGrade` promedia **simple** las 3 (`:1093-1095`) — **ignora los pesos del plan** (40/40/20). Es una **tercera implementación** de la fórmula de nota final, inconsistente con `partial-grades.service` y `student-grades.service` (ambas ponderadas).
**Reproducir.** Importa COG=5, PROC=1, ACT=1 con plan 40/40/20. La final importada = (5+1+1)/3 = **2.3**; el motor normal daría 0.4·5+0.4·1+0.2·1 = **2.6**. Divergen.
**Impacto.** Las notas finales importadas **no coinciden** con las que el motor calcula para los mismos componentes; si solo se tiene la DEFINITIVA del período anterior, no hay forma de cargarla (se descarta).
**Riesgo.** Prob. alta · Impacto alto. **Prioridad P1.**
**Solución.** Unificar en el motor ponderado único; permitir importar la DEFINITIVA como override de `PeriodFinalGrade` (con `isManualOverride`) cuando no se tengan los componentes.

### BI-7 · `parseGrade` no valida rango: acepta 50, -3, 999 como nota

**Descripción.** `parseGrade:676-680` solo hace `parseFloat` + redondeo; **no valida contra la escala** (min/max) de la institución. Un typo "50" (por 5.0), un "-3" o un "999" entran tal cual.
**Impacto.** Notas inválidas rompen promedios, clasificación de desempeño y promoción (Escenario 5: nota máxima/mínima/inválida). Un "50" en una materia dispara el promedio y "aprueba" cualquier cosa.
**Riesgo.** Prob. media-alta (errores de digitación en Excel) · Impacto alto. **Prioridad P1.**
**Solución.** Validar cada nota contra `[minScore, maxScore]` de la escala institucional; rechazar/marcar la fila y reportarla en `errors`, no importarla en silencio.

### BI-8 · [RIESGO — no confirmado] Detección de columnas heurística: posible desalineación de notas

> ⚠️ **Esto es un riesgo a validar, no un bug confirmado.** No tengo evidencia de que ocurra hoy; requiere reproducirlo con archivos Excel reales (fixtures). Se documenta como hipótesis de alto impacto, no como defecto demostrado.

**Descripción.** `detectColumnStructure` es un conjunto de heurísticas con **nombres de asignatura hardcodeados** (`'MATEMATICAS','ESTADISTICA','LENGUAJE'`, `:530`) y múltiples fallbacks para inferir qué columna es COG/PROC/ACT/DEF y a qué asignatura pertenece. La **hipótesis** es que un Excel con estructura ligeramente distinta a la plantilla podría asociar notas a la asignatura equivocada sin lanzar error. **Falta comprobarlo.**
**Impacto potencial (si se confirma).** Notas correctas en la asignatura incorrecta → promoción/boletín equivocados, difícil de detectar.
**Prioridad.** P2 hasta confirmar con fixtures; si se reproduce, sube a P1.
**Cómo validarlo (Pase 2).** Reunir 3–5 Excel reales de distintas instituciones/plantillas y correr `detectColumnStructure` sobre ellos comparando la asignatura detectada vs la esperada.
**Solución (si se confirma).** Plantilla con estructura fija y verificable (marcadores/IDs de columna ocultos) y validación estricta que **rechace** el archivo si no calza, en vez de adivinar.

---

# 🟡 Riesgos medios

### YC-5 · "Promoción con pendientes" (AT_RISK) se colapsa a PROMOTED y se pierde qué materias quedaron debiendo
`computePromotions:499` hace `shouldPromote = status !== 'NOT_PROMOTED'`, así que `AT_RISK` (promueve con 1-2 materias perdidas dentro del límite) se guarda como `PROMOTED` sin registrar **cuáles** materias quedan pendientes. La obligación de nivelación/recuperación en el año siguiente **se pierde**. **Prioridad P2.** Solución: persistir las materias pendientes (p. ej. `FinalRecoveryPlan` o campo en la matrícula nueva) al promover con AT_RISK.

### YC-6 · `promoteStudents` no es transaccional
Bucle de `create` (`:710-780`) sin `$transaction`. Ante fallo a mitad, quedan matrículas del año nuevo creadas a medias. El `existingEnrollment` (713) da idempotencia parcial y el unique `studentId_academicYearId` evita duplicados, pero no hay rollback. **Prioridad P2.** Solución: envolver en transacción o hacerlo reintentable por lotes con marca de progreso.

### BI-5 · `syncStudentIdentity` sobrescribe el documento del estudiante por match difuso de nombre
Si el estudiante se emparejó por **nombre** y el documento del Excel difiere, `syncStudentIdentity:844-880` **cambia el `documentNumber`** del estudiante real (salvo colisión). Un match difuso equivocado corrompe la identidad legal del estudiante. **Prioridad P2.** Solución: nunca reescribir el documento por match de nombre; solo permitir corrección de documento con match exacto y confirmación.

### BI-6 · Re-matrícula mueve de grupo por match difuso
`reEnrollStudent:1880-1922` cambia el `groupId` del estudiante si `findBestGroupMatch` (difuso, `:1163-1204`) devuelve un grupo. Un código de grupo ambiguo ("7A" vs "septimo a") puede mover al estudiante al grupo equivocado en silencio. **Prioridad P2.**

---

# ✅ Lo que está bien (para no romperlo)

- **Cierre atómico (G-2):** `closeYear` calcula en solo-lectura y escribe promociones + cierre en **una sola transacción** con timeout (`:347-405`). Correcto y robusto ante caídas.
- **Guarda de recuperaciones finales:** no deja cerrar el año con `FinalRecoveryPlan` sin decidir (`validateYearForClosure:411-457`).
- **Validación de activación:** exige períodos, escala de desempeño y grupos antes de activar; distingue bloqueantes de advertencias (`validateYearForActivation:279-322`).
- **`guardTermNotFinalized`** en el import respeta períodos finalizados (`:377-388`).

---

# 🧩 Ajuste al hallazgo A-1 del Pase 1 (renormalización) — feedback incorporado

La observación externa es correcta: **renormalizar no es un bug per se**; mostrar `5.0` como nota provisional cuando solo se evaluó el componente cognitivo es válido **durante el período**. El defecto real es que:
1. Hoy **no se distingue** una nota provisional (faltan componentes) de una definitiva — ni en el dato ni en la UI.
2. En el **cierre** no se **exige 100% de componentes/períodos**: el anual se computa sobre pesos parciales y puede promover mal (ligado a YC-4).

**Recomendación afinada:** marcar la nota como *provisional* mientras falten componentes (badge "NOTA PROVISIONAL — faltan componentes") y, en el cierre de período/año, **bloquear o advertir fuerte** si no está el 100% del peso. Convertirlo en política institucional explícita, no comportamiento implícito.

---

# 📋 Qué falta validar (Pase 2, requiere entorno vivo)

- Ejecutar un **cierre+promoción real** en staging con 2 instituciones para confirmar YC-1 (cross-tenant) end-to-end.
- **Fixtures de Excel** reales para medir el alcance de BI-8 (columnas mal alineadas) y BI-2 (divergencia de definitiva).
- **Consultas históricas** post-cambio de año: nota → boletín → PDF → histórico → consulta (integridad de la cadena, sugerido por la revisión externa).
- **Reingreso/traslado** (`TRANSFERRED`/`REENTRY`) en el cambio de año — no auditado aún.

---

*Fin del Pase 1B. Cada hallazgo tiene evidencia `archivo:línea` verificable en `staging`. Prioridad de arranque sugerida: YC-1 y BI-3 (destrucción de datos) antes que cualquier otra cosa.*
