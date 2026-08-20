# AUDITORÍA CROSS-TENANT · `communications`

> **Fase de solo lectura.** No se modificó controlador, servicio, DTO, prueba ni esquema. No
> se creó ningún test, commit ni push. Staging y producción intactos.
>
> **Fecha:** 2026-08-19 · **Rama:** `security/fase0.3-contencion`

---

## 1. Baseline

| | |
|---|---|
| Commit | `f0a6901` |
| Suite | **553/553** |
| Typecheck | limpio |
| `origin/staging` | `f0a6901` — verificado |
| `origin/main` (producción) | `a00b3f5` — **intacta** |

---

## 2. Por qué este módulo cambia la metodología

Los dos analizadores del censo detectaban dos clases: escrituras con `institutionId` del
cliente, y escrituras por identificador de recurso. `communications` demuestra una **tercera
clase que ninguno podía encontrar**:

> **Consultas que no reciben identificador ni operan por id, pero cuyo filtro de tenant falta
> dentro de una condición de negocio.**

El caso es `getInbox`. No hay parámetro que manipular, no hay id que forjar. El `OR` de la
consulta simplemente no acota por institución, y el resultado es una **fuga pasiva y
permanente** que ocurre en operación normal.

Esta auditoría se hizo, por tanto, revisando explícitamente `OR`, `AND`, `NOT`, filtros de
destinatario, filtros por rol, `include`, `select` y predicados booleanos —no solo los `where`
por id—.

---

## 3. Mapa completo — los 17 endpoints

Guard de clase: `JwtAuthGuard, RolesGuard`. No hay ningún otro guard en el módulo.
Tenant: **A** resuelto del contexto · **B** enviado por el cliente · **C** derivado de un
recurso · **D** sin comprobación.

