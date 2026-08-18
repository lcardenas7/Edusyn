# F2 · FK de integridad de `StudentEvidenceValuation`

**Aplicada en producción el 2026-08-17.** · **F2 sigue 🟡 ABIERTA.**
Sin despliegue de código · sin cambios de datos · sin resolver el drift preexistente.

---

## 1. Qué se cerró

Hasta hoy, `StudentEvidenceValuation.achievementEvidenceId` era una columna suelta: **no tenía
clave foránea**. Borrar una evidencia no producía cascada ni error — dejaba valoraciones
apuntando a un id inexistente, en silencio. Ese es el mecanismo del defecto **H-1**, documentado
y reproducido en `docs/F1_INTEGRIDAD_EVIDENCIAS.md`.

F1 lo cerró **en código** (reconciliación por id + guardas con `ConflictException`).
Esta FK lo cierra **en la base de datos**, que es donde deja de depender de que el código
acierte.

## 2. Precondiciones verificadas antes de aplicar

| # | Condición | Resultado |
|---|---|---|
| 1 | 0 filas huérfanas | ✅ **0** |
| 2 | Todos los `achievementEvidenceId` válidos | ✅ 3/3 · 0 nulos |
| 3 | La relación coincide con el modelo auditado | ✅ `text → text` · origen `NOT NULL` · destino PK simple · FK inexistente · índice ya presente |
| 4 | No existe drift | ❌ **falló** — ver §5. Se autorizó continuar sin resolverlo |
| 5 | Sin migraciones pendientes adicionales | ✅ 87 aplicadas, ninguna fallida ni revertida |

Las 12 valoraciones huérfanas **fueron eliminadas previamente**, en una acción independiente,
explícita y autorizada, acotada a I.E.D. La Esperanza del Sur. Quedan **3 valoraciones
válidas**, todas de esa misma institución. Ninguna otra institución tiene valoraciones por
imprescindible.

## 3. La migración

**Nombre:** `20260817120000_student_evidence_valuation_fk`

```sql
ALTER TABLE "StudentEvidenceValuation"
  ADD CONSTRAINT "StudentEvidenceValuation_achievementEvidenceId_fkey"
  FOREIGN KEY ("achievementEvidenceId") REFERENCES "AchievementEvidence"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
```

**Una sola sentencia ejecutable.** Escrita a mano, no generada con `migrate dev`: la generación
automática habría arrastrado las 8 sentencias de drift (§5) dentro de esta migración.

Aplicada con `prisma migrate deploy`, que sólo ejecuta migraciones ausentes de
`_prisma_migrations` y **no reconcilia drift**. Antes de lanzarlo se confirmó que había
exactamente una pendiente y que era ésta.

**Estado:** 88 migraciones aplicadas · `prisma migrate status` → *«Database schema is up to
date!»* respecto al historial de migraciones.

## 4. Por qué `RESTRICT`

| Opción | Veredicto |
|---|---|
| `CASCADE` | **Rechazada.** Borrar una evidencia destruiría las valoraciones — exactamente la historia que F1 y D-12 existen para proteger |
| `SET NULL` | **Imposible.** La columna es `NOT NULL`; la relación es obligatoria |
| `RESTRICT` | **Elegida.** Una evidencia con valoraciones no puede borrarse. Para sacarla del catálogo existe el retiro lógico de **D-12**, que conserva la fila y su historia |

`ON UPDATE RESTRICT` acompaña por coherencia: los ids son `cuid()` inmutables, así que la
política no tiene efecto práctico, pero deja la intención explícita en vez de heredar el
`CASCADE` que Prisma pone por defecto.

> **La FK es la red de seguridad de la guarda de F1, no su sustituto.** Rechaza con un `23503`
> crudo de Postgres, que el usuario vería como error 500. El mensaje explicativo sigue siendo
> responsabilidad del código.

> **Actualización 2026-08-17.** Ese mensaje explicativo ya existe: `deleteAchievement` detecta el
> conflicto antes de llegar a la base y lanza `ConflictException`. La FK pasó a ser la segunda
> barrera, que es su papel. Ver §4.1.

### 4.1 Las tres guardas de servicio de `deleteAchievement`

Borrar un propósito cascadea a cinco relaciones. Tres de ellas se comprueban **antes** de
cualquier operación destructiva, en este orden:

```
assertCatalogWritable            permisos
        ↓
studentAchievement.count         historia académica
        ↓
achievementEvidence.findMany
  → studentEvidenceValuation     valoraciones por imprescindible
        ↓
attitudinalAchievement.count     contenido actitudinal
        ↓
achievement.delete               única operación destructiva
```

