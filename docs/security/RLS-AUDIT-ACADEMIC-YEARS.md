# AUDITORÍA CROSS-TENANT · `academic-years`

> **Fase de solo lectura.** No se modificó ningún controlador, servicio, prueba ni esquema.
> No se hizo commit ni push. Staging y producción intactos.
>
> **Fecha:** 2026-08-19 · **Rama:** `security/fase0.3-contencion` · **Commit base:** `d950235`
> · Baseline: 527/527, typecheck limpio, staging `SUCCESS`, producción `a00b3f5`.

---

## 1. Alcance

Se auditó el módulo del ciclo de vida del año lectivo y **toda la superficie que escribe la
entidad `AcademicYear`**, no solo su controlador. La lección de `guardians` y `students` es
que el límite del controlador no coincide con el límite de la superficie de seguridad — y
aquí vuelve a cumplirse: **hay una segunda ruta de creación de años en otro módulo, y es
justamente la que usa el frontend.**

| Superficie | Hallado |
|---|---|
| Endpoints en `academic-year-lifecycle.controller.ts` | **13** |
| Endpoints en otros módulos que escriben `AcademicYear` | **2** (`academic-terms`) |
| Métodos en `academic-year-lifecycle.service.ts` | ~25 (1 175 líneas) |
| Escrituras Prisma sobre `AcademicYear` fuera del módulo | 3 puntos |

---

## 2. Mapa de endpoints

### 2.1 `academic-year-lifecycle.controller.ts` — guard de clase `JwtAuthGuard, RolesGuard`

| # | Ruta | Método | Operación | Actores | Entrada del cliente | Entidad | Tenant hoy | Riesgo |
|---|---|---|---|---|---|---|---|---|
| 1 | `/` | POST | escritura | ADMIN, SUPERADMIN | `dto.institutionId` | `AcademicYear` + `AcademicTerm` | **del cuerpo** | **P1** |
| 2 | `/` | GET | lectura | 6 roles | `?institutionId` | `AcademicYear` | **del query** | **P2** |
| 3 | `/institution/:institutionId` | GET | lectura | 6 roles | param | `AcademicYear` | **del path** | **P2** |
| 4 | `/institution/:institutionId/current` | GET | lectura | 6 roles **+ ESTUDIANTE** | param | `AcademicYear` | **del path** | **P2** |
| 5 | `/:yearId` | GET | lectura | 6 roles | `yearId` | `AcademicYear` | **ninguno** | **P2** |
| 6 | `/:yearId` | PUT | escritura | ADMIN, SUPERADMIN | `yearId` | `AcademicYear` | **ninguno** | **P1** |
| 7 | `/:yearId` | DELETE | **destructiva** | ADMIN, SUPERADMIN | `yearId` | `AcademicYear` | **ninguno** | **P1** |
| 8 | `/:yearId/activate` | POST | escritura | ADMIN, SUPERADMIN | `yearId` | `AcademicYear` | **ninguno** | **P0** |
| 9 | `/:yearId/close` | POST | **escritura en cascada** | ADMIN, SUPERADMIN | `yearId` | `AcademicYear`, `StudentEnrollment`, `EnrollmentEvent` | **ninguno** | **P0** |
| 10 | `/:fromYearId/promote-to/:toYearId` | POST | **escritura en cascada** | ADMIN, SUPERADMIN | **dos** `yearId` | `StudentEnrollment`, `EnrollmentEvent` | **parcial** | **P0** |
| 11 | `/:yearId/validate-activation` | GET | lectura | ADMIN, SUPERADMIN | `yearId` | vía `getYearById` | **ninguno** | **P2** |
| 12 | `/:yearId/validate-closure` | GET | lectura | ADMIN, SUPERADMIN | `yearId` | vía `getYearById` | **ninguno** | **P2** |
| 13 | `/:yearId/promotion-preview` | GET | lectura | ADMIN, SUPERADMIN | `yearId` | notas y promociones | **ninguno** | **P2** |
| 14 | `/:yearId/permissions` | GET | lectura | 6 roles | `yearId` | vía `getYearById` | **ninguno** | **P2** |

*(14 rutas: el controlador declara 13 decoradores HTTP; `/:yearId/permissions` comparte el
prefijo con las anteriores.)*

### 2.2 Superficie lateral — `academic-terms.controller.ts`

