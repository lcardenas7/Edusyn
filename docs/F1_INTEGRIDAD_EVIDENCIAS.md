# F1 — Integridad de las valoraciones por imprescindible/evidencia

**Estado: COMPLETADA Y CERRADA** · 2026-08-16 · Rama `main` (sin commit)

Fase 1 del plan `docs/PLAN_TRANSICION_CORRECCION_Y_DISENO.md`. Alcance autorizado y ejecutado:
cerrar el vector que dejaba huérfanas las valoraciones cualitativas al editar el catálogo, y
medir el alcance de los registros afectados. **Ninguna otra fase fue implementada.**

> **Resumen en una línea:** *defecto de integridad reproducido en producción mediante datos de
> prueba*, y cerrado. Sin afectación de información académica institucional.

---

## 1. El defecto

`AchievementEvidence` (el «imprescindible» / «evidencia de aprendizaje») es referenciado por
`StudentEvidenceValuation.achievementEvidenceId`, un **escalar sin clave foránea** — decisión
declarada en el propio esquema (`schema.prisma:3166-3167`).

`updateAchievement` resolvía la edición de evidencias con **reemplazo total**:

```ts
await prisma.achievementEvidence.deleteMany({ where: { achievementId: id } });
await prisma.achievementEvidence.createMany({ data: evidences.map(...) });   // ids NUEVOS
```

Y `PreschoolCatalog.savePurpose` enviaba **siempre** el arreglo completo de evidencias **sin
sus `id`**. Resultado: cada guardado del catálogo regeneraba todos los ids, y las valoraciones
ya registradas quedaban apuntando a filas inexistentes. Sin FK no había cascada ni error:
**la pérdida era silenciosa**.

Disparador real: corregir una tilde en un propósito.

### Vector único — verificado

| Camino | ¿Enviaba `evidences`? | Efecto |
|---|---|---|
| `PreschoolCatalog.savePurpose` → `PUT /achievements/:id` | Sí, siempre, **sin `id`** | **Destruía los ids** |
| `Achievements.tsx:617` → `PUT /achievements/:id` | No (`{ baseDescription }`) | Seguro: `evidences === undefined` salta el bloque |
| `POST /:id/evidences`, `PATCH /evidences/:id`, reorder | n/a | Seguros: preservan el id |
| `DELETE /achievements/evidences/:id` | n/a | **Segundo vector**: borrado físico sin comprobar valoraciones |

---

## 2. Reproducción en producción

Diagnóstico ejecutado el 2026-08-16 contra **producción** (`believable-forgiveness` → servicio
`Postgres`), solo lectura, vía `railway run` para no exponer credenciales.

### Cronología reconstruida por marcas de tiempo

```
13-ago 20:56–20:58  Se crean 4 propósitos (uno por dimensión, 3 imprescindibles cada uno)
14-ago 00:42–00:44  Se registran 12 valoraciones
14-ago 01:04        Se EDITA «Dimensión Socioafectiva» → sus 3 imprescindibles reciben ids nuevos
                    → quedan huérfanas sus 3 valoraciones de las 00:44
14-ago 01:05        Se re-capturan 3 valoraciones de Socioafectiva  ← las únicas 3 vivas hoy
14-ago 04:39        Se EDITAN Comunicativa, Cognitiva y Corporal → 9 ids nuevos
                    → quedan huérfanas sus 9 valoraciones de las 00:42–00:44
```

**Los 12 imprescindibles vivos hoy fueron creados por las ediciones (01:04 y 04:39), no por la
creación original del catálogo.** Ninguna valoración anterior a una edición sobrevivió a ella.

### Resultado medido

| Métrica | Valor |
|---|---|
| Valoraciones totales | 15 |
| **Huérfanas** | **12 (80.0 %)** |
| Instituciones afectadas | 1 — I.E.D. La Esperanza del Sur |
| Períodos afectados | 1 — 2026 · Período 1 · `OPEN` |
| Matrículas afectadas | 2 (TRANSICIÓN B) |
| Evidencias perdidas | 12 ids, 1 valoración cada uno |
| Niveles contenidos | 6 SUPERIOR · 4 BASICO · 2 BAJO |
| Snapshots disponibles | **0** (el período nunca se finalizó) |
| Clase A (recuperables desde snapshot) | 0 |
| Clase B (identificables parcialmente) | 0 |
| Clase C (irrecuperables) | **12 — 100 %** |

