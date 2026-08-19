# RLS AUDIT — FASE 0 (READ ONLY)

> **Alcance:** auditoría de solo lectura del aislamiento multi-tenant (Row-Level Security)
> de Edusyn. **No se modificó ningún archivo de código, esquema, migración ni base de datos.**
> Este documento es evidencia y diagnóstico. El diseño oficial vivirá luego en
> `docs/security/RLS-MULTI-TENANT.md` (Fase 5).
>
> **Fecha:** 2026-08-18 · **Rama:** `main` · **Estado del árbol:** con cambios ajenos en curso
> (evaluaciones semestrales / onboarding) que **no fueron tocados**.

---

## 0. Resumen ejecutivo

El aparato de RLS de Edusyn está **construido a medias y completamente inerte**:

- La **capa de aplicación existe y es correcta en su idea**: un interceptor global abre
  una transacción interactiva por request y ejecuta `set_config('app.current_institution', …, true)`,
  propagando el cliente transaccional vía `AsyncLocalStorage` a través de un `Proxy` sobre
  `PrismaService`.
- La **capa de base de datos no existe**: 0 funciones, 0 políticas, 0 tablas con RLS
  habilitado, en las tres bases (local verificada; staging y producción reportadas).
- Y aunque existiera, **no tendría efecto**: la aplicación se conecta como `postgres`,
  un **superusuario con `rolbypassrls = true`**, que ignora RLS incluso con `FORCE`.

El aislamiento real hoy depende **al 100 %** de los filtros manuales por `institutionId`
escritos a mano en los servicios. La segunda barrera que el código creía tener
(`TenantGuard`) **tampoco se ejecuta** (ver B-2).

**Veredicto:** activar RLS no es "correr un SQL". Requiere primero varias decisiones de
arquitectura que hoy no están tomadas (rol de base de datos, bootstrap de login,
modelo de SuperAdmin, bypass de procesos internos). Se detallan en §9 con la
**regla de parada** solicitada.

---

## 1. Estado actual de PostgreSQL (evidencia)

Consultas ejecutadas con `SET default_transaction_read_only = on` contra la base
**local** `localhost:5432/edusyn_dev` (la única a la que esta sesión tiene credenciales).

| Métrica | Valor medido |
|---|---|
| Versión | PostgreSQL 17.5 |
| Tablas (`relkind='r'`) en `public` | **215** |
| Vistas / matviews / secuencias | **0 / 0 / 0** |
| Triggers no internos | **0** |
| Extensiones | solo `plpgsql` |
| Funciones en `public` | **0** → `current_institution_id()` **NO EXISTE** |
| Políticas (`pg_policies`) | **0** |
| Tablas con `relrowsecurity` | **0** |
| Tablas con `relforcerowsecurity` | **0** |
| Tablas con columna `institutionId` | **121** |
| Columnas `institutionId` nullable | **0** (todas `NOT NULL`) |
| Roles con login | **solo `postgres`** — `rolsuper=t`, `rolbypassrls=t` |
| Owner de todas las tablas | `postgres` |
| GRANTs a roles no-owner | **0** |
| Migraciones aplicadas | 83 (de 91 en el repo) |
| Migraciones **fallidas / rolled back** | **2** |

Esto coincide exactamente con lo reportado para **staging** (0 funciones, 0 políticas,
~122 tablas con `institutionId`, 0 protegidas) y **producción** (0 funciones, 0 políticas).

### 1.1 Migraciones en estado fallido (local)

| Migración | `rolled_back_at` |
|---|---|
| `20260228170000_baseline` | 2026-06-26 |
| `20260713120000_abp_expedicion` | 2026-07-14 |

Ambas quedaron con `finished_at = NULL` y `applied_steps_count = 0`. No bloquean hoy
(las migraciones posteriores sí aplicaron), pero **cualquier trabajo de RLS que dependa de
`prisma migrate` debe partir de un historial limpio.**

---

## 2. Causa raíz de que RLS esté inactivo

Esto es un incidente concreto y reconstruible, no una omisión difusa.

