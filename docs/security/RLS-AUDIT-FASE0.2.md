# RLS AUDIT — FASE 0.2
## Auditoría de exposición real y plan de remediación

> **Continuación de** `RLS-AUDIT-FASE0.md` y `RLS-AUDIT-FASE0.1.md` (ambos leídos íntegros;
> ninguno modificado).
> **Fase READ-ONLY.** No se rotó ninguna credencial, no se tocó Railway, no se creó ningún rol,
> política, función ni migración, no se modificó código de la aplicación, no se desplegó nada.
> **Ningún secreto se reproduce en este documento.**
>
> **Fecha:** 2026-08-18 · **Rama:** `main` (HEAD `83da383`) · Cambios ajenos en curso
> (evaluaciones D-19) **no tocados**.

---

## 1. Resumen ejecutivo

Esta fase cambia la naturaleza del problema. Las fases 0 y 0.1 describían un RLS **ausente**.
La fase 0.2 mide la **exposición real de hoy** y encuentra que el aislamiento multi-tenant no
solo carece de defensa en profundidad: **tiene brechas activas y explotables sin RLS de por medio**.

Cinco hallazgos nuevos de máxima prioridad:

1. **La credencial de producción versionada en Git es la credencial viva.** Verificado por
   comparación de huella SHA-256 — **sin intentar autenticarse y sin revelar el valor**.
2. **Staging y producción comparten los mismos secretos JWT.** Un token emitido en staging es
   criptográficamente válido en producción.
3. **Staging y producción comparten las mismas claves de Cloudflare R2 y Supabase**, incluido el
   bucket donde viven **los backups de producción**.
4. **Escritura cross-tenant confirmada en la matriz de autorización**: un admin de la institución
   A puede reescribir las *capabilities* de la institución B.
5. **De 139 puntos de entrada de `institutionId`, 113 son seguros y 25 no lo son** — 8 de ellos
   permiten **escritura** en otra institución.

**Corrección de la cifra de la Fase 0.1:** los "≈113 puntos" no eran 113 vulnerabilidades.
El análisis de flujo demuestra lo contrario: **113 son precisamente los seguros**, y el problema
está en los 25 restantes. La coincidencia numérica era casual.

**Conclusión operativa:** implementar RLS ahora sería construir la segunda barrera mientras la
primera está abierta y las llaves están publicadas. **Ver §16.**

---

## 2. 0.2-A — InstitutionId Input Flow

### 2.1 Método

Se extrajeron automáticamente todos los handlers de los 103 controladores que reciben
`institutionId` desde `@Query`, `@Param` o `@Body`, y se siguió el flujo hasta la consulta
Prisma final. Los casos sensibles se verificaron leyendo el código.

### 2.2 Resultado global

| Grupo | Nº | Significado |
|---|---|---|
| Handlers que reciben `institutionId` del request | **139** | universo total |
| **A — Seguros** | **113** | pasan por `resolveInstitutionId()` / `requireInstitutionId()` |
| **B — Requiere revisión** | 1 | compara contra `req.user.institutionId` de forma ad-hoc |
| **C / D — sin resolver** | **25** | el valor del request llega a Prisma sin validación de tenant |

### 2.3 Por qué los 113 son seguros

`common/utils/institution-resolver.ts` tiene esta secuencia:

1. `req.resolvedInstitutionId` — **código muerto** (B-2: `TenantGuard` nunca lo asigna).
2. Si `isSuperAdmin` **y** hay `queryInstitutionId` → usa el del request. *(legítimo)*
3. **Si el usuario tiene `institutionId` en el JWT → devuelve SIEMPRE el del JWT**, ignora el
   del request y solo registra un `console.warn`. ← **esta es la barrera real**
4. Fallback: `institutionUser.findFirst({ where: { userId } })` **sin `orderBy`**.

El paso 3 es lo que hace seguros a los 113. **No es el `TenantGuard`** —que está inerte—
sino este helper. Es una defensa efectiva pero **opcional**: protege solo a quien lo llama.

> ⚠️ **Riesgo residual del paso 4** (ya registrado como R-7): para un usuario multi-institución
> sin `institutionId` en el JWT, `findFirst` sin orden elige una institución **arbitraria**.

> ⚠️ **Riesgo del paso 2** (nuevo, requiere revisión): `isSuperAdmin` se acepta también si el
> array `roles` del JWT contiene la cadena `'SUPERADMIN'`. Los roles del JWT provienen de
> `InstitutionUserRole`, y `Role.name` es único **global**. Si un administrador de tenant
> pudiera asignar el rol `SUPERADMIN` dentro de su institución, obtendría capacidad
> cross-tenant. **No he verificado si existe un endpoint que lo permita** — pendiente.

### 2.4 Los 25 casos sin resolver — clasificación

Clasificación pedida: **A** seguro · **B** requiere revisión · **C** potencialmente explotable
(lectura) · **D** crítico (escritura / datos sensibles) · **E** cross-tenant legítimo.

