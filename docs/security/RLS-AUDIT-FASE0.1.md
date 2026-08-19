# RLS AUDIT — FASE 0.1 — RESOLUCIÓN DE BLOQUEANTES

> **Continuación de** `docs/security/RLS-AUDIT-FASE0.md` (leído íntegro antes de empezar).
> **Alcance:** READ ONLY en local, staging y producción. **No se modificó ningún archivo del
> repositorio salvo este documento**, ni ninguna base de datos, rol, variable o servicio.
>
> **Fecha:** 2026-08-18 · **Rama:** `main` (HEAD `1e38d57`) · Cambios ajenos en curso
> (evaluaciones D-19, onboarding) **no tocados**.

---

## 0. Resumen: qué queda resuelto y qué no

| Bloqueante | Estado tras esta fase |
|---|---|
| **B-1** Roles PostgreSQL | ✅ **RESUELTO con evidencia en los 3 entornos** |
| **B-2** `TenantGuard` inerte | ✅ **CONFIRMADO empíricamente** (ya no es inferencia) |
| **B-3** Bootstrap del login | ✅ Mapeado · ⚠️ **hallazgo nuevo**: `switchInstitution` |
| **B-4** SuperAdmin | ✅ Mapeado y clasificado |
| **B-5** Jobs / scripts / workers | ✅ Inventariado y clasificado |
| **B-6** Backup y recuperación | ✅ Verificado · corrige un dato de la Fase 0 |

Además aparecieron **tres hallazgos nuevos de severidad alta** que no estaban en la Fase 0
(§8). Uno de ellos activa la regla de parada por *"datos de producción en riesgo"*.

**No se escribió `RLS-MULTI-TENANT.md`** (§17 del encargo): siguen faltando decisiones
arquitectónicas, enumeradas en §9.

---

## 1. Inventario de entornos y conexiones (§3, §5 del encargo)

Distinción explícita entre rama Git y base de datos, verificada por CLI, no asumida.

### 1.1 Ramas Git

Rama actual: **`main`**. Existe rama local y remota **`staging`**. Ninguna fue cambiada.

### 1.2 Infraestructura Railway (verificada con `railway status --json`)

Proyecto **`believable-forgiveness`** (`aa04d6e3-…`).

> 🔴 **Existe un solo *environment* de Railway, llamado `production`.**
> "Staging" **no es un environment separado**: es un conjunto de *servicios* que conviven
> con producción dentro del mismo environment.

| Servicio Railway | Rama desplegada | Rol real |
|---|---|---|
| `api` | `main` | **API de PRODUCCIÓN** |
| `web` | `main` | Web de producción |
| `Postgres` | (imagen) | **BD de PRODUCCIÓN** |
| `edusyn-api-staging` | `staging` | API de staging |
| `edusyn-web-staging` | `staging` | Web de staging |
| `edusyn-staging-db` | (imagen) | BD de staging |

**Consecuencia operativa:** cualquier comando de Railway sin `--service` explícito, o con el
servicio equivocado, actúa **dentro del environment de producción**. El radio de daño de un
error de tipeo durante la implementación de RLS es máximo. Se detalla como **DECISIÓN F**.

### 1.3 Conexiones a base de datos realmente consultadas

Las tres fueron consultadas con `SET default_transaction_read_only = on` y **exclusivamente**
`pg_catalog` / `information_schema` / `COUNT(*)`. Las credenciales se leyeron mediante
`railway variables --json` dentro de un script que **nunca las imprime**.

| Entorno | Host | Database | Usuario | Versión | Instituciones |
|---|---|---|---|---|---|
| **LOCAL** | `localhost:5432` | `edusyn_dev` | `postgres` | **17.5** | 1 |
| **STAGING** | `reseau.proxy.rlwy.net:50660` | `railway` | `postgres` | **18.4** | 6 |
| **PRODUCCIÓN** | `centerbeam.proxy.rlwy.net:53943` | `railway` | `postgres` | **17.10** | **5 (datos reales)** |

> ⚠️ **Deriva de versión mayor:** staging corre **PostgreSQL 18.4** y producción **17.10**.
> Staging no es una réplica fiel: probar RLS allí **no garantiza** el mismo comportamiento de
> planificador ni idéntica semántica en producción. Ver **DECISIÓN G**.

---

## 2. B-1 · Roles y privilegios PostgreSQL — RESUELTO

Consulta idéntica en los tres entornos sobre `pg_roles`, `pg_tables`, `information_schema.role_table_grants`.