| # | Relación | `ON DELETE` en BD | Barrera de BD | Guarda de servicio | Filas en producción |
|---|---|---|---|---|---|
| 1 | `StudentAchievement` | `CASCADE` | **ninguna** | ✅ `count > 0 → ConflictException` | 7 204 |
| 2 | `AchievementEvidence` → `StudentEvidenceValuation` | `CASCADE` → **`RESTRICT`** | ✅ la FK de este documento | ✅ `ConflictException` | 12 → 3 |
| 3 | `AttitudinalAchievement` | **`CASCADE`** | **ninguna** | ✅ `count > 0 → ConflictException` | 0 |
| 4 | `AchievementLevelDescriptor` | `CASCADE` | ninguna | no requiere: es configuración de catálogo | 0 |
| 5 | `PedagogicalSupportPlan` | `SET NULL` | n/a | no requiere: **no es destructiva**, el plan sobrevive | 8 (0 ligados) |

**La FK `RESTRICT` de este documento cubre únicamente el caso 2.** Los casos 1 y 3 están
protegidos **sólo en la capa de servicio**: sus claves foráneas siguen siendo `CASCADE / CASCADE`
y no se han modificado. **No hay ninguna FK nueva.**

Sobre el caso 3: `AttitudinalAchievement` **no es historia académica por estudiante** —no lleva
`studentEnrollmentId`—. Es contenido redactado por el docente para una asignación, un período y,
opcionalmente, un propósito, y puede llegar al boletín. Se protegió **preventivamente**: la
funcionalidad existe y está expuesta en dos rutas, la relación es `CASCADE`, el contenido puede
llegar al boletín, hoy hay 0 registros y por tanto la guarda **no cambia ningún comportamiento
observable en producción**.

Consecuencia funcional vigente: los **292** propósitos de producción tienen `StudentAchievement`,
así que `deleteAchievement` no tiene hoy ningún caso de uso real. Sigue siendo válido para
propósitos sin historia. La alternativa para propósitos con historia sería el retiro lógico
(**D-18**), que **no está implementado** — ver §12.

## 4.2 Las tres FK de alcance — aplicadas el 2026-08-17

Cierran **H-2**: la tabla no tenía ninguna clave foránea hacia matrícula, período ni
institución, así que borrar cualquiera de los tres dejaba valoraciones colgando en silencio.

**Migración:** `20260817180000_student_evidence_valuation_scope_fks` — tres sentencias, ni una
más. Escrita a mano por el mismo motivo que la anterior: `migrate dev` habría arrastrado las 8
sentencias de drift.