| # | Controlador | Método / ruta | Origen | Rol exigido | Uso final | Clase |
|---|---|---|---|---|---|---|
| 1 | `capabilities` | `PUT matrix/:institutionId` | param | ADMIN_INSTITUTIONAL | `institutionRoleCapability.upsert` | **D** |
| 2 | `capabilities` | `POST matrix/:institutionId/reset` | param | ADMIN_INSTITUTIONAL | reset de la matriz | **D** |
| 3 | `capabilities` | `GET matrix/:institutionId` | param | ADMIN/COORD | lectura de config | **C** |
| 4 | `academic-year-lifecycle` | `POST /` (`dto.institutionId`) | body | ADMIN_INSTITUTIONAL | `academicYear.create` | **D** |
| 5 | `academic-year-lifecycle` | `GET /?institutionId=` | query | ADMIN…SECRETARIA | lista años | **C** |
| 6 | `academic-year-lifecycle` | `GET institution/:institutionId` | param | ADMIN…SECRETARIA | lista años | **C** |
| 7 | `academic-year-lifecycle` | `GET institution/:institutionId/current` | param | + ESTUDIANTE | año vigente | **C** |
| 8 | `institutional-documents` | `POST /` | body | ADMIN/COORD | crea documento institucional | **D** |
| 9 | `storage` | `POST upload/gallery` | body | ADMIN/COORD | sube archivo bajo otra institución | **D** |
| 10 | `storage` | `POST upload/announcement` | body | ADMIN/COORD | ídem | **D** |
| 11 | `guardians` | `POST with-link` (`dto.institutionId`) | body | **ninguno** | crea acudiente + vínculo | **D** |
| 12 | `guardians` | `GET /?institutionId=` | query | **ninguno** | lista acudientes (**PII**) | **C** |
| 13 | `guardians` | `GET :id` | — | **ninguno** | acudiente por id | **C** |
| 14–19 | `achievements` | `GET/POST config/:institutionId/**` (6) | param | ADMIN/COORD/DOCENTE | config + `createDefault*` | **C** (4) / **D** (2) |
| 20 | `templates` | `GET /?institutionId=` | query | ADMIN…DOCENTE | lista plantillas | **C** |
| 21 | `student-documents` | `GET stats?institutionId=` | query | ADMIN/COORD | estadísticas | **C** |
| 22–24 | `iam/users` | `institution/admins`, `grant-admin`, `revoke-admin` | query | ADMIN_INSTITUTIONAL | **usa `resolveInstitutionForAdmin` → `resolveInstitutionId`** | **A** ✅ |
| 25 | `superadmin` | `GET grade-audit?institutionId=` | query | (SuperAdmin) | auditoría de notas | **E** |

**Recuento final: 8 clase D · 14 clase C · 3 reclasificados a A · 1 clase E.**

### 2.5 Caso D-1 detallado (el más grave)

```ts
// capabilities.controller.ts
@Put('matrix/:institutionId')
@Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
async updateCapabilityMatrix(@Param('institutionId') institutionId: string, @Body() body) {
  await this.capabilitiesService.updateCapabilityMatrix(institutionId, body.updates);
}
```

```ts
// capabilities.service.ts
this.prisma.institutionRoleCapability.upsert({
  where:  { institutionId_role_capabilityKey: { institutionId, role: u.role, capabilityKey: u.capabilityKey } },
  update: { isEnabled: u.isEnabled },
  create: { institutionId, role: u.role, capabilityKey: u.capabilityKey, isEnabled: u.isEnabled },
});
```

El `institutionId` de la URL viaja intacto hasta el `upsert`. No hay comparación con el JWT,
`TenantGuard` está inerte y `RolesGuard` solo comprueba **qué rol tiene el usuario**, no
**sobre qué institución actúa**. Un `ADMIN_INSTITUTIONAL` de A puede reescribir qué puede ver y
hacer cada rol en la institución B — es decir, **modificar la configuración de autorización de
otro colegio**.

> **Potencialmente explotable; pendiente prueba controlada en local o staging con instituciones
> ficticias.** No se ha ejecutado ninguna prueba contra producción.

### 2.6 Observación sobre validación de DTOs

`CreateAcademicYearDto` es un **`interface` de TypeScript**, no una clase con decoradores de
`class-validator`. El `ValidationPipe` global (`whitelist: true, forbidNonWhitelisted: true`)
**no puede validar ni filtrar** un body sin metadatos de clase: el objeto llega crudo al
servicio. Merece revisión sistemática aparte de RLS.

---

## 3. 0.2-B — `switchInstitution`

### 3.1 Flujo real reconstruido

```
JWT actual (institutionId = A)
   ↓
JwtAuthGuard (nivel de controlador)      → req.user.institutionId = A
   ↓
TenantContextInterceptor (global)        → ABRE $transaction
   ↓                                       set_config('app.current_institution', A, true)
   ↓
authService.switchInstitution(userId, B)
   ↓
prisma.user.findUnique({ id: userId })                     ← tabla GLOBAL, sin institución
   ↓
prisma.institutionUser.findUnique({                        ← ⚠ fila de la institución B
     where: { userId_institutionId: { userId, institutionId: B } },
     include: { institution: {...},                        ← ⚠ fila Institution B
                institutionUserRoles: { include: { role } } }
   })
   ↓
signTokenForInstitution(...)  →  nuevo JWT con institutionId = B
```

**El tenant activo durante toda la operación es A**, y se resuelve en el interceptor, antes de
que el servicio sepa que se trata de un cambio de institución.

### 3.2 Qué ocurriría con RLS activo

Con una política ingenua `institutionId = current_institution_id()` sobre `InstitutionUser` y
`id = current_institution_id()` sobre `Institution`, ambas consultas devolverían **0 filas** con
contexto A. El servicio lanzaría *"No tienes acceso a esta institución"*.

**Efecto: todo usuario multi-institución queda atrapado en su institución de entrada.** El único
escape sería cerrar sesión y volver a entrar eligiendo institución en el login — que también
está en riesgo (B-3).

### 3.3 Alternativas