| | LOCAL | STAGING | PRODUCCIÓN |
|---|---|---|---|
| Roles con login (excl. `pg_*`) | **solo `postgres`** | **solo `postgres`** | **solo `postgres`** |
| `rolsuper` | `true` | `true` | `true` |
| `rolbypassrls` | **`true`** | **`true`** | **`true`** |
| `rolinherit` / `rolcreaterole` / `rolcreatedb` | `true` | `true` | `true` |
| Owner de las tablas de `public` | `postgres` (215) | `postgres` (217) | `postgres` (216) |
| GRANTs a roles distintos del owner | **0** | **0** | **0** |
| `row_security` (server) | — | `on` | `on` |
| `current_institution_id()` | **no existe** | **no existe** | **no existe** |
| Funciones en `public` | 0 | 0 | 0 |
| Políticas RLS | **0** | **0** | **0** |
| Tablas con RLS enabled / forced | 0 / 0 | 0 / 0 | 0 / 0 |
| Tablas totales | 215 | 217 | 216 |
| Tablas con `institutionId` | 121 | 123 | **122** |
| …sin índice sobre `institutionId` | 35 | 35 | **35** |
| …sin FK a `Institution` | 13 | 13 | **13** |
| Migraciones aplicadas / sin terminar | 83 / **2** | 91 / **1** | 89 / **0** |

**Veredicto B-1 — confirmado en los tres entornos.** No existe ningún rol de aplicación.
El runtime, las migraciones, los scripts y el SuperAdmin usan **el mismo superusuario con
`BYPASSRLS`**. Mientras esto no cambie, crear políticas RLS produce **cero aislamiento** y
un `check:rls` en verde. Esto se decide en **DECISIÓN A**.

**Detalle a resolver:** la única migración sin terminar en staging es
`20260630170000_grade_audit_events` (`rolled_back_at` no nulo), y es **precisamente una de
las que llevan el bloque RLS con guarda `IF EXISTS`**. La tabla `GradeAuditEvent` **sí existe**
en staging y en producción, y staging tiene aplicadas migraciones posteriores, luego alguien
la resolvió manualmente. Producción no arrastra migraciones fallidas.

---

## 3. B-2 · `TenantGuard` — CONFIRMADO EMPÍRICAMENTE

En la Fase 0 esto era una inferencia sobre el orden de guards de NestJS. Ahora es una
observación.

### 3.1 Prueba realizada

Se construyó una aplicación NestJS mínima **fuera del repositorio** (en el scratchpad de la
sesión) que reproduce exactamente el cableado de `app.module.ts`: un guard registrado como
`APP_GUARD` global, un guard aplicado con `@UseGuards()` a nivel de controlador, y un
`APP_INTERCEPTOR` global. No importa código de Edusyn ni toca la base de datos.

**Traza real de ejecución (NestJS 11, el mismo del proyecto):**

```
 1. GLOBAL_GUARD(TenantGuard): req.user = undefined
 2.    -> rama "if (!user) return true": NO valida cross-tenant, NO fija resolvedInstitutionId
 3. CONTROLLER_GUARD(JwtAuthGuard): req.user ASIGNADO
 4. GLOBAL_INTERCEPTOR(TenantContextInterceptor): req.user = {...} | resolvedInstitutionId = undefined
 5. HANDLER ejecutado
```

### 3.2 Conclusiones con evidencia

1. El guard **global** se ejecuta **antes** que el guard de **controlador**. Confirmado.
2. Cuando `TenantGuard` evalúa, `req.user` es `undefined` en **los 99 de 103 controladores**
   que aplican `JwtAuthGuard` a nivel de clase o de ruta.
3. Por tanto `TenantGuard` **siempre** toma la rama `if (!user) return true`:
   - la comprobación cross-tenant `requestInstitutionId !== jwtInstitutionId` **nunca se ejecuta**;
   - `req.resolvedInstitutionId` **nunca se asigna**.
4. El `TenantContextInterceptor` **sí** ve `req.user` (los interceptores corren después de
   todos los guards) — por eso el contexto de tenant sí funciona hoy, y `TenantGuard` no.

### 3.3 🛑 DISCREPANCIA con documentación existente del repositorio

`docs/AUDITORIA_ADVERSARIAL_PASE1.md`, hallazgo **C-1**, afirma:

> *"El `TenantGuard` está registrado global … pero **solo bloquea cuando el request trae
> `institutionId` explícito** en query/body/params"*

**Lo que hace realmente el código: no bloquea nunca.** La rama que C-1 da por funcional es
inalcanzable. Conforme a la regla de parada, no elijo entre código y documento; lo reporto:

| | |
|---|---|
| **Dice el documento** | El guard protege el caso "`institutionId` explícito en el request". |
| **Hace el código** | El guard retorna `true` antes de mirar nada, porque `req.user` no existe todavía. |
| **Discrepancia** | C-1 subestima el alcance: no es que falten los recursos identificados por su propio ID — es que **tampoco** está cubierto el caso explícito. |
| **Riesgo** | C-1 está priorizado **P0** asumiendo cobertura parcial. La cobertura real es nula: 113 puntos en controladores reciben `institutionId` por query/param/body. |
| **Alternativas** | (1) Corregir C-1 en el documento adversarial; (2) tratarlo en el diseño de RLS; (3) ambas. |

**No he modificado `AUDITORIA_ADVERSARIAL_PASE1.md`.** Requiere tu decisión.

### 3.4 Qué NO se hizo

No se cambió el orden de los guards, ni `app.module.ts`, ni ningún controlador. La prueba
vive fuera del repositorio; se propone incorporarla como test de regresión en la Fase 6.

---

## 4. B-3 · Login y bootstrap — mapa completo

Qué consulta el sistema **antes** de que exista `app.current_institution`.

### 4.1 Endpoints sin tenant resuelto

| Endpoint | Guard | `req.user` | Contexto de tenant |
|---|---|---|---|
| `POST auth/login` | ninguno (`@Throttle` 5/min) | no | **no** |
| `POST auth/register` | `JwtAuthGuard` + `RolesGuard` | sí | sí |
| `GET auth/institutions/search` | **ninguno (público)** | no | **no** |
| `GET auth/institution/:slug` | **ninguno (público)** | no | **no** |
| `POST auth/switch-institution` | `JwtAuthGuard` | sí | **sí, pero del tenant ANTERIOR** ⚠ |
| `GET auth/me` | `JwtAuthGuard` | sí | sí |
| `POST auth/change-password` | `JwtAuthGuard` | sí | sí |

> No existen endpoints de `refresh` ni `logout` en `auth.controller.ts`.

### 4.2 Tablas consultadas antes de conocer el tenant

| Operación | Tabla | Consulta | ¿Necesita tenant? | Momento | Riesgo bajo RLS |
|---|---|---|---|---|---|
| `login` paso 1 | `User` | `findFirst` por email/username + `roles.role` | No (User es global) | pre-tenant | Bajo — `User` no debe llevar RLS |
| `login` paso 1 | `UserRole`, `Role` | `include` | No (globales) | pre-tenant | Bajo |
| `login` paso 2 | **`InstitutionUser`** | `findMany({ userId, isActive })` | **No puede tenerlo: el tenant se deduce de aquí** | pre-tenant | 🔴 **Login imposible** si lleva política de tenant |
| `login` paso 2 | **`Institution`** | `include` (id, name, slug, logo, status) | No | pre-tenant | 🔴 **Login imposible** con política `id = current_institution_id()` |
| `login` paso 2 | `InstitutionUserRole`, `Role` | `include` | Indirecto vía `InstitutionUser` | pre-tenant | 🔴 mismo problema |
| `institutions/search` | `Institution` | `findMany` por nombre/slug, público | No | pre-tenant | 🔴 devolvería vacío |
| `institution/:slug` | `Institution` | `findUnique({ slug })`, público | No | pre-tenant | 🔴 404 permanente |
| `signTokenForInstitution` | `UserRole` | `findMany({ userId })` | No | pre-tenant | Bajo |

### 4.3 ⚠️ Hallazgo nuevo: `switchInstitution` es un caso peor que el login

`POST auth/switch-institution` **sí** lleva `JwtAuthGuard`, luego el
`TenantContextInterceptor` **abre la transacción y fija el contexto a la institución ACTUAL
(la A)**. Dentro de esa transacción, el servicio hace:

```ts
const targetIu = await this.prisma.institutionUser.findUnique({
  where: { userId_institutionId: { userId, institutionId } },   // institutionId = B
  include: { institution: {...}, institutionUserRoles: { include: { role: true } } },
});
```

Bajo RLS con contexto = A, esa consulta sobre `InstitutionUser` (fila de B) y su `include`
de `Institution` (fila B) **devolverían vacío**, y el usuario recibiría
*"No tienes acceso a esta institución"*. **Un usuario multi-institución quedaría atrapado en
su primera institución.** Este caso no aparecía en la Fase 0.

**No es un problema de bootstrap "antes del tenant": es un problema de cambio de tenant
*dentro* de un tenant.** Cualquier política sobre `InstitutionUser` debe resolverlo.
Se decide en **DECISIÓN C**.

---

## 5. B-4 · SuperAdmin — mapa de operaciones

Contexto: `auth.service.ts:262` emite el JWT de SuperAdmin **sin institución**
(`institutionId: null`) sólo cuando el usuario **no tiene ninguna** `InstitutionUser`.
Si la tiene, el SuperAdmin recibe un token **con** institución, como cualquier usuario.
`SuperadminController` está protegido con `JwtAuthGuard` y cada método llama a
`verifySuperAdmin(userId)`, que lee `User` (tabla global).