| Ruta | Método | Estado |
|---|---|---|
| `GET /academic-terms/years` | GET | ✅ **ya endurecido** — usa `requireInstitutionId` |
| `POST /academic-terms/years` | POST | 🔴 **`data.institutionId` del cuerpo, sin resolver** |

> 🔴 **`POST /academic-terms/years` es una segunda ruta de creación de años lectivos**, en
> otro módulo, con la institución controlada por el cliente. Y es **la que el frontend usa
> realmente** (`academicYearsApi.create` → `/academic-terms/years`). Endurecer solo
> `academic-years` dejaría la puerta principal abierta.

### 2.3 Otras escrituras de `AcademicYear`

| Origen | Operación | Veredicto |
|---|---|---|
| `superadmin.service.ts:467` | `deleteMany({ institutionId })` | ✅ legítima — precedida de `verifySuperAdmin()` |
| `play-workspace.service.ts:85` | `create` | ⚠️ `institutionId` interno del workspace de Play, no del cliente. **Requiere trazado propio** — no se amplía el alcance aquí |

---

## 3. Consumidores reales

Verificados en el frontend, no inferidos por el nombre de la ruta.

| Ruta | Consumidor | Estado |
|---|---|---|
| `getCurrent` (`/institution/:id/current`) | **7 usos** | confirmado |
| `getByInstitution` (`/institution/:id`) | **7 usos** | confirmado |
| `close` | 2 usos | confirmado |
| `validateClosure`, `validateActivation`, `activate` | 1 uso cada uno | confirmado |
| `create` (`POST /academic-years`) | 1 uso | confirmado |
| `POST /academic-terms/years` | `academicYearsApi.create` | **confirmado — el camino real de creación** |
| `PUT /:yearId` (updateYear) | **ninguno** | superficie sin consumidor |
| `DELETE /:yearId` | **ninguno** | superficie sin consumidor |
| `POST /:fromYearId/promote-to/:toYearId` | **ninguno** | superficie sin consumidor |
| `GET /:yearId`, `promotion-preview`, `permissions` | **ninguno** | superficie sin consumidor |

**Seis rutas sin consumidor confirmado.** No son código muerto —están montadas y son
alcanzables— pero nadie las llama desde el frontend. **No se eliminan.**

Consumidores internos del servicio: `enrollment.service`, `onboarding-state.service`,
`men-reports.service`, `reports.service`, `reports-export.service`. Todos usan métodos de
lectura auxiliares (`getPassingGrade`, `getTermsByAcademicYear`, `getTeacherAssignments*`),
no las mutaciones del ciclo de vida.

---

## 4. Relaciones de tenant verificadas en el schema

| Entidad | Relación con `Institution` |
|---|---|
| `AcademicYear` | **`institutionId` directo** (`@@unique([institutionId, year])`) |
| `StudentEnrollment` | `institutionId` directo |
| `EnrollmentEvent` | `institutionId` directo |
| `Grade` | `institutionId` directo |
| `Group` | **indirecto** — vía `campus.institutionId` |

No hay ambigüedad: `yearId → institutionId` es una relación directa y fiable. **El problema
no es que la relación falte, es que nadie la comprueba contra el actor.**

---

## 5. Hallazgo P0-1 · `close`

### Flujo trazado

```
ADMIN de A  →  POST /academic-years/<yearId de B>/close
   ↓ JwtAuthGuard        autentica
   ↓ RolesGuard          @Roles('ADMIN_INSTITUTIONAL','SUPERADMIN') → pasa: el rol es correcto
   ↓ controller          closeYear({ yearId, userId: req.user.id, calculatePromotions })
   ↓ getYearById(yearId) findUnique({ id }) — SIN filtro de institución  ← el fallo
   ↓ validateYearForClosure(yearId)
   ↓ FASE 1  computePromotions(yearId)      lectura de notas de B
   ↓ FASE 2  $transaction:
        studentEnrollment.update({ where: { id: w.enrollmentId }, data: { status } })   × N
        enrollmentEvent.create({ institutionId: w.institutionId, ... })                 × N
        academicYear.update({ where: { id: yearId }, data: { status: 'CLOSED' } })
```

### Qué modifica exactamente

- El **estado de cada matrícula** del año: `PROMOTED` / `REPEATED` / `GRADUATED` / `REVIEW_PENDING` / `WITHDRAWN`.
- Un `EnrollmentEvent` de auditoría por estudiante.
- El año pasa a `CLOSED`.