```sql
ALTER TABLE "StudentEvidenceValuation" ADD CONSTRAINT "StudentEvidenceValuation_studentEnrollmentId_fkey"
  FOREIGN KEY ("studentEnrollmentId") REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentEvidenceValuation" ADD CONSTRAINT "StudentEvidenceValuation_academicTermId_fkey"
  FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentEvidenceValuation" ADD CONSTRAINT "StudentEvidenceValuation_institutionId_fkey"
  FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

**Las políticas no se eligieron: se derivaron.** Se consultaron todas las FK del sistema hacia
esos tres destinos, y en particular las cinco tablas de historia académica —`StudentAchievement`,
`PeriodFinalGrade`, `PartialGrade`, `ConvivenciaEntry`, `TermReportCardSnapshot`—:

| Columna | Política | Precedente |
|---|---|---|
| `studentEnrollmentId` | `CASCADE` / `CASCADE` | **5 de 5** sin excepción. Global: 34 `CASCADE` · 7 `SET NULL` · 1 `RESTRICT` |
| `academicTermId` | `CASCADE` / `CASCADE` | **5 de 5** sin excepción. Global: 17 `CASCADE` · 2 `SET NULL` · 2 `RESTRICT` |
| `institutionId` | **`RESTRICT`** / `CASCADE` | **3 de 4**: las tres tablas de notas omiten `onDelete` en su relación `Rls*`, lo que en Prisma da `Restrict`. Global: 58 `RESTRICT` · 50 `CASCADE` |

La única excepción es `ConvivenciaEntry → Institution`, que escribe `onDelete: Cascade`
explícitamente. Se documenta porque es la tabla cualitativa más parecida, pero se siguió el
criterio de las tres tablas de notas: `RESTRICT` no destruye.

**Por qué la valoración no sobrevive a su matrícula ni a su período**, demostrado desde el
esquema: `TermReportCardSnapshot.academicTermId` es también `CASCADE`, es decir que borrar un
período destruye incluso los boletines congelados de ese período. El sistema ya trata el borrado
de un período como *«este período nunca existió»*. Aplicar otra política dejaría a
`StudentEvidenceValuation` como la única excepción.

**Índices:** ninguno nuevo. La simulación previa no generó ni un `CREATE INDEX`;
`academicTermId` e `institutionId` ya tenían el suyo y `studentEnrollmentId` está cubierto por el
prefijo izquierdo de `_stu_evi_term_key`. La tabla conserva sus **5** índices.

### Riesgo registrado, no resuelto

`academic-terms.service.ts:77` expone un `delete(id)` de período **sin ninguna guarda**, y
`syncPeriods` (línea 142) envuelve sus borrados en un `try/catch` cuyo comentario dice *«Si tiene
dependencias, no eliminar»* — pero ese catch **sólo se dispara con relaciones `RESTRICT`**. Con
`CASCADE` el borrado tiene éxito y arrastra en silencio. Esto **ya ocurría** con las notas
cuantitativas, `ConvivenciaEntry` y los 2 000 snapshots; la decisión consciente fue meter la
valoración cualitativa en el mismo régimen en lugar de convertirla en excepción. **Queda como
hallazgo abierto, fuera del alcance de F2.**

## 5. Drift preexistente — **NO se resolvió, y sigue igual**

`prisma migrate diff` entre la base real y `schema.prisma` devolvía **8 sentencias** antes de
esta migración, y devuelve **las mismas 8 después**. Ninguna fue modificada.

**Dos índices presentes en producción que `schema.prisma` no declara:**

| Índice | Naturaleza |
|---|---|
| `AbpMission_assigneeEnrollmentId_idx` | índice normal sobre `assigneeEnrollmentId` |
| `Achievement_code_teacherAssignmentId_key` | **UNIQUE** sobre (`code`, `teacherAssignmentId`) — **permanece intacta** |

**Seis diferencias de nombre de índice** (truncados por una versión anterior de Prisma;
verificado que las columnas indexadas son idénticas en los seis casos):

```
Achievement_gradeId_subjectId_academicYearId_orderNumber_isProm
AttitudinalSubmission_activityId_evaluatorEnrollmentId_targetEn
ConvivenciaEntry_studentEnrollmentId_academicTermId_subjectId_k
PeerAssessmentPair_activityId_evaluatorEnrollmentId_targetEnrol
StudentAchievement_studentEnrollmentId_achievementId_academicTe
StudentEvidenceValuation_stu_evi_term_key
```

**La migración de la FK no modificó ninguno de esos 8 elementos.** Comprobado uno por uno
contra `pg_indexes` después de aplicar.

`StudentEvidenceValuation` conserva sus **5 índices**, lista idéntica: la FK no creó ninguno
—ya existía `StudentEvidenceValuation_achievementEvidenceId_idx`— ni eliminó ninguno.

> `prisma migrate status` **no detecta este drift**: sólo compara el historial de migraciones,
> no la forma real de la base. Quien ejecute `prisma migrate dev` generará una migración que
> renombra 6 índices y **elimina la `UNIQUE` de `Achievement`**. Queda registrado como riesgo
> abierto, sin decisión tomada.

## 6. Prueba de comportamiento

Cuatro escenarios, cada uno en su propia transacción, **todos con rollback**. Ningún dato real
fue borrado ni creado.

| | Escenario | Resultado |
|---|---|---|
| 1 | `DELETE` de evidencia **con** valoración | **Rechazado** · `23503` *violates foreign key constraint …_fkey* |
| 2 | `DELETE` de evidencia **sin** valoración | Permitido (1 fila) y revertido |
| 3 | `INSERT` de valoración con evidencia **existente** | Permitido (1 fila) y revertido |
| 4 | `INSERT` de valoración con evidencia **inexistente** | **Rechazado** · `23503` |

El escenario 4 es el defecto original: lo que en agosto entró sin protesta, ahora la base lo
rechaza.

## 7. Verificación de la FK

| | |
|---|---|
| Nombre | `StudentEvidenceValuation_achievementEvidenceId_fkey` |
| Definición | `FOREIGN KEY ("achievementEvidenceId") REFERENCES "AchievementEvidence"(id) ON UPDATE RESTRICT ON DELETE RESTRICT` |
| `confdeltype` | `'r'` = RESTRICT |
| `confupdtype` | `'r'` = RESTRICT |
| Columna | sigue `NOT NULL` |

## 8. Sin cambios de datos

Hashes recalculados **después** de las cuatro pruebas de comportamiento, lo que demuestra
además que los rollbacks funcionaron:

| Tabla | Antes → Después | Hash |
|---|---|---|
| `StudentEvidenceValuation` | 3 → 3 | `5ddbd87941653f56` → **idéntico** |
| `AchievementEvidence` | 12 → 12 | `edc55e1634b9ea93` → **idéntico** |
| `Achievement` | 292 → 292 | `181aeb02925bdef0` → **idéntico** |
| `StudentAchievement` | 7204 → 7204 | `4619b13787e31236` → **idéntico** |

Las 3 valoraciones conservan id, evidencia y nivel. Ninguna otra institución fue tocada.

## 9. Cambio en `schema.prisma`

Sólo la relación, en los dos extremos:

```prisma
// StudentEvidenceValuation
achievementEvidence AchievementEvidence @relation(fields: [achievementEvidenceId], references: [id], onDelete: Restrict, onUpdate: Restrict)

