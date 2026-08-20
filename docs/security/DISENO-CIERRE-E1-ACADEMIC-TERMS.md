# Diseño de cierre — E-1: eliminación de `AcademicTerm` cross-tenant

> **Fase:** diseño. **Ningún archivo de código modificado. Sin commit. Sin cambios de esquema.**
> **Baseline:** commit `6214974`.
> **Alcance exclusivo:** rutas capaces de ejecutar `DELETE` sobre `AcademicTerm`.
> Las otras 28 escrituras de `evaluation` quedan **fuera** de esta fase.

---

## 1. Inventario exhaustivo de rutas DELETE

### 1.1 Total encontrado: 7 vías (5 directas + 2 indirectas por cascada)

La primera auditoría usó el patrón `prisma\.academicTerm\.`, que **no captura llamadas dentro de
transacciones interactivas** (`tx.academicTerm.…`). Se repitió con un patrón que admite cualquier
receptor, más búsqueda de SQL crudo y de la vía indirecta por `AcademicYear`.

| # | Ubicación | Operación | Naturaleza |
|---|---|---|---|
| **1** | `evaluation/academic-terms.service.ts:80` | `academicTerm.delete({ where: { id } })` | **VULNERABLE** |
| **2** | `evaluation/academic-terms.service.ts:145` | `academicTerm.delete` en bucle (`syncPeriods`) | **VULNERABLE** |
| 3 | `institution-config.service.ts:517` | `academicTerm.delete` en bucle | **YA ACOTADA** (§2) |
| 4 | `superadmin.service.ts:466` | `tx.academicTerm.deleteMany` | legítima SuperAdmin (§4) |
| 5 | `prisma/reset-logical.ts:114` | `academicTerm.deleteMany({})` | script CLI, no HTTP |
| 6 | `academic/academic-year-lifecycle.service.ts:1029` | `academicYear.delete` → cascada | **YA ACOTADA** |
| 7 | `superadmin.service.ts:467` | `tx.academicYear.deleteMany` → cascada | legítima SuperAdmin |

Búsqueda de SQL crudo (`DELETE FROM "AcademicTerm"`, `TRUNCATE`, `$executeRaw`): **sin resultados**.
No queda una tercera vía HTTP.

### 1.2 Mapa de consumidores de las dos vías vulnerables

| | **Vía 1 — `DELETE /academic-terms/:id`** | **Vía 2 — `POST /academic-terms/sync`** |
|---|---|---|
| Endpoint | `DELETE /academic-terms/:id` | `POST /academic-terms/sync` |
| Roles | `SUPERADMIN`, `ADMIN_INSTITUTIONAL` | `SUPERADMIN`, `ADMIN_INSTITUTIONAL`, `COORDINADOR` |
| Guards | `JwtAuthGuard`, `RolesGuard` | idem |
| Origen del ID | `@Param('id')` — del cliente | `@Body().academicYearId` — del cliente |
| Origen de la institución | **ninguno** | **ninguno** |
| Comprobación de pertenencia | **ninguna** | solo `findUnique` de existencia del año |
| Método que borra | `AcademicTermsService.delete(id)` | `AcademicTermsService.syncPeriods(academicYearId, periods)` |
| **Consumidor frontend** | **NINGUNO** | `lib/api.ts:212`, `contexts/AcademicContext.tsx:481` |

**Hallazgo relevante:** `DELETE /academic-terms/:id` **no tiene consumidor en la aplicación web**.
Es un endpoint huérfano — expuesto y alcanzable con un JWT válido, pero no usado por el producto.
Su severidad no baja (sigue siendo alcanzable), pero **cerrarlo tiene riesgo de regresión de UI
prácticamente nulo**.

En cambio `POST /academic-terms/sync` **sí está en uso activo** y borra períodos sobrantes. Es la
vía destructiva realmente ejercitada, y por tanto la que concentra el riesgo de regresión.

---