1. La migración **`20260211060000_add_institutionid_rls_26_tables`** creaba la función
   `current_institution_id()` y las políticas:

   ```sql
   CREATE OR REPLACE FUNCTION current_institution_id() RETURNS text AS $$
     SELECT coalesce(nullif(current_setting('app.current_institution', true), ''), '__none__');
   $$ LANGUAGE sql STABLE;
   ```

2. El **2026-02-28 se hizo un squash**: las 61 migraciones anteriores se movieron a
   `prisma/migrations_archived/` y se reemplazaron por `20260228170000_baseline`.
3. Ese baseline se generó **desde `schema.prisma`**, y Prisma **no modela RLS**.
   Verificado: buscar `row level security`, `current_institution_id` o `CREATE POLICY`
   en las 4 683 líneas del baseline devuelve **0 coincidencias**.
4. Desde entonces, las **15 migraciones posteriores** que crean políticas lo hacen bajo
   la guarda:

   ```sql
   IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id') THEN …
   ```

   Como la función nunca se recreó, **esa condición es permanentemente falsa** y todos
   esos bloques se saltan en silencio, en todos los entornos, desde marzo de 2026.

> **La guarda `IF EXISTS` no es el error; es el síntoma.** El error fue perder el
> objeto del que depende y no tener nada que lo detectara. **El mismo fallo se repetirá
> en el próximo squash de migraciones** salvo que la creación de la función y las
> políticas viva en una migración que el baseline no pueda borrar.

### 2.1 Artefactos SQL huérfanos

`prisma/sql/rls/` contiene scripts nunca ejecutados por el pipeline
(`enable_rls.sql`, `enable_rls_new_tables.sql`, `force_rls_all_tables.sql`,
`populate_institution_id.sql`). Están fuera del historial de migraciones: nadie los
corre en deploy, y su contenido ya está desalineado con el esquema actual
(cubren ~72 tablas de las 121 con `institutionId`). **No deben usarse tal cual**
(ver B-3: romperían el login).

---

## 3. Estado actual del código

### 3.1 Cadena de contexto de tenant (existe y está bien pensada)

```
HTTP request
  │
  ├─ JwtAuthGuard (por controlador, 99/103)  → req.user = { id, institutionId, isSuperAdmin, … }
  │
  ├─ TenantContextInterceptor (APP_INTERCEPTOR global)
  │     └─ rawPrisma.$transaction(async tx => {
  │            SELECT set_config('app.current_institution', $1, true)   ← is_local = true
  │            tenantContext.run({ tx, institutionId }, () => handler())
  │        }, { maxWait: 10s, timeout: 120s })
  │
  └─ PrismaService (Proxy) → si hay store.tx, delega TODA operación al tx
```

**De dónde sale el tenant:** exclusivamente de `payload.institutionId` del **JWT**
(`src/modules/auth/jwt.strategy.ts`). El JWT se emite en login / `switchInstitution`
a partir de la fila `InstitutionUser` elegida (`src/modules/auth/auth.service.ts`).
No hay header, subdominio ni sesión de servidor.

**Esta parte es correcta**, y responde directamente a §7 y §8 del encargo:

- `set_config(…, is_local := true)` equivale a `SET LOCAL` → **el valor muere al terminar
  la transacción**, con commit o con rollback. No hay fuga entre tenants por pooling,
  porque `SET LOCAL` y todas las queries del request corren **en la misma conexión**,
  la que Prisma reserva para la transacción interactiva.
- `SET` (sin `LOCAL`) sería inseguro aquí: persiste en la sesión, y la conexión vuelve
  al pool con el tenant anterior pegado → fuga A→B. **No debe usarse.**
- Conclusión de diseño: **`SET LOCAL` dentro de transacción interactiva es el mecanismo
  correcto**, y ya está implementado. Lo que falta es todo lo demás.

### 3.2 Lo que hay fuera de esa cadena

