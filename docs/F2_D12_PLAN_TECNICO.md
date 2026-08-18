# F2 · D-12 — Plan técnico previo a la implementación

> **Análisis técnico. No se implementó nada.** Sin cambios de código, esquema, migraciones, datos ni UI.
> D-12 permanece **DECISIÓN PROPUESTA — PENDIENTE DE APROBACIÓN** y **no implementada**.
> F1 permanece **CERRADA e intacta**. Las 12 filas huérfanas no se tocaron.

Fecha: 2026-08-16 · Rama `main` · Precede a `docs/PLAN_TRANSICION_CORRECCION_Y_DISENO.md` §13 (F2)

---

## A. ARQUITECTURA ACTUAL RELEVANTE

```
Subject (subjectType = PRESCHOOL_DIMENSION)                    ← dimensión
 └── Achievement  (gradeId + subjectId + academicYearId,       ← propósito, ANUAL
      │            teacherAssignmentId = null,
      │            academicTermId = null)
      └── AchievementEvidence (id, text, orderNumber, isActive) ← imprescindible, ANUAL
           └── StudentEvidenceValuation                         ← valoración, POR PERÍODO
               (studentEnrollmentId, achievementEvidenceId, academicTermId)
               @@unique([studentEnrollmentId, achievementEvidenceId, academicTermId])
               ⚠ SIN relaciones Prisma — todos los vínculos son escalares
```

Selector de modo: `AchievementConfig.valuationScope` (`PURPOSE` \| `EVIDENCE`), por institución,
efectivo sólo cuando `Grade.academicStructure = DIMENSIONS`.

---

## B. FLUJO ACTUAL DE `AchievementEvidence`

### B.1 Escritores (6 puntos, todos en `achievement.service.ts`)

| Línea | Método | Operación | ¿Preserva id? |
|---|---|---|---|
| `:314` | `createCatalogAchievement` | `create` anidado | n/a (nuevas) |
| `:400` | `createAchievement` | `create` anidado | n/a (nuevas) |
| `:~440` | `reconcileEvidences` (F1) | `update` / `create` / `deleteMany` | **Sí** |
| `:457` | `createEvidence` | `create` | n/a |
| `:573` | `updateEvidence` | `update` (`text`, `isActive`) | **Sí** |
| `:583` | `deleteEvidence` | `delete` — **con guarda F1** | n/a |
| `:669` | `duplicateAchievement` | `create` (copia, incluye `isActive`) | n/a |

### B.2 Lectores y filtro `isActive` — **el hallazgo central**

`isActive` se respeta en **exactamente 2 de 8 lecturas**, y ambas están en el boletín.

| Línea | Lectura | ¿Filtra `isActive`? | Impacto de D-12 |
|---|---|---|---|
| `achievement.service.ts:76` | `getAchievementsByAssignment` → **planilla del docente** | ❌ **NO** | **H-18** |
| `achievement.service.ts:270` | `getCatalogAchievements` → **catálogo del admin** | ❌ NO | **Debe seguir así** (ver E.3) |
| `achievement.service.ts:403,429,638,672` | Retornos de create/update/duplicate | ❌ NO | Cosmético |
| `reports.service.ts:2894` | `StudentAchievement.achievement.evidences` (modo **PURPOSE**) | ✅ **SÍ** | Fuera de alcance (PURPOSE) |
| `reports.service.ts:2973` | Catálogo del **modo EVIDENCE** → boletín | ✅ **SÍ** | **H-20 — retiro retroactivo** |

---

## C. FLUJO ACTUAL DE `StudentEvidenceValuation`

| Línea | Método | Operación |
|---|---|---|
| `achievement.service.ts:167` | `getEvidenceValuationsByAssignment` | `findMany` por matrículas del grupo + período. ⚠ **no filtra `status: 'ACTIVE'`** (H-12) |
| `achievement.service.ts:186` | `upsertEvidenceValuation` | `upsert`. ⚠ **no valida `isActive`** (H-19) · **no valida estado del período** |
| `achievement.service.ts:213` | `deleteEvidenceValuation` | `deleteMany` |
| `achievement.service.ts:500` | `reconcileEvidences` (F1) | `findMany` — guarda de integridad |
| `achievement.service.ts:603` | `deleteEvidence` (F1) | `count` — guarda de integridad |
| `reports.service.ts:2984` | Boletín EVIDENCE | `findMany` |

**Endpoints:** `GET|PUT|DELETE /achievements/evidence-valuations`, roles `SUPERADMIN, ADMIN_INSTITUTIONAL, COORDINADOR, DOCENTE`.

### C.1 Cómo se determina el período de una valoración

`academicTermId` es **explícito**, enviado por el cliente en cada `upsert` y almacenado en la fila.
No se deriva de fechas ni del término del propósito. Es un dato de primera clase y forma parte
de la clave única. **Esto es lo que hace computable la regla de vigencia de D-12.**

### C.2 Dato crítico para la estabilidad de la regla derivada

- `DELETE /achievements/evidence-valuations` **no tiene consumidor en el frontend**:
  `apps/web/src/lib/api.ts` sólo expone `getEvidenceValuations` y `upsertEvidenceValuation`.
- `Grades.tsx:1237` omite las entradas sin nivel (`if (!g || !g.levelCode) continue`) en lugar de
  borrarlas.

