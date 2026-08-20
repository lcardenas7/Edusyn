# AUDITORÍA CROSS-TENANT · `observer`

> **Fase de solo lectura.** No se modificó controlador, servicio, DTO, prueba ni esquema. No
> se creó ningún test, commit ni push. Staging y producción intactos.
>
> **Fecha:** 2026-08-19 · **Rama:** `security/fase0.3-contencion`

---

## 1. Baseline

| | |
|---|---|
| Commit | `5565232` |
| Suite | **608/608** |
| Typecheck | limpio |
| `origin/staging` | `5565232` |
| `origin/main` (producción) | `a00b3f5` — **intacta** |

**Naturaleza del dato:** este módulo contiene el **observador del estudiante** — faltas
disciplinarias, actas de convivencia, compromisos, citaciones a acudientes, remisiones a
orientación y medidas pedagógicas. Es **PII sensible de menores** y, en el marco colombiano,
material con valor probatorio en procesos de convivencia escolar.

---

## 2. Corrección del alcance previsto

El censo atribuía a `observer` **8 IDOR**. El mapa completo da **27 endpoints** y una
distribución muy distinta:

| | Censo | Esta auditoría |
|---|---|---|
| Endpoints | ~8 | **27** |
| Endpoints que resuelven institución del contexto | — | **3** |
| Endpoints sin ninguna referencia a institución | — | **24** |

Es la **tercera vez consecutiva** que el mapa completo cambia el número. Y por segunda vez
aparece la clase que ningún detector automático encuentra: **una lista cuyo único filtro es
opcional, y que el cliente puede desactivar**.

---

## 3. Mapa completo — 27 endpoints

Guard de clase `JwtAuthGuard, RolesGuard`. **Todos los endpoints tienen `@Roles`** (a
diferencia de `communications`). Tenant: **A** del contexto · **B** del cliente · **C**
derivado de un recurso elegido por el cliente · **D** sin comprobación.

### 3.1 Observaciones

| # | Método | Ruta | Roles | Consumidor | L/E | Tenant | Riesgo |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/` | SUPER, ADMIN, COORD, DOCENTE | `Observer.tsx` | E | **C** | **P1** |
| 2 | PUT | `/:id` | ídem | `Observer.tsx` | E | **D** | **P1** |
| 3 | DELETE | `/:id` | SUPER, ADMIN, COORD | `Observer.tsx` | E destructiva | **D** | **P1** |
| 4 | GET | `/dashboard` | SUPER, ADMIN, COORD | **ninguno** | L | **A** | ✅ |
| 5 | GET | `/stats/convivencial` | + RECTOR, DOCENTE | `ObserverStats.tsx` ×3 | L | **A** | ✅ |
| 6 | GET | `/pending-followups` | SUPER, ADMIN, COORD, DOCENTE | **declarado, no invocado** | L | **D** | 🔴 **P0** |
| 7 | GET | `/by-group/:groupId` | SUPER, ADMIN, COORD, DOCENTE | `Observer.tsx` | L | **D** | **P2** |
| 8 | GET | `/by-student/:studentEnrollmentId` | + **ESTUDIANTE** | `Students.tsx` | L | **D** | **P2** |
| 9 | GET | `/timeline/:studentEnrollmentId` | + **ESTUDIANTE** | **ninguno** | L | **D** | **P2** |
| 10 | GET | `/summary/:studentEnrollmentId` | + **ESTUDIANTE** | `Students.tsx` | L | **D** | **P2** |
| 11 | GET | `/commission-data` | SUPER, ADMIN, COORD, RECTOR, DOCENTE | `CommissionReports.tsx` | L | **A** | ✅ |
| 12 | GET | `/:id` | + **ESTUDIANTE** | **ninguno** | L | **D** | **P2** |
| 13 | PUT | `/:id/notify-parent` | SUPER, ADMIN, COORD, DOCENTE | `Observer.tsx` | E | **D** | **P1** |