| Superficie | ¿Tiene contexto de tenant? | Consecuencia bajo RLS activo |
|---|---|---|
| Requests autenticados normales | **Sí** | OK |
| Login / registro / `institution/:slug` | **No** (aún no hay `req.user`) | **Rompe** (B-3) |
| SuperAdmin (JWT con `institutionId: null`) | **No** — el interceptor hace `return next.handle()` | **Rompe todo el panel** (B-4) |
| 12 endpoints con `@SkipTenantCheck()` | **No** (el decorador salta guard **y** transacción) | **Rompen** (B-5) |
| 3 crons (`@Cron`) | **No** | **Fallan en silencio** (B-5) |
| 47 scripts/seeds con `new PrismaClient()` | **No** | **Rompen** (B-5) |
| Migraciones (`prisma migrate deploy`) | **No** | Depende del rol (B-1) |
| Tests (37 `.spec.ts`, unitarios con mocks) | N/A | Sin cobertura de aislamiento |

---

## 4. Inventario y clasificación de tablas

Obtenido parseando `prisma/schema.prisma` (216 modelos) y resolviendo, para cada modelo
sin `institutionId`, la ruta más corta y no opcional hasta un ancestro que sí lo tenga.

| Clase | Nº | Significado |
|---|---|---|
| **ROOT** | 1 | `Institution` — la frontera de aislamiento (usa `id`, no `institutionId`) |
| **DIRECTO** | 123 | Tiene columna `institutionId` propia |
| **INDIRECTO** | 81 | Determina institución por FK (1–3 saltos) |
| **HUÉRFANO** | 8 | Sin ninguna ruta a `Institution` |
| **NO RESUELTO** | 3 | Solo llega a tablas huérfanas |

> Diferencia 216 modelos vs. 215 tablas, y 123 vs. 121 columnas: deriva por las 8
> migraciones del repo aún no aplicadas en local. Sin relevancia para el diseño.

### 4.1 La raíz del tenant y el grafo real

No hay **una** cadena, hay **seis raíces de primer nivel** bajo `Institution`:

```
Institution (id)
├── Campus ──── Shift
│      └─ Group
├── Area ────── Subject
├── AcademicTemplate ── TemplateArea ── TemplateSubject
│                    └─ TemplateDimension
├── AcademicYear ─── Period / AcademicTerm ── GradingPeriodConfig
│                 └─ AcademicCalendar         RecoveryPeriodConfig
│                                             PreventiveCutConfig / TermReopeningRecord
├── Student ──── StudentEnrollment* ── ActivitySubmission ── QuestionAnswer
│                                   └─ TermReportCardSnapshot
│                                   └─ LessonProgress / ActivityAssignment
│                                   └─ LiveSession{Answer,Participant,TeamMember}
└── Classroom* ── ClassroomSection ── ClassroomMaterial
               └─ ClassroomActivity ── ActivityQuestion / QuestionContext
                                    └─ Lesson ── LessonSlide / LessonVersion
                                              └─ LiveLessonSession
```

`*` = ya tienen `institutionId` propio (desnormalizado por la migración archivada).

**Respuesta a "¿cómo determinamos inequívocamente la institución de un registro?"**:
para 124 de 216 modelos, por columna propia. Para 81, por FK obligatoria (verificado que
la ruta elegida no es opcional). Para **11 modelos, no se puede** — ver §4.3.

### 4.2 Ejemplos de rutas indirectas (muestra representativa)

| Modelo | Ruta a la institución | Saltos |
|---|---|---|
| `Group` | `campus → Campus.institutionId` | 1 |
| `Subject` | `area → Area.institutionId` | 1 |
| `Period`, `AcademicTerm` | `academicYear → AcademicYear.institutionId` | 1 |
| `GradingPeriodConfig` | `academicTerm → AcademicTerm → AcademicYear` | 2 |
| `TermReportCardSnapshot` | `studentEnrollment → StudentEnrollment.institutionId` | 1 |
| `ActivityQuestion` | `activity → ClassroomActivity → Classroom.institutionId` | 2 |
| `LessonSlide`, `LessonVersion` | `lesson → Lesson → ClassroomActivity → Classroom` | 3 |
| `QuestionAnswer` | `submission → ActivitySubmission → StudentEnrollment` | 2 |

### 4.3 Tablas que **REQUIEREN DECISIÓN DE DISEÑO**