→ **Hoy ninguna acción de la aplicación borra valoraciones.** Una vez creada, la fila persiste.
El endpoint existe y es invocable por cualquier `DOCENTE`, pero no se usa.

---

## D. FLUJO ACTUAL DEL CATÁLOGO

```
PreschoolCatalog.tsx
  ├─ GET  /achievements/catalog          → getCatalogAchievements(:263)
  │        where { institutionId, gradeId, subjectId, academicYearId,
  │                academicTermId: term ?? null, teacherAssignmentId: null,
  │                isPromotional: false }
  │        include { evidences: { orderBy: orderNumber } }   ← SIN filtro isActive
  ├─ POST /achievements/catalog          → createCatalogAchievement
  ├─ PUT  /achievements/:id              → updateAchievement → reconcileEvidences
  └─ DEL  /achievements/:id              → deleteAchievement
```

Permiso de escritura: `canManageCatalog(req)` — chequeo de **rol**
(`SUPERADMIN|ADMIN_INSTITUTIONAL|COORDINADOR`), no de `learningCatalogMode` (que sigue inerte).

---

## E. FLUJO ACTUAL DE `reconcileEvidences` (F1)

### E.1 Algoritmo

```
1. items = payload filtrado (texto no vacío, trim)
2. existing = findMany({ achievementId }) ordenado por orderNumber
3. Para cada item, en orden:
     a. id conocido y no emparejado  → UPDATE si cambió texto u orden
     b. sin id → empareja por TEXTO EXACTO con una existente libre
     c. sin coincidencia            → CREATE
4. removed = existentes no emparejadas
5. Si removed tiene valoraciones → ConflictException, CERO escrituras
6. Aplica update/create/deleteMany en $transaction
```

### E.2 Propiedades relevantes para D-12

- El plan se calcula **completo antes de escribir**: un guardado bloqueado no queda a medias.
- **No conoce `isActive`.** Trata activas y retiradas por igual.

### E.3 ⚠ Punto de colisión con D-12

Si el catálogo dejara de enviar las evidencias retiradas, `reconcileEvidences` las vería como
`removed` → tendrían valoraciones → **`ConflictException` en cada guardado**. El administrador
quedaría bloqueado para editar cualquier propósito que tenga una evidencia retirada.

**Regla de diseño obligatoria:** las evidencias retiradas **siguen viajando en el catálogo y en
el payload**. `getCatalogAchievements` **no debe** filtrar `isActive`.

---

## F. FLUJO ACTUAL DEL BOLETÍN EVIDENCE

```
buildGroupReportCards (reports.service.ts)
 :2930  reportContent.valuationScope ← AchievementConfig
 :2958  evidenceMode = valuationScope === 'EVIDENCE' && gradeStructure === 'DIMENSIONS'
 :2964  catálogo del grado: achievement.findMany({ gradeId, academicYearId,
          teacherAssignmentId: null, OR: [{academicTermId}, {academicTermId: null}] })
          include { evidences: { where: { isActive: true } } }        ← H-20
 :2984  studentEvidenceValuation.findMany({ enrollmentIds, academicTermId, evidenceIds })
 :3309  buildLearningBlocks rama evidenceMode →
          { learning, evidences[], evidenceItems: [{text, level}], performanceLevel: null }
 ↓
reportCardTemplates.ts:499  fila por propósito (sin nivel) + fila por imprescindible (con nivel)
```

**H-20 en detalle:** el filtro `isActive: true` se aplica al **catálogo**, que es la fuente de las
filas del boletín. Una evidencia retirada desaparece de la tabla **en todos los períodos vivos**,
incluidos aquellos donde fue evaluada. El retiro sería **retroactivo**.

Los períodos `FINALIZED` están a salvo: `AcademicDataSourceService` sirve el snapshot congelado y
nunca vuelve a ejecutar esta consulta.

---

## G. FLUJO ACTUAL DE COMPLETITUD

**No existe para el modo EVIDENCE.** Verificado: `reports.service.ts` referencia
`studentEvidenceValuation` **una sola vez**, en la línea 2984 (boletín).

`getCompletenessStatus` mide dos ejes —`PeriodFinalGrade` y `StudentAchievement`— y este último
exige `achievement.teacherAssignment.{groupId, academicYearId}`, que el catálogo compartido no
tiene (`teacherAssignmentId = null`). **Transición reporta 0 %/0 % siempre** (C-2), y en modo
EVIDENCE ni siquiera hay eje que medir.

→ La regla de completitud de D-12 **no tiene hoy dónde aplicarse**. Es F4 quien la consumirá.
D-12 debe dejarla *especificada*, no implementada.

---

## H. FLUJO ACTUAL DE `FINALIZED`

Guardas de escritura existentes en todo `apps/api/src` — **tres, todas cuantitativas**:

```
partial-grades.service.ts:24       if (term?.status === 'FINALIZED') throw
period-final-grades.service.ts:18  if (term?.status === 'FINALIZED') throw
evaluation-plans.service.ts:28     if (term?.status === 'FINALIZED') throw
```

**`achievement.service.ts` no tiene ninguna guarda de estado de período.** Su único
`academicTerm.findUnique` (`:373`) es para generar el código del logro, no para proteger.

→ Hoy se puede retirar una evidencia, crear un propósito o valorar en un período `FINALIZED`.
`CLOSED` no bloquea nada en ningún modelo.

---