Script: `apps/api/scripts/diagnose-evidence-orphans.ts` (solo lectura).

```bash
cd apps/api && railway run --service Postgres -- npx ts-node scripts/diagnose-evidence-orphans.ts
```

---

## 3. ⚠️ Naturaleza de los datos afectados — SIN AFECTACIÓN ACADÉMICA REAL

**Las 12 valoraciones huérfanas son DATOS DE PRUEBA.**

I.E.D. La Esperanza del Sur está desplegada en producción pero **todavía no ha comenzado a
utilizar el sistema académicamente**. Los estudiantes, el grupo, el período y las valoraciones
encontrados fueron creados durante la validación del sistema.

Por tanto:

- **No** existen calificaciones reales de docentes que preservar.
- **No** existe información académica institucional real que recuperar.
- Este hallazgo **no es un incidente académico**.

**El valor del diagnóstico no es recuperar datos: es demostrar y documentar, con evidencia de
producción, el bug que F1 acaba de cerrar.**

> **Alcance de esta regla.** Aplica a I.E.D. La Esperanza del Sur. **Las demás instituciones
> del despliegue SÍ tienen información real.** Ninguna migración, limpieza o backfill futuro
> puede ejecutarse de forma global: debe acotarse por institución.

---

## 4. La corrección

### 4.1 Reconciliación por id — `reconcileEvidences`

> **Editar el texto de una evidencia ≠ crear una evidencia nueva.**

| Entrada | Acción |
|---|---|
| Item con `id` conocido | `update` de texto y orden — **el id sobrevive** |
| Item sin `id` | Se empareja por **texto exacto** contra una existente aún libre; si no hay coincidencia → `create` |
| Existente ausente del payload | Baja **solo si no tiene valoraciones**; si las tiene, se aborta toda la operación |

El plan se calcula **completo antes de escribir** y se aplica en `$transaction`, de modo que un
guardado bloqueado no quede aplicado a medias. El emparejamiento por texto es una red de
seguridad para clientes que aún no envíen ids: evita duplicados y bajas masivas.

### 4.2 Guarda en el borrado explícito — `deleteEvidence`

Misma regla en el segundo vector. El conteo de valoraciones **no filtra por período**: historia
de cualquier período basta para bloquear.

```
sin valoraciones  → borrado físico (comportamiento anterior, sin pérdida)
con valoraciones  → ConflictException; no borra evidencia, no borra valoraciones,
                    no toca datos históricos
```

### 4.3 Garantía resultante

**No queda ningún camino conocido en el código de aplicación que pueda dejar un
`StudentEvidenceValuation` apuntando a una evidencia inexistente.**

---

## 5. Archivos modificados

| Archivo | Cambio |
|---|---|
| `apps/api/src/modules/achievements/achievement.service.ts` | `updateAchievement` reconcilia; nuevo `reconcileEvidences`; guarda en `deleteEvidence`; import de `ConflictException` |
| `apps/api/src/modules/achievements/achievement.controller.ts` | DTO del `PUT /achievements/:id` acepta `evidences[].id` |
| `apps/web/src/lib/api.ts` | Tipo de `achievementsApi.update` acepta `evidences[].id` |
| `apps/web/src/components/achievements/PreschoolCatalog.tsx` | `savePurpose` envía el `id` de cada evidencia |
| `apps/api/src/modules/achievements/achievement-evidence-reconcile.spec.ts` | **nuevo** — 14 pruebas |
| `apps/api/scripts/diagnose-evidence-orphans.ts` | **nuevo** — diagnóstico de solo lectura |

---

## 6. Pruebas — 14/14

```bash
cd apps/api && npx jest src/modules/achievements/achievement-evidence-reconcile.spec.ts
```

**Reconciliación (`updateAchievement`)**

| Caso | Resultado |
|---|---|
| 1 · Editar solo el texto | ✅ mismo id · 1 `update` · 0 `create` · 0 `delete` |
| 2 · Agregar una nueva | ✅ existentes intactas · 1 `create` |
| 3 · Editar varias + agregar una | ✅ solo la nueva recibe id nuevo · 0 bajas |
| 4 · Guardar sin modificar evidencias | ✅ ninguna escritura, ni transacción |
| 5 · Payload sin `evidences` | ✅ ni se consulta la tabla |
| Guarda · retirar evidencia con valoraciones | ✅ `ConflictException` · cero escrituras |
| Retirar evidencia nunca valorada | ✅ `deleteMany` solo de ese id |
| Cliente legado sin ids | ✅ empareja por texto · 0 duplicados · 0 bajas |
| Entradas vacías | ✅ descartadas sin provocar bajas |