## 2. Por qué `institution-config` NO es una vía gemela vulnerable

La auditoría afirmó que `institution-config.service.ts:517` era una segunda vía abierta. **Esa
afirmación era incorrecta.** La cadena real:

```
PUT /institution-config/periods
  @Roles('SUPERADMIN','SUPER_ADMIN','ADMIN_INSTITUTIONAL','RECTOR')
  → const institutionId = await this.getInstitutionId(req.user.id)   ← DEL ACTOR
  → configService.updatePeriods(institutionId, periods)
  → syncPeriodsToAcademicTerms(institutionId, periods)      [private]
      → academicYear.findFirst({ where: { institutionId, status: 'ACTIVE' } })
        ?? findFirst({ where: { institutionId, status: 'DRAFT' } })
      → academicTerm.findMany({ where: { academicYearId: academicYear.id } })
      → academicTerm.delete(...)   ← acotado por derivación desde el actor
```

`getInstitutionId(userId)` consulta `institutionUser` por `userId` y no acepta **ningún** valor del
cliente. El método `syncPeriodsToAcademicTerms` es `private` y tiene un único llamador.

**Conclusión: no requiere cambios.** Tocarla sería una modificación innecesaria sobre un módulo
que ya cumple. La corrección se registró en `RLS-AUDIT-EVALUATION.md` §5.

---

## 3. Relación canónica `AcademicTerm → Institution`

**Verificada contra el esquema, no inferida.**

`AcademicTerm` declara **exactamente una** clave foránea saliente:

```prisma
academicYear AcademicYear @relation(fields: [academicYearId], references: [id], onDelete: Cascade)
```

y `AcademicYear` tiene columna directa:

```prisma
institutionId String
institution   Institution @relation(fields: [institutionId], references: [id], onDelete: Restrict)
@@unique([institutionId, year])
```

Por tanto la ruta es:

```
AcademicTerm.academicYearId → AcademicYear.institutionId → Institution.id
```

- **¿Existen varias rutas?** No. Al haber una sola FK saliente, la ruta es única.
- **¿Pueden divergir?** No: la divergencia requeriría dos caminos, y no los hay.
- **Fuente autoritativa para autorización tenant:** `academicTerm.academicYear.institutionId`.
  Es la única posible y por construcción no ambigua.

### 3.1 Radio exacto de la eliminación — verificado relación por relación

**18 con `onDelete: Cascade`** (se borran):

| Modelo | Línea | Sensibilidad |
|---|---|---|
| `TermReportCardSnapshot` | 1180 | **irreversible — boletines congelados** |
| `TermReopeningRecord` | 1206 | **irreversible — actas de reapertura** |
| `GradingPeriodConfig` | 1224 | configuración |
| `RecoveryPeriodConfig` | 1243 | configuración |
| `EvaluativeActivity` | 1326 | estructura evaluativa |
| `EvaluationPlan` | 1345 | estructura evaluativa |
| `PeriodFinalGrade` | 1887 | **irreversible — notas finales** |
| `PartialGrade` | 1913 | **irreversible — notas parciales** |
| `PreventiveCutConfig` | 2136 | configuración |
| `PreventiveAlert` | 2160 | alertas |
| `PeriodRecovery` | 2784 | **irreversible — recuperaciones** |
| `SubjectPerformance` | 2964 | desempeños |
| `PerformanceManualEdit` | 2987 | **irreversible — ediciones manuales** |
| `Achievement` | 3165 | aprendizajes (FK opcional, cascada igual) |
| `AttitudinalAchievement` | 3209 | aprendizajes |
| `StudentEvidenceValuation` | 3299 | **irreversible — valoraciones** |
| `ConvivenciaEntry` | 3326 | convivencia |
| `StudentAchievement` | 3373 | aprendizajes (FK opcional, cascada igual) |

**2 con `onDelete: SetNull`** (sobreviven, quedan desvinculados):