## I. AUDITORÍA ACTUAL

`GradeAuditService` (`evaluation/grade-audit.service.ts`):

- API: `record(event, actor)` / `recordMany(events, actor)`
- Campos: `institutionId`, `source` (default `'PARTIAL_GRADE'`), `action` (`CREATE|UPDATE|DELETE`),
  actor (`userId`, `name`, `role`), contexto (`partialGradeId`, `studentEnrollmentId`,
  `teacherAssignmentId`, `academicTermId`, `componentType`, `activityIndex`, `activityName`),
  valores (`previousScore`, `newScore`, `previousValue: Json`, `newValue: Json`)
- **Política de diseño a preservar:** atrapa sus propios errores y sólo loguea
  (`:69`, *"auditar NUNCA debe romper el guardado de la nota"*).

**Único escritor:** `partial-grades.service.ts` (6 llamadas). `source` **nunca se pasa** → el
100 % de los eventos es `PARTIAL_GRADE`. El campo está preparado y sin usar.

### I.1 Estructura propuesta para E-5 (no implementar)

| Campo | Valor para retiro/reactivación |
|---|---|
| `source` | `'ACHIEVEMENT_EVIDENCE'` |
| `action` | `UPDATE` (retiro y reactivación son transiciones de estado, no altas ni bajas) |
| `institutionId` | el del `Achievement` padre |
| `academicTermId` | período en curso al momento de la acción (contexto, no alcance) |
| `activityName` | texto de la evidencia (legible en el visor sin joins) |
| `previousValue` | `{ evidenceId, achievementId, isActive: true, valuationCount: N }` |
| `newValue` | `{ evidenceId, achievementId, isActive: false, reason }` |
| actor | usuario que ejecuta |

`partialGradeId`, `componentType`, `activityIndex` quedan `null`. **No requiere cambio de esquema:**
`GradeAuditEvent` ya tiene todos los campos necesarios, incluidos los `Json` libres.

---

## J. VIABILIDAD DE D-12 SIN CAMBIO DE ESQUEMA — **ANÁLISIS CRÍTICO**

### J.0 ¿Es computable la regla?

**Sí.** `StudentEvidenceValuation` almacena `achievementEvidenceId` **y** `academicTermId` como
columnas propias e indexadas. El conjunto de períodos vigentes de una evidencia es directo:

```sql
SELECT DISTINCT "academicTermId" FROM "StudentEvidenceValuation"
WHERE "achievementEvidenceId" = $1
```

**Verificación pedida explícitamente:** ¿existe algún caso en que una evidencia tenga valoraciones
en un período y el sistema no permita reconstruir ese período de forma segura?
**NO.** El `academicTermId` es explícito, obligatorio, y forma parte de la clave única. La
reconstrucción es directa y no depende de fechas, de joins ni del término del propósito. Las 12
filas huérfanas apuntan a ids de evidencias muertas y por tanto **nunca** se atribuyen a una
evidencia viva: no contaminan el cálculo.

### J.1 ⚠ Ambigüedad irreducible

El modelo **no puede distinguir**:

- «la evidencia estuvo vigente en el período P y todavía nadie la valoró» → 0 filas
- «la evidencia no estuvo vigente en el período P» → 0 filas

Ambos son indistinguibles. Consecuencias:

- En un período **OPEN** es benigno: retirar significa precisamente «deja de exigirse ya».
- En un período **CLOSED/FINALIZED** que se hubiera cerrado sin valoraciones de esa evidencia,
  retirarla la borraría del histórico vivo. Hoy el riesgo es bajo —C-1 impide cerrar períodos con
  grupos `DIMENSIONS`— pero el modelo no lo previene por sí mismo.

**Ningún código puede resolver J.1 con el esquema actual. Es estructural.**

### J.2 ⚠ Inestabilidad de la regla derivada

La vigencia depende de datos mutables: borrar la última valoración de un período haría desaparecer
la evidencia de ese período retroactivamente.

**Mitigante fuerte y verificado:** hoy nada en la aplicación borra valoraciones (§C.2). El endpoint
`DELETE /achievements/evidence-valuations` existe y está expuesto a `DOCENTE`, pero **no tiene
consumidor**. El riesgo es latente, no activo.

### J.3 Alcance de la vigencia: por grado, no por grupo

El catálogo es compartido (`gradeId + subjectId + academicYearId`). «Al menos una valoración en el
período» agrega **todos los grupos del grado**. Si TRANSICIÓN A valoró y TRANSICIÓN B no, el período
queda vigente para ambos y B la ve como pendiente. Es coherente con la regla aprobada («la unidad
es el período, no el estudiante»), pero conviene declararlo: **la vigencia es por grado**.

### J.4 Veredicto

> **D-12 ES implementable sin tocar Prisma** y cubre correctamente todos los casos operativos
> reales del catálogo anual. **Pero la regla derivada no es inequívoca**: J.1 es una ambigüedad
> estructural y J.2 una inestabilidad latente.

### J.5 Recomendación — **APROBADA el 2026-08-16.** Ver §Q para el diseño definitivo

> ⚠ **La verificación posterior a la aprobación obligó a corregir la columna concreta.**
> `retiredAt` como *timestamp* no puede resolver «desde qué período», porque
> **7 de 17 períodos en producción (41 %) tienen `startDate`/`endDate` en `NULL`**.
> El diseño definitivo, con la columna correcta, está en **§Q**.