| | **A** · Cambio de tenant sin tenant | **B** · Contexto "tenant selection" | **C** · Política propia para `InstitutionUser` | **D** · Reutilizar el login por institución |
|---|---|---|---|---|
| **Descripción** | Marcar el endpoint para que el interceptor no abra transacción ni fije contexto | Un modo de contexto (`app.tenant_selection = on`) que habilita solo lectura de `InstitutionUser`/`Institution` del usuario | Política basada en `userId` (`app.current_user_id`), no en institución: cada quien ve sus propias membresías | Eliminar `switchInstitution` y reusar `POST auth/login` con `institutionId`, que ya existe y funciona |
| **Seguridad** | Media — reintroduce una ruta autenticada sin contexto | Media-alta — nuevo estado que hay que acotar bien | **Alta** — el predicado es exactamente la regla de negocio | Alta — mismo camino ya auditado |
| **Complejidad** | Baja | Alta | Media | **Muy baja** |
| **Impacto** | 1 decorador | interceptor + función SQL + políticas | política + añadir `current_user_id` al contexto | frontend debe reautenticar |
| **Compatibilidad** | Convive con todo | Requiere rediseñar `current_institution_id()` | Requiere que el contexto lleve `userId` | Pierde el cambio sin contraseña |
| **Riesgo** | Amplía la superficie `@SkipTenantCheck` (hoy 12 endpoints) | Un modo mal acotado es un bypass encubierto | Bajo, si `app.current_user_id` no es manipulable | UX peor |
| **Recomendación** | — | descartar | ✅ **preferida** | alternativa de respaldo |

**Recomendación: C**, que además resuelve el mismo problema en el login (B-3) con un solo
mecanismo: el contexto debe transportar **`app.current_user_id` junto a `app.current_institution`**.
Esto condiciona el diseño de `current_institution_id()` de la Fase 2. **No implementado.**

---

## 4. 0.2-C — SuperAdmin

### 4.1 Clasificación pedida

| Categoría | Operaciones | ¿Necesita realmente cross-tenant? |
|---|---|---|
| **GLOBAL** | `verifySuperAdmin` (lee `User`), `resetUserPassword` | No — `User` es tabla global, quedaría fuera de RLS |
| **CROSS-TENANT** | `getSystemStats` (`institution.count`, `user.count`, `student.count`), `getAllInstitutions` | **Sí** — son agregados de todo el sistema |
| **TENANT-SELECTION** | `createInstitution` | **Caso aparte**: el tenant **no existe todavía** cuando haría falta el contexto |
| **TENANT-SCOPED** | `getInstitutionById`, `getInstitutionUsers`, `getInstitutionUsage`, `getGradeAuditLog`, `updateInstitution`, `updateInstitutionStatus`, `updateInstitutionModules`, `deleteInstitution` | **No** — bastaría con fijar el contexto a la institución elegida |

### 4.2 ¿Es inevitable `BYPASSRLS`?

Conforme al encargo, **no concluyo automáticamente que haga falta**. Analizado caso por caso:

- **8 de 12 operaciones no lo necesitan.** Son tenant-scoped: el SuperAdmin ya recibe el
  `institutionId` objetivo. Basta con que el interceptor fije el contexto a esa institución en
  lugar de saltarse la transacción. Esto **también corrige** la incoherencia ya detectada entre
  `TenantGuard` (que resuelve `?institutionId=`) y el interceptor (que usa el del JWT).
- **`resetUserPassword`** opera sobre `User`, tabla global sin RLS → no necesita bypass.
- **`getSystemStats` y `getAllInstitutions`** sí son irreductiblemente cross-tenant. Pero
  admiten alternativas sin `BYPASSRLS`:
  - *vistas o funciones `SECURITY DEFINER`* que devuelvan **solo agregados** (recuentos), sin
    exponer filas;
  - o una política sobre `Institution` que permita `SELECT` cuando el contexto declare modo
    administrativo — con el matiz de §4.3.
- **`createInstitution`** es el caso duro: escribe la fila raíz de un tenant inexistente. La
  política `WITH CHECK` de `Institution` tendría que admitir la creación. Sea cual sea la
  solución, es **una** operación acotada, no un permiso general.

**Conclusión provisional:** el bypass, si existe, debería reducirse a
**`getAllInstitutions` + `getSystemStats` + `createInstitution`**, no a "el SuperAdmin". Y las 8
tenant-scoped deberían resolverse con **contexto seleccionado**, no con bypass.

### 4.3 Advertencia sobre "modo administrativo en la política"

Meter `current_setting('app.is_superadmin') = 'on'` dentro de las políticas convierte la
política en una decisión de **autorización**, no de **aislamiento** — la confusión de capas que
el propio encargo prohíbe (§23 de la Fase 0). Además, si ese ajuste se puede fijar desde
`$queryRaw`, es un bypass universal disfrazado. **Descartado salvo que se demuestre que el
ajuste no es manipulable desde la aplicación.**

---

## 5. 0.2-D — Crons / Jobs / Workers

No existen colas, workers ni *queue processors*. Solo 3 `@Cron`. **Ninguno recibe `institutionId`
por ningún medio: operan sobre todas las instituciones a la vez.**

| | `classroom.cron` | `play.cron` | `live-session.cron` |
|---|---|---|---|
| Frecuencia | 5 min | 30 min | 5 min |
| Función | `processScheduledPublications()` | `handleOrphanSessions()` | `cleanupOrphanedStreams()` |
| Tabla | `ClassroomActivity` (tenant **indirecto** vía `Classroom`) | `LiveSession` (indirecto vía `Classroom`) | `LiveSession` vía **`$queryRaw`** |
| Operación | `updateMany` (publica programadas) | `updateMany` (cierra huérfanas) | `SELECT` + limpieza en memoria |
| Contexto hoy | ninguno | ninguno | ninguno |
| Sin contexto con RLS | `count = 0` | `count = 0` | **`SELECT` devuelve 0 filas** |
| Interpretación del código | `if (count > 0) log(...)` → **silencio** | `if (count > 0) warn(...)` → **silencio** | 🔴 **ver abajo** |
| Consecuencia funcional | Las actividades programadas **nunca se publican** | Sesiones huérfanas se acumulan | 🔴 **destructiva** |