| `ClassroomSection` | 6033 | `academicTermId → null` |
| `ClassroomActivity` | 6111 | `academicTermId → null` |

**1 con `Restrict`** — excepción no detectada en la primera pasada:

```prisma
// PedagogicalSupportPlan:5084
academicTerm AcademicTerm @relation(fields: [academicTermId], references: [id])
```

Sin `onDelete` explícito y con relación requerida, Prisma aplica **`Restrict`**. Un período con
planes de apoyo pedagógico **no se puede eliminar**: la operación falla con violación de FK.

Es el **único freno existente** hoy, y es incidental: no fue diseñado como salvaguarda y no cubre
los otros 18 modelos. **No se modifica ninguna relación.**

---

## 4. SuperAdmin: operación legítima que NO se debe romper

Existe una operación global genuina, y no pasa por ninguna de las dos rutas vulnerables:

```
DELETE /superadmin/institutions/:id
  → superadminService.deleteInstitution(req.user.id, id, body.confirmationName)
      → await this.verifySuperAdmin(superAdminId)
      → confirmationName debe coincidir EXACTAMENTE con institution.name
      → $transaction: … tx.academicTerm.deleteMany({ where: { academicYear: { institutionId } } })
```

`verifySuperAdmin` lee **`User.isSuperAdmin` desde la base de datos**, no el array `roles`:

```ts
const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
if (!user?.isSuperAdmin) throw new ForbiddenException(...);
```

Es la misma disciplina que se aplicó al corregir `institution-resolver` (claim booleano, nunca el
array de roles, que proviene de `InstitutionUserRole` y sería falsificable por un admin de tenant).
**Correcto tal como está. No se toca.**

### 4.1 Tratamiento de SuperAdmin en las dos rutas a cerrar

`resolveInstitutionId` ya implementa la semántica adecuada:

- **SuperAdmin** (`user.isSuperAdmin === true`) **+ `institutionId` explícito** → se acepta ese valor.
- **Usuario normal** → siempre el del JWT; el valor del cliente se ignora y se registra un warning.

**Decisión propuesta: no introducir un bypass.** SuperAdmin conserva la capacidad global, pero debe
**declarar explícitamente la institución destino** vía `?institutionId=`. Razones:

1. Es el patrón ya aplicado en los 9 módulos endurecidos (`students`, `communications`, `observer`…);
   introducir aquí una excepción rompería la uniformidad.
2. Para una cascada destructiva sobre 18 entidades, un destino explícito convierte una acción
   cross-tenant en deliberada en lugar de accidental.
3. No añade seguridad frente a un SuperAdmin malicioso — pero sí frente a uno distraído.

*Alternativa descartada:* `if (isSuperAdmin(req.user)) return service.delete(id)` sin acotar.
Más simple, pero elimina la confirmación implícita del destino en la operación más destructiva del
módulo.

---

## 5. Punto único de control

**No existe hoy un punto común compartido entre `evaluation` e `institution-config`**, y —
demostrado en §2 — **no hace falta crearlo**: `institution-config` ya está acotado. Fabricar un
servicio compartido obligaría a modificar un módulo que cumple, en contra del criterio de cambio
mínimo.

El punto único de control real es **`AcademicTermsService`**, que es el destino final de las dos
vías vulnerables. Se propone el patrón ya validado en `observer`:

```ts
// academic-terms.service.ts  (privado)
private async assertTermInInstitution(termId: string, institutionId: string) {
  const term = await this.prisma.academicTerm.findFirst({
    where: { id: termId, academicYear: { institutionId } },   // ← ruta canónica §3
    select: { id: true },
  });
  if (!term) throw new NotFoundException('Período académico no encontrado');
  return term;
}

private async assertYearInInstitution(yearId: string, institutionId: string) {
  const year = await this.prisma.academicYear.findFirst({
    where: { id: yearId, institutionId },
    select: { id: true },
  });
  if (!year) throw new NotFoundException('Año académico no encontrado');
  return year;
}
```