F2 **ya incluye una migración**: la FK de `StudentEvidenceValuation`. Añadir en esa misma migración
una columna nullable en `AchievementEvidence`:

```
retiredAt  DateTime?     // null = activa
```

- Elimina **J.1 y J.2 de raíz**: la vigencia pasa de proxy a dato declarado
  («el período comenzó antes del retiro»).
- Hace `isActive` derivable (`retiredAt == null`), evitando dos fuentes de verdad para el
  mismo estado — el patrón de duplicidad que la auditoría encontró seis veces.
- Coste marginal: cero migraciones adicionales.

**No lo doy por decidido.** D-12 fue propuesta como solución sin esquema; esto la modificaría.
Si prefiere mantenerla sin cambio de esquema, la implementación de §N sigue siendo válida con la
ambigüedad J.1 documentada y aceptada.

---

## K. ARCHIVOS A MODIFICAR

| # | Archivo | Cambio |
|---|---|---|
| K-1 | `apps/api/src/modules/achievements/achievement.service.ts` | Filtrar `isActive` en `getAchievementsByAssignment` (**H-18**) · validar `isActive` + vigencia en `upsertEvidenceValuation` (**H-19**) · métodos `retireEvidence` / `reactivateEvidence` · `reconcileEvidences` consciente de retiradas · ganchos de auditoría |
| K-2 | `apps/api/src/modules/achievements/achievement.controller.ts` | `PUT /achievements/evidences/:id/retire` y `/reactivate` (acciones explícitas, no un booleano en el formulario) |
| K-3 | `apps/api/src/modules/reports/reports.service.ts` | **Sólo la línea 2973**: sustituir `where: { isActive: true }` por la regla de vigencia por período (**H-20**) |
| K-4 | `apps/web/src/lib/api.ts` | Clientes de retirar/reactivar |
| K-5 | `apps/web/src/components/achievements/PreschoolCatalog.tsx` | Estado visual «Retirada», acciones Retirar/Reactivar, seguir enviando las retiradas en el payload |
| K-6 | `apps/web/src/pages/Achievements.tsx` | Igual, en la vista de evidencias del docente |
| K-7 | `apps/api/src/modules/achievements/*.spec.ts` | Pruebas nuevas (§O) |

`apps/web/src/pages/Grades.tsx` **no debería requerir cambios** si K-1 filtra en el backend:
`evidenceIndicators` se construye desde `achievementsApi.getByAssignment`. Confirmar en la
implementación; si hace falta, es un ajuste de una línea.

## L. ARCHIVOS QUE NO DEBEN MODIFICARSE

| Archivo / zona | Motivo |
|---|---|
| `apps/api/prisma/schema.prisma` | Sin cambio de esquema en este paso (salvo aprobación de J.5) |
| `partial-grades.service.ts`, `period-final-grades.service.ts`, `evaluation-plans.service.ts` | Cuantitativo |
| `performance-scale.*`, `academic-rules.engine` | Escala y reglas cuantitativas |
| `academic-data-source.service.ts` | Agnóstico de modalidad; no requiere cambios |
| `reports.service.ts` — `validateTermGrades`, `closeTerm`, `finalizeTerm`, `getCompletenessStatus`, `buildGroupReportCards` (salvo la línea 2973) | Fases posteriores; sin cobertura de pruebas |
| `reportCardTemplates.ts` | La plantilla ya consume `evidenceItems` del payload; si el backend entrega el conjunto correcto, no cambia |
| `recovery/*`, `ConvivenciaEntry`, `StudentAchievement` (modo PURPOSE) | Fuera de alcance |
| Las 12 filas huérfanas | Se conservan |
| `deleteEvidence` — guarda de F1 | **Intocable** |

---

## M. RIESGOS Y CASOS LÍMITE

| # | Riesgo | Mitigación |
|---|---|---|
| M-1 | Ocultar retiradas del catálogo rompe `reconcileEvidences` (§E.3) | Regla de diseño: el catálogo **siempre** las envía |
| M-2 | Ambigüedad «vigente sin valorar» (J.1) | Documentar, o aprobar J.5 |
| M-3 | Borrado de la última valoración de un período (J.2) | Aplicar la guarda de retiro también a `deleteEvidenceValuation` |
| M-4 | `getEvidenceValuationsByAssignment` no filtra `status: 'ACTIVE'` (H-12) | Corregir en el mismo paso; es de una línea |
| M-5 | Retirar en período `FINALIZED` sin reapertura | La guarda de estado es F3; hasta entonces, restringir el retiro por rol |
| M-6 | `duplicateAchievement` copia `isActive` | Una copia nueva debería nacer activa. Revisar |
| M-7 | Modo PURPOSE usa `isActive` en `:2894` con otra semántica | **No tocar esa línea.** D-12 aplica a EVIDENCE |
| M-8 | Vigencia por grado, no por grupo (J.3) | Declararlo en la UI del catálogo |

---

## N. PLAN DE IMPLEMENTACIÓN DE F2 · D-12 (por pasos, no ejecutado)