### 5.1 🛑 El caso `live-session.cron` no es un fallo silencioso: es destructivo

```ts
const activeSessions = await this.prisma.$queryRaw`
  SELECT id FROM "LiveSession" WHERE id = ANY(${sessionIds}) AND status IN ('ACTIVE','WAITING')`;
const activeIds = new Set(activeSessions.map(s => s.id));
for (const sessionId of sessionIds) {
  const isActive = activeIds.has(sessionId);
  if (!isActive || age > TWO_HOURS) { this.cleanupStream(sessionId); }   // ← cierra el stream SSE
}
```

El código interpreta **"no aparece en la consulta" como "la sesión terminó"**. Con RLS activo y
sin contexto, la consulta devolvería **0 filas siempre**, `activeIds` quedaría vacío, y el cron
**cerraría todos los streams SSE en curso cada 5 minutos**: todos los quizzes en vivo del país
se caerían, en clase, sin ningún error en los logs.

Este es el ejemplo más claro de por qué la pregunta del encargo —*"¿se interpreta `count = 0`
como éxito?"*— importa: aquí **`0 filas` se interpreta como "todo terminó"**, y la reacción es
activa, no pasiva.

---

## 6. 0.2-E — SSE / Play: análisis real de conexiones

La Fase 0.1 repitió la afirmación del código ("35 alumnos = 35 conexiones"). **Verificada: es
correcta, pero condicional.** Detalle del ciclo de vida real:

- La difusión SSE se hace con un **`Subject` de RxJS en memoria**, uno por sesión, en
  `LiveSessionService.streams: Map<string, Subject<LiveEvent>>`.
- El handler devuelve `concat(replay$, live$)`, donde `live$ = subject.asObservable()`.
  **Ese Observable no completa nunca** hasta que `cleanupStream()` llama a `subject.complete()`.

**Pregunta 1 — ¿una conexión SSE mantiene abierta una conexión PostgreSQL?**
**No, por sí misma.** Mientras el stream está abierto no hay actividad de base de datos: los
eventos viajan por el `Subject` en memoria. El coste es una conexión HTTP, no una de PostgreSQL.

**Pregunta 2 — ¿una transacción Prisma permanece abierta durante la vida del SSE?**
**Hoy no, porque el endpoint lleva `@SkipTenantCheck()`.** Pero **sí ocurriría si se le quitara**:
el `TenantContextInterceptor` envuelve `next.handle()` en una promesa que solo se resuelve con
`complete()`. Como el Observable SSE nunca completa, la `$transaction` seguiría abierta
—reteniendo su conexión— durante toda la sesión. La afirmación del código es correcta; la
condición es "si el interceptor lo envuelve".

**Pregunta 3 — consumo real de conexiones PostgreSQL:**

| Alumnos conectados | Hoy (`@SkipTenantCheck`) | Si el SSE se envolviera en el interceptor |
|---|---|---|
| 10 | 0 | 10 |
| 20 | 0 | 20 → **pool de la instancia agotado** |
| 35 | 0 | 35 solicitadas, **20 concedidas, 15 en espera → `P2024`** |
| 50 | 0 | 20 concedidas, 30 fallan |
| 100 | 0 | 20 concedidas, 80 fallan |

**Pregunta 4 — `connection_limit = 20` frente a `max_connections = 100`:**
el límite que muerde primero es el de Prisma (**20 por instancia de la API**), no el del
servidor. Con 2 instancias serían 40 de las 100 disponibles. Con el SSE fuera del interceptor
—como está hoy— el pool queda íntegro para las peticiones normales.

**Pregunta 5 — ¿RLS obliga a mantener una transacción abierta durante todo el SSE?**
**No.** RLS necesita que el contexto esté fijado **cuando se ejecuta una consulta**, no de forma
continua. Como el SSE **no consulta la base de datos mientras emite**, no necesita contexto
persistente. Un patrón de transacciones cortas por operación (fijar `SET LOCAL`, consultar,
cerrar) sería suficiente y no retendría conexiones. **El acoplamiento actual entre "contexto de
tenant" y "una transacción por request completo" es una decisión de implementación, no un
requisito de RLS.**

### 6.1 Hallazgo colateral (fuera del alcance de RLS)

El `Map` de `Subject` vive **en la memoria del proceso**. Si la API escalara a más de una
instancia, los alumnos conectados a la instancia 2 **no recibirían** los eventos publicados en
la instancia 1. **El diseño SSE actual solo funciona con una única réplica.**

---

## 7. 0.2-F — Credencial de producción expuesta

### 7.1 Identificación (sin revelar el valor)

| Campo | Dato |
|---|---|
| Tipo de secreto | Contraseña del rol `postgres` de PostgreSQL |
| Entorno afectado | **PRODUCCIÓN** |
| Archivo 1 | `scripts/fix-recovery-grades.ts`, línea 17 |
| Archivo 2 | `docs/RBAC_OBSERVATION_SPRINT.md`, líneas 38 y 149 |
| Commit | `75f4572c` (el fichero está versionado; la credencial vive en el historial) |
| Alcance del privilegio | `SUPERUSER`, `BYPASSRLS`, owner de las 216 tablas |

### 7.2 🛑 Verificación: la credencial expuesta ES la credencial viva

Comparación por **huella SHA-256 truncada**, sin imprimir ni transmitir el valor y **sin intentar
autenticarse** (prohibido explícitamente):