**Punto a favor del código:** la cascada es internamente coherente. `computePromotions(yearId)`
deriva todo del año, y `w.institutionId` procede de la propia matrícula. **Todos los objetos
afectados pertenecen necesariamente a la institución del `yearId`** — no hay un segundo
identificador del cliente que pueda desviar la escritura.

**El fallo es único y limpio: el `yearId` no se comprueba contra el actor.**

### Impacto

Un ADMIN de A cierra el año lectivo de B: se recalculan y **se reescriben las promociones de
todos sus estudiantes**. No borra filas, pero **altera el resultado académico del año**, y
revertirlo exige reabrir el año y recalcular — sin garantía de recuperar el estado previo.

**Severidad P0** confirmada, y por la razón que ya se había anticipado: la ausencia de
borrado no la degrada.

---

## 6. Hallazgo P0-2 · `promote-to` — el peor del módulo

Este **no estaba en la lista P0 original** y es más grave que `activate`.

```
POST /academic-years/<fromYearId>/promote-to/<toYearId>
```

**Dos identificadores del cliente, y solo uno gobierna el aislamiento.**

```ts
const fromYear = await this.getYearById(dto.fromYearId);   // sin filtro de institución
const toYear   = await this.getYearById(dto.toYearId);     // sin filtro de institución

// YC-1: los grados se limitan a la institución del año de ORIGEN
const grades = await this.prisma.grade.findMany({
  where: { institutionId: fromYear.institutionId },
});
...
await this.prisma.studentEnrollment.create({
  data: {
    institutionId:  oldEnrollment.institutionId,   // ← institución de fromYear
    academicYearId: dto.toYearId,                  // ← ¡puede ser de OTRA institución!
    groupId:        targetGroup.id,                // ← grupo de fromYear
  },
});
```

Existe una guarda parcial (`YC-1`) que acota los **grados** a `fromYear.institutionId`.
**Pero nadie comprueba que `toYear` pertenezca a la misma institución que `fromYear`.**

Dos vectores distintos:

| Vector | Efecto |
|---|---|
| `fromYearId` de B | Se leen las matrículas de B y se crean matrículas nuevas **dentro de B** |
| `toYearId` de B, `fromYearId` de A | Se crea una `StudentEnrollment` con `institutionId = A`, `groupId` de A y **`academicYearId` de B** |

El segundo produce **una fila estructuralmente incoherente entre tenants**: su columna de
institución dice A, pero su año lectivo pertenece a B. Es exactamente el mismo patrón que el
vínculo `StudentGuardian` cruzado, y con la misma consecuencia futura: la política RLS la
vería desde un lado y no desde el otro.

**Severidad P0.** Sin consumidor en el frontend, pero plenamente alcanzable.

---

## 7. Hallazgo P0-3 · `activate`

```ts
const updatedYear = await this.prisma.academicYear.update({
  where: { id: dto.yearId },
  data: { status: 'ACTIVE', activatedAt, activatedById: dto.userId },
});
```

Sin comprobación de institución. Activar el año de B habilita en esa institución el registro
de notas y las matrículas — o, si ya había otro activo, produce un estado inconsistente.
Superficie de escritura menor que `close`, pero con efecto operativo inmediato.

---

## 8. Hallazgos P1 · escrituras

| # | Ruta | Detalle |
|---|---|---|
| **P1-1** | `PUT /:yearId` | `updateYear`. **Punto a favor:** solo permite `name`, `startDate`, `endDate` — **no acepta `institutionId`**, así que *no* se puede migrar un año de una institución a otra. Y exige estado `DRAFT`. Pero el `yearId` no se comprueba: se puede editar el año en preparación de B |
| **P1-2** | `DELETE /:yearId` | `deleteYear`. Exige `DRAFT` y cero matrículas — buena salvaguarda —, pero sin comprobación de institución: **borra el año que B está preparando para el curso siguiente** |
| **P1-3** | `POST /academic-years` | `dto.institutionId` del cuerpo. Crea año + sus `AcademicTerm` en cualquier institución |
| **P1-4** | `POST /academic-terms/years` | **La ruta que usa el frontend.** `data.institutionId` del cuerpo, sin resolver. Módulo distinto |

---

## 9. Hallazgos P2 · lecturas

**`getYearById(yearId)` es la pieza clave**: `findUnique({ where: { id } })` sin filtro. Y
**todas las mutaciones lo invocan primero**, así que arreglarlo cierra de golpe la lectura y
da el punto natural para la comprobación de escritura.