// AchievementEvidence
valuations StudentEvidenceValuation[]
```

El `migrate diff` previo a aplicar demostró que esta declaración genera **exactamente** el SQL
de §3 y ningún índice.

## 10. Pruebas

| | |
|---|---|
| Typecheck API | ✅ |
| Typecheck web | ✅ |
| `reports` + `achievements` + integridad/F2 | ✅ **151/151** (10 suites) |
| Suite completa API | **268/269** · 27 suites verdes |

El único fallo es `institution-config.service.spec.ts` →
`this.prisma.academicYear.findFirst is not a function`. Es **preexistente y ajeno a este
trabajo**, ya verificado anteriormente mediante `git stash`. No se tocó.

## 11. Estado

| | |
|---|---|
| **D-12** | ✅ |
| **C-1** | ✅ implementada |
| **C-2** | ✅ implementada |
| **C-4** | ✅ implementada |
| **F0** | 🟡 parcial |
| **F2** | 🟡 **ABIERTA** |

**C-1, C-2 y C-4 NO están desplegadas a producción.** El código vive en el árbol de trabajo,
sin commit.

### F2 — completado

- Limpieza de las 12 huérfanas · **0 huérfanas restantes**.
- FK `StudentEvidenceValuation → AchievementEvidence`.
- `RESTRICT` en `DELETE` y `UPDATE`.
- Guarda de `StudentEvidenceValuation` en `deleteAchievement`.
- Guarda de `StudentAchievement` en `deleteAchievement`.
- Guarda de `AttitudinalAchievement` en `deleteAchievement`.
- **FK de `studentEnrollmentId` (H-2)** — `CASCADE` / `CASCADE` · 2026-08-17.
- **FK de `academicTermId` (H-2)** — `CASCADE` / `CASCADE` · 2026-08-17.
- **FK de `institutionId` (H-2)** — `RESTRICT` / `CASCADE` · 2026-08-17.
- Pruebas de integridad correspondientes.

`StudentEvidenceValuation` queda con sus **cuatro** relaciones cerradas a nivel de base de datos.
**H-2 resuelto.**

### F2 — pendiente

- Despliegue de C-1 / C-2 / C-4.
- Cualquier trabajo adicional definido por F2.

## 12. D-18 · retiro lógico de `Achievement` — **NO implementado**

Trabajo futuro. `Achievement` **no tiene** `retiredFromTermId`, **no tiene** `retiredAt`, y el
servicio **no expone** `retireAchievement` ni `reactivateAchievement`. No existe ningún mecanismo
de retiro lógico para propósitos.

Requiere diseño previo por dos motivos comprobados:

1. **`@@unique([gradeId, subjectId, academicYearId, orderNumber, isPromotional])`** — un propósito
   retirado seguiría ocupando su número de orden, así que no podría crearse otro en su lugar sin
   renumerar. `AchievementEvidence` no tiene esta restricción, por eso D-12 no se topó con el
   problema.
2. **El boletín de los períodos `OPEN` depende del `Achievement` vivo** (`levelDescriptors`,
   `orderNumber`, dimensión). Los períodos `FINALIZED` disponen de snapshot y no vuelven a leer el
   catálogo.

## 13. Pruebas tras las tres guardas

| | |
|---|---|
| `delete-achievement-attitudinal` | ✅ 15/15 |
| Las tres specs de `deleteAchievement` | ✅ 41/41 |
| achievements + evidence + reports + integridad/F2 | ✅ **208/208** |
| Suite completa API | **325/326** |
| Typecheck API · Typecheck web | ✅ · ✅ |

Tras las tres FK de alcance (2026-08-17): mismas cifras — **208/208** en las suites relacionadas
y **325/326** en la completa. **Ningún fallo nuevo.** Cinco pruebas transaccionales, todas con
rollback: `CASCADE` verificado en matrícula y período, `RESTRICT` verificado en institución y en
`achievementEvidenceId`, y rechazo de inserción con cada una de las cuatro referencias
inexistentes. Hashes de datos idénticos antes y después.

Único fallo: `institution-config.service.spec.ts` →
`TypeError: this.prisma.academicYear.findFirst is not a function`. **Preexistente y ajeno** a este
trabajo.

En `achievement-retirement-audit.spec.ts`, tres pruebas marcadas `[DEFECTO CONGELADO]` pasaron a
`[CORREGIDO]` al existir ya la protección de `AttitudinalAchievement`: era la señal para la que
fueron escritas.