No se inventa solución para ninguna. Se documenta el problema.

| Tabla | Problema | Caso (§13 del encargo) |
|---|---|---|
| `Institution` | Es la raíz; el login la lee **antes** de que exista contexto | **B-3** |
| `InstitutionUser` | Tiene `institutionId`, pero el login **debe** leerla sin contexto para saber a qué institución entrar | **B-3** |
| `User` | **Global por diseño**: un docente puede pertenecer a varias instituciones (`InstitutionUser` es N:M). Su única ruta a un tenant es `studentProfile`, y es **opcional** | A / E |
| `UserRole` | Roles globales legacy (paralelo a `InstitutionUserRole`, que sí es por tenant) | E |
| `Role`, `Permission`, `RoleBasePermission` | Catálogos del sistema, sin `institutionId` | A (global) |
| `Dimension` | Catálogo de dimensiones de preescolar, **compartido**; las instancias por tenant son `TemplateDimension` / `EnrollmentDimension` | A |
| `Competency` | Marco CEFR/DBA global, `code` único global | A |
| `WorkspaceFavorite`, `WorkspaceDashboardConfig` | Clave solo por `teacherId`. Si un docente está en 2 instituciones, **sus favoritos y su dashboard se mezclan entre ellas** | **C** — falta relación |
| `LiveSessionGuest`, `LiveSessionGuestAnswer`, `LiveSessionReaction`, `GuestGradeConversion` | Invitados de Edusyn Play: **por diseño no pertenecen a ninguna institución** (`sessionId` es polimórfico, sin FK) | **E** |

> `WorkspaceFavorite` / `WorkspaceDashboardConfig` son un **defecto de aislamiento
> preexistente e independiente de RLS**: hoy ya filtran solo por `teacherId`.

---

## 5. Autenticación / Autorización / Aislamiento (§23)

Las tres capas **sí están conceptualmente separadas** en el código, pero una de ellas
está rota:

| Capa | Implementación | Estado |
|---|---|---|
| **Authentication** | `JwtAuthGuard` + `JwtStrategy` (passport-jwt) | ✅ funciona |
| **Authorization** | `RolesGuard`, `PermissionsService`, `InstitutionRoleCapability`, `UserExtraPermission` | ✅ funciona (no auditado a fondo aquí) |
| **Tenant isolation** | `TenantGuard` + filtros manuales `institutionId` + (RLS ausente) | 🔴 `TenantGuard` **inerte** (B-2), RLS **ausente** |

---

## 6. Prisma y connection pooling (§7)

- Pool: `connection_limit` forzado a **20** (`DB_CONNECTION_LIMIT`), `pool_timeout` 20 s,
  configurado en `buildDatabaseUrl()` de `PrismaService`.
- **Cada request autenticado retiene una conexión del pool durante todo el request**
  (transacción interactiva, `timeout: 120000`).
- **No hay riesgo de fuga de contexto entre tenants por pooling**, gracias a `SET LOCAL`.
- **Sí hay riesgo operativo ya materializado**, documentado en el propio código:
  - `P2024` (pool agotado) cuando un curso completo responde a la vez → por eso se subió
    el pool a 20 y por eso el SSE lleva `@SkipTenantCheck`.
  - `25P02` — *"current transaction is aborted"*: una violación de `@unique` dentro de la
    transacción por-request **envenena el resto del request** y provoca rollback total.
    Ya causó el incidente del "canvas de ABP que se borraba"
    (`abp.service.ts:723`, `learning-identity.service.ts:108`).

> **Consecuencia para el diseño:** RLS haría de esa transacción por-request un elemento
> **obligatorio y crítico**, no una comodidad. Hoy es la pieza más frágil del sistema.
> Cualquier plan de RLS debe decir explícitamente qué hace con ella.

---

## 7. `current_institution_id()` — análisis previo (§6)

La definición archivada era:

```sql
SELECT coalesce(nullif(current_setting('app.current_institution', true), ''), '__none__');
```

Evaluación:

| Aspecto | Observación |
|---|---|
| Fuente del contexto | `current_setting('app.current_institution')`, puesto por el backend. **Correcto**, porque queda demostrado (§3.1) que el backend sí lo establece, con `SET LOCAL`, dentro de transacción. |
| Ausencia de contexto | Devuelve el centinela `'__none__'` → ninguna fila coincide → **fail-closed**. Es la decisión correcta, pero hoy es implícita; debe volverse **explícita y probada** (Test 7). |
| `STABLE` vs `IMMUTABLE` | `STABLE` es correcto. |
| `SECURITY DEFINER` | No lo es, y **no debe serlo**. |
| Quién puede modificarlo | 🔴 **Cualquiera con la conexión.** Un `SET app.current_institution = '<otra>'` colado en un `$queryRaw` cambiaría el tenant. Nada ata el valor al usuario autenticado (Test 8). |
| Ámbito | 🔴 `current_setting` es de **sesión**, no de rol. Con el rol actual (superusuario) es irrelevante, porque RLS ni siquiera se aplica. |

**Falta por decidir:** si el contexto debe llevar además el `userId` y un indicador de
SuperAdmin (p. ej. `app.current_user_id`, `app.bypass_rls`), porque de eso depende
cómo se resuelven §9 y §10 sin caer en `USING (true)`.

---

## 8. El checker `check:rls` (§22)

`apps/api/scripts/check-rls-coverage.ts` — su criterio es
`rls_enabled && rls_forced && has_policy` sobre *toda tabla con columna `institutionId`*.

Defectos conceptuales encontrados:

1. **Ignora las 81 tablas indirectas** y las 11 ambiguas: para él no existen.
2. **Ignora `Institution`**, que no tiene columna `institutionId` — justo la tabla raíz.
3. **No detecta el problema real**: aunque todo saliera verde, RLS seguiría inerte
   mientras la app se conecte como superusuario (B-1). El checker **no mira el rol**.
4. **No valida el contenido de las políticas**: una `USING (true)` le parecería perfecta.
5. **No distingue `USING` de `WITH CHECK`**, ni comandos (`SELECT` / `INSERT` / `UPDATE` / `DELETE`).
6. **No admite excepciones documentadas**, así que la única forma de ponerlo verde sería
   forzar RLS en tablas donde no corresponde — exactamente lo que §14 prohíbe.
7. No verifica que exista índice sobre `institutionId` (§8.1).

**Debe reescribirse después del diseño, no antes.**

### 8.1 Hallazgos de rendimiento e integridad que afectan a RLS

- **35 tablas con `institutionId` no tienen ningún índice que lo incluya**, entre ellas
  las más grandes del sistema: `PartialGrade`, `PeriodFinalGrade`, `StudentGrade`,
  `AttendanceRecord`, `StudentEnrollment`, `TeacherAssignment`, `StudentObservation`,
  `EnrollmentSubject`, `EnrollmentArea`, `FinalComponentGrade`.
  Con RLS, el predicado `institutionId = current_institution_id()` se añade a **cada**
  consulta → riesgo alto de seq scans.
- **13 tablas tienen `institutionId` sin FK a `Institution`**: `InstitutionAiPlan`,
  `PedagogicalDesign`, `TallerEvent`, `TallerInstrument`, `TallerObject`,
  `TallerRelation`, `WorkspaceActivity`, `WorkspaceCollection`, `WorkspaceEvent`,
  `WorkspaceFollowUp`, `WorkspaceProject`, `WorkspaceResource`, `WorkspaceRole`.
  Nada impide hoy escribir un `institutionId` inexistente.

---

## 9. 🛑 REGLA DE PARADA — bloqueantes que requieren tu decisión

Conforme a §26, la auditoría se detiene aquí. Estos son los puntos donde continuar
significaría improvisar.

### B-1 · La aplicación se conecta como superusuario → RLS sería decorativo

**Evidencia:** único rol con login = `postgres` (`rolsuper = t`, `rolbypassrls = t`);
todas las tablas son suyas; 0 GRANTs a otros roles.