| Origen | Huella |
|---|---|
| `scripts/fix-recovery-grades.ts` | `5f333a632d` |
| `docs/RBAC_OBSERVATION_SPRINT.md` | `5f333a632d` |
| Railway · servicio `Postgres` · `PGPASSWORD` | **`5f333a632d`** |
| Railway · servicio `api` · `DATABASE_URL` | **`5f333a632d`** |

**Coinciden.** La credencial publicada en el repositorio es la que hoy usa la API de producción.
No es un secreto caducado.

### 7.3 🛑 Hallazgo nuevo: secretos compartidos entre staging y producción

La misma comparación por huella, aplicada al resto de variables:

| Secreto | `api` (producción) | `edusyn-api-staging` | ¿Compartido? |
|---|---|---|---|
| `DATABASE_URL` (password) | `5f333a632d` | `e4db11961e` | ✅ No — **bases separadas correctamente** |
| **`JWT_SECRET`** | `b044b3e57e` | `b044b3e57e` | 🔴 **SÍ** |
| **`JWT_ACCESS_SECRET`** | `c6ed2bd6a8` | `c6ed2bd6a8` | 🔴 **SÍ** |
| **`JWT_REFRESH_SECRET`** | `499eff3202` | `499eff3202` | 🔴 **SÍ** |
| **`R2_SECRET_ACCESS_KEY`** | `a823c42345` | `a823c42345` | 🔴 **SÍ** |
| **`SUPABASE_SERVICE_ROLE_KEY`** | `a2372d8802` | `a2372d8802` | 🔴 **SÍ** |

Consecuencias:

- **Un JWT emitido por staging es criptográficamente válido en producción**, y viceversa. El
  payload transporta `institutionId` e `isSuperAdmin`, que `JwtStrategy.validate()` acepta sin
  volver a consultar la base de datos. Si staging se pobló alguna vez desde un volcado de
  producción, los identificadores de usuario e institución **coinciden**, y el token sería
  plenamente utilizable contra producción.
  *Potencialmente explotable; pendiente prueba controlada. **No se ha probado.***
- **R2 y Supabase son la misma cuenta con la misma clave.** El bucket `edusyn-files` contiene
  `backups/db/`, es decir, **los backups de producción**. Un error o un compromiso en staging
  puede borrarlos. Esto degrada gravemente el análisis de B-6 de la Fase 0.1: el backup no está
  aislado del entorno donde vamos a experimentar con RLS.

### 7.4 Inventario de consumidores de la credencial de producción

| Consumidor | Entorno | Cómo la obtiene | Acción futura |
|---|---|---|---|
| Railway · servicio `api` | producción | variable `DATABASE_URL` | **actualizar** |
| Railway · servicio `Postgres` | producción | `PGPASSWORD`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `DATABASE_PUBLIC_URL` | **origen de la rotación** |
| GitHub Actions · `db-backup.yml` | producción | secreto `DATABASE_PUBLIC_URL` | **actualizar** |
| `scripts/fix-recovery-grades.ts` | producción | **literal en el código** | **sustituir por `process.env.DATABASE_URL`** |
| `docs/RBAC_OBSERVATION_SPRINT.md` | producción | **literal en la documentación** | **eliminar el secreto** |
| Puestos de desarrollo | — | copias locales / historial de terminal | **verificar y purgar** |
| `apps/api/.env` local | local | apunta a `localhost` | sin acción (correcto, y está en `.gitignore`) |
| `apps/api/scripts/diagnose-evidence-orphans.ts` | — | solo un ejemplo con marcador de posición | sin acción |

### 7.5 Plan de rotación propuesto — **NO EJECUTADO**

1. **Inventariar consumidores** — hecho en §7.4.
2. **Ventana de mantenimiento.** Rotar la contraseña de `postgres` **reinicia las conexiones
   activas**: la API devolverá errores hasta que su variable se actualice.
3. **Generar la nueva credencial** en el servicio `Postgres` de Railway.
4. **Actualizar consumidores en este orden:** servicio `api` → secreto de GitHub Actions
   `DATABASE_PUBLIC_URL` → cualquier uso manual.
5. **Verificar conectividad**: arranque de la API, `prisma migrate deploy` sin cambios pendientes,
   y una ejecución manual (`workflow_dispatch`) del backup.
6. **Revocar la anterior** (implícito al rotar).
7. **Limpiar el árbol de trabajo**: sustituir el literal por `process.env.DATABASE_URL` en
   `fix-recovery-grades.ts` y eliminar la cadena de `RBAC_OBSERVATION_SPRINT.md`.
8. **Historial de Git**: decisión aparte. Una vez rotada la contraseña, la del historial queda
   inerte. `git filter-repo` reescribe todos los hashes y afecta a **30+ ramas** locales y
   remotas — coste alto, beneficio marginal tras la rotación.
9. **Auditar accesos**: revisar en Railway las conexiones a la base de producción en busca de
   orígenes no reconocidos.

**Rotación adicional recomendada, por §7.3:** separar `JWT_*`, `R2_*` y `SUPABASE_*` entre
staging y producción. La rotación de los `JWT_*` **invalida todas las sesiones activas** y
obliga a que todos los usuarios vuelvan a entrar: exige su propia ventana.

> Ninguno de estos 9 pasos se ha ejecutado. No se ha lanzado `ALTER ROLE`, ni actualizado
> variables de Railway, ni `git filter-repo`, ni ningún `push`.

---

## 8. 0.2-G — Aislamiento Railway staging / producción

### 8.1 Arquitectura real (verificada, sin secretos)