```
PASO 1 · Bloquear valoraciones sobre evidencias retiradas   [IMPACTO CUANTITATIVO: NINGUNO]
   K-1: getAchievementsByAssignment filtra isActive           → H-18
   K-1: upsertEvidenceValuation valida isActive               → H-19
   K-1: deleteEvidenceValuation con la misma guarda           → M-3
   K-1: getEvidenceValuationsByAssignment filtra ACTIVE       → M-4
   Sin este paso, "retirada" no significa nada.

PASO 2 · Corregir la retroactividad del boletín              [IMPACTO CUANTITATIVO: NINGUNO]
   K-3: línea 2973 — de `isActive: true` a la regla de vigencia por período  → H-20
   Sin este paso, retirar borra historia viva.

PASO 3 · Acciones explícitas de retiro y reactivación
   K-1/K-2: retireEvidence / reactivateEvidence
   reconcileEvidences: nunca reactiva ni retira implícitamente por el payload

PASO 4 · Auditoría (E-5)
   source 'ACHIEVEMENT_EVIDENCE' según §I.1. Sin cambio de esquema.
   Preservar la política de no-propagación de errores.

PASO 5 · UI
   K-5/K-6: estado «Retirada», acciones explícitas, retiradas siempre en el payload

PASO 6 · Especificar (NO implementar) la regla de completitud
   Documentar para F4: obligación en períodos vigentes, no en posteriores.
```

**Los pasos 1 y 2 son el núcleo. Sin ambos, D-12 es una etiqueta sin efecto.**

---

## O. PLAN DE PRUEBAS

### O.1 Reutilizables

`achievement-evidence-reconcile.spec.ts` (F1, 14/14). **Debe seguir pasando sin modificarse** —
es el contrato de que D-12 no debilita F1. Patrón de mock de Prisma reutilizable tal cual.

Las 15 specs restantes del API no tocan esta zona: sirven de red para el cuantitativo.
*(Recordatorio: `institution-config.service.spec.ts` falla desde antes de F1 y es ajena.)*

### O.2 Nuevas

| Grupo | Casos |
|---|---|
| Retiro / reactivación | retirar marca `isActive=false` y conserva id · conserva sus valoraciones · reactivar sólo cambia el estado · retirar dos veces es idempotente |
| Bloqueo de valoración | `upsertEvidenceValuation` sobre retirada → rechaza · sobre activa → acepta · valoración existente sigue editable · `deleteEvidenceValuation` protegido |
| Planilla | `getAchievementsByAssignment` no devuelve retiradas · sí devuelve activas |
| Catálogo | `getCatalogAchievements` **sí** devuelve retiradas, marcadas |
| Compatibilidad F1 | `reconcileEvidences` con una retirada presente en el payload no la da de baja · ausente del payload y con valoraciones → sigue lanzando `ConflictException` |
| Vigencia por período | evidencia retirada con valoraciones en P1 aparece en P1 · no aparece en P2 · reactivada vuelve a aparecer desde el período en curso |
| Boletín | período con valoraciones muestra la retirada · período sin valoraciones no la muestra · **snapshot congelado no cambia** |
| Eliminación física | guarda de F1 intacta: con valoraciones → `ConflictException`; sin valoraciones → borra |
| Auditoría | retiro y reactivación emiten evento con `source` correcto · un fallo de auditoría no impide la operación |

---

## P. CRITERIOS DE ACEPTACIÓN

1. Una evidencia retirada **no aparece** en la planilla del docente.
2. El API **rechaza** toda valoración nueva sobre una evidencia retirada.
3. Las valoraciones existentes **permanecen intactas y editables** mientras el período lo permita.
4. Una evidencia retirada **sigue apareciendo en el boletín** de los períodos donde fue evaluada.
5. **Ningún snapshot congelado cambia** como consecuencia de un retiro.
6. Una evidencia retirada **sigue visible en el catálogo**, diferenciada.
7. `reconcileEvidences` **no** interpreta una retirada como baja.
8. La guarda de borrado físico de F1 **sigue funcionando sin cambios**; sus 14 pruebas pasan.
9. Retiro y reactivación quedan **auditados**.
10. La reactivación **no altera** ningún período anterior.
11. **Impacto en cuantitativo: NINGUNO**, demostrable porque ningún archivo de §L fue tocado.
12. La regla de completitud queda **especificada y no implementada** (es F4).
13. El estado de retiro se determina **exclusivamente** por la columna de retiro; ninguna ruta lee `isActive`.

---

# Q. DISEÑO DEFINITIVO DEL ESTADO DE RETIRO (J.5 aprobada)

> Aprobación recibida el 2026-08-16: *«implementar `retiredAt`»*, con la instrucción explícita de
> **no permitir dos fuentes de verdad**. Dos verificaciones posteriores condicionan el diseño y se
> documentan antes de la propuesta, porque cambian la columna concreta.

## Q.1 Verificaciones que condicionan el diseño

### V-1 · `isActive` es escritura-muerta — no hay compatibilidad que preservar

- Ningún componente del frontend escribe `isActive` de una evidencia:
  `Achievements.tsx:662` llama `updateEvidence(id, { text })`, sólo texto.
- Ningún seed ni script lo pone en `false`.
- El único camino de escritura es `PUT /achievements/evidences/:id` con `isActive`, sin consumidor.

→ **`isActive` vale `true` en el 100 % de los datos y sus dos filtros `where: { isActive: true }`
son no-ops hoy.** No existe estado histórico que preservar: no hay argumento de compatibilidad
para conservarlo como fuente de verdad.

### V-2 · Las fechas de período NO son fiables — un timestamp no basta