| # | Ruta | Fuga |
|---|---|---|
| P2-1 | `GET /:yearId` | Año ajeno completo, con `_count` de matrículas y asignaciones |
| P2-2 | `GET /institution/:institutionId` | Todos los años de la institución indicada |
| P2-3 | `GET /institution/:institutionId/current` | Año vigente ajeno — **alcanzable incluso por `ESTUDIANTE`** |
| P2-4 | `GET /?institutionId=` | Ídem por query |
| P2-5 | `GET /:yearId/promotion-preview` | **Proyección de promoción de los estudiantes de B**: notas, áreas perdidas, decisión |
| P2-6 | `GET /:yearId/validate-activation`, `validate-closure`, `permissions` | Estado interno del año ajeno |

**Sobre el patrón "omitir el filtro":** se buscó explícitamente el defecto de `students`
(`...(institutionId && { institutionId })`). **No aparece aquí**: `getYearsByInstitution` y
`getCurrentYear` sí filtran siempre por el `institutionId` que reciben. El problema es que
ese valor llega del path o del query **sin resolver**, no que el filtro desaparezca.

---

## 10. Contraste con el censo

| | Censo | Esta auditoría |
|---|---|---|
| Escrituras de `academic-years` censadas | 2 (`POST /`, `PUT /:yearId`) | **7** |
| No detectadas por el censo | — | `close`, `activate`, `promote-to`, `DELETE /:yearId`, `POST /academic-terms/years` |

**Por qué el detector no las vio:** `close`, `activate`, `promote-to` y `DELETE` **no reciben
`institutionId` por ninguna vía** — pertenecen a la clase **D-recurso**, que el censo
cuantificó como candidatas heurísticas (≈132) pero no enumeró endpoint por endpoint. Esta
auditoría las confirma como vulnerabilidades reales, lo que **refuerza la validez de esa
clase**: 4 candidatas más pasan a confirmadas.

`POST /academic-terms/years` sí es clase D-entrada y estaba fuera del recuento porque usa un
**tipo literal en línea** en otro módulo, y el censo lo atribuía a `evaluation`, no a años
lectivos.

---

## 11. Propuesta de corrección (no implementada)

**Punto único de control: `getYearById`.** Pasa a exigir la institución resuelta y a acotar
la consulta. Como todas las mutaciones lo invocan primero, una sola guarda cubre `close`,
`activate`, `updateYear`, `deleteYear`, `validate*`, `promotion-preview` y `permissions`.

| Ruta | Corrección |
|---|---|
| Todas las de `:yearId` | `requireInstitutionId` en el controlador → `getYearById(yearId, institutionId)` acotado |
| `promote-to` | Además: **exigir que `toYear.institutionId === fromYear.institutionId === institución resuelta`** |
| `POST /` y `POST /academic-terms/years` | `requireInstitutionId(…, dto.institutionId)`; se ignora el valor del cliente |
| `GET /institution/:institutionId(/current)` y `GET /?institutionId=` | Resolver en servidor; el param se honra solo para SuperAdmin |
| Autorización | **Sin cambios.** Se conservan los `@Roles` actuales. No se inventa ningún rol |

**Semántica de error:** consulta acotada + el `NotFoundException` que `getYearById` ya lanza
cuando el año no existe. Mismo patrón que `guardians` y `students`: no inventa semántica y no
revela la existencia del recurso ajeno.

---

## 12. Riesgo de regresión

**Bajo, con dos matices que exigen verificación antes de desplegar:**

1. **`GET /institution/:institutionId/current` lo consumen 7 puntos del frontend y es
   alcanzable por `ESTUDIANTE`.** Es la ruta más usada del módulo. Al resolver en servidor,
   el `institutionId` del path pasará a ignorarse para usuarios normales — hay que confirmar
   que el frontend siempre envía el propio (patrón observado en `capabilities` y `students`,
   pero **debe comprobarse aquí explícitamente**).
2. **SuperAdmin sin institución en el JWT.** `requireInstitutionId` lanzaría. Las rutas
   `/institution/:institutionId` deben seguir honrando el param para SuperAdmin.

Las seis rutas sin consumidor (`updateYear`, `deleteYear`, `promote-to`, `getYearById`,
`promotion-preview`, `permissions`) tienen **riesgo de regresión nulo**.

---

## 13. Pruebas que deberían existir