```
Proyecto Railway: believable-forgiveness
└── environment ÚNICO: "production"
    ├── api                 ← rama main      → DB postgres.railway.internal      (PROD)
    ├── web                 ← rama main
    ├── Postgres            ← volumen        → PROD, público en centerbeam.proxy.rlwy.net:53943
    ├── edusyn-api-staging  ← rama staging   → DB postgres-w0we.railway.internal (STAGING)
    ├── edusyn-web-staging  ← rama staging
    └── edusyn-staging-db   ← volumen        → STAGING, público en reseau.proxy.rlwy.net:50660
```

| Dimensión | Estado |
|---|---|
| Bases de datos | ✅ **Separadas**, con credenciales distintas. La API de staging **no** apunta a producción |
| Ramas de despliegue | ✅ Separadas (`main` / `staging`) |
| Secretos JWT / R2 / Supabase | 🔴 **Compartidos** (§7.3) |
| Environment de Railway | 🔴 **Uno solo**: cualquier comando sin `--service` correcto actúa sobre producción |
| Exposición pública de la BD | ⚠️ Ambas bases tienen proxy TCP público |
| Backups | 🔴 Solo producción; y el bucket es accesible con la clave de staging |

### 8.2 Alternativas

| | **A** · Environments separados | **B** · Mismo environment, aislar por servicio | **C** · Proyecto Railway independiente |
|---|---|---|---|
| Seguridad | Alta | Media | **Muy alta** |
| Riesgo de despliegue accidental | Bajo (el CLI exige `--environment`) | Medio (persiste hoy) | **Muy bajo** |
| Complejidad | Media — recrear servicios y variables | **Nula** | Alta — dominios, CI/CD, R2 |
| Coste | Igual | Igual | Posible proyecto adicional |
| Migraciones | Sin impacto | Sin impacto | Sin impacto |
| Backups | Permite un workflow por environment | Requiere duplicar el workflow | Aislamiento total del bucket |
| Dominios | Reasignar staging | Sin cambios | Reconfigurar |
| Variables | Se separan de forma natural | Hay que separarlas a mano | Separadas por construcción |

**Recomendación:** **B de inmediato** (coste cero: protocolo obligatorio de `--service` explícito
+ verificación de `current_database()` y host antes de cada operación, más separar los secretos
compartidos de §7.3), y **A antes de la Fase 9**, cuando empecemos a crear roles y políticas en
staging. **C** solo si más adelante se quiere aislar también el almacenamiento.

---

## 9. 0.2-H — PostgreSQL 17 vs 18

### 9.1 Qué usa realmente el proyecto

| Elemento | Uso en Edusyn | ¿Sensible a la versión? |
|---|---|---|
| Extensiones | solo `plpgsql` (por defecto) | No |
| Funciones | **0** en `public` | No |
| Triggers | **0** | No |
| Vistas / matviews | **0** | No |
| Columnas generadas / `MERGE` | **0** en las migraciones | No |
| Tipos Prisma | solo `@db.Text` (98), `@db.Decimal` (65), `@db.Date` (7) | No |
| `previewFeatures` de Prisma | ninguna | No |
| RLS / políticas | ninguna todavía; la sintaxis es idéntica en 17 y 18 | No |
| Transacciones interactivas, `set_config`, `current_setting` | soportadas desde hace muchas versiones | No |

**No existe ningún motivo técnico para que staging esté en 18.4.** Nada del proyecto lo requiere.
La deriva es casi con seguridad accidental: el servicio de staging se creó después y Railway
aprovisionó la imagen más reciente.

### 9.2 Argumento en contra de mantenerla

- **Prisma 5.22.0** es la versión instalada. La rama 5.x se publicó y validó contra PostgreSQL
  hasta 16/17. **PostgreSQL 18 queda fuera de su matriz de compatibilidad probada.** Staging
  corre hoy en una combinación no certificada.
- Para RLS, staging existe para **ensayar producción**. Con una versión mayor de diferencia,
  un ensayo correcto no acredita el original: plan de consultas, comportamiento del planificador
  ante predicados de política y detalles de bloqueo pueden diferir.

### 9.3 Recomendación

**Igualar staging a la versión de producción (17.x)**, conforme al criterio del encargo.
Advertencia importante: **PostgreSQL no permite degradar un directorio de datos de 18 a 17 en
caliente**. Requiere `pg_dump` desde staging + servicio nuevo en 17 + restauración. Es una
operación de infraestructura, no una migración de esquema, y debe hacerse **antes** de la Fase 9.

**No se ha actualizado ni degradado ninguna base.**

---

## 10. Hallazgos P0

| ID | Hallazgo | Evidencia | ¿Bloquea RLS? |
|---|---|---|---|
| **P0-1** | La credencial de producción versionada en Git **es la credencial viva** (superusuario, `BYPASSRLS`) | §7.2 — coincidencia de huellas | Sí. RLS no protege contra un superusuario con la contraseña publicada |
| **P0-2** | **Secretos JWT compartidos** entre staging y producción | §7.3 | Sí. El perímetro de autenticación no está aislado |
| **P0-3** | **Claves de R2 y Supabase compartidas** — staging alcanza los backups de producción | §7.3 | Sí. Anula la red de seguridad de la Fase 8 |
| **P0-4** | **Escritura cross-tenant en `capabilities`**: A reescribe la matriz de autorización de B | §2.5 | Sí. Es una brecha de aislamiento activa, hoy |
| **P0-5** | `TenantGuard` inerte: la validación cross-tenant nunca se ejecuta | Fase 0.1 §3, confirmado empíricamente | Sí |
| **P0-6** | 7 escrituras cross-tenant adicionales (clase D) | §2.4 | Sí |

## 11. Hallazgos P1