| Operación | Alcance | Escribe | Bajo RLS sin bypass |
|---|---|---|---|
| `getSystemStats` | **cross-tenant** — `institution.count()`, `user.count()`, `student.count()` global | no | Devuelve **0** en todo |
| `getAllInstitutions` | **cross-tenant** — `institution.findMany()` sin filtro | no | Lista **vacía** |
| `getInstitutionById` | tenant-scoped (una institución) | no | Vacío sin contexto |
| `getInstitutionUsers` | tenant-scoped | no | Vacío |
| `getInstitutionUsage` | tenant-scoped (counts por `institutionId`) | no | Todo a 0 |
| `getGradeAuditLog` | tenant-scoped | no | Vacío |
| `createInstitution` | **crea el tenant** (`$transaction`: `Institution`, `InstitutionUser`, roles, `PerformanceScale`, rector) | **sí** | 🔴 Imposible: el tenant aún **no existe** cuando se necesita el contexto |
| `updateInstitution` / `updateInstitutionStatus` | tenant-scoped | **sí** | Falla silenciosa (0 filas) |
| `updateInstitutionModules` | tenant-scoped + `institutionModule.deleteMany` | **sí** | Falla silenciosa |
| `resetUserPassword` | usuario (tabla global) | **sí** | Depende de política sobre `User` |
| **`deleteInstitution`** | tenant-scoped, **~20 `deleteMany` en cascada** dentro de `$transaction` | **sí, destructivo** | 🔴 **Peor caso: "éxito" sin borrar nada** |

**Detalle crítico de `deleteInstitution`:** además de borrar datos del tenant, ejecuta
`user.deleteMany({ id: { in: userIds }, isSuperAdmin: false })` — borra filas de la **tabla
global `User`**. Cualquier decisión sobre RLS en `User` afecta a esta operación.

**Categorías que emergen:**

- **Cross-tenant legítimo** (2): `getSystemStats`, `getAllInstitutions`.
- **Bootstrap de tenant** (1): `createInstitution` — necesita escribir un tenant inexistente.
- **Tenant-scoped con tenant elegido por el operador** (8): funcionarían si se fija contexto.
- **Global** (1): `resetUserPassword`.

Se decide en **DECISIÓN D**.

---

## 6. B-5 · Jobs, crons, workers, scripts — inventario y clasificación

Clasificación: **A** tenant-scoped · **B** cross-tenant legítimo · **C** global/sistema · **D** ambiguo.

### 6.1 Crons (3 en total; no hay colas ni workers)

| Archivo | Frecuencia | Operación | Prisma | Contexto hoy | Clase | Con RLS |
|---|---|---|---|---|---|---|
| `classroom.cron.ts` | 5 min | `classroomActivity.updateMany` (publica programadas) | `PrismaService` | **ninguno** | **B** | `ClassroomActivity` no tiene `institutionId` (indirecta vía `Classroom`) → **0 filas, log de éxito** |
| `play.cron.ts` | 30 min | `liveSession.updateMany` (cierra huérfanas) | `PrismaService` | **ninguno** | **B** | `LiveSession` indirecta vía `Classroom` → **0 filas, log de éxito** |
| `live-session.cron.ts` | 5 min | `cleanupOrphanedStreams()` (memoria + BD) | `PrismaService` | **ninguno** | **B** | Igual |

No existen `@Interval`, `@Timeout`, colas ni *queue processors*. `ScheduleModule.forRoot()`
está activo en `app.module.ts`.

> Los tres son **fallos silenciosos**: `updateMany` devuelve `count: 0` y el cron lo
> interpreta como "nada que hacer".

### 6.2 Instanciación directa de Prisma

| Ubicación | Nº archivos con `new PrismaClient()` | Clase |
|---|---|---|
| **`apps/api/src/`** | **0** ✅ | — |
| `apps/api/scripts/` | 34 | **D** |
| `apps/api/prisma/` (seeds, reset) | 11 | **C/D** |
| `apps/api/prisma/seeds/` | 1 | C |
| `apps/api/prisma/sql/rls/` | 1 (`verify_nulls.js`) | C |
| `scripts/` (raíz del repo) | 7 | **D** |
| **Total fuera de `PrismaService`** | **54** | |

Que `src/` esté limpio es un resultado **bueno**: todo el runtime pasa por `PrismaService`
y, por tanto, por el `Proxy` y el `AsyncLocalStorage`. El riesgo está fuera del runtime.

### 6.3 Endpoints con `@SkipTenantCheck()` (12)

El decorador desactiva **a la vez** el guard y la transacción del interceptor.