Consulta de solo lectura sobre producción:

```
Períodos: 17
Sin startDate o endDate: 7 de 17   (41 %)
```

Una institución completa tiene sus 6 períodos con ambas fechas en NULL.

→ **Resolver «desde qué período deja de exigirse» comparando un DateTime contra
`AcademicTerm.startDate/endDate` falla en el 41 % de los períodos actuales.** Un timestamp
responde *cuándo* ocurrió el retiro, no *desde qué período* deja de aplicar. Son preguntas
distintas, y el modelo sólo puede responder la segunda con una referencia al período.

## Q.2 Columna definitiva

```prisma
model AchievementEvidence {
  // …
  isActive          Boolean   @default(true)   // DEPRECADO — ver Q.3
  retiredFromTermId String?                    // ← FUENTE DE VERDAD del retiro
  retiredAt         DateTime?                  // metadato informativo, NUNCA se lee para decidir
}
```

| | `retiredFromTermId` | `retiredAt` | `isActive` |
|---|---|---|---|
| Rol | **Estado y alcance. Única fuente de verdad conductual** | Sello temporal para UI y trazabilidad | **Deprecado** |
| `NULL` significa | Evidencia activa | — | — |
| ¿Se lee para decidir? | **Sí, siempre** | **Nunca** | **Nunca, tras F2** |
| ¿Se escribe? | Sólo al retirar/reactivar | Junto al anterior, misma operación | **Nunca, tras F2** |

**Invariante única:** `retiredFromTermId IS NULL` ⇔ evidencia activa.
No existe ninguna otra forma de expresar el estado de retiro.

## Q.3 Relación con `isActive` — cómo se evita la divergencia

La regla que pidió —«no debe existir un estado válido contradictorio»— se cumple **eliminando el
estado, no sincronizándolo**. Sincronizar dos columnas es exactamente el patrón que puede divergir
en silencio.

```
F2  · Se deja de LEER isActive   (reports.service.ts:2894 y :2973)
    · Se deja de ESCRIBIR isActive (sale del DTO de updateEvidence)
    · duplicateAchievement deja de copiarlo
    → desde aquí isActive es columna muerta: no puede divergir de forma
      observable porque nada la consulta.
F6  · Migración de contracción: DROP COLUMN isActive
```

**Sin backfill de `isActive`:** es innecesario —hoy vale `true` en todas las filas (V-1)— y el
backfill está expresamente prohibido.

> ⚠ `reports.service.ts:2894` pertenece al modo PURPOSE. Hoy su filtro es un no-op (V-1), así que
> retirarlo **no cambia el comportamiento observable**. Debe hacerse igualmente para no dejar viva
> una lectura de una columna deprecada.

## Q.4 Regla de vigencia definitiva

> Una evidencia con `retiredFromTermId = T` es **vigente** en todo período `P` del mismo año
> académico tal que `P.order < T.order`, y **no vigente** en `T` y en los posteriores.

- Determinista: no depende de fechas, ni de valoraciones, ni de ningún dato mutable.
- Elimina **J.1** (ambigüedad «vigente sin valorar») y **J.2** (inestabilidad) de raíz.
- **J.3 se mantiene y es intencional:** la vigencia es **por grado**, porque el catálogo es
  compartido (`gradeId + subjectId + academicYearId`). Todos los grupos del grado ven la misma
  estructura en el mismo período — que es la regla aprobada.

## Q.5 Transiciones de estado

| Transición | Precondición | Efecto | Auditoría |
|---|---|---|---|
| **activa → retirada** | Período destino `T` con `status = OPEN`. **Prohibido** apuntar a `CLOSED`/`FINALIZED` | `retiredFromTermId = T.id`, `retiredAt = now()`. **No toca ninguna valoración** | E-5 `UPDATE` |
| **retirada → activa** | — | Ambas columnas a `null`. Efecto **sólo prospectivo** | E-5 `UPDATE` |
| **activa → eliminada** | `count(StudentEvidenceValuation) = 0` — **guarda F1, intacta** | `delete` físico | E-5 `DELETE` |
| **retirada → eliminada** | **La misma guarda F1.** Con valoraciones → `ConflictException` | `delete` físico sólo si nunca tuvo valoraciones | E-5 `DELETE` |

**Retiro y eliminación son ortogonales.** El estado de retiro **no sustituye ni debilita** la guarda
de F1: una evidencia retirada con valoraciones sigue siendo indestructible.

## Q.6 Interacción con `FINALIZED`

- Un período `FINALIZED` sirve su **snapshot congelado**: retirar o reactivar después **no puede
  alterarlo**, porque `AcademicDataSourceService` no vuelve a ejecutar la consulta viva.
- Lo que sí debe impedirse es **apuntar `retiredFromTermId` a un período `CLOSED` o `FINALIZED`**:
  eso eliminaría obligaciones de un período ya cerrado.
- **Hoy no existe ninguna guarda de estado de período en `achievement.service.ts`** (§H). Se declara
  como alcance de **F2** (validación puntual al retirar) y **F3** (guarda transversal extendida a los
  modelos cualitativos). **No se implementa en este turno.**

## Q.7 Esquema de la futura migración — **NO EJECUTAR**

