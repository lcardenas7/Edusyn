# ═══════════════════════════════════════════════════════════════════════════════
# DISEÑO DE MODELO RBAC MULTI-TENANT ENTERPRISE-GRADE — EDUSYN ERP
# Fecha: Marzo 2026
# Alcance: Análisis del modelo actual + Propuesta de diseño seguro
# Restricciones: SIN generación de código. Solo análisis y diseño.
# ═══════════════════════════════════════════════════════════════════════════════

---

## ÍNDICE

1. [Riesgos Críticos Actuales](#1-riesgos-críticos-actuales)
2. [Riesgos Medios](#2-riesgos-medios)
3. [Diseño Estructural Recomendado](#3-diseño-estructural-recomendado)
4. [Diseño JWT Recomendado](#4-diseño-jwt-recomendado)
5. [Diseño Guard Recomendado](#5-diseño-guard-recomendado)
6. [Estrategia de Migración](#6-estrategia-de-migración)
7. [Nivel de Seguridad Antes vs Después](#7-nivel-de-seguridad-antes-vs-después)

---

## 1. RIESGOS CRÍTICOS ACTUALES

### 1.1 — Roles globales sin vínculo a institución (ESCALACIÓN CROSS-TENANT)

**Estado actual:**

```
User ──→ UserRole ──→ Role (global, name @unique)
User ──→ InstitutionUser ──→ Institution
```

Estas dos cadenas **están desconectadas**. Un usuario tiene roles de forma global (tabla `UserRole`) e instituciones de forma independiente (tabla `InstitutionUser`). No existe ningún vínculo que diga "este usuario tiene rol X **en** institución Y".

**Archivo:** `schema.prisma:362-380`
```
Role       → name @unique, SIN institutionId
UserRole   → (userId, roleId), SIN institutionId
```

**Escenario de ataque real:**
1. Un usuario es `DOCENTE` en Institución A
2. El mismo usuario es `COORDINADOR` en Institución B
3. Al hacer login, el JWT recibe `roles: ["DOCENTE", "COORDINADOR"]` (ambos roles, sin distinción)
4. Al acceder a recursos de Institución A, el `RolesGuard` valida `roles.includes("COORDINADOR")` → **PASA**
5. El usuario accede a funciones de coordinador en Institución A donde solo es docente

**Evidencia en el JWT signing:**
```
// auth.service.ts:65-72
const roleNames = user.roles.map((r) => r.role.name);  // ← Todos los roles, sin filtrar por institución
const accessToken = await this.jwtService.signAsync({
  sub: user.id,
  roles: roleNames,  // ← Array plano: ["DOCENTE", "COORDINADOR"]
  institutionId: userInstitution?.id || null,
});
```

**Criticidad: MÁXIMA** — Escalación de privilegios real en escenarios multi-institución.

---

### 1.2 — `RolesGuard` NO valida el tenant del rol

**Archivo:** `guards/roles.guard.ts:10-41`

El guard solo verifica:
```
¿El array roles[] del JWT contiene alguno de los roles requeridos?
```

**Lo que NO hace:**
- No verifica que el rol aplique a la institución activa del request
- No consulta `InstitutionUser` para confirmar membresía
- No distingue roles por tenant
- No cruza `institutionId` del JWT contra el recurso solicitado

Esto convierte al `RolesGuard` en un **validador cosmético**: verifica que el usuario tiene el rol en algún lugar, pero no en el contexto correcto.

---

### 1.3 — `findUserInstitution` usa `findFirst` sin criterio determinista

**Archivo:** `users.service.ts:68-112`

```
async findUserInstitution(userId: string) {
  const institutionUser = await this.prisma.institutionUser.findFirst({
    where: { userId },  // ← Sin filtro de institución específica
    ...
  });
```

**Problema para usuarios multi-institución:**
- `findFirst` sin `orderBy` retorna el primer registro encontrado (orden arbitrario de PostgreSQL)
- Si un usuario pertenece a instituciones A y B, el JWT siempre recibe la primera que PostgreSQL encuentre
- No hay forma de que el usuario elija a cuál institución conectarse

**Bug funcional combinado con el login:**
```
// auth.service.ts:55-62
const userInstitution = await this.usersService.findUserInstitution(user.id);
if (dto.institutionId) {
  if (!userInstitution || userInstitution.id !== dto.institutionId) {
    throw new UnauthorizedException('No tienes acceso a esta institución.');
  }
}
```

Escenario:
1. Usuario pertenece a Institución A y B
2. `findFirst` retorna Institución A
3. Usuario envía `dto.institutionId = B` (quiere entrar a B)
4. Comparación: `A !== B` → **LANZA ERROR** aunque el usuario SÍ pertenece a B

**Criticidad: ALTA** — Usuarios multi-institución no pueden elegir institución de forma fiable.

---

### 1.4 — `isSuperAdmin` detection ROTA en `institution-resolver.ts` para requests JWT

**Archivo:** `institution-resolver.ts:23-29`

```typescript
const isSuperAdmin = user.isSuperAdmin === true ||   // ← (A)
  user.roles?.some((r: any) => 
    r.role?.name === 'SUPERADMIN' ||                  // ← (B)
    r.role?.name === 'SUPER_ADMIN' ||
    r.roleName === 'SUPERADMIN' ||                    // ← (C)
    r.roleName === 'SUPER_ADMIN'
  );
```

**Análisis del `req.user` que viene del JWT (`jwt.strategy.ts:23-29`):**
```typescript
return { 
  id: payload.sub, 
  email: payload.email, 
  roles: payload.roles,        // ← string[] como ["SUPERADMIN", "ADMIN_INSTITUTIONAL"]
  institutionId: payload.institutionId || null,
};
```

**Por qué cada check falla:**
- **(A)** `user.isSuperAdmin === true` → **SIEMPRE false** — `isSuperAdmin` NO está en el JWT payload. El campo no existe en `req.user`.
- **(B)** `r.role?.name === 'SUPERADMIN'` → **SIEMPRE false** — `r` es un string (ej: `"SUPERADMIN"`), no un objeto. `r.role` es `undefined`.
- **(C)** `r.roleName === 'SUPERADMIN'` → **SIEMPRE false** — Un string no tiene propiedad `roleName`.

**Resultado:** Para requests autenticados por JWT, la función `isSuperAdmin()` en `institution-resolver.ts` **NUNCA retorna true**, incluso para un SuperAdmin real. El override de `queryInstitutionId` nunca funciona.

**Curiosamente, esto es un accidente de seguridad positivo** — impide que un SuperAdmin use el query param para cambiar de institución, forzándolo a usar siempre su JWT. Pero es **código muerto** que da falsa sensación de funcionalidad.

**Contraste con `CapabilitiesGuard`:** Este SÍ funciona correctamente porque consulta la BD: `user.isSuperAdmin` directo de Prisma.

**Criticidad: ALTA** — Código de seguridad que no funciona como se espera. Falsa sensación de control.

---

### 1.5 — `RegisterDto` acepta roles sin restricción por institución

**Archivo:** `auth/dto/register.dto.ts`

```
roles: string[]  // ← Acepta cualquier array de strings
```

**Archivo:** `auth.controller.ts:19-25`
```
@Post('register')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
```

**Análisis:**
- El endpoint está protegido (solo SUPERADMIN/ADMIN_INSTITUTIONAL pueden registrar) ✅
- **Pero** un ADMIN_INSTITUTIONAL puede crear usuarios con rol `SUPERADMIN` ❌
- No hay validación de que un ADMIN_INSTITUTIONAL solo pueda asignar roles ≤ su nivel
- No hay `institutionId` en el `RegisterDto` — el usuario creado no se vincula a ninguna institución

**Criticidad: ALTA** — Un admin institucional puede escalar privilegios creando un SuperAdmin.

---

### 1.6 — Ausencia de vínculo `institutionId` en `UserExtraPermission`

**Archivo:** `schema.prisma:2818-2845`

```
model UserExtraPermission {
  userId       String
  permissionId String
  grantedById  String
  // ... NO tiene institutionId
  @@unique([userId, permissionId])
}
```

Los permisos extra son globales. Si un coordinador de Institución A otorga un permiso a un docente, ese permiso aplica en TODAS las instituciones del usuario, no solo en A.

---

## 2. RIESGOS MEDIOS

### 2.1 — `InstitutionUser.isAdmin` no se usa en los Guards

**Archivo:** `schema.prisma:551`
```
isAdmin  Boolean  @default(false)  // Es admin/rector de esta institución
```

Este campo existe en `InstitutionUser` pero **nunca se consulta en los Guards**. El `RolesGuard` usa `roles` del JWT (globales). El `CapabilitiesGuard` consulta la BD por `user.isSuperAdmin` y `roleNames.includes('ADMIN_INSTITUTIONAL')`, pero no consulta `InstitutionUser.isAdmin`.

Esto significa que el campo `isAdmin` per-institución es decorativo.

---

### 2.2 — `institution-resolver.ts` fallback busca `InstitutionUser.findFirst` sin orden

**Archivo:** `institution-resolver.ts:44-55`

Cuando el JWT no tiene `institutionId`, el fallback busca `InstitutionUser.findFirst` sin `orderBy`. Para usuarios multi-institución, retorna una institución arbitraria.

---

### 2.3 — `RoleBasePermission.role` es `String` plano, no FK a `Role`

**Archivo:** `schema.prisma:2806-2815`

```
model RoleBasePermission {
  role         String     // "ADMIN_INSTITUTIONAL", "RECTOR", "COORDINADOR", "DOCENTE"
  permissionId String
  // ... role es String libre, no FK a tabla Role
}
```

Lo mismo ocurre con `InstitutionRoleCapability.role` (línea 4286). Son strings que podrían contener valores inconsistentes con la tabla `Role`.

---

### 2.4 — `CapabilitiesGuard` hace query a BD en cada request

**Archivo:** `capabilities.guard.ts:50-53`

Cada request que pasa por `CapabilitiesGuard` ejecuta `userHasCapability()`, que a su vez:
1. `prisma.user.findUnique({ include: { roles: { include: { role: true } } } })` — 1 query
2. `prisma.group.count({ where: { directorId } })` — 1 query (si es docente)
3. `seedDefaults(institutionId)` — potencialmente N queries
4. `prisma.institutionRoleCapability.findFirst()` — 1 query

**Total: 3-5 queries por request** en endpoints con capability. Sin cache.

---

### 2.5 — JWT contiene roles como strings planos sin firma por tenant

El JWT payload:
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "roles": ["DOCENTE", "COORDINADOR"],
  "institutionId": "inst-id-or-null"
}
```

Los roles no están vinculados al `institutionId` dentro del token. Si se intercepta y decodifica el JWT (es solo base64), se puede ver que tiene roles de todas las instituciones. Aunque no se puede modificar (está firmado), la **semántica es incorrecta**: el token declara privilegios que no corresponden al tenant.

---

### 2.6 — No hay mecanismo de "switch institution"

No existe un endpoint tipo `POST /auth/switch-institution` que permita a un usuario multi-institución cambiar de contexto de forma segura (emitiendo un nuevo JWT con el `institutionId` y los roles correctos del nuevo tenant).

---

## 3. DISEÑO ESTRUCTURAL RECOMENDADO

### 3.1 — Modelo de datos propuesto

```
┌──────────┐       ┌───────────────────────┐       ┌─────────────┐
│   User   │       │   InstitutionUser     │       │ Institution │
│          │──1:N─→│   (tabla pivote)      │←─N:1──│             │
│ id       │       │   id                  │       │ id          │
│ email    │       │   userId     FK→User  │       │ name        │
│ password │       │   institutionId FK→Inst│       │ slug        │
│ isSuperAd│       │   isActive            │       │ ...         │
│ ...      │       │   joinedAt            │       │             │
└──────────┘       │                       │       └─────────────┘
                   │   @@unique(userId,    │
                   │           institutionId)│
                   └───────────┬───────────┘
                               │
                               │ 1:N
                               ▼
                   ┌───────────────────────┐       ┌─────────────┐
                   │ InstitutionUserRole   │       │    Role     │
                   │   (NUEVA)             │──N:1─→│  (global)   │
                   │   id                  │       │  id         │
                   │   institutionUserId   │       │  name       │
                   │   roleId     FK→Role  │       └─────────────┘
                   │   assignedAt          │
                   │   assignedById        │
                   │                       │
                   │   @@unique(           │
                   │     institutionUserId, │
                   │     roleId)           │
                   └───────────────────────┘
```

### 3.2 — Explicación del modelo

**Principio: Los roles se asignan POR institución, no globalmente.**

| Concepto | Estado actual | Propuesto |
|----------|--------------|-----------|
| Asignación de rol | `UserRole(userId, roleId)` — global | `InstitutionUserRole(institutionUserId, roleId)` — por tenant |
| Pregunta que responde | "¿Qué roles tiene este usuario?" | "¿Qué roles tiene este usuario **en esta institución**?" |
| JWT payload | `roles: ["DOCENTE", "COORDINADOR"]` (todos) | `roles: ["DOCENTE"]` (solo del tenant activo) |
| Multi-institución | Roles mezclados de todas las instituciones | Roles aislados por institución |

### 3.3 — Tabla `Role` se mantiene global

La tabla `Role` debe seguir siendo global (catálogo de roles del sistema):
- `SUPERADMIN`
- `ADMIN_INSTITUTIONAL`
- `RECTOR`
- `COORDINADOR`
- `DOCENTE`
- `ACUDIENTE` (futuro)
- `ESTUDIANTE` (futuro)

**Razón:** Los nombres de roles son estándar del sistema educativo colombiano. No varían por institución. Lo que varía son las **capabilities** por rol por institución (que ya existe en `InstitutionRoleCapability`).

### 3.4 — La tabla `UserRole` actual se depreca

`UserRole` actual (global) se reemplaza por `InstitutionUserRole` (por tenant). La migración debe ser aditiva (crear nueva tabla, migrar datos, deprecar antigua).

### 3.5 — `UserExtraPermission` necesita `institutionId`

Agregar `institutionId` a `UserExtraPermission` para que los permisos extra sean por tenant:

```
UserExtraPermission
  + institutionId  FK→Institution
  @@unique([userId, permissionId, institutionId])  // Reemplaza @@unique([userId, permissionId])
```

### 3.6 — `RoleBasePermission` y `InstitutionRoleCapability` ya son correctos

- `RoleBasePermission` es global (permisos base del sistema por rol) → Correcto
- `InstitutionRoleCapability` es por tenant (capabilities configurables por institución) → Correcto

**Recomendación menor:** Cambiar `RoleBasePermission.role` de `String` a `FK → Role` para integridad referencial.

---

## 4. DISEÑO JWT RECOMENDADO

### 4.1 — Payload actual (problemático)

```json
{
  "sub": "clxxxxx",
  "email": "usuario@correo.com",
  "roles": ["DOCENTE", "COORDINADOR"],
  "institutionId": "clyyyyyy",
  "iat": 1234567890,
  "exp": 1234571490
}
```

**Problemas:**
1. `roles` contiene TODOS los roles del usuario (de todas las instituciones)
2. `institutionId` se obtiene con `findFirst` (arbitrario para multi-institución)
3. No hay `isSuperAdmin` — rompe detección en `institution-resolver`
4. No hay claim que vincule roles con institución

### 4.2 — Payload propuesto

```json
{
  "sub": "clxxxxx",
  "email": "usuario@correo.com",
  "institutionId": "clyyyyyy",
  "roles": ["DOCENTE"],
  "isSuperAdmin": false,
  "institutionUserId": "clzzzzz",
  "iat": 1234567890,
  "exp": 1234571490
}
```

| Campo | Qué contiene | Por qué |
|-------|-------------|---------|
| `sub` | ID del usuario | Identificación principal |
| `email` | Email del usuario | Conveniencia (evita query extra) |
| `institutionId` | ID de la institución ACTIVA | Contexto de tenant. Obligatorio para no-SuperAdmin |
| `roles` | Roles del usuario EN ESA institución | Solo los roles relevantes al tenant activo |
| `isSuperAdmin` | `true`/`false` | Elimina la detección rota en institution-resolver |
| `institutionUserId` | ID del registro `InstitutionUser` | Referencia directa para queries, evita JOINs |
| `iat` / `exp` | Timestamps estándar JWT | Seguridad temporal. Recomendado: `exp` = 8h |

### 4.3 — Lo que NO debe contener el JWT

| Campo prohibido | Razón |
|----------------|-------|
| Roles de OTRAS instituciones | Violación de aislamiento de tenant |
| Capabilities (lista completa) | Demasiado grande, cambia frecuentemente |
| Datos sensibles (password hash) | Nunca en un token decodificable |
| `institutionId` de query param | Manipulable por el cliente |
| Información de otros usuarios | Violación de privacidad |

### 4.4 — Flujo de login propuesto

```
POST /auth/login
Body: { email, password, institutionId? (slug o id) }

1. Validar credenciales (email/password) ✓
2. Verificar usuario activo ✓
3. Determinar institución:
   a. Si es SuperAdmin sin institutionId → JWT sin institutionId (acceso global)
   b. Si es SuperAdmin con institutionId → JWT con esa institución + roles en ella
   c. Si envía institutionId → buscar InstitutionUser WHERE userId AND institutionId
   d. Si NO envía institutionId → buscar InstitutionUser WHERE userId (si solo hay 1, usar esa)
   e. Si tiene múltiples instituciones y no especifica → retornar lista de instituciones para elegir
4. Obtener roles del usuario EN LA INSTITUCIÓN seleccionada (no globales)
5. Firmar JWT con roles filtrados por tenant
6. Retornar token + info de usuario + institución
```

### 4.5 — Respuesta de login para usuarios multi-institución

Cuando un usuario tiene múltiples instituciones y no especifica cuál:

```json
{
  "requiresInstitutionSelection": true,
  "institutions": [
    { "id": "clxxx1", "name": "Colegio San José", "slug": "colegio-san-jose", "logo": "...", "roles": ["DOCENTE"] },
    { "id": "clxxx2", "name": "Liceo Bolívar", "slug": "liceo-bolivar", "logo": "...", "roles": ["COORDINADOR"] }
  ]
}
```

El frontend muestra un selector. El usuario elige y reenvía login con `institutionId`.

### 4.6 — Endpoint de switch institution

```
POST /auth/switch-institution
Body: { institutionId: "nuevo-tenant-id" }
Headers: Authorization: Bearer <jwt-actual>

1. Validar JWT actual (usuario autenticado)
2. Verificar que el usuario pertenece a la nueva institución (InstitutionUser)
3. Obtener roles del usuario EN LA NUEVA institución
4. Firmar NUEVO JWT con institutionId y roles de la nueva institución
5. Retornar nuevo token
```

**Esto permite cambio de contexto sin re-autenticación** (no requiere contraseña de nuevo).

---

## 5. DISEÑO GUARD RECOMENDADO

### 5.1 — Capas de autorización (arquitectura propuesta)

```
Request HTTP
  │
  ▼
[JwtAuthGuard] ── Capa 1: ¿Está autenticado?
  │                  Valida firma JWT, extrae req.user
  │                  Verifica expiración
  ▼
[TenantGuard]  ── Capa 2: ¿Pertenece al tenant? (NUEVO)
  │                  Verifica que req.user.institutionId coincida con el recurso
  │                  Bloquea acceso cross-tenant
  ▼
[RolesGuard]   ── Capa 3: ¿Tiene el rol correcto EN ESTE TENANT?
  │                  Lee roles del JWT (ya filtrados por tenant)
  │                  Valida contra @Roles() del endpoint
  ▼
[CapabilitiesGuard] ── Capa 4: ¿Tiene la capability específica?
  │                      Verifica InstitutionRoleCapability
  │                      (Solo en endpoints que lo requieren)
  ▼
[Controller] → [Service] → [Prisma WHERE institutionId = ...]
```

### 5.2 — TenantGuard (NUEVO — propuesta)

**Responsabilidad:** Garantizar que el `institutionId` del JWT coincida con el tenant del recurso solicitado.

**Lógica:**
```
1. Extraer institutionId del JWT (req.user.institutionId)
2. Si el usuario es SuperAdmin → permitir (puede acceder a cualquier tenant)
3. Si el endpoint tiene @SkipTenantCheck() → permitir (endpoints públicos)
4. Extraer institutionId del recurso:
   - De query param: ?institutionId=X
   - De path param: /institutions/:institutionId/...
   - De body: { institutionId: "X" }
5. Si el institutionId del recurso != institutionId del JWT → DENEGAR
6. Si no se puede determinar institutionId del recurso → DENEGAR
```

**Por qué es necesario:** Actualmente, la validación de tenant se hace DENTRO de cada servicio (con `resolveInstitutionId`). Esto es frágil porque:
- Si un servicio olvida llamar a `resolveInstitutionId`, no hay validación
- La validación depende de que cada developer la implemente
- No hay garantía sistémica de que TODO endpoint valide el tenant

Con un `TenantGuard` global, la validación es automática y no depende del código del servicio.

### 5.3 — RolesGuard rediseñado

**Cambio fundamental:** El guard ya NO necesita cruzar roles con institución porque el JWT ya contiene solo los roles del tenant activo.

```
Antes:
  JWT.roles = ["DOCENTE", "COORDINADOR"]  ← de TODAS las instituciones
  RolesGuard verifica: ¿"COORDINADOR" está en JWT.roles? → SÍ (pero es de otra institución)

Después:
  JWT.roles = ["DOCENTE"]  ← solo de la institución activa
  RolesGuard verifica: ¿"COORDINADOR" está en JWT.roles? → NO (correcto)
```

El RolesGuard se simplifica: solo verifica presencia del rol en `req.user.roles`, confiando en que el JWT fue emitido correctamente con roles filtrados por tenant.

### 5.4 — `institution-resolver.ts` simplificado

Con el nuevo JWT que incluye `isSuperAdmin` e `institutionId` siempre correcto:

```
Antes: 3 fallbacks (JWT → InstitutionUser.findFirst → undefined)
Después:
  1. SuperAdmin con query param → usar query param (verificado por isSuperAdmin en JWT)
  2. Usuario normal → usar JWT.institutionId (siempre presente y correcto)
  3. Sin institutionId → ERROR (nunca debería pasar con el nuevo login flow)
```

Se elimina el fallback a `InstitutionUser.findFirst` que era no determinista.

### 5.5 — CapabilitiesGuard optimizado

**Propuesta de cache:**

```
Capa de cache en CapabilitiesService:
  Key: `caps:${userId}:${institutionId}`
  TTL: 60 segundos (igual que InstitutionContext)
  Invalidación: al cambiar capabilities de un rol o cambiar roles de un usuario

En lugar de 3-5 queries por request:
  1. Primer request: 3-5 queries → guarda en cache
  2. Requests siguientes (60s): 0 queries → lee de cache
  3. Cambio de config: invalida cache → recalcula en siguiente request
```

---

## 6. ESTRATEGIA DE MIGRACIÓN

### 6.1 — Principios de migración

1. **CERO DOWNTIME** — La migración debe ser aditiva, no destructiva
2. **COMPATIBILIDAD DUAL** — Durante la transición, ambos modelos coexisten
3. **ROLLBACK SEGURO** — Si algo falla, se puede revertir sin pérdida de datos
4. **PRODUCCIÓN ACTIVA** — El sistema está en producción, no se puede parar

### 6.2 — Fases de migración

#### FASE 1: Crear nueva estructura (aditiva, sin romper nada)

**Acciones en schema:**
1. Crear modelo `InstitutionUserRole` (nueva tabla)
2. Agregar `institutionId` a `UserExtraPermission` (campo nullable primero)
3. NO tocar `UserRole` — sigue funcionando en paralelo

**Migración de datos:**
1. Para cada `UserRole(userId, roleId)`:
   - Buscar TODOS los `InstitutionUser` del userId
   - Para cada institución: crear `InstitutionUserRole(institutionUserId, roleId)`
   - Esto "explota" cada rol global en N registros (1 por institución)
2. Para cada `UserExtraPermission`:
   - Buscar el `InstitutionUser` del userId
   - Asignar el `institutionId` correspondiente

**Resultado:** Ambas tablas (`UserRole` e `InstitutionUserRole`) tienen datos válidos.

#### FASE 2: Actualizar el login para usar nueva tabla

**Cambios en `auth.service.ts`:**
1. En `login()`:
   - Resolver institución PRIMERO (por `dto.institutionId` o selección)
   - Buscar `InstitutionUser WHERE userId AND institutionId`
   - Buscar `InstitutionUserRole WHERE institutionUserId`
   - Firmar JWT con roles filtrados + `isSuperAdmin`
2. Nuevo endpoint: `POST /auth/switch-institution`
3. Respuesta de selección de institución para multi-institución

**Cambios en `jwt.strategy.ts`:**
- Agregar `isSuperAdmin` al tipo `JwtPayload`

**Cambios en `institution-resolver.ts`:**
- Simplificar detección de SuperAdmin: `user.isSuperAdmin === true`
- Eliminar los checks rotos de `r.role?.name`

#### FASE 3: Activar TenantGuard global

1. Crear `TenantGuard`
2. Registrarlo como guard global en `app.module.ts`
3. Agregar `@SkipTenantCheck()` a endpoints públicos (login, search, slug lookup)
4. Verificar que todos los endpoints pasen correctamente

#### FASE 4: Deprecar `UserRole` (limpieza)

1. Dejar de escribir en `UserRole` (toda escritura va a `InstitutionUserRole`)
2. Verificar que ningún servicio lea de `UserRole`
3. Mantener `UserRole` como tabla legacy durante 1 ciclo de release
4. Eliminar `UserRole` en un release posterior

### 6.3 — Orden de deployment

```
Release 1: Schema migration (FASE 1)
  - Crear InstitutionUserRole
  - Migrar datos
  - Deploy: cero impacto en funcionalidad existente

Release 2: Login refactor (FASE 2)
  - Nuevo flujo de login
  - Nuevo JWT payload
  - institution-resolver simplificado
  - Deploy: requiere logout/login de todos los usuarios (JWT viejo caduca)

Release 3: TenantGuard (FASE 3)
  - Guard global
  - Deploy: refuerza seguridad, no cambia funcionalidad

Release 4: Cleanup (FASE 4)
  - Eliminar UserRole
  - Deploy: limpieza
```

### 6.4 — Validación post-migración

Para cada release, ejecutar verificaciones:

**Release 1:**
- Verificar que `InstitutionUserRole` tiene al menos 1 registro por cada `UserRole`
- Verificar que no hay `InstitutionUser` sin roles (si tenía `UserRole`)
- Verificar `COUNT(InstitutionUserRole)` ≥ `COUNT(UserRole)`

**Release 2:**
- Login con usuario de 1 institución: JWT.roles contiene sus roles
- Login con usuario de 2 instituciones sin especificar: retorna selector
- Login con usuario de 2 instituciones especificando: JWT.roles solo del tenant
- Switch institution: nuevo JWT con roles del nuevo tenant
- SuperAdmin login: `isSuperAdmin: true` en JWT

**Release 3:**
- Request a endpoint de Institución A con JWT de Institución B: → 403
- Request a endpoint público sin JWT: → funciona
- SuperAdmin accediendo a cualquier institución: → funciona

### 6.5 — Riesgos de migración y mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Usuarios activos pierden sesión | JWT viejo sigue válido hasta expiración. Nuevos JWT usan nuevo formato. |
| Datos inconsistentes en `InstitutionUserRole` | Script de validación que compara conteos pre/post migración |
| Un servicio sigue leyendo `UserRole` | Grep de `UserRole` en codebase. Cada servicio se migra explícitamente. |
| Frontend no maneja selector de institución | Agregar UI de selector antes de Release 2 |
| `CapabilitiesGuard` incompatible | Ya usa `institutionId` del JWT — compatible sin cambios |

---

## 7. NIVEL DE SEGURIDAD ANTES VS DESPUÉS

### 7.1 — Scorecard ANTES

| Aspecto | Nota (1-10) | Detalle |
|---------|-------------|---------|
| Aislamiento de roles por tenant | **2** | Roles son globales. Escalación cross-tenant posible. |
| Validación de tenant en Guards | **3** | RolesGuard no valida tenant. CapabilitiesGuard sí pero solo en endpoints con capability. |
| JWT correctness | **3** | Roles mezclados de todas las instituciones. `isSuperAdmin` ausente. |
| Multi-institución | **2** | `findFirst` arbitrario. Login falla para usuario que elige institución secundaria. |
| SuperAdmin detection | **2** | Rota en institution-resolver para JWT. Funciona por accidente en CapabilitiesGuard (vía DB). |
| Escalación de privilegios | **3** | Posible para usuarios multi-institución. Register permite crear SuperAdmin por ADMIN. |
| Permisos granulares | **4** | `UserExtraPermission` existe pero sin institutionId. `InstitutionRoleCapability` bien diseñado. |
| Resistencia a ataques | **5** | Throttle en login ✅. JWT firmado ✅. institution-resolver bloquea query params en no-SuperAdmin ✅ (por accidente). |

### **NIVEL DE SEGURIDAD ACTUAL: 3.0 / 10** (para el módulo RBAC específicamente)

---

### 7.2 — Scorecard DESPUÉS (con diseño propuesto implementado)

| Aspecto | Nota (1-10) | Detalle |
|---------|-------------|---------|
| Aislamiento de roles por tenant | **9** | `InstitutionUserRole` vincula rol+usuario+institución. JWT solo tiene roles del tenant activo. |
| Validación de tenant en Guards | **9** | `TenantGuard` global valida en CADA request. Sistémico, no opt-in. |
| JWT correctness | **9** | Roles filtrados, `isSuperAdmin` explícito, `institutionUserId` para queries directos. |
| Multi-institución | **9** | Selector de institución en login. Switch-institution endpoint. Determinista. |
| SuperAdmin detection | **10** | `isSuperAdmin: true/false` directamente en JWT. Sin heurísticas rotas. |
| Escalación de privilegios | **9** | Roles per-tenant eliminan escalación cross-tenant. Register restringido por jerarquía. |
| Permisos granulares | **8** | `UserExtraPermission` con `institutionId`. `InstitutionRoleCapability` ya funciona bien. |
| Resistencia a ataques | **8** | Todo lo anterior + TenantGuard + cache en capabilities (reduce superficie por DoS). |

### **NIVEL DE SEGURIDAD PROPUESTO: 8.9 / 10**

---

### 7.3 — Resumen de impacto

```
ANTES:  3.0 / 10  →  DESPUÉS:  8.9 / 10  (+5.9 puntos)
```

| Métrica | Antes | Después |
|---------|-------|---------|
| Vectores de escalación cross-tenant | 3+ | 0 |
| Guards que validan tenant | 1 de 3 (CapabilitiesGuard) | 3 de 3 + TenantGuard global |
| Queries por request para auth | 3-5 (sin cache) | 0-1 (con cache, JWT enriched) |
| Soporte multi-institución | Roto | Funcional con selector + switch |
| Código de seguridad muerto | ~30 líneas (institution-resolver) | 0 |
| Puntos de falla del desarrollador | Alto (cada servicio debe llamar resolveInstitutionId) | Bajo (TenantGuard sistémico) |

---

## ANEXO: ARCHIVOS ANALIZADOS

| Archivo | Líneas | Hallazgo principal |
|---------|--------|--------------------|
| `schema.prisma:225-360` | User, roles, institutionUsers | Roles y membresías desconectados |
| `schema.prisma:362-380` | Role, UserRole | Globales sin institutionId |
| `schema.prisma:546-559` | InstitutionUser | Tiene @@unique pero sin roles |
| `schema.prisma:2789-2845` | Permission, RoleBasePermission, UserExtraPermission | Permisos sin tenant |
| `schema.prisma:4283-4297` | InstitutionRoleCapability | Bien diseñado (por tenant) |
| `auth.service.ts:38-88` | login() | roles globales en JWT, findFirst arbitrario |
| `auth.service.ts:16-36` | register() | Acepta roles sin restricción de jerarquía |
| `auth/dto/login.dto.ts` | LoginDto | institutionId opcional |
| `auth/dto/register.dto.ts` | RegisterDto | roles sin institutionId |
| `jwt.strategy.ts:6-31` | JwtPayload, validate() | Sin isSuperAdmin en payload |
| `guards/roles.guard.ts:10-41` | canActivate() | No valida tenant |
| `capabilities.guard.ts:25-63` | canActivate() | SÍ valida tenant (via DB) |
| `institution-resolver.ts:11-91` | resolveInstitutionId() | SuperAdmin detection rota para JWT |
| `users.service.ts:68-112` | findUserInstitution() | findFirst sin orden |
| `capabilities.service.ts:217-277` | userHasCapability() | 3-5 queries sin cache |

---

*Documento de diseño arquitectónico. No se generó, modificó, ni refactorizó código.*