| Controlador | Endpoint | JWT | Clase | Motivo declarado |
|---|---|---|---|---|
| `apd.controller.ts` | `POST ai/valeria` | sí | **D** | (no documentado) |
| `auth-play.controller.ts` | `register-play`, `login-play`, `google-play` | **no** | C | Alta/login de cuentas Play |
| `guest-public.controller.ts` | clase completa `public/*` | **no** | C | Invitados sin cuenta |
| `live-lesson.controller.ts` | clase completa `public/lesson-session/*` | sí | **D** | Sesiones de lección en vivo |
| `play.controller.ts` | `SSE live/:sessionId/stream` | sí | C | Evitar 1 conexión de pool por cliente SSE |
| `live-session.controller.ts` | `SSE :id/stream` | **no** (JWT manual por query param) | C | Mismo motivo; auth manual con `jwt.verify` |
| `storage-public.controller.ts` | clase completa `storage/*` | **no** | **D** | Servir archivos públicos |

Tres controladores no aplican `JwtAuthGuard` en absoluto: `auth-play`, `guest-public`,
`storage-public`.

**Los dos SSE son estructurales, no accidentales:** con RLS obligatorio, un stream SSE que
mantuviera contexto retendría una conexión del pool por alumno. Con `max_connections = 100`
en el servidor y `connection_limit = 20` por instancia, un curso de 35 alumnos agota el pool.
**El SSE no puede depender del patrón "transacción por request".** Se decide en **DECISIÓN E**.

---

## 7. B-6 · Backup y recuperación — verificado

Fuente: `.github/workflows/db-backup.yml`, ejecuciones reales (`gh run list`) y
`pg_settings` de staging y producción.

| Pregunta | Respuesta verificada |
|---|---|
| ¿Qué backup existe? | `pg_dump --no-owner --no-privileges --format=plain`, comprimido a `.sql.gz`, subido a Cloudflare R2 (`s3://edusyn-files/backups/db/`) |
| Frecuencia | Cron `0 3 1,15 * *` → **días 1 y 15 de cada mes**, 03:00 UTC |
| ¿Se ejecuta de verdad? | **Sí.** 8 ejecuciones consecutivas correctas; la última **2026-08-15**, duración 23 s |
| Retención | ⚠️ **Corrige la Fase 0.** `BACKUP_RETENTION_DAYS: 30` se usa como **número de ficheros**, no de días: se conservan los **últimos 30 backups** ≈ **15 meses** |
| **RPO** | **Hasta 15 días** — sin cambios respecto a la Fase 0 |
| **RTO** | **No documentado ni probado** |
| ¿Guarda roles? | **No.** `pg_dump` nunca vuelca roles (requiere `pg_dumpall --roles-only`) |
| ¿Guarda ownership? | **No.** `--no-owner` |
| ¿Guarda grants? | **No.** `--no-privileges` |
| ¿Guardaría políticas RLS? | **Sí** — `pg_dump` sí emite `CREATE POLICY` y `ENABLE/FORCE ROW LEVEL SECURITY` |
| **¿PITR?** | 🔴 **No.** `archive_mode = off` y `archive_command = (disabled)` en **staging y producción** |
| ¿Prueba de restauración? | **No consta ninguna.** Sin workflow, sin runbook, sin registro |
| ¿Staging tiene backup? | 🔴 **No hay evidencia.** El workflow usa un único secreto `DATABASE_PUBLIC_URL`; el servicio `edusyn-staging-db` es independiente y no aparece en ningún workflow |
| ¿Snapshots de Railway? | **No verificable por CLI.** Requiere revisar el panel de Railway |

**Lectura para RLS:** el punto grave no es la frecuencia sino la **combinación**. Si se crea
el rol de aplicación de la DECISIÓN A y más tarde hay que restaurar desde estos dumps, el
rol **no se recrea** y los `GRANT` **no se restauran**: la aplicación no arranca tras la
restauración, aunque los datos estén intactos. Y el entorno donde vamos a experimentar
—staging— **es el que no tiene copia**.

---

## 8. Hallazgos nuevos de esta fase (no estaban en la Fase 0)

### 🛑 N-1 · Credenciales de producción escritas en el repositorio

`scripts/fix-recovery-grades.ts:17` contiene **una cadena de conexión completa, con usuario y
contraseña**, apuntando a `centerbeam.proxy.rlwy.net:53943/railway` — **exactamente el host,
puerto y base de datos de PRODUCCIÓN** verificados en §1.3.

```ts
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://<usuario>:<contraseña>@centerbeam.proxy.rlwy.net:53943/railway' } }
});
```

Agravantes:

- El fichero **está versionado en Git** (`git ls-files` lo confirma; commit `75f4572c`), luego
  la credencial está en el **historial** y en todos los clones y forks.
- La misma credencial aparece en `docs/RBAC_OBSERVATION_SPRINT.md` (líneas 38 y 149).
- El script **no es de lectura**: ejecuta escrituras sobre `PeriodFinalGrade` en producción.
- Está fuera de `apps/api`, y `apps/api/.env` está correctamente en `.gitignore` — es una
  fuga puntual, no una política ausente.

**Riesgo:** acceso directo de escritura a la base de datos de 5 instituciones reales,
saltándose la API, la autenticación, la autorización y cualquier RLS futuro. **RLS no
protege contra esto**: quien tiene esa cadena se conecta como `postgres`, superusuario con
`BYPASSRLS`.

**Regla de parada activada** (*"datos de producción en riesgo"*). No he modificado el
fichero ni rotado nada. Ver **DECISIÓN B**.

### N-2 · Staging y producción comparten environment de Railway

Detallado en §1.2. Un `railway run`, `railway variables set` o `railway redeploy` sin
`--service` correcto opera sobre producción. Ver **DECISIÓN F**.

### N-3 · Deriva de versión mayor entre staging (PG 18.4) y producción (PG 17.10)

Detallado en §1.3. Ver **DECISIÓN G**.

---

## 9. DECISIONES QUE NECESITAN AUTORIZACIÓN

### DECISIÓN A · Rol de base de datos para el runtime

| | |
|---|---|
| **Problema** | Runtime, migraciones, scripts y SuperAdmin usan `postgres` (superusuario, `BYPASSRLS`). RLS sería decorativo. |
| **Evidencia** | §2 — verificado en local, staging y producción. |
| **Riesgo si no se decide** | Se implementa RLS completo, `check:rls` en verde, aislamiento real **cero**. Falsa seguridad certificada. |
| **Alternativas** | **A1** Tres roles (`edusyn_migrate` owner · `edusyn_app` runtime sin bypass · `edusyn_admin` con `BYPASSRLS`). **A2** Dos roles (owner/migraciones + runtime), SuperAdmin resuelto en política. **A3** Un solo rol de app y `FORCE RLS` con owner separado. **A4** No hacer RLS; reforzar la capa de aplicación. |
| **Recomendación** | **A1.** Separa los tres modos de acceso que ya existen de hecho, y permite que `prisma migrate deploy` siga funcionando sin tocarlo. |
| **Archivos afectados** | Ninguno del repositorio. Variables `DATABASE_URL` de los servicios `api` y `edusyn-api-staging`. |
| **Bases afectadas** | Las tres. |
| **Riesgo staging** | Medio: si los `GRANT` quedan incompletos, la API de staging deja de arrancar. Reversible cambiando la variable. |
| **Riesgo producción** | **Alto**, y por eso no se toca hasta la Fase 12. |

### DECISIÓN B · Credencial de producción en el repositorio (urgente, independiente de RLS)

| | |
|---|---|
| **Problema** | Contraseña de la BD de producción versionada en Git (§8, N-1). |
| **Evidencia** | `scripts/fix-recovery-grades.ts:17`, `docs/RBAC_OBSERVATION_SPRINT.md:38,149`, commit `75f4572c`. |
| **Riesgo** | Escritura directa sobre datos académicos reales de 5 instituciones, sin pasar por la aplicación. |
| **Alternativas** | **B1** Rotar la contraseña en Railway **ya** y sustituir el literal por `process.env.DATABASE_URL`. **B2** Además, purgar el historial (`git filter-repo`) — invasivo, reescribe hashes, afecta a las 30+ ramas. **B3** Solo rotar y dejar el historial. |
| **Recomendación** | **B1 + B3 ahora** (rotar es lo que corta el acceso; el historial sin contraseña válida es inerte). Evaluar B2 aparte. |
| **Archivos afectados** | `scripts/fix-recovery-grades.ts`, `docs/RBAC_OBSERVATION_SPRINT.md`. |
| **Bases afectadas** | Producción (rotación de credencial). |
| **Riesgo staging** | Ninguno. |
| **Riesgo producción** | Rotar la contraseña **reinicia las conexiones**: hay que actualizar la variable del servicio `api` en la misma ventana. Requiere tu autorización explícita — **no lo he hecho**. |

### DECISIÓN C · Tratamiento de `Institution` e `InstitutionUser`