### 3.2 Actas, compromisos, citaciones, remisiones, medidas

| # | Método | Ruta | Roles | Consumidor | L/E | Tenant | Riesgo |
|---|---|---|---|---|---|---|---|
| 14 | POST | `/actas` | SUPER, ADMIN, COORD | **ninguno** | E | **D** | **P1** |
| 15 | PUT | `/actas/:id` | ídem | **ninguno** | E | **D** | **P1** |
| 16 | POST | `/commitments` | + DOCENTE | **ninguno** | E | **C** | **P1** |
| 17 | PUT | `/commitments/:id` | + DOCENTE | **ninguno** | E | **D** | **P1** |
| 18 | GET | `/commitments/by-student/:id` | + **ESTUDIANTE** | **ninguno** | L | **D** | **P2** |
| 19 | POST | `/citations` | + DOCENTE | **ninguno** | E | **C** | **P1** |
| 20 | PUT | `/citations/:id` | + DOCENTE | **ninguno** | E | **D** | **P1** |
| 21 | GET | `/citations/by-student/:id` | SUPER, ADMIN, COORD, DOCENTE | **ninguno** | L | **D** | **P2** |
| 22 | POST | `/referrals` | + DOCENTE | **ninguno** | E | **C** | **P1** |
| 23 | PUT | `/referrals/:id` | + DOCENTE | **ninguno** | E | **D** | **P1** |
| 24 | GET | `/referrals/by-student/:id` | SUPER, ADMIN, COORD, DOCENTE | **ninguno** | L | **D** | **P2** |
| 25 | POST | `/measures` | SUPER, ADMIN, COORD | **ninguno** | E | **C** | **P1** |
| 26 | PUT | `/measures/:id` | ídem | **ninguno** | E | **D** | **P1** |
| 27 | GET | *(medidas por estudiante — no expuesto)* | — | — | — | — | — |

**Solo 8 de los 27 endpoints tienen consumidor confirmado en el frontend.** Los 19 restantes
están montados y son alcanzables. **No son código muerto y no se eliminan.**

---

## 4. Hallazgos confirmados

### 🔴 O-1 · `GET /pending-followups?all=true` — volcado de todo el observador · **P0**

**Actor mínimo: `DOCENTE`.**

```ts
// controller
const authorId = all === 'true' ? undefined : req.user.id;
return this.observerService.getPendingFollowUps(authorId);

// service
where: {
  requiresFollowUp: true,
  status: { not: 'CLOSED' },
  ...(authorId ? { authorId } : {}),   // ← si no hay autor, NO queda ningún filtro
}
```

Con `?all=true` la consulta queda **sin filtro de autor y sin filtro de institución**:
devuelve **todas las observaciones abiertas con seguimiento pendiente de toda la
plataforma**, con `observationFullInclude` (estudiante, matrícula, grupo, autor).

**Es exactamente el patrón de `guardians.list` y `communications.getInbox`**: el único filtro
es opcional y el cliente decide desactivarlo. Ningún detector del censo lo encuentra — no hay
identificador que manipular ni `institutionId` en el request.

**Agravante:** el parámetro `all` **está declarado explícitamente en el cliente de la API**
(`getPendingFollowUps(all?: boolean)`), así que la vía de desactivación es parte del diseño,
solo que sin acotar por institución.

**Impacto:** exposición del expediente disciplinario abierto —tipo de falta, categoría,
descripción, estudiante identificado, grupo y autor— de **todos los colegios del sistema**, a
cualquier docente.

### 🔴 O-2 · Las cinco creaciones derivan la institución de un recurso elegido por el cliente · **P1**

```ts
const enr = await this.prisma.studentEnrollment.findUnique({
  where: { id: dto.studentEnrollmentId },      // ← el cliente elige la matrícula
  select: { institutionId: true },
});
return this.prisma.studentObservation.create({
  data: { institutionId: enr!.institutionId, ... },   // ← y con ella, la institución
});
```