| ID | Hallazgo | Evidencia |
|---|---|---|
| **P1-1** | 14 lecturas cross-tenant (clase C), incluida PII de acudientes **sin ningún `@Roles`** | §2.4, casos 12–13 |
| **P1-2** | `live-session.cron` interpreta "0 filas" como "sesión terminada" → con RLS **cerraría todos los SSE en curso cada 5 min** | §5.1 |
| **P1-3** | `switchInstitution` incompatible con RLS ingenuo: atraparía a los usuarios multi-institución | §3.2 |
| **P1-4** | Railway con un único environment: riesgo de operar producción por error | §8.1 |
| **P1-5** | Staging en PG 18.4 con Prisma 5.22 (fuera de matriz) y distinto de producción | §9 |
| **P1-6** | Sin PITR en ninguna base; el único backup vive en un bucket alcanzable desde staging | Fase 0.1 §7 + §7.3 |
| **P1-7** | La escalada de rol `SUPERADMIN` dentro de un tenant no está descartada | §2.3 |

## 12. Hallazgos P2

| ID | Hallazgo | Evidencia |
|---|---|---|
| **P2-1** | `resolveInstitutionId` paso 4: `findFirst` sin `orderBy` → institución arbitraria | §2.3 |
| **P2-2** | `CreateAcademicYearDto` es un `interface`: el `ValidationPipe` no valida ese body | §2.6 |
| **P2-3** | El SSE guarda los `Subject` en memoria: la API no puede escalar a más de una réplica | §6.1 |
| **P2-4** | 35 tablas con `institutionId` sin índice; 13 sin FK a `Institution` | Fase 0.1 §2 |
| **P2-5** | Ambas bases exponen proxy TCP público | §8.1 |

---

## 13. Discrepancias documentales (no se editó ningún documento anterior)

| Documento | Afirmación anterior | Evidencia nueva | Impacto | Recomendación |
|---|---|---|---|---|
| `docs/AUDITORIA_ADVERSARIAL_PASE1.md` · C-1 | *"El `TenantGuard` … **solo bloquea cuando el request trae `institutionId` explícito**"* | El guard **no bloquea nunca**: `req.user` es `undefined` cuando se ejecuta (prueba empírica, Fase 0.1 §3) | C-1 subestima el alcance; el caso que da por cubierto tampoco lo está | Actualizar C-1 tras autorización. **No modificado** |
| `docs/security/RLS-AUDIT-FASE0.1.md` | *"≈113 puntos donde controladores reciben `institutionId`… debemos determinar cuáles son explotables"* | Son **139** puntos; **113 son justamente los seguros** y los problemáticos son **25** | La cifra 113 se leía como "113 sospechosos"; es lo contrario | Corregido aquí. **La Fase 0.1 no se modificó** |
| `docs/security/RLS-AUDIT-FASE0.1.md` · §6.3 | *"35 alumnos = 35 conexiones de pool"* (repitiendo el comentario del código) | Correcto **solo si** el interceptor envuelve el SSE; hoy no lo hace, y el consumo real es **0** | La justificación de `@SkipTenantCheck` es válida, pero RLS **no** obliga a ese patrón | Documentado en §6. **No modificado** |

---

## 14. Decisiones que requieren autorización

Se mantienen las decisiones **A–G** de la Fase 0.1. Esta fase añade tres y reordena la urgencia.

### DECISIÓN H · Rotación de secretos compartidos entre staging y producción (nueva, P0)