- El **servicio** es el punto de control, no el controlador (lección de `guardians`).
- Se reutiliza `NotFoundException`, ya usado por estas rutas: **no se introduce semántica 403/404
  nueva** y no se revela la existencia de recursos ajenos.
- No se inyecta `AcademicYearLifecycleService` (que ya tiene `getYearById(yearId, institutionId)`)
  para **no crear una dependencia `evaluation → academic`** por dos métodos. Se valora como
  alternativa si el usuario prefiere consolidar.

### 5.1 Cambios en firma

| Método | Antes | Después |
|---|---|---|
| `delete` | `delete(id)` | `delete(id, institutionId)` → `assertTermInInstitution` primero |
| `syncPeriods` | `syncPeriods(academicYearId, periods)` | `syncPeriods(academicYearId, periods, institutionId)` → `assertYearInInstitution` primero |

Controlador: `const instId = await requireInstitutionId(this.prisma as any, req, institutionId?)`.

**Nada más cambia.** El cuerpo de `syncPeriods` (crear/actualizar/borrar sobrantes) y el `delete`
quedan **idénticos** una vez superado el aserto.

---

## 6. Archivos que habría que tocar

| Archivo | Cambio |
|---|---|
| `evaluation/academic-terms.controller.ts` | resolver institución en `DELETE /:id` y `POST /sync` |
| `evaluation/academic-terms.service.ts` | 2 asertos privados + 2 firmas |
| `evaluation/academic-terms.isolation.spec.ts` | **nuevo** |

**Explícitamente NO se tocan:** `institution-config` (§2), `superadmin` (§4),
`academic-year-lifecycle` (ya acotado), `prisma/schema.prisma`, migraciones, `reset-logical.ts`,
ni las otras 27 escrituras de `evaluation`.

---

## 7. Pruebas a añadir (diseñadas antes de implementar)

### Matriz de aislamiento

| # | Actor | Recurso | Ruta | Esperado |
|---|---|---|---|---|
| 1 | Institución A | `AcademicTerm` de A | `DELETE /:id` | **permitido**, borra |
| 2 | Institución A | `AcademicTerm` de B | `DELETE /:id` | `NotFoundException` |
| 3 | Institución B | `AcademicTerm` de A | `DELETE /:id` | `NotFoundException` |
| 4 | Institución A | `AcademicYear` de A | `POST /sync` | **permitido** |
| 5 | Institución A | `AcademicYear` de B | `POST /sync` | `NotFoundException` |
| 6 | Institución B | `AcademicYear` de A | `POST /sync` | `NotFoundException` |
| 7 | SuperAdmin + `?institutionId=B` | `AcademicTerm` de B | `DELETE /:id` | **permitido** |
| 8 | SuperAdmin + `?institutionId=A` | `AcademicTerm` de B | `DELETE /:id` | `NotFoundException` |
| 9 | Usuario normal + `?institutionId=B` | `AcademicTerm` de B | `DELETE /:id` | rechazado — se ignora el query y se usa el JWT |

### Pruebas de no-regresión (que nada académico cambia)

10. **La cascada legítima sigue intacta:** en el caso 1, el `delete` se ejecuta con
    `where: { id }` — se verifica que la llamada a Prisma es idéntica a la del baseline y que no
    se añadió ningún filtro que altere el borrado en cascada.
11. **`syncPeriods` conserva su lógica:** creación, actualización y borrado de sobrantes producen
    el mismo resultado que en el baseline para un actor legítimo (mismo número de `create`,
    `update` y `delete`, mismos argumentos).
12. **El `try/catch` de `syncPeriods` se mantiene sin cambios** (§8).
13. **La autorización por rol no cambia:** los `@Roles` de ambas rutas quedan idénticos; se prueba
    que un `COORDINADOR` sigue pudiendo `sync` y sigue **sin** poder `DELETE /:id`.