1. `close` con `yearId` de B → rechazado, **sin ninguna escritura**
2. `close` con año propio → funciona y conserva el cálculo de promociones
3. `activate` con `yearId` de B → rechazado
4. `promote-to` con `fromYearId` de B → rechazado
5. `promote-to` con `fromYear` de A y `toYear` de B → **rechazado** (vínculo cruzado)
6. `promote-to` con ambos años de A → funciona
7. `updateYear` / `deleteYear` con año de B → rechazados
8. `deleteYear` conserva sus salvaguardas (`DRAFT` + sin matrículas)
9. `getYearById` con año de B → no encontrado
10. `GET /institution/:institutionId` con B → devuelve los de A
11. `promotion-preview` de B → rechazado
12. SuperAdmin conserva su alcance explícito
13. Regresión: `getCurrent` y `getByInstitution` siguen funcionando para los 7 consumidores

---

## 14. Respuestas al criterio de terminación

**A · ¿Cuántos endpoints tiene realmente `academic-years`?**
**13 en su controlador**, más **2 en `academic-terms`** que escriben la misma entidad. Superficie efectiva: **15**.

**B · ¿Cuántas vulnerabilidades cross-tenant confirmaste?**
**13** — 7 de escritura y 6 de lectura.

**C · ¿Cuántas son P0?**
**3**: `close`, `promote-to` y `activate`.

**D · ¿Son `close`, `activate` y `updateYear` las únicas escrituras vulnerables?**
**No.** Hay **7**: esas tres más `DELETE /:yearId`, `promote-to`, `POST /academic-years` y `POST /academic-terms/years`.

**E · ¿Existen lecturas IDOR?**
**Sí, 6.** La más sensible es `promotion-preview`, que expone la proyección académica de los estudiantes de otra institución.

**F · ¿Existen escrituras indirectas desde otros módulos?**
**Sí.** `POST /academic-terms/years` (vulnerable, **y es la que usa el frontend**),
`superadmin.service` (legítima) y `play-workspace.service` (requiere trazado propio).

**G · ¿Alguna operación destructiva adicional?**
**Sí:** `DELETE /:yearId`. Conserva salvaguardas (`DRAFT`, sin matrículas) pero sin comprobación de institución.

**H · ¿Hay algún `institutionId` controlable por el cliente?**
**Sí, en cuatro sitios:** el DTO de `POST /academic-years`, el cuerpo de `POST /academic-terms/years`, y el path/query de las tres rutas de listado.
**Punto a favor:** `updateYear` **no** admite `institutionId`, así que **no se puede migrar un año lectivo de una institución a otra.**

**I · ¿Qué actor mínimo puede explotar cada vulnerabilidad?**
Escrituras: `ADMIN_INSTITUTIONAL` (el mínimo de las tres P0).
Lecturas: `DOCENTE`, `RECTOR`, `SECRETARIA`, `COORDINADOR` — y **`ESTUDIANTE`** en `/institution/:institutionId/current`.

**J · ¿Qué flujo legítimo podría romperse?**
Solo dos: `getCurrent` y `getByInstitution` (7 consumidores cada uno) y el alcance del SuperAdmin. Las seis rutas sin consumidor no tienen riesgo.

**K · ¿Orden recomendado de implementación?**

1. **`getYearById`** — punto único; cierra de golpe 3 P0 y 4 P2
2. **`promote-to`** — necesita además la comprobación `fromYear ≡ toYear`
3. **`POST /academic-terms/years`** — la puerta lateral en uso real
4. **`POST /academic-years`**, `updateYear`, `deleteYear`
5. **Las tres rutas de listado** — las de mayor riesgo de regresión, al final y con verificación del frontend

---

## 15. Deuda de seguridad registrada (no olvidar)

**`men-reports`** sigue pasando `dto.institutionId` sin resolver a
`getEnrollmentsForMenReport`. Sus cinco rutas están hoy inertes porque exigen los roles
`ADMIN` y `COORDINATOR`, **que no existen en `SYSTEM_ROLES`**. Es una errata actuando como
cerradura.

> ⚠️ **Si alguien corrige esos nombres de rol sin endurecer antes `institutionId`, reactiva
> cinco brechas de golpe.** Ambas correcciones deben ir en el mismo cambio, nunca por
> separado.

---

## 16. Qué NO se hizo

No se editó ningún controlador, servicio, DTO, prueba ni esquema. No se creó ningún commit
ni push. No se tocó staging ni producción. No se activó RLS. No se eliminó código muerto ni
se corrigieron los roles latentes de `men-reports`. No se implementó ninguna corrección.