| Aspecto | Definición |
|---|---|
| Columnas | `retiredFromTermId String?` · `retiredAt DateTime?` |
| Tipo SQL | `TEXT NULL` · `TIMESTAMP(3) NULL` |
| Nullable | **Sí, ambas.** `NULL` = activa |
| Valor inicial | **Ninguno.** Las filas existentes quedan en `NULL` = activas, que es su estado real (V-1). **Sin backfill** |
| Relación Prisma | `retiredFromTerm AcademicTerm? @relation(fields: [retiredFromTermId], references: [id], onDelete: Restrict)`. `Restrict` evita que borrar un período reactive evidencias en silencio; `syncPeriods` ya envuelve sus borrados en `try/catch`, así que no rompe nada |
| **Índice** | **NO.** Justificado desde las consultas reales: *todos* los accesos a `AchievementEvidence` están acotados por `achievementId` (ya indexado) y devuelven ~3 filas por propósito. Ninguna consulta filtra por estado de retiro a nivel de tabla, y no existe la consulta inversa «qué evidencias se retiraron en el período X». El único uso sería la verificación de la FK al borrar un período, sobre una tabla pequeña. El planificador nunca elegiría ese índice |
| Compatibilidad | Totalmente aditiva. Ningún código existente lee estas columnas |
| `isActive` | **No se toca en esta migración.** Se deprecia en código (Q.3) y se elimina en F6 |

### Q.7.1 ⚠ Dependencia de secuenciación con la FK — **RESUELTA (2026-08-17)**

> **Estado real.** Las 12 filas huérfanas **fueron eliminadas** en una acción independiente,
> explícita y autorizada, acotada a I.E.D. La Esperanza del Sur. Quedan **0 huérfanas** y **3
> `StudentEvidenceValuation` válidas**.
>
> La FK **ya está aplicada en producción**:
> `StudentEvidenceValuation_achievementEvidenceId_fkey`, `ON DELETE RESTRICT` ·
> `ON UPDATE RESTRICT`, migración `20260817120000_student_evidence_valuation_fk`.
> 88 migraciones aplicadas; `migrate status` indica que la base está al día respecto al
> historial. Detalle completo en `docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md`.
>
> La previsión de esta sección —migraciones separadas— se cumplió: las columnas de retiro
> fueron en `20260816120000_evidence_logical_retirement` y la FK, un día después, en la suya.

*Texto original, conservado como registro del análisis previo:*

La FK de `StudentEvidenceValuation.achievementEvidenceId` **está bloqueada por las 12 filas
huérfanas**: la migración fallaría. Las columnas de retiro **no están bloqueadas**.

→ Si al llegar a F2 la resolución de las 12 huérfanas no está autorizada, **las columnas de retiro
deben ir en una migración propia, separada de la FK.** Agruparlas obligaría a esperar.

## Q.8 Impacto por área

| Área | Impacto |
|---|---|
| **Histórico** | Ninguno. Retirar no lee, modifica ni borra `StudentEvidenceValuation` |
| **Catálogo** | Las retiradas **siguen presentes** en `getCatalogAchievements` y en el payload de `reconcileEvidences`. La UI las marca «Retirada» |
| **Valoración** | Prohibida sobre retiradas (H-18 + H-19). Las existentes permanecen intactas y editables |
| **Boletín** | H-20: la línea 2973 pasa de `isActive: true` a la regla de vigencia de Q.4. Snapshots congelados jamás cambian |
| **Completitud** | La regla queda **especificada**; su motor es **F4**. F2 no crea un segundo sistema de completitud |
| **FINALIZED** | Q.6. Guarda pendiente, declarada como alcance F2/F3 |
| **FK futura** | Compatible y habilitante: evita elegir entre `Cascade` (destruye historia) y `Restrict` (bloquea al administrador) |
| **Cuantitativo** | **NINGUNO.** Ningún archivo de §L se toca |

## Q.9 Ajustes a §K, §N, §O y §P

- **§K** — K-1 añade la escritura de las columnas de retiro y **retira `isActive` del DTO de
  `updateEvidence`**; K-3 usa la regla de Q.4 en lugar de la vigencia derivada.
  Nuevo **K-8**: `apps/api/prisma/schema.prisma` + migración, sólo cuando se autorice F2.
- **§N** — nuevo PASO 0: migración aditiva de Q.7. El PASO 2 usa Q.4. El PASO 3 escribe las nuevas
  columnas y deja de escribir `isActive`.
- **§O** — se añaden: vigencia por `order` de período (anterior / igual / posterior al retiro),
  prohibición de apuntar a un período `CLOSED`/`FINALIZED`, y una prueba de que **ninguna lectura
  consulta ya `isActive`**.
- **§P** — criterio 13, ya incorporado arriba.

## Q.10 Riesgos residuales

| # | Riesgo | Estado |
|---|---|---|
| Q-R1 | **La columna aprobada cambia.** Se aprobó `retiredAt`; V-2 demuestra que un timestamp no resuelve el alcance por período. Se propone `retiredFromTermId` como fuente de verdad, con `retiredAt` como metadato | **Requiere confirmación explícita** |
| Q-R2 | `isActive` queda como columna muerta entre F2 y F6 | Aceptado: sin lectores, no puede divergir de forma observable |
| Q-R3 | Retirar apuntando a un período `CLOSED`/`FINALIZED` | Validación en F2; guarda transversal en F3 |
| ~~Q-R4~~ | ~~La FK bloqueada por las 12 huérfanas arrastraría a las columnas de retiro~~ | **RESUELTO (2026-08-17).** Se hizo lo previsto en Q.7.1: migraciones separadas. Retiro en `20260816120000_evidence_logical_retirement`; FK en `20260817120000_student_evidence_valuation_fk`, ya aplicada tras eliminar las huérfanas |
| Q-R5 | `duplicateAchievement` copia hoy `isActive`; deberá crear siempre copias activas | Recogido en M-6 |