Mismo patrón en `createCommitment`, `createCitation`, `createReferral` y `createMeasure`.

**Esto es precisamente lo que no basta.** Las cinco entidades **tienen `institutionId` y lo
rellenan correctamente** — pero el valor procede de la matrícula que el cliente indicó, no del
contexto autenticado. Un `DOCENTE` de A que envíe un `studentEnrollmentId` de B **crea una
falta disciplinaria, una citación o una medida pedagógica dentro de B**, correctamente
etiquetada como de B.

Es la razón por la que "tiene `institutionId`" nunca puede aceptarse como evidencia: aquí el
dato está bien formado y el aislamiento roto.

### O-3 · Once escrituras por identificador sin comprobación · **P1**

`PUT /:id`, `DELETE /:id`, `PUT /:id/notify-parent`, `PUT /actas/:id`,
`PUT /commitments/:id`, `PUT /citations/:id`, `PUT /referrals/:id`, `PUT /measures/:id`,
más `POST /actas` (que recibe `observationId` del cliente).

Todas hacen `findUnique({ where: { id } })` o escriben directamente. **Un `COORDINADOR` de A
puede borrar una observación disciplinaria de B** — destrucción de material con valor
probatorio en un proceso de convivencia.

### O-4 · Ocho lecturas por identificador · **P2**

`by-student`, `timeline`, `summary`, `:id`, `commitments/by-student`,
`citations/by-student`, `referrals/by-student`, `by-group/:groupId`.

Ninguna filtra por institución. **Cinco de ellas son alcanzables por `ESTUDIANTE`**, lo que
significa que un alumno con un `studentEnrollmentId` ajeno lee el expediente disciplinario
completo de un menor de otra institución.

### O-5 · Los tres endpoints "seguros" arrastran identificadores sin validar · **Candidata, requiere trazado**

`dashboard`, `stats/convivencial` y `commission-data` **sí** usan `req.user.institutionId`
—correcto—, pero reciben además `academicYearId`, `groupId` y `gradeId` **del query, sin
validar que pertenezcan a esa institución**. El filtro de institución los acota, así que no
hay fuga demostrada; queda como **candidata** de traversal por clave foránea, pendiente de
verificar cada consulta.

---

## 5. Matriz actor × operación × institución

Situación **actual**. "✔" = puede ejecutarlo sobre **otra** institución.

| Operación | SUPERADMIN | ADMIN_INST | COORDINADOR | DOCENTE | ESTUDIANTE | ACUDIENTE |
|---|---|---|---|---|---|---|
| **Volcado global de seguimientos (O-1)** | ✔ | ✔ | ✔ | **✔** | ✖ | ✖ |
| Crear observación / compromiso / citación / remisión en otra institución | ✔ | ✔ | ✔ | **✔** | ✖ | ✖ |
| Crear medida pedagógica ajena | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| Editar observación ajena | ✔ | ✔ | ✔ | **✔** | ✖ | ✖ |
| **Borrar observación ajena** | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| Editar acta / medida ajena | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| Leer expediente ajeno por matrícula | ✔ | ✔ | ✔ | ✔ | **✔** | ✖ |
| Leer observación ajena por id | ✔ | ✔ | ✔ | ✔ | **✔** | ✖ |
| Leer observaciones de un grupo ajeno | ✔ | ✔ | ✔ | ✔ | ✖ | ✖ |

`ACUDIENTE` no alcanza ningún endpoint de este módulo.

---

## 6. Entidades y relación de tenant (verificado en schema)

| Entidad | Relación con `Institution` | Estado |
|---|---|---|
| `StudentObservation` | **`institutionId` directo** | inequívoca |
| `ObserverCommitment` | **`institutionId` directo** | inequívoca |
| `GuardianCitation` | **`institutionId` directo** | inequívoca |
| `ObserverReferral` | **`institutionId` directo** | inequívoca |
| `PedagogicalMeasure` | **`institutionId` directo** | inequívoca |
| `ActaRecord` | **derivada** — `observationId` (`@unique`) → `StudentObservation.institutionId` | ruta única |
| `ObserverEvidence` | 🔴 **AMBIGUA** — ver §6.1 | **requiere decisión** |