| # | Método | Ruta | Actor real | Consumidor | L/E | Tenant | Riesgo | Acción |
|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/` | 7 roles **incl. ESTUDIANTE, ACUDIENTE** | `Communications.tsx` ×2 | E | **B** — el JWT es solo *fallback* | **P1** | resolver en servidor |
| 2 | PUT | `/:id` | 7 roles | `Communications.tsx` | E | **D** | **P1** | acotar |
| 3 | POST | `/:id/send` | 7 roles | `Communications.tsx` | E | **D** | **P1** | acotar |
| 4 | DELETE | `/:id` | ADMIN, COORD | `Communications.tsx` | E destructiva | **D** | **P1** | acotar |
| 5 | GET | `/` | 7 roles | `Communications.tsx` | L | **A** (`req.user.institutionId`) | ✅ | — |
| 6 | GET | `/institution/:institutionId` | ADMIN, COORD, DOCENTE | **ninguno** | L | **A** — el JWT gana; el param solo aplica si el token no trae institución (SuperAdmin) | ✅ | — |
| 7 | GET | `/available-recipients` | **sin `@Roles`** | `Communications.tsx` | L | **A** | ✅ | — |
| 8 | GET | `/allowed-categories` | **sin `@Roles`** | `Communications.tsx` | — | n/a (puro cálculo) | ✅ | — |
| 9 | GET | `/inbox` | **sin `@Roles`** | `Communications.tsx` **+ `Layout.tsx:313`** | L | **D** | 🔴 **P0** | rediseñar consulta |
| 10 | GET | `/storage-usage` | ADMIN, COORD | **ninguno** | L | **A** | ✅ | — |
| 11 | GET | `/:id` | **sin `@Roles`** | **ninguno** | L | **D** | **P2** | acotar |
| 12 | POST | `/:id/reply` | **sin `@Roles`** | `Communications.tsx` | E | **D** | **P1** | acotar |
| 13 | GET | `/:id/replies` | **sin `@Roles`** | `Communications.tsx` | L | **D** | **P2** | acotar |
| 14 | POST | `/:id/read` | **sin `@Roles`** | `Communications.tsx` | E | acotado por `recipientId = self` | ✅ | — |
| 15 | POST | `/:id/attachments` | 7 roles | `Communications.tsx` | E | **autor únicamente** | ✅ | — |
| 16 | DELETE | `/attachments/:attachmentId` | 7 roles | `Communications.tsx` | E | **autor únicamente** | ✅ | — |
| 17 | GET | `/attachments/:attachmentId/download` | **sin `@Roles`** | `Communications.tsx` | L | **predicado roto** | 🔴 **P1** | rediseñar predicado |

**Siete endpoints sin `@Roles`** (7, 8, 9, 11, 12, 13, 17): `RolesGuard` sin roles requeridos
devuelve `true`, así que los alcanza **cualquier usuario autenticado**, incluidos roles fuera
de la lista de los otros diez.

**Dos endpoints sin consumidor** (6 y 10) más el 11 (`getById`, **0 usos** en el frontend).
No son código muerto —están montados y son alcanzables— pero nadie los llama. **No se
eliminan.**

---

## 4. Matriz actor → operación

Situación **actual**. "✔" = puede ejecutarlo sobre **cualquier institución**.

| Operación | SUPERADMIN | ADMIN_INST | COORDINADOR | DOCENTE | ESTUDIANTE | ACUDIENTE |
|---|---|---|---|---|---|---|
| Crear mensaje en otra institución (1) | ✔ | ✔ | ✔ | ✔ | **✔** | **✔** |
| Editar mensaje ajeno (2) | ✔ | ✔ | ✔ | ✔ | **✔** | **✔** |
| Enviar borrador ajeno (3) | ✔ | ✔ | ✔ | ✔ | **✔** | **✔** |
| Borrar mensaje ajeno (4) | ✔ | ✔ | ✔ | ✖ | ✖ | ✖ |
| **Ver bandeja con mensajes ajenos (9)** | ✔ | ✔ | ✔ | ✔ | **✔** | **✔** |
| Leer mensaje ajeno por id (11) | ✔ | ✔ | ✔ | ✔ | **✔** | **✔** |
| Responder a mensaje ajeno (12) | ✔ | ✔ | ✔ | ✔ | **✔** | **✔** |
| Leer hilo ajeno (13) | ✔ | ✔ | ✔ | ✔ | **✔** | **✔** |
| Descargar adjunto ajeno (17) | ✔ | ✔ | ✔ | ✔ | **✔** | **✔** |

**El actor mínimo de 8 de las 9 vulnerabilidades es "cualquier usuario autenticado".** Solo el
borrado exige `COORDINADOR`.

---

## 5. Entidades y tenant

| Entidad | Relación con `Institution` | Verificado en schema |
|---|---|---|
| `Message` | **`institutionId` directo** | sí |
| `MessageRecipient` | **derivado** — `messageId → Message.institutionId` | sí, **ruta única** |
| `MessageAttachment` | **derivado** — `messageId → Message.institutionId` | sí, **ruta única** |

Ninguna de las dos derivadas tiene columna propia ni una segunda ruta. Ambas se resolverán en
la futura política RLS con un único `JOIN` a `Message` — **sin el problema de doble extremo
que sí tiene `StudentGuardian`**. Se documenta como decisión de diseño.

Se buscaron `schoolId`, `tenantId`, `institution_id`: **no existen**. El modelo usa
`institutionId`.

---

## 6. El modelo de destinatarios — análisis previo a rediseñar `inbox`

Antes de tocar la consulta hay que entender cómo se modelan los envíos. `RecipientType`
declara **seis** valores y el frontend genera **seis** formas:

| Categoría en la UI | Filas `MessageRecipient` generadas |
|---|---|
| `ALL` | `ALL_TEACHERS` + `ALL_STUDENTS` + `ALL_PARENTS` |
| `TEACHERS` | `ALL_TEACHERS` |
| `STUDENTS` | `ALL_STUDENTS` |
| `PARENTS` | `ALL_PARENTS` |
| `GROUP` | `GROUP` con `recipientId = groupId` |
| `INDIVIDUAL` | `USER` con `recipientId = userId` (una por destinatario) |

Y la bandeja empareja solo con tres condiciones:

```ts
OR: [
  { recipientId: userId },          // cubre USER
  { recipientType: 'ALL_TEACHERS' },
  { recipientType: 'ALL_STUDENTS' },
]
```

De ahí se deducen **cuatro defectos distintos**, no uno:

| # | Defecto | Naturaleza |
|---|---|---|
| a | `ALL_TEACHERS` llega a **todos**: cualquier rol, cualquier institución | **seguridad + rol** |
| b | `ALL_STUDENTS` llega a **todos**: ídem | **seguridad + rol** |
| c | **`ALL_PARENTS` no llega a nadie** — no aparece en el `OR` | **funcional** |
| d | **`GROUP` no llega a nadie** — no aparece en el `OR` | **funcional** |

Es decir: el módulo **sobre-entrega dos categorías e infra-entrega otras dos**. La UI ofrece
"Acudientes" y "Grupo", crea las filas correctamente, y **ningún destinatario las recibe
jamás**.

> ⚠️ **Decisión de diseño propuesta:** corregir (a) y (b) —que son la vulnerabilidad— y
> **documentar (c) y (d) como deuda funcional, sin tocarlos en esta intervención**. Arreglar
> la entrega de `ALL_PARENTS` y `GROUP` es un cambio de comportamiento del producto: haría
> aparecer mensajes que hoy nadie ve. Es una decisión de producto, no de seguridad, y merece
> su propio cambio. **Requiere tu confirmación.**

---

## 7. Hallazgos confirmados

### 🔴 C-1 · `GET /inbox` — fuga pasiva permanente · **P0**

**Actor mínimo: cualquier usuario autenticado.**

Toda comunicación difundida a "todos los docentes" o "todos los estudiantes" de **cualquier**
institución entra en la bandeja de **todos** los usuarios del sistema.

**Agravante descubierto en esta fase:** `getInbox` tiene **dos consumidores**, y el segundo es
`Layout.tsx:313` — el **contador de no leídos de la barra de navegación**. La consulta no se
ejecuta solo al abrir la pantalla de comunicaciones: **se ejecuta en cada carga de página, para
todos los usuarios**. El propio contador está contando circulares de otras instituciones.

**Impacto real:** exposición continua del contenido íntegro —asunto, cuerpo, autor con nombre
y apellidos, adjuntos— de las comunicaciones internas de otras instituciones. Sin atacante.
Es el único hallazgo de todo el programa que filtra de forma **pasiva y continua**.

Se eleva a **P0**: no por poder destructivo, sino porque la exposición está ocurriendo ahora
mismo, de forma masiva y sin necesidad de explotación.

### 🔴 C-2 · Descarga de adjuntos — predicado de autorización roto · **P1**

```ts
const isRecipient = attachment.message.recipients.some(
  r => r.recipientId === userId || r.recipientType === 'ALL_TEACHERS' || r.recipientType === 'ALL_STUDENTS',
);
if (!isAuthor && !isRecipient) throw new BadRequestException('No tienes acceso a este adjunto');
```

Si el mensaje tiene **una sola** fila de difusión, la segunda o tercera condición es verdadera
para **cualquier** `userId`. El predicado no comprueba nada.

**Corregir `getInbox` NO corrige esto:** son dos consultas independientes con el mismo error
de modelo. Cualquiera que obtenga un `attachmentId` —por ejemplo, a través de C-1— descarga el
fichero.

**Actor mínimo: cualquier usuario autenticado.**

### C-3 · `POST /` — la institución del cliente prevalece · **P1**

```ts
if (!dto.institutionId && req.user.institutionId) dto.institutionId = req.user.institutionId;
```

El JWT es **fallback**, no autoridad. Encadenado con `send` (C-4), un `ESTUDIANTE` de A crea y
publica un mensaje **dentro de la institución B**, firmado con su nombre. Vector de
suplantación y phishing interno.

### C-4 · Cuatro escrituras por identificador · **P1**

`PUT /:id`, `POST /:id/send`, `DELETE /:id` y `POST /:id/reply` hacen
`findUnique({ where: { id } })` y operan sin comprobar institución.

- **`PUT`** reescribe asunto y contenido de un mensaje ajeno — **incluso ya enviado**, alterando
  el historial que sus destinatarios leyeron.
- **`send`** publica un borrador ajeno.
- **`DELETE`** destruye el mensaje; `MessageRecipient` y `MessageAttachment` caen por
  `onDelete: Cascade`. Actor mínimo `COORDINADOR`.
- **`reply`** crea un mensaje con `institutionId: parent.institutionId` dirigido al autor
  original: **inyecta contenido en la bandeja de un usuario de otra institución** sin
  necesitar C-3.

### C-5 · Dos lecturas por identificador · **P2**

`GET /:id` devuelve el mensaje completo con autor, destinatarios, adjuntos y **todo el hilo de
respuestas**. `GET /:id/replies` devuelve el hilo por `parentId`. Ninguna comprueba institución
y ninguna tiene `@Roles`.

### ✅ Correctamente protegidos — verificado, no asumido

| Endpoint | Mecanismo |
|---|---|
| `POST /:id/attachments`, `DELETE /attachments/:id` | Exigen `message.authorId === userId`. Un tercero no puede adjuntar ni borrar |
| `POST /:id/read` | `updateMany` acotado por `recipientId = self`: solo marca lo propio |
| `GET /`, `/available-recipients`, `/storage-usage` | Institución del JWT |
| `GET /institution/:institutionId` | `req.user.institutionId \|\| institutionId` — el JWT gana; el param solo aplica cuando el token no trae institución (SuperAdmin). **Patrón correcto ya presente en el código** |
| `GET /allowed-categories` | Puro cálculo sobre los roles del JWT, sin acceso a datos |

---

## 8. Rutas alternativas — demostrado, no asumido

Búsqueda repo-wide de `create`, `createMany`, `update`, `updateMany`, `delete`, `deleteMany`,
`upsert`, `findUnique`, `findFirst`, `findMany`, `count`, `aggregate` y consultas raw sobre las
tres entidades:

| Entidad | Operaciones encontradas | Fuera de `communications.service.ts` |
|---|---|---|
| `Message` | 12 | **0** |
| `MessageRecipient` | 2 | **0** |
| `MessageAttachment` | 5 | **0** |
| Consultas raw | 0 | — |

**Las 21 operaciones viven en `communications.service.ts`.** Es el **primer módulo
autocontenido** del programa: a diferencia de `guardians` (puerta lateral en `students`),
`students` (`bulk-import`) y `academic-years` (creación paralela en `academic-terms`), aquí
cerrar el servicio cierra la entidad.

**No hace falta modificar ningún otro módulo.**

---

## 9. Diseño de la corrección (no implementado)

### 9.1 Punto único de control

El módulo **no tiene** hoy un equivalente a `getYearById` o `assertStudent`. Se propone crear
uno privado en el servicio:

```ts
private async assertMessage(messageId: string, institutionId: string) { ... }
```

**Justificación:** seis operaciones (`update`, `send`, `delete`, `reply`, `getById`,
`getReplies`) repiten hoy el mismo `findUnique({ where: { id } })`. Un solo punto las cubre.
No es una abstracción gratuita: es exactamente el patrón que ya funcionó en los tres módulos
anteriores, y la lección de `guardians` es que la guarda debe vivir en el **servicio**, no en
el controlador.

### 9.2 `getInbox` — semántica propuesta

No es una sustitución mecánica. La consulta debe expresar: *"mensajes de MI institución
dirigidos a mí individualmente, o difundidos a MI categoría"*.

```
where: {
  message: { institutionId },              ← acota el tenant vía la relación única
  OR: [
    { recipientId: userId },               ← individual (USER)
    ...(esDocente     ? [{ recipientType: 'ALL_TEACHERS' }] : []),
    ...(esEstudiante  ? [{ recipientType: 'ALL_STUDENTS' }] : []),
  ],
}
```

- Corrige el tenant **y** el defecto de rol: un `ESTUDIANTE` deja de recibir `ALL_TEACHERS`.
- **Preserva** los mensajes individuales y las difusiones de la propia institución.
- **No añade** `ALL_PARENTS` ni `GROUP`: hoy no se entregan, y añadirlos es un cambio funcional
  (§6). Queda como deuda documentada.

El controlador ya extrae los roles del JWT en dos endpoints
(`(req.user.roles || []).map(r => r.role?.name || r.name || r)`); se reutiliza ese patrón.
**No se crea nada nuevo.**

**Caso SuperAdmin sin institución:** su token no trae `institutionId`. Debe decidirse si su
bandeja queda vacía o conserva algún alcance. Se propone **vacía** —no es un buzón
institucional— y documentarlo.

### 9.3 Descarga de adjuntos

El predicado pasa a exigir **institución + categoría**, no bastar por sí solo:

```
adjunto accesible  ⟺  message.institutionId === institución del actor
                       Y ( es autor
                           O destinatario individual
                           O difusión que corresponde a su rol )