**Por qué es peligroso:** PostgreSQL **siempre** exime de RLS a superusuarios y a roles
`BYPASSRLS`. `FORCE ROW LEVEL SECURITY` solo alcanza al *owner no superusuario*. Es
decir: se podrían crear las 121 políticas, `check:rls` saldría **verde**, y el
aislamiento seguiría siendo **cero**. Es el peor desenlace posible: falsa seguridad,
además verificable y con sello de aprobación.

**Alternativas:** (a) crear un rol de aplicación no superusuario, no owner, con GRANTs
explícitos, y cambiar `DATABASE_URL` en Railway; (b) mantener `postgres` para migraciones
y un rol separado para runtime; (c) no hacer RLS y reforzar la capa de aplicación.

**Recomendación:** (b). Es la única que permite RLS real sin romper `prisma migrate deploy`.

**Qué afecta:** variables de entorno de Railway (staging y prod). No toca código.

**Pendiente de verificar:** que staging y producción tengan la misma situación de rol
(esta sesión no dispone de credenciales de esos entornos).

### B-2 · `TenantGuard` nunca se ejecuta con usuario → la segunda barrera no existe

**Evidencia:** `TenantGuard` está registrado **solo** como `APP_GUARD` global
(`app.module.ts:107-110`); `JwtAuthGuard` se aplica **por controlador** (99 de 103).
NestJS ejecuta los guards globales **antes** que los de controlador, así que cuando
`TenantGuard` corre, `req.user` todavía es `undefined` y el guard toma su rama
`if (!user) return true;`.