- **Problema:** `JWT_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `R2_SECRET_ACCESS_KEY`
  y `SUPABASE_SERVICE_ROLE_KEY` son idénticos en ambos entornos.
- **Evidencia:** §7.3, comparación de huellas.
- **Alternativas:** **H1** separar los cinco. **H2** separar solo los `JWT_*` (corta la
  falsificación de tokens). **H3** separar solo `R2_*` (protege los backups).
- **Recomendación:** **H1**, ejecutado en dos ventanas: primero `R2_*` y `SUPABASE_*` (sin
  impacto en usuarios), después los `JWT_*` (**cierra todas las sesiones activas**).
- **Riesgo local:** ninguno. **Staging:** bajo. **Producción:** medio — los `JWT_*` obligan a
  que todos los usuarios vuelvan a iniciar sesión.

### DECISIÓN I · Corrección de las 8 escrituras cross-tenant (nueva, P0)

- **Problema:** 8 endpoints permiten escribir en otra institución, hoy, sin RLS de por medio.
- **Evidencia:** §2.4 y §2.5.
- **Alternativas:** **I1** aplicar `resolveInstitutionId()` en los 25 casos (patrón ya existente
  y probado en 113 endpoints). **I2** arreglar `TenantGuard` para que cubra el caso genérico.
  **I3** esperar a RLS y que la base de datos lo bloquee.
- **Recomendación:** **I1 + I2**. **I3 es inaceptable**: deja la brecha abierta durante todas las
  fases restantes, y RLS por sí solo no la cerraría en las rutas donde el `institutionId` del
  request **coincide** con lo que la política espera.
- **Riesgo local/staging:** bajo. **Producción:** bajo, pero toca 8 controladores; requiere pruebas.

### DECISIÓN J · Orden de trabajo: seguridad de acceso antes que RLS (nueva)

- **Problema:** el plan vigente pasa de la auditoría al diseño de RLS. Los hallazgos P0-1 a P0-4
  son brechas **activas** que RLS no resuelve.
- **Alternativas:** **J1** congelar RLS y ejecutar primero H, B e I. **J2** avanzar en paralelo.
  **J3** seguir el plan original.
- **Recomendación:** **J1.** Con la credencial de producción publicada y los JWT compartidos,
  invertir semanas en RLS es reforzar la puerta de atrás con la principal abierta.
- **Riesgo:** ninguno técnico; retrasa el calendario de RLS.

---

## 15. Cambios que NO deben hacerse todavía

- Crear roles PostgreSQL, activar RLS, crear políticas o funciones, generar migraciones.
- Modificar `TenantGuard`, `JwtAuthGuard`, el orden de los guards o el `TenantContextInterceptor`.
- Reescribir `check:rls`.
- Tocar los crons o el SSE.
- Crear environments en Railway o mover servicios.
- Actualizar o degradar la versión de PostgreSQL de staging.
- Ejecutar `git filter-repo` o cualquier reescritura del historial.
- Escribir `docs/security/RLS-MULTI-TENANT.md` (la arquitectura depende de A, B, C, D).

**Excepción a considerar con autorización expresa:** la rotación de la credencial de producción
(DECISIÓN B) y la de los secretos compartidos (DECISIÓN H) **no son cambios de arquitectura**;
son contención de un incidente y no dependen de ninguna decisión sobre RLS.

---

## 16. Matriz de estado

| Decisión | Estado | ¿Bloquea RLS? | Acción |
|---|---|---|---|
| Credencial de producción en Git | 🔴 **Confirmada viva** | **Sí** | Requiere autorización — rotar (DECISIÓN B) |
| Secretos JWT/R2/Supabase compartidos | 🔴 **Nuevo P0** | **Sí** | Requiere autorización — rotar (DECISIÓN H) |
| Escrituras cross-tenant (8 endpoints) | 🔴 **Nuevo P0** | **Sí** | Corregir con `resolveInstitutionId` (DECISIÓN I) |
| Lecturas cross-tenant (14 endpoints) | 🟠 | Sí | Clasificadas; corregir con el mismo patrón |
| Roles PostgreSQL | 🔴 | **Sí** | Diseñar (DECISIÓN A) |
| `TenantGuard` | 🔴 | **Sí** | Diseñar corrección + test de regresión |
| `switchInstitution` | 🔴 | **Sí** | Diseñar flujo — alternativa C recomendada |
| SuperAdmin | 🟠 | Sí | Modelo definido: contexto seleccionado + bypass mínimo (3 operaciones) |
| Railway staging | 🔴 | **Sí** | Protocolo ya (B) + environment separado antes de Fase 9 |
| PG 17 vs 18 | 🟠 | Antes de staging | Igualar staging a 17.x — sin obstáculo técnico |
| SSE / Play | 🟢 **Resuelto** | **No** | RLS no exige transacción larga; usar transacciones cortas |
| Crons | 🟠 | Sí | `live-session.cron` reclasificado a **destructivo**, no silencioso |
| Backups | 🔴 | Antes de cambios | Sin PITR + bucket alcanzable desde staging |
| Flujos de `institutionId` | 🟠 | Sí | **Clasificados**: 113 A · 1 B · 14 C · 8 D · 1 E |

---

## 🚦 ¿ESTAMOS LISTOS PARA IMPLEMENTAR RLS?

# NO.

Y las razones ya no son las de la Fase 0. Entonces faltaban decisiones de diseño; ahora hay
**brechas activas que RLS no arregla y que lo harían inútil**:

1. **La contraseña de producción está publicada y es válida.** Quien la tenga se conecta como
   superusuario con `BYPASSRLS`. Ninguna política que escribamos le afecta. **RLS sería
   irrelevante frente al vector de ataque real.**
2. **Los secretos JWT son comunes a staging y producción.** El aislamiento de tenant presupone
   que la identidad es de fiar. Si un token de staging vale en producción, la premisa de RLS
   —"el `institutionId` del JWT es cierto"— no se sostiene.
3. **Existen 8 escrituras cross-tenant explotables hoy.** Hay que cerrarlas en la capa de
   aplicación con independencia de RLS: son el fallo primario, y RLS es la defensa en profundidad.
4. **La red de seguridad no está aislada.** Los backups de producción son alcanzables con la clave
   de staging, no hay PITR, y staging —donde vamos a experimentar— no tiene copia propia.
5. **Staging no es un ensayo válido**: versión mayor distinta, mismo environment de Railway.

**Lo que sí quedó resuelto y no bloquea:** el SSE. Queda demostrado que RLS **no** obliga a
mantener una transacción abierta por cliente, así que el temor al agotamiento del pool no
condiciona el diseño.

---

## 17. Próximo paso recomendado

**Fase 0.3 — Contención, antes de cualquier diseño de RLS** (requiere tu autorización explícita
para cada punto):

1. **DECISIÓN B** — rotar la credencial de producción y sacar el literal del árbol de trabajo.
2. **DECISIÓN H** — separar los secretos compartidos entre staging y producción.
3. **DECISIÓN I** — cerrar las 8 escrituras cross-tenant con el patrón `resolveInstitutionId()`
   que ya protege a 113 endpoints, y añadir pruebas.
4. Verificar en el panel de Railway si existen snapshots, y hacer un `pg_dump` manual de staging.

Solo después: **Fase 1** (mapa definitivo de tenancy) y **Fase 2** (diseño de
`current_institution_id()`, que ya sabemos debe transportar también `app.current_user_id`
por §3.3 y §4.2).

---

## 18. Qué NO se hizo en esta fase

Ninguna escritura en ninguna base de datos: todas las sesiones se abrieron con
`default_transaction_read_only = on` y se limitaron a catálogos y `COUNT(*)`. No se intentó
autenticarse con la credencial expuesta —la verificación se hizo comparando huellas SHA-256—.
No se probó ninguna de las vulnerabilidades identificadas contra ningún entorno. No se rotó
ningún secreto, no se modificó Railway, no se creó ni cambió ningún rol, política, función o
migración, no se tocó el código de la aplicación, no se editó ningún documento anterior y no se
desplegó nada.

Los cambios ajenos en curso no fueron tocados. **Único archivo creado: este documento.**