```

### 9.4 `POST /` y las seis operaciones por id

`requireInstitutionId` en el controlador; el `dto.institutionId` se conserva en el contrato
—el frontend lo envía— pero **deja de tener autoridad**. Las seis por id pasan por
`assertMessage`.

### 9.5 Los siete endpoints sin `@Roles`

**No se añaden roles.** Razonamiento por endpoint:

| Endpoint | Decisión |
|---|---|
| `/available-recipients`, `/allowed-categories` | Ya acotados por el JWT y por el rol del propio usuario. **Sin cambio** |
| `/inbox`, `/:id/read` | Cada usuario ve y marca **lo suyo**: no procede restringir por rol. **Sin cambio** |
| `/:id`, `/:id/replies`, `/:id/reply`, descarga | El fallo es de **tenant**, no de rol: cualquier usuario legítimo puede necesitar leer y responder un mensaje que le llega. **Sin cambio de roles**; se cierra por institución |

Es la lección de `guardians`: una lista arbitraria de roles habría roto flujos legítimos. Aquí
`ESTUDIANTE` y `ACUDIENTE` **están diseñados para usar el módulo** (`getAllowedCategories` les
devuelve `['INDIVIDUAL']`, `getAvailableRecipients` les acota los destinatarios). El problema
no es que escriban: es que escriban **en otra institución**.

### 9.6 Ficheros a modificar

| Fichero | Cambio |
|---|---|
| `communications.service.ts` | `assertMessage`; `getInbox`; predicado de adjuntos; institución obligatoria en `create` |
| `communications.controller.ts` | `requireInstitutionId`; pasar institución y roles a `getInbox` |
| `communications.isolation.spec.ts` | **nuevo** |

**Ningún otro módulo.**

---

## 10. Pruebas propuestas

**Negativas (cross-tenant):**

1. `inbox` de un usuario de A **no** devuelve mensajes de B, ni siquiera de difusión
2. `inbox`: un `ESTUDIANTE` no recibe `ALL_TEACHERS` de su propia institución
3. `inbox`: un `DOCENTE` no recibe `ALL_STUDENTS` de su propia institución
4. Adjunto de un mensaje de B → rechazado **aunque tenga destinatario de difusión**
5. `ALL_TEACHERS` de A → estudiante de A: rechazado
6. `ALL_STUDENTS` de A → docente de A: rechazado
7. `POST /` con `institutionId = B` → crea en A
8. `PUT`, `send`, `DELETE`, `reply` sobre mensaje de B → rechazados **sin escritura**
9. `GET /:id` y `/:id/replies` de B → no encontrados

**Positivas (flujo legítimo):**

10. `inbox` sigue devolviendo los individuales propios y las difusiones **de su institución**
11. `ESTUDIANTE` y `ACUDIENTE` conservan crear, responder y leer dentro de su institución
12. Autor descarga su adjunto; destinatario individual de su institución también
13. Adjuntos: se conservan las restricciones de autor y de mensaje ya enviado
14. `markAsRead` sigue marcando solo lo propio
15. SuperAdmin conserva el comportamiento de `GET /institution/:institutionId`

---

## 11. Distinción explícita de categorías

| Categoría | Contenido |
|---|---|
| **Hallazgos confirmados** | C-1 a C-5 — 9 vulnerabilidades verificadas leyendo el código |
| **Hipótesis** | Ninguna pendiente: las 9 están confirmadas por lectura directa |
| **Código muerto** | Ninguno. Tres endpoints sin consumidor (6, 10, 11) pero montados y alcanzables |
| **Rutas latentes** | Los tres anteriores: sin consumidor hoy, explotables si alguien los descubre |
| **Deuda técnica (funcional, NO seguridad)** | `ALL_PARENTS` y `GROUP` **nunca se entregan** (§6 c/d). La UI los ofrece y crea las filas; nadie los recibe |
| **Riesgos residuales** | Ver §12 |
| **Decisiones de diseño** | Tenant de las derivadas vía `Message` (ruta única); no tocar `@Roles`; no arreglar la entrega de `ALL_PARENTS`/`GROUP` en esta intervención; bandeja vacía para SuperAdmin |

---

## 12. Riesgos residuales tras la corrección propuesta

1. **Cambio visible para los usuarios.** Al cerrar C-1, las bandejas **perderán** los mensajes
   de otras instituciones que hoy muestran, y el contador de la barra bajará. Es la
   corrección de la fuga, no una regresión — pero conviene anticiparlo si alguna institución
   lleva tiempo viendo esa mezcla.
2. **`ALL_PARENTS` y `GROUP` seguirán sin entregarse.** Documentado como deuda funcional.
3. **Tres rutas sin consumidor** quedan protegidas pero vivas.
4. **`markAsRead`** seguirá pudiendo marcar como leída una fila `MessageRecipient` propia
   aunque el mensaje sea de otra institución. Tras cerrar C-1 el usuario ya no podrá verla, así
   que el vector queda sin utilidad práctica; se documenta.

---

## 13. Criterio obligatorio antes de implementar — las 14 respuestas

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿Los 17 endpoints trazados? | **Sí** — §3 |
| 2 | ¿Todas las escrituras de `Message` localizadas? | **Sí** — 12 operaciones, todas en el servicio |
| 3 | ¿Todas las de `MessageRecipient`? | **Sí** — 2 |
| 4 | ¿Todas las de `MessageAttachment`? | **Sí** — 5 |
| 5 | ¿Consumidores reales localizados? | **Sí** — `Communications.tsx` y `Layout.tsx`; 3 endpoints sin consumidor |
| 6 | ¿`GET /inbox` verificado completo? | **Sí** — incluido el modelo de destinatarios y los 4 defectos |
| 7 | ¿`isRecipient` verificado completo? | **Sí** — es un fallo independiente de C-1 |
| 8 | ¿Separación `ALL_TEACHERS` / `ALL_STUDENTS` comprobada? | **Sí** — hoy no existe: ambos llegan a todos |
| 9 | ¿Institución de cada comunicación colectiva comprobada? | **Sí** — no se comprueba en ninguna de las dos consultas |
| 10 | ¿Los 7 sin `@Roles` revisados? | **Sí** — §9.5, con decisión razonada de no añadir roles |
| 11 | ¿Existe alguna ruta alternativa? | **No** — demostrado repo-wide, §8 |
| 12 | ¿Punto único de control definido? | **Sí** — `assertMessage`, §9.1 |
| 13 | ¿Pruebas de aislamiento A↔B definidas? | **Sí** — 15 casos, §10 |
| 14 | ¿Confirmado que no hace falta tocar otro módulo? | **Sí** — §8 |

**Las 14 respuestas son afirmativas.** El módulo está listo para la fase de implementación,
pendiente de dos decisiones tuyas (§14).

---

## 14. Decisiones que requieren tu confirmación

1. **`ALL_PARENTS` y `GROUP` sin entregar** (§6): ¿se dejan como deuda funcional documentada
   —mi recomendación, porque arreglarlo cambia el comportamiento del producto— o entran en
   esta intervención?
2. **Bandeja del SuperAdmin** (§9.2): ¿vacía —mi recomendación— o con algún alcance
   explícito?

---

## 15. RESULTADO DE LA IMPLEMENTACIÓN

> Añadido tras ejecutar la corrección autorizada. Todo lo anterior es la auditoría previa y
> se conserva sin alterar.

### 15.1 Vulnerabilidades corregidas

| # | Hallazgo | Corrección |
|---|---|---|
| C-1 | `GET /inbox` — fuga pasiva **P0** | Cada rama del `OR` lleva su propio aislamiento **y** su condición de destinatario; el filtro de institución se repite a nivel superior como garantía estructural para ramas futuras. `ESTUDIANTE` deja de recibir `ALL_TEACHERS`; `DOCENTE` deja de recibir `ALL_STUDENTS` |
| C-2 | Descarga de adjuntos — predicado roto | Consulta acotada por institución + predicado que exige **categoría correspondiente al rol**. Tratada como vulnerabilidad independiente, no como efecto de C-1 |
| C-3 | `POST /` — institución del cliente | `requireInstitutionId`; el DTO conserva el campo por contrato pero su valor se ignora |
| C-4 | `PUT`, `send`, `DELETE`, `reply` | `assertMessage` — punto único de control en el **servicio** |
| C-5 | `GET /:id`, `GET /:id/replies` | Ídem |

### 15.2 Decisiones aplicadas

| Decisión | Aplicación |
|---|---|
| **`ALL_PARENTS` y `GROUP`** | **Fuera de alcance.** No se implementa su entrega. Ver §15.4 |
| **SuperAdmin en `/inbox`** | **Bandeja vacía.** Sin `institutionId` resuelta, `getInbox` devuelve `[]` sin consultar. No se inventa alcance global: eso convertiría la ausencia de tenant en privilegio de lectura universal |
| **`@Roles`** | **Sin cambios.** Los siete endpoints sin roles se revisaron uno a uno y se dejan como están |
| **Entidades derivadas** | **Sin columna duplicada.** `MessageRecipient` y `MessageAttachment` siguen derivando de `messageId → Message.institutionId` |
| **Semántica de error** | Consulta acotada + `NotFoundException` existente para el caso cross-tenant. Se **conserva** el `BadRequestException('No tienes acceso a este adjunto')` original para el caso "de mi institución pero no soy destinatario" |

### 15.3 Pruebas

**55 casos nuevos** en `communications.isolation.spec.ts`:

- 6 · operaciones por identificador sobre un mensaje ajeno → rechazadas sin escritura
- 8 · bandeja (forma del filtro): aislamiento por rama, separación
  `ALL_TEACHERS`/`ALL_STUDENTS`, individuales preservados, `ACUDIENTE` solo individuales,
  SuperAdmin vacía, y una prueba que **fija el estado actual de `ALL_PARENTS`/`GROUP`**
- 7 · adjuntos: cross-tenant, difusión que no corresponde al rol, difusión que sí, autor,
  destinatario individual, sin institución
- 2 · escritura: el `institutionId` del DTO se ignora
- 14 · controlador y regresión de `ESTUDIANTE`, `ACUDIENTE`, `DOCENTE`
- **11 · MATRIZ DE ENTREGA (semántica, no forma)** — ver §15.3.1
- **7 · adjuntos: conocer el `messageId` no basta** — exige pertenencia **y** categoría

#### 15.3.1 Matriz de entrega verificada

Las pruebas de "forma" comprueban qué ramas contiene el `where`. Estas comprueban **qué filas
casarían realmente**: evalúan el filtro generado contra filas candidatas en memoria,
interpretando exactamente las claves que usa (`message.institutionId`, `recipientId`,
`recipientType`). No sustituyen una prueba de integración, pero demuestran la **lógica del
predicado**, que es donde estaba el defecto.

| Actor | Destinatario | Misma institución | Otra institución |
|---|---|---|---|
| DOCENTE | `ALL_TEACHERS` | ✅ recibe | ❌ no recibe |
| ESTUDIANTE | `ALL_TEACHERS` | ❌ no recibe | ❌ no recibe |
| ESTUDIANTE | `ALL_STUDENTS` | ✅ recibe | ❌ no recibe |
| DOCENTE | `ALL_STUDENTS` | ❌ no recibe | ❌ no recibe |
| ACUDIENTE | `ALL_TEACHERS` / `ALL_STUDENTS` | ❌ no recibe | ❌ no recibe |
| ACUDIENTE | `INDIVIDUAL` dirigido a él | ✅ recibe | ❌ no recibe |
| cualquiera | `INDIVIDUAL` dirigido a otro | ❌ no recibe | ❌ no recibe |
| SuperAdmin | cualquier difusión | ❌ — **bandeja vacía, no llega a consultar** | ❌ |
| ACUDIENTE | `ALL_PARENTS` | ❌ *(deuda funcional §15.4)* | ❌ |
| DOCENTE | `GROUP` | ❌ *(deuda funcional §15.4)* | ❌ |

Y para adjuntos, la misma matriz de rol × categoría **dentro** de la institución, más la
prueba explícita de que **un `attachmentId` válido de otra institución no resuelve**: la
pertenencia institucional es condición previa, y la categoría de destinatario debe además
corresponder al rol.

```
baseline   553/553  (f0a6901)
final      608/608  (+55)
typecheck  limpio
commit     070ef1a  (código) + 8d43c4b (matriz de entrega)
```

**Búsqueda repo-wide final:** 0 operaciones sobre las tres entidades fuera de
`communications.service.ts`. Ningún otro módulo modificado.

### 15.4 🔴 Deuda funcional — `ALL_PARENTS` y `GROUP`

**NO SE CONSIDERA RESUELTO.** Queda explícitamente fuera del alcance de esta intervención
de seguridad.

**Estado:** la interfaz permite seleccionar las categorías "Acudientes" y "Grupo",
`getRecipientsForApi` genera correctamente las filas `MessageRecipient` con
`recipientType: 'ALL_PARENTS'` y `'GROUP'`, y el mensaje se persiste bien. **Pero la
bandeja nunca las ha emparejado**, así que ningún destinatario las recibe.

**Por qué no se corrige aquí:** hacerlas funcionar cambiaría el comportamiento funcional
del producto —haría aparecer mensajes que hoy nadie ve— y convertiría una intervención de
aislamiento en una corrección de la lógica de entrega. Es una decisión de producto.

**Salvaguarda dejada:** una prueba fija el estado actual (`ALL_PARENTS` y `GROUP` no
aparecen en las ramas del `OR`), de modo que el día que se aborde sea una decisión
consciente y no un efecto colateral.

### 15.5 Riesgos residuales

1. **Cambio visible para los usuarios.** Las bandejas dejarán de mostrar los mensajes de
   otras instituciones y el contador de la barra bajará. Es la corrección de la fuga, no
   una regresión — pero conviene anticiparlo.
2. **Deuda funcional §15.4** sigue abierta.
3. **Tres rutas sin consumidor** (`GET /institution/:institutionId`, `/storage-usage`,
   `GET /:id`) quedan protegidas pero vivas. No se eliminan.
4. **`markAsRead`** puede seguir marcando como leída una fila `MessageRecipient` propia
   aunque el mensaje sea de otra institución. Tras cerrar C-1 el usuario ya no puede verla,
   así que el vector queda sin utilidad práctica. Se documenta.

### 15.6 Commit y staging

| | |
|---|---|
| Commit | `070ef1a` |
| Rama | `security/fase0.3-contencion` → `staging` |
| Producción | `a00b3f5` — **intacta** |

---

## 16. Qué NO se hizo

No se modificó ningún controlador, servicio, DTO, prueba ni esquema. No se creó ningún test.
No se hizo commit ni push. No se desplegó. No se tocó staging ni producción. No se activó
RLS. No se eliminó código muerto, no se cambió ningún rol y no se corrigió la entrega de
`ALL_PARENTS`/`GROUP`. No se modificó ningún otro módulo.