| | |
|---|---|
| **Problema** | Login, búsqueda pública de instituciones y `switchInstitution` necesitan leerlas sin (o con otro) contexto de tenant. |
| **Evidencia** | §4.2 y §4.3. |
| **Riesgo** | Aplicar `prisma/sql/rls/enable_rls.sql` tal cual **deja a todos los usuarios fuera de la aplicación**, y atrapa a los multi-institución en su primera institución. |
| **Alternativas** | **C1** Ambas fuera de RLS. **C2** `Institution`: `SELECT` abierto (los datos de login ya son públicos) + escritura restringida; `InstitutionUser`: política por `userId` en lugar de por institución. **C3** Login bajo un rol de bootstrap con `BYPASSRLS` limitado a esas dos tablas. |
| **Recomendación** | **C2.** Es la única que aísla las escrituras sin romper login ni `switchInstitution`, y no introduce un cuarto rol. Requiere que el contexto lleve también `app.current_user_id`. |
| **Archivos afectados** | Ninguno todavía (fase de diseño). Después: migración RLS + posiblemente `auth.service.ts`. |
| **Riesgo staging / producción** | Alto si se equivoca: bloqueo total de login. Debe cubrirse con los Tests 6 y 7 antes de desplegar. |

### DECISIÓN D · Modelo de bypass del SuperAdmin

| | |
|---|---|
| **Problema** | 2 operaciones cross-tenant legítimas, 1 de bootstrap de tenant, 8 tenant-scoped sin contexto, 1 global. |
| **Evidencia** | §5. |
| **Riesgo** | `deleteInstitution` reportando éxito sin borrar; panel de SuperAdmin en blanco; imposibilidad de crear instituciones. |
| **Alternativas** | **D1** Rol `edusyn_admin` con `BYPASSRLS` para las rutas de SuperAdmin. **D2** `current_setting('app.is_superadmin')` dentro de las políticas. **D3** Fijar contexto explícito por institución en las 8 tenant-scoped y bypass solo en las 3 restantes. |
| **Recomendación** | **D1 + D3**: bypass real y auditado solo donde es inevitable (`getSystemStats`, `getAllInstitutions`, `createInstitution`); contexto explícito en el resto. **D2 queda descartada**: mete autorización dentro de la política, que es el `USING (true)` disfrazado que rechazaste. |
| **Archivos afectados** | `superadmin.service.ts`, `superadmin.controller.ts`, `tenant-context.interceptor.ts`. |
| **Riesgo producción** | Alto: `deleteInstitution` es destructivo. Debe cubrirse con el Test 6. |

### DECISIÓN E · SSE y endpoints `@SkipTenantCheck()`

| | |
|---|---|
| **Problema** | 12 endpoints quedan fuera de la transacción por request; los 2 SSE lo hacen por una razón estructural (agotamiento del pool). |
| **Evidencia** | §6.3; `max_connections = 100` (servidor), `connection_limit = 20` (por instancia). |
| **Riesgo** | Si se les exige contexto, un curso de 35 alumnos agota el pool. Si se les deja sin contexto y llevan RLS, dejan de funcionar. |
| **Alternativas** | **E1** Excluir de RLS las tablas que tocan (Play/invitados). **E2** Fijar contexto por consulta sin transacción larga (`SET LOCAL` en transacciones cortas por operación). **E3** Rol de servicio sin bypass pero con políticas propias. |
| **Recomendación** | **E2 para el SSE** (la transacción larga es el problema, no el contexto) y **E1 para los invitados de Play**, que por diseño no tienen institución. Requiere tu confirmación de que Play queda fuera del perímetro RLS. |
| **Archivos afectados** | `live-session.controller.ts`, `play.controller.ts`, `guest-public.controller.ts`, `storage-public.controller.ts`, `apd.controller.ts`. |

### DECISIÓN F · Aislamiento de staging respecto a producción

| | |
|---|---|
| **Problema** | Un único environment de Railway llamado `production` contiene ambos. |
| **Evidencia** | §1.2. |
| **Riesgo** | Durante la implementación de RLS ejecutaremos comandos contra staging. Un `--service` equivocado impacta producción. |
| **Alternativas** | **F1** Crear un environment `staging` real y mover los servicios. **F2** Mantenerlo y adoptar un protocolo obligatorio de `--service` explícito + verificación de `current_database()` y host antes de cada operación. **F3** Proyecto Railway separado para staging. |
| **Recomendación** | **F2 ahora** (coste cero, aplicable de inmediato), **F1 antes de la Fase 9**. |
| **Riesgo producción** | Es precisamente el riesgo que se busca reducir. |

### DECISIÓN G · Deriva de versión PostgreSQL entre staging y producción