14. **El aserto corre antes que cualquier escritura:** con un recurso ajeno, se verifica que
    `prisma.academicTerm.delete` **nunca se invoca**.

Referencia de volumen: `observer.isolation.spec.ts` (50 casos), `communications` (55).
Estimación aquí: **~20 casos**.

---

## 8. `syncPeriods`: salvaguarda inerte — NO se corrige en esta fase

```ts
try {
  await this.prisma.academicTerm.delete({ where: { id: t.id } });
} catch (e) {
  // Si tiene dependencias, no eliminar
}
```

- **Qué pasa realmente:** de los 21 modelos hijos, 18 son `Cascade` y 2 `SetNull`. Para todos
  ellos el `delete` **no lanza error: borra**. El `catch` solo se activa con
  `PedagogicalSupportPlan` (`Restrict`, §3.1). La intención declarada — «si tiene dependencias, no
  eliminar» — se cumple en 1 de 21 casos.
- **Por qué queda fuera del cierre tenant:** es un problema de **integridad académica**, no de
  aislamiento. Un actor legítimo de su propia institución puede destruir su propio período. Cerrar
  el tenant no lo resuelve ni lo empeora, y arreglarlo aquí significaría alterar una regla
  académica — exactamente lo que esta fase prohíbe.
- **Dónde queda registrado:** `RLS-AUDIT-EVALUATION.md` §4.1 y §6 como **deuda D-2**, eje
  «integridad académica».

El mismo patrón inerte existe en `institution-config.service.ts:517`. También se deja registrado y
sin tocar.

---

## 9. Riesgos de regresión

| # | Riesgo | Probabilidad | Mitigación |
|---|---|---|---|
| R-1 | `POST /sync` es la ruta viva. Si `AcademicContext` enviara un `academicYearId` de otra institución en algún flujo, ahora fallaría. | Baja — el contexto se carga por institución | Prueba 4 (A/A) + verificación manual en staging del flujo de Períodos |
| R-2 | `requireInstitutionId` lanza `Error` genérico → **500**, no 4xx. | Cierta | Comportamiento **preexistente** en los 9 módulos ya endurecidos. No se cambia aquí para no alterar contratos; se registra como deuda transversal |
| R-3 | SuperAdmin sin fila `InstitutionUser` que llame `sync` sin `institutionId` pasará a fallar. | Media | Prueba 7; documentar que SuperAdmin debe declarar destino |
| R-4 | Usuario multi-institución cuyo JWT apunte a una institución y edite el año de otra. | Muy baja | El resolver usa siempre el JWT; el cambio de institución reemite el JWT (`switchInstitution`) |
| R-5 | Endpoint huérfano: cerrar `DELETE /:id` podría romper un consumidor externo no visible en `apps/web`. | Muy baja | Búsqueda en `apps/web` sin resultados; queda como supuesto declarado |

---

## 10. Hallazgos nuevos de esta fase

1. **Tercera vía real:** `superadmin.service.ts:466` (`tx.academicTerm.deleteMany`) — invisible al
   patrón `prisma\.` de la auditoría. Legítima, pero el método de búsqueda anterior era
   incompleto: **toda búsqueda futura debe contemplar `tx.`**.
2. **Dos vías indirectas por cascada** vía `AcademicYear` (`deleteYear` y el borrado de
   institución). Ambas ya acotadas.
3. **`institution-config` no era vulnerable.** Corrección registrada (§2).
4. **`PedagogicalSupportPlan` es `Restrict`**, no `Cascade`. Radio real 18/2/1, no 18.
5. **`DELETE /academic-terms/:id` no tiene consumidor frontend** — endpoint huérfano.
6. **`POST /academic-terms/sync` es la vía destructiva realmente en uso**, y no estaba señalada
   como prioritaria en la auditoría inicial. Es el objetivo de mayor valor de esta fase.

---

**Fin de la fase de diseño. No se implementa nada sin autorización explícita.**