### 6.1 🛑 `ObserverEvidence` — tenencia ambigua

```prisma
observationId String?     // opcional
actaRecordId  String?     // opcional
citationId    String?     // opcional
uploadedById  String
```

**Tres claves foráneas opcionales y ninguna obligatoria.** Una fila puede tener las tres a
nulo, y entonces **no existe ninguna ruta a `Institution`**.

Es la primera entidad del programa con una tenencia **estructuralmente ambigua** — peor que
`StudentGuardian`, que al menos tenía dos extremos obligatorios. Para la futura política RLS
no basta con un `JOIN`: haría falta un `COALESCE` sobre tres relaciones y una decisión sobre
las filas huérfanas.

**Estado actual:** la tabla **no tiene ninguna referencia en el código** — cero operaciones
Prisma, cero endpoints. Es una entidad declarada y nunca usada.

**Se documenta como decisión pendiente para la fase de RLS. No se toca.**

---

## 7. Rutas alternativas

Búsqueda repo-wide sobre las siete entidades (`findUnique`, `findFirst`, `findMany`, `count`,
`aggregate`, `create`, `update`, `updateMany`, `delete`, `deleteMany`, `upsert`):

| Origen | Operación | Veredicto |
|---|---|---|
| `observer.service.ts` | todas las del módulo | objeto de esta auditoría |
| `students.service.ts:1514` | `studentObservation.findMany` | ✅ **ya endurecida** — filtra por `institutionId` (commit `d950235`) |
| `reports.service.ts:3152` | `studentObservation.findMany` | ⚠️ **candidata** — `where: { studentEnrollmentId: { in: enrollmentIds } }`, sin institución propia. Los `enrollmentIds` proceden de `buildGroupReportCards`; **habría que trazar si ese conjunto está acotado** antes de calificarla |

> 🛑 **`reports.service.ts:3152` está fuera del módulo `observer`.** Conforme a la regla
> acordada: se documenta la cadena, **no se modifica**, y se pide autorización si la
> trazabilidad demuestra que es necesaria para cerrar la superficie.

---

## 8. Clasificación de los hallazgos

| Categoría | Contenido |
|---|---|
| **Vulnerabilidad confirmada** | O-1 (P0), O-2 (5 escrituras), O-3 (11 escrituras), O-4 (8 lecturas) — **25 puntos** |
| **Candidata que requiere trazabilidad** | O-5 (3 endpoints con FKs sin validar) · `reports.service:3152` |
| **Legítima** | `dashboard`, `stats/convivencial`, `commission-data` — usan `req.user.institutionId` |
| **Código muerto** | Ninguno. 19 endpoints sin consumidor pero montados y alcanzables |
| **Deuda funcional / diseño pendiente** | `ObserverEvidence` con tenencia ambigua y sin uso (§6.1) |

**No se extrapola ningún porcentaje.** Los 25 puntos confirmados lo están por lectura directa
de la cláusula `where` o del origen del `institutionId`, uno a uno.

---

## 9. Orden recomendado de corrección

| # | Objetivo | Motivo |
|---|---|---|
| 1 | **`getPendingFollowUps`** | P0 activo: un docente vuelca el observador de toda la plataforma con un parámetro documentado en el cliente |
| 2 | **Las 5 creaciones (O-2)** | La institución debe venir del actor, no de la matrícula que el cliente eligió. Cierra la inyección de faltas y medidas en otra institución |
| 3 | **`assertObservation` como punto único** | Cubre las 11 escrituras y varias lecturas por id de una vez, igual que `getYearById` y `assertMessage` |
| 4 | **Las 8 lecturas por id** | Cinco alcanzables por `ESTUDIANTE`; PII disciplinaria de menores |
| 5 | **Validar `academicYearId` / `groupId` / `gradeId`** en los tres endpoints "seguros" | Cierra el traversal por clave foránea |
| 6 | **`reports.service:3152`** | Solo si la trazabilidad lo exige, y **con autorización previa** |