---

# R. REGISTRO DE APLICACIÓN DE LA MIGRACIÓN

**Estado: `20260816120000_evidence_logical_retirement` — APLICADA sobre producción el 2026-08-16.**

> **La migración fue aplicada sobre producción mediante un cambio de esquema aditivo y no
> destructivo. La comparación de hashes antes/después confirmó que no se modificaron datos
> existentes. No se realizó prueba funcional escribiendo sobre producción para preservar dicha
> garantía.**

## R.1 Precondiciones verificadas antes de ejecutar

```
87 migraciones encontradas en prisma/migrations
Pendientes: 1  →  20260816120000_evidence_logical_retirement
```

Exactamente una pendiente, coincidente con el archivo auditado en §Q.7. Sin drift ni migraciones
fallidas. La ejecución se hizo con `prisma migrate deploy` (nunca `migrate dev`), que sólo aplica
lo pendiente y no reinicia nada.

## R.2 Estructura resultante

| Elemento | Verificado |
|---|---|
| `retiredFromTermId` | `text` · nullable · **sin default** |
| `retiredAt` | `timestamp` · nullable · **sin default** |
| FK | `AchievementEvidence_retiredFromTermId_fkey → AcademicTerm(id)` · **ON DELETE RESTRICT** · ON UPDATE CASCADE |

## R.3 Evidencia de que los datos no cambiaron

Comparación por hash SHA-256 del contenido completo de cada fila (id, texto, orden, `isActive`,
timestamps), no por simple conteo:

| Tabla | Antes | Después | |
|---|---|---|---|
| `AchievementEvidence` | 12 · `489d3929b58dc126` | 12 · `489d3929b58dc126` | ✅ idéntico |
| `StudentEvidenceValuation` | 15 · `f8df2dfad7d64b58` | 15 · `f8df2dfad7d64b58` | ✅ idéntico |
| **12 huérfanas** | `b28c2faca1fc37ff` | `b28c2faca1fc37ff` | ✅ **intactas** |

**Cero backfill:** de las 12 evidencias, `retiredFromTermId` no-nulo = 0 y `retiredAt` no-nulo = 0.

**Tablas ajenas, sin variación:** `PeriodFinalGrade` 22 741 · `PartialGrade` 111 088 ·
`StudentAchievement` 7 204 · `ConvivenciaEntry` 29 · `TermReportCardSnapshot` 2 000 ·
`AcademicTerm` 17.

> Estos volúmenes confirman que la base de producción contiene **datos académicos reales de otras
> instituciones**. La migración no los tocó.

## R.4 Validación funcional — alcance y límite

Se decidió **no** ejecutar retiro/reactivación reales sobre producción: habría escrito sobre una
fila existente y roto la garantía de integridad demostrada en R.3.

La cobertura funcional de D-12 proviene de **31 pruebas unitarias** (retiro, reactivación,
prospectividad, orden de períodos, rechazo en `CLOSED` y `FINALIZED`, bloqueo de valoraciones
nuevas, conservación del histórico, catálogo con retiradas, compatibilidad con
`reconcileEvidences`, auditoría E-5 y guarda de eliminación física de F1).

**No debe presentarse esta cobertura como prueba de integración.** No existe ninguna prueba E2E
contra base real para D-12.

## R.5 Lo que este registro NO cierra

| | Estado |
|---|---|
| **F2** | 🟡 **ABIERTA / PENDIENTE DE CIERRE.** *(actualizado 2026-08-17)* D-12 implementado y migrado; **C-1, C-2 y C-4 implementadas pero NO desplegadas**; FK de `StudentEvidenceValuation → AchievementEvidence` ✅ aplicada con `RESTRICT`. `deleteAchievement` ✅ protegido por tres guardas de servicio (`StudentAchievement`, `StudentEvidenceValuation`, `AttitudinalAchievement`). **FK de alcance ✅ aplicadas (2026-08-17):** `studentEnrollmentId` `CASCADE`/`CASCADE`, `academicTermId` `CASCADE`/`CASCADE`, `institutionId` `RESTRICT`/`CASCADE` — migración `20260817180000_student_evidence_valuation_scope_fks`; **H-2 resuelto**. **Pendiente:** despliegue de C-1/C-2/C-4. **D-18** (retiro lógico de `Achievement`) **NO implementado** — trabajo futuro, requiere resolver antes el choque con `@@unique([gradeId, subjectId, academicYearId, orderNumber, isPromotional])` |
| **H-20** | ⚠️ **Sigue abierto.** Regla corregida y cableado revisado, pero **sin prueba E2E de `buildGroupReportCards`**. No se cierra por tener typechecks y unitarias en verde |
| **H-12** | ⚠️ Abierto |
| Pendientes de F3/F4 | ⚠️ Abiertos |
| **F1** | ✅ Cerrada — su historia no se altera |
| Despliegue | ❌ **No realizado.** El código de D-12 no está en producción; las columnas existen pero están inertes |