**Consecuencias:** (1) la comprobación cross-tenant de `?institutionId=` **nunca dispara**
— el `console.warn "[TenantGuard] BLOCKED"` es inalcanzable; (2) `req.resolvedInstitutionId`
**nunca se asigna**, por lo que el paso 0 de `institution-resolver.ts` es código muerto;
(3) el comentario de `auth.service.ts:204` ("TenantGuard bloquea cross-tenant con token
viejo") es **falso**.

**Alternativas:** promover `JwtAuthGuard` a global con `@Public()`; o mover `TenantGuard`
a nivel de controlador; o fusionarlo con el interceptor, que sí ve `req.user`.

**Recomendación:** confirmarlo primero con un test de integración antes de mover nada:
cambiar el orden de los guards altera el comportamiento de **103 controladores**.

**Nota:** es un hallazgo de seguridad **independiente de RLS** y probablemente el de
mayor impacto inmediato de toda la auditoría.

### B-3 · Bootstrap del login vs. políticas sobre `Institution` / `InstitutionUser`

**Evidencia:** `auth.service.login()` consulta `institutionUser.findMany({ where: { userId } })`,
y `auth.controller` expone `GET institution/:slug` y la búsqueda de instituciones —
todo **antes** de que exista `app.current_institution`. `prisma/sql/rls/enable_rls.sql`
pone políticas de tenant sobre **ambas** tablas.

**Por qué es peligroso:** aplicar esos scripts tal cual con un rol no superusuario
**deja a todo el mundo fuera de la aplicación** (0 filas → "credenciales inválidas").
Es exactamente el escenario de "bloqueo de toda la aplicación" que §26 pide evitar.

**Alternativas:** (a) excluir ambas tablas de RLS y confiar en la capa de aplicación;
(b) política de `SELECT` abierta pero `INSERT` / `UPDATE` / `DELETE` restringidos;
(c) ejecutar el login bajo un rol o función de bootstrap acotada.

**Recomendación:** (b) para `Institution` (los datos de login son públicos por diseño:
nombre, slug, logo) y (c) para `InstitutionUser`. **No lo implemento sin tu aval.**

### B-4 · SuperAdmin sin institución → panel completo caído bajo RLS

**Evidencia:** `auth.service.ts:270` emite el JWT de SuperAdmin con `institutionId: null`;
el interceptor entonces hace `return next.handle()` **sin abrir transacción ni fijar
contexto**. `superadmin.service.getAllInstitutions()` es una consulta intrínsecamente
cross-tenant, y `deleteInstitution()` ejecuta ~20 `deleteMany` en cascada.

**Por qué es peligroso:** con RLS activo y rol no superusuario, **todas** esas
operaciones devolverían 0 filas — incluido el borrado, que "tendría éxito" sin borrar nada.

**Alternativas:** (a) rol de BD `edusyn_admin` con `BYPASSRLS`, usado solo por rutas de
SuperAdmin; (b) predicado `current_setting('app.is_superadmin') = 'on'` dentro de las
políticas; (c) `SECURITY DEFINER` para operaciones concretas.

**Recomendación:** (a). La opción (b) mete la decisión de autorización dentro de la
política y es exactamente el `USING (true)` disfrazado que §10 rechaza.

**Detalle adicional:** hay una incoherencia ya presente — `TenantGuard` permite al
SuperAdmin fijar el tenant vía `?institutionId=` y lo deja en `req.resolvedInstitutionId`,
pero el interceptor usa `user.institutionId` (el del JWT). Aunque se arregle B-2, esas
dos fuentes discreparían.

### B-5 · Procesos sin contexto fallarían **en silencio**

**Evidencia:** 3 crons (`classroom.cron`, `play.cron`, `live-session.cron`), 47 scripts y
seeds con `new PrismaClient()` propio, y 12 endpoints con `@SkipTenantCheck()` (incluido
el stream SSE y todo Edusyn Play para invitados).

**Por qué es peligroso:** `play.cron` hace `updateMany` sobre sesiones huérfanas de todas
las instituciones. Bajo RLS sin contexto devolvería `count: 0` y **registraría éxito**.
Los fallos silenciosos en tareas de limpieza tardan meses en detectarse.

**Alternativas:** contexto explícito por institución iterando tenants; rol de servicio con
bypass; o dejar esos procesos fuera del alcance de RLS.

**Recomendación:** decisión tuya por categoría (cron / script / Play). Requiere un
inventario endpoint por endpoint que aún no he hecho.

### B-6 · La estrategia de recuperación no cubre este cambio (§19)

**Evidencia:** `.github/workflows/db-backup.yml` → `pg_dump --no-owner --no-privileges`,
**los días 1 y 15 de cada mes**, retención 30 días, destino R2.

**Por qué es peligroso:**

- **RPO de hasta 15 días.** Un error de RLS en producción detectado tarde no tiene punto
  de restauración cercano.
- `--no-owner --no-privileges` **descarta ownership y GRANTs**, y `pg_dump` **nunca
  vuelca roles** (eso requiere `pg_dumpall --roles-only`). Si se introduce el rol de
  aplicación de B-1, **una restauración desde estos backups no lo recrearía y la app no
  arrancaría.**
- No consta ninguna prueba de restauración (`docs/AUDITORIA_OPERACIONAL_FASE2.md`, CN-1,
  ya lo señalaba).

**Recomendación:** antes de tocar staging, un `pg_dump` manual bajo demanda y verificar
qué ofrece realmente Railway (snapshots / PITR). No asumir que "Railway tiene backup"
significa que podemos volver atrás.

---

## 10. Riesgos adicionales (no bloqueantes, a registrar)

| # | Riesgo | Evidencia |
|---|---|---|
| R-1 | Fuga silenciosa entre instituciones de un mismo docente en `WorkspaceFavorite` / `WorkspaceDashboardConfig` | §4.3 — solo `teacherId` |
| R-2 | 13 tablas admiten un `institutionId` arbitrario (sin FK) | §8.1 |
| R-3 | Degradación de rendimiento al activar RLS en 35 tablas sin índice | §8.1 |
| R-4 | 2 migraciones en estado fallido en local | §1.1 |
| R-5 | Amplificación del `25P02`: con RLS la transacción por-request pasa de conveniencia a requisito | §6 |
| R-6 | Cambio de tenant vía `$queryRaw` (`SET app.current_institution`) no está impedido por nada | §7 |
| R-7 | `institution-resolver.ts` degrada a `findFirst` sobre `InstitutionUser` **sin ordenar**: para un usuario multi-institución elige una arbitraria | `institution-resolver.ts:52` |

---

## 11. Propuesta de arquitectura (esbozo, sin implementar)

Sujeta a tus decisiones sobre B-1…B-6.

1. **Tres roles de base de datos**
   - `edusyn_migrate` (owner, ejecuta `prisma migrate deploy`) — sin `BYPASSRLS`.
   - `edusyn_app` (runtime, **no owner, no superusuario**) — sujeto a RLS.
   - `edusyn_admin` (SuperAdmin / mantenimiento, `BYPASSRLS`) — uso auditado y acotado.
2. **`current_institution_id()` en una migración propia y estable**, nunca dentro de un
   baseline regenerable, y con un test que falle si desaparece.
3. **Políticas separadas por comando**, no una única `FOR ALL`:
   - `SELECT` → `USING (institutionId = current_institution_id())`
   - `INSERT` → **solo** `WITH CHECK (…)`
   - `UPDATE` → `USING (…)` **y** `WITH CHECK (…)` — las dos, porque `USING` sin
     `WITH CHECK` permite exactamente el ataque de §12: leer una fila propia y reescribir
     su `institutionId` hacia otra institución.
   - `DELETE` → `USING (…)`
4. **Clasificación explícita y versionada** de las 216 tablas (§4), con las excepciones
   documentadas **en el repositorio**, no implícitas.
5. **Reescritura de `check:rls`** contra esa clasificación, incluyendo verificación del
   rol de conexión y de los índices.

---

## 12. Plan de implementación propuesto

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Auditoría read-only | ✅ **este documento** |
| 1 | Mapa de tenancy tabla por tabla, con decisiones sobre las 11 ambiguas | ⛔ bloqueada por B-3 / B-4 / B-5 |
| 2 | Diseño de `current_institution_id()` y del rol de BD | ⛔ bloqueada por B-1 |
| 3 | Diseño de políticas por comando | pendiente |
| 4 | Diseño de bypass (SuperAdmin, crons, scripts, migraciones) | ⛔ bloqueada por B-4 / B-5 |
| 5 | `docs/security/RLS-MULTI-TENANT.md` (documento oficial) | pendiente |
| 6 | Suite de aislamiento (Tests 1–10 + prueba de fuga alternada A→B→A) | pendiente |
| 7 | Implementación local contra `edusyn_dev` | pendiente |
| 8 | Migraciones aditivas y reversibles | pendiente |
| 9–11 | Staging + pruebas + auditoría posterior | pendiente |
| 12 | Propuesta de producción | pendiente |

Las pruebas de §15 y §16 se diseñarán contra el **mecanismo real** (`PrismaService` +
`TenantContextInterceptor`), no contra `psql` directo — de lo contrario probarían
PostgreSQL, no Edusyn.

---

## 13. Incidente conocido (registro obligatorio, §21.12)

> **RLS ha estado inactivo en Edusyn desde el 2026-02-28 hasta hoy, en local, staging y
> producción.** La función `current_institution_id()` se perdió al reemplazar 61
> migraciones por `20260228170000_baseline`, generado desde `schema.prisma`, que no
> representa RLS. Las 15 migraciones posteriores que crean políticas están protegidas por
> `IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'current_institution_id')`, condición
> que desde entonces es siempre falsa: **todos esos bloques se saltaron en silencio.**
> Adicionalmente, aunque la función hubiera existido, RLS no habría tenido efecto: la
> aplicación se conecta como `postgres`, superusuario con `BYPASSRLS`.
> Durante todo ese período, el aislamiento entre instituciones ha dependido
> exclusivamente de filtros `institutionId` escritos a mano en los servicios, sin la
> segunda barrera que se creía tener (`TenantGuard`, inerte por orden de guards).

---

## 14. Qué NO se hizo en esta fase

Ningún `ALTER`, `CREATE`, `DROP`, `UPDATE`, `DELETE`, `INSERT` ni `TRUNCATE`.
Ninguna modificación de `schema.prisma`, migraciones, servicios, middleware o Prisma.
Ningún despliegue ni reinicio. Ninguna conexión a staging o producción.
Los cambios ajenos en curso (`classroom.service.ts`, `lesson.service.ts`,
`live-session.service.ts`, `Classroom.tsx` y los archivos sin seguimiento) no fueron
tocados. Único archivo creado: **este documento**.