**Punto único de control propuesto:** el módulo no lo tiene. Las cinco entidades principales
llevan `institutionId` directo, así que un `assertX(id, institutionId)` por entidad —o uno
genérico parametrizado— replicaría el patrón ya probado tres veces. La guarda debe vivir en el
**servicio**.

---

## 10. Riesgos de regresión

**Bajo, pero con dos puntos que exigen verificación previa:**

1. **Los 5 `create` cambian de fuente de institución.** Hoy la toman de la matrícula; pasarían
   a tomarla del actor. Si existiera algún flujo legítimo en el que un usuario registra una
   observación sobre una matrícula de otra institución —no debería, pero hay que
   comprobarlo—, dejaría de funcionar. **Verificar antes de implementar.**
2. **`ESTUDIANTE` en cinco lecturas.** Hay que confirmar que la pantalla que las usa
   (`Students.tsx`) envía siempre una matrícula de su propia institución; si un alumno
   consulta su propio expediente, el filtro por institución no le afecta, pero conviene
   demostrarlo.

Los 19 endpoints sin consumidor tienen **riesgo de regresión nulo**.

---

## 11. Criterio explícito de cierre

`observer` **no** se declarará cerrado hasta que:

1. Los 27 endpoints estén aislados o justificados uno a uno.
2. `getPendingFollowUps` no pueda devolver datos de otra institución con ningún valor de `all`.
3. Las 5 creaciones tomen la institución del actor.
4. Las 11 escrituras por id comprueben pertenencia.
5. Las 8 lecturas por id comprueben pertenencia.
6. `ESTUDIANTE` no alcance el expediente de otra institución.
7. Los tres endpoints con FK sin validar queden resueltos o documentados.
8. `reports.service:3152` quede trazada y, si procede, autorizada aparte.
9. Suite completa sin regresiones y suite de aislamiento propia en verde.
10. Typecheck limpio.
11. Staging `SUCCESS`, health 200, logs limpios, rutas críticas 401, login sin regresión.
12. Producción intacta.
13. Búsqueda repo-wide final sin rutas alternativas nuevas.

---

## 12. Respuestas al criterio de terminación

**¿Cuántos endpoints tiene realmente `observer`?** **27**, no 8.

**¿Vulnerabilidades confirmadas?** **25** — 16 escrituras y 9 lecturas *(O-1 cuenta como
lectura)*.

**¿Cuál es el hallazgo más grave?** **O-1**, `GET /pending-followups?all=true`: un `DOCENTE`
vuelca el expediente disciplinario abierto de toda la plataforma. Tercera aparición de la
clase "lista con filtro opcional que el cliente desactiva".

**¿"Tiene `institutionId`" bastó como evidencia?** **No, y aquí se ve por qué:** las cinco
entidades principales lo tienen y lo rellenan bien, pero el valor sale de una matrícula que
elige el cliente (O-2). El dato está bien formado y el aislamiento roto.

**¿Rutas alternativas?** **Dos**: una ya endurecida, otra (`reports.service:3152`) fuera del
módulo y pendiente de trazar. **No se modifica sin autorización.**

**¿Entidades con tenencia ambigua?** **Sí: `ObserverEvidence`**, con tres FKs opcionales y
ninguna obligatoria. Sin uso en el código. Requiere decisión de diseño para RLS.

---

## 13. Qué NO se hizo

No se modificó ningún controlador, servicio, DTO, prueba ni esquema. No se creó ningún test.
No se hizo commit ni push. No se desplegó. No se tocó staging ni producción. No se activó
RLS. No se eliminó código muerto ni se cambió ningún rol. **No se modificó `reports` ni
ningún otro módulo.** No se implementó ninguna corrección.