**Borrado explícito (`deleteEvidence`)**

| Caso | Resultado |
|---|---|
| A · sin valoraciones | ✅ `delete` ejecutado |
| B · una valoración | ✅ `ConflictException` · no borra |
| C · 47 valoraciones, varios estudiantes y períodos | ✅ `ConflictException` · cero borrados |
| D · solo valoraciones de períodos anteriores | ✅ bloquea; el `where` **no** contiene `academicTermId` |
| Evidencia inexistente | ✅ `NotFound` sin consultar valoraciones |

**Suite completa del API: 140 pasan, 1 falla.** La que falla es
`institution-config.service.spec.ts` (`prisma.academicYear.findFirst is not a function`),
**previa a F1 y ajena a ella** — verificada contra el árbol limpio con las modificaciones en
stash. Typecheck backend y frontend sin errores en los archivos tocados.

---

## 7. Confirmaciones

| | |
|---|---|
| ¿Se modificó cuantitativo? | **NO** |
| ¿Se modificó Prisma? | **NO** |
| ¿Se hizo migración? | **NO** |
| ¿Se modificó snapshot? | **NO** |
| ¿Se modificó boletín? | **NO** |
| ¿Se modificó convivencia? | **NO** |
| ¿Se implementó baja lógica? | **NO** |
| ¿Se repararon o borraron datos? | **NO** |
| ¿Se ejecutó F0 u otra fase? | **NO** |

`AchievementEvidence` y `StudentEvidenceValuation` no son leídos por ningún camino cuantitativo:
**impacto en cuantitativo = NINGUNO.**

---

## 8. Estado de las decisiones

### D-12 — Baja de una evidencia ya evaluada · **ABIERTA**

Hoy el sistema **bloquea**. Preserva datos, pero deja al administrador **sin ninguna vía** para
retirar del catálogo un imprescindible ya valorado. Es una limitación consciente, no una
solución. Opciones a decidir funcionalmente:

- **A.** baja lógica (`isActive`, que ya existe y `deleteEvidence` no usa)
- **B.** versionado de la evidencia
- **C.** retiro solo para períodos nuevos
- **D.** otra

No se implementó ninguna. La decisión no debe tomarse dentro de una corrección técnica.

### D-13 — Recuperación forense · **CERRADA — NO REQUERIDA**

**Motivo:** las 12 valoraciones huérfanas corresponden exclusivamente a datos de prueba creados
durante la validación del sistema. No existe información académica institucional real que
reconstruir.

**No se implementa** ninguna forma de recuperación: ni automática, ni manual, ni herramienta
para que los docentes recapturen, ni reconstrucción desde snapshots, ni alineación por orden,
ni inferencia de imprescindibles, ni ningún mecanismo especial.

### Las 12 filas huérfanas — **SE CONSERVAN** *(en el momento de F1)*

**No fueron borradas.** Aunque son datos de prueba, la limpieza es una acción independiente y
explícita que no debe mezclarse con una corrección funcional.

Nota operativa para F2: estas 12 filas **bloquearán la migración** cuando se añada la FK a
`StudentEvidenceValuation` (riesgo R-2, ahora cuantificado). Antes de esa migración habrá que
decidir si se borran o se mueven a cuarentena, **acotando la acción a esta institución**.

> **Actualización 2026-08-17 — no altera la historia de F1.** La limpieza se ejecutó después,
> como la acción independiente y explícita que esta sección anticipaba, con autorización propia
> y acotada a I.E.D. La Esperanza del Sur. Quedan **0 huérfanas** y **3
> `StudentEvidenceValuation` válidas**.
>
> La FK ya está aplicada: `StudentEvidenceValuation_achievementEvidenceId_fkey`,
> `ON DELETE RESTRICT` · `ON UPDATE RESTRICT`, migración
> `20260817120000_student_evidence_valuation_fk`. El defecto que F1 cerró en código queda ahora
> cerrado también en la base de datos. Ver `docs/F2_FK_STUDENT_EVIDENCE_VALUATION.md`.