| | |
|---|---|
| **Problema** | Staging PG **18.4**, producción PG **17.10**. |
| **Evidencia** | §1.3. |
| **Riesgo** | Staging deja de ser un ensayo válido: planificador, comportamiento de políticas y rendimiento con RLS pueden diferir. Validar RLS en 18.4 no acredita 17.10. |
| **Alternativas** | **G1** Alinear staging a 17.x. **G2** Alinear producción a 18.x (fuera del alcance de esta tarea). **G3** Aceptar la deriva y documentarla como limitación de la validación. |
| **Recomendación** | **G1** antes de la Fase 9, o **G3 explícito** si prefieres no tocar staging ahora. No lo decido yo. |
| **Riesgo producción** | Ninguno directo; el riesgo es de **falsa validación**. |

---

## 10. Diseño de las pruebas de seguridad (Fase 6, sin ejecutar)

Todas contra el mecanismo real (`PrismaService` + `TenantContextInterceptor` + pool), con dos
instituciones de prueba A y B, **solo en local y después en staging. Nunca en producción**.

| # | Prueba | Criterio de aprobación |
|---|---|---|
| 1 | A no puede `SELECT` filas de B | 0 filas, sin error |
| 2 | A no puede `UPDATE` filas de B | `count = 0` |
| 3 | A no puede `DELETE` filas de B | `count = 0` |
| 4 | A no puede `INSERT` con `institutionId = B` | error de `WITH CHECK` |
| 5 | A no puede cambiar `institutionId` de A a B | error de `WITH CHECK` (requiere `UPDATE` con `USING` **y** `WITH CHECK`) |
| 6 | SuperAdmin: alcance exacto por operación | según **DECISIÓN D**, operación por operación |
| 7 | Sin contexto (`'__none__'`) | 0 filas — **fail-closed** explícito, no accidental |
| 8 | Contexto falsificado (`SET app.current_institution` vía `$queryRaw`) | debe ser imposible o inefectivo |
| 9 | Concurrencia A/B simultánea sobre el mismo pool | aislamiento total |
| 10 | Rollback: el contexto no sobrevive a la transacción | `current_setting` vacío tras rollback |
| 11 | Alternancia A→B→A→B→A→B reutilizando conexiones | ninguna fila del tenant incorrecto |

**Pruebas adicionales que esta fase demuestra necesarias:**

| # | Prueba | Motivo |
|---|---|---|
| 12 | Login de usuario de A y de B con RLS activo | **DECISIÓN C** — evitar bloqueo total |
| 13 | `switchInstitution` A→B con contexto A activo | §4.3 — caso no cubierto por los tests 1–11 |
| 14 | Los 3 crons procesan filas de **todas** las instituciones | §6.1 — detectar el fallo silencioso |
| 15 | Regresión del orden de guards | §3 — que `TenantGuard` vuelva a quedar inerte debe romper el build |

---

## 11. Qué NO pudo verificarse

Conforme a §9 del encargo, se declara explícitamente:

1. **Snapshots o PITR gestionados por Railway** — no expuestos por la CLI. `archive_mode = off`
   descarta PITR a nivel PostgreSQL, pero Railway podría tener copias de volumen. **Requiere
   revisar el panel de Railway manualmente.**
2. **Backup de la base de staging** — el workflow usa un único secreto; no puedo leer secretos
   de GitHub para confirmar a qué base apunta. La conclusión "staging sin backup" es una
   inferencia razonada, **no una verificación**.
3. **RTO real** — nunca se ha probado una restauración; no hay dato que medir.
4. **Contenido de `apps/api/.env` de los servicios desplegados más allá de `DATABASE_URL`** —
   no se enumeraron otras variables para no exponer secretos innecesariamente.
5. **Si la credencial de `fix-recovery-grades.ts` sigue siendo válida** — comprobarlo exigiría
   intentar autenticarse con ella; **no lo hice**. El host, puerto y base coinciden con
   producción, lo que basta para tratarla como comprometida.

---

## 12. Qué NO se hizo en esta fase

Ningún `CREATE`, `ALTER`, `DROP`, `TRUNCATE`, `INSERT`, `UPDATE`, `DELETE`, `CREATE ROLE`,
`GRANT`, `REVOKE`, `ENABLE/FORCE RLS`, `CREATE POLICY` ni `CREATE FUNCTION` en ningún
entorno. Ninguna migración, ningún `prisma migrate`, ningún `prisma db push`, ningún script
de `prisma/sql/rls/`. Ningún despliegue, reinicio ni cambio de variable de entorno. Ninguna
rotación de credenciales.

Todas las sesiones de base de datos se abrieron con `default_transaction_read_only = on` y se
limitaron a `pg_catalog`, `information_schema` y `COUNT(*)`.

No se modificó el orden de guards, `app.module.ts`, `check:rls`, ni ningún servicio. La prueba
de la §3 vive **fuera del repositorio**. No se creó `RLS-MULTI-TENANT.md` (§17).

Los cambios ajenos en curso no fueron tocados. **Único archivo creado: este documento.**
