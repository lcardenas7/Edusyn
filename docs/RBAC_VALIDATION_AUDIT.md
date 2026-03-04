# ═══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA DE VALIDACIÓN PROFUNDA — DISEÑO RBAC MULTI-TENANT EDUSYN
# Tipo: Revisión independiente de propuesta arquitectónica
# Fecha: Marzo 2026
# Alcance: Validar que el diseño propuesto elimina TODOS los riesgos detectados
#          y no introduce nuevos vectores de ataque.
# Restricciones: SIN generación de código. Solo análisis crítico.
# ═══════════════════════════════════════════════════════════════════════════════

---

## ÍNDICE

1. [Vulnerabilidades aún presentes](#1-vulnerabilidades-aún-presentes)
2. [Riesgos nuevos introducidos por el rediseño](#2-riesgos-nuevos-introducidos-por-el-rediseño)
3. [Validación del TenantGuard](#3-validación-del-tenantguard)
4. [Validación del JWT](#4-validación-del-jwt)
5. [Impacto modular](#5-impacto-modular)
6. [Validación de migración](#6-validación-de-migración)
7. [Recomendaciones adicionales enterprise](#7-recomendaciones-adicionales-enterprise)
8. [Score final realista](#8-score-final-realista)

---

## 1. VULNERABILIDADES AÚN PRESENTES

El diseño propuesto aborda correctamente los 6 riesgos críticos originales. Sin embargo, la auditoría del codebase revela **vulnerabilidades residuales que el diseño NO cubre**, y que existirían incluso después de implementar las 4 fases.

### 1.1 — CRÍTICO: `live-session` controller sin aislamiento de tenant

**Evidencia:** `live-session.controller.ts:57-133`

El módulo `live-session` (sesiones interactivas en tiempo real):
- **NO usa `resolveInstitutionId`** en ningún endpoint
- **NO pasa `institutionId`** a ninguna llamada del servicio
- `createSession()` recibe `classroomId` y `activityId` pero NO valida que pertenezcan a la institución del usuario
- `getSession()`, `getActiveSession()` no verifican pertenencia al tenant
- `submitAnswer()` permite que cualquier usuario autenticado envíe respuestas a cualquier sesión

**Vector de ataque:** Un usuario autenticado en Institución A puede interactuar con sesiones live de Institución B si conoce los IDs (que son CUIDs predecibles en secuencia).

**¿El rediseño lo resuelve?** PARCIALMENTE. El TenantGuard global ayudaría SI se implementa como guard de clase (aplicado al controller entero). Pero el TenantGuard propuesto valida `institutionId` contra un recurso — y en `live-session` no hay `institutionId` en ningún parámetro para cruzar. Se necesita validación adicional a nivel de servicio.

### 1.2 — CRÍTICO: SSE Stream bypasses todos los Guards

**Evidencia:** `live-session.controller.ts:35-50`

```
@Sse(':id/stream')
stream(@Param('id') sessionId: string, @Query('token') token?: string)
```

El endpoint SSE:
- **NO tiene `@UseGuards(JwtAuthGuard)`** — valida el JWT manualmente via `jwt.verify(token, secret)`
- La validación manual solo verifica la firma, **NO extrae roles ni institutionId**
- **NO tiene RolesGuard** → cualquier usuario autenticado puede conectarse
- El TenantGuard global propuesto NO aplicaría a este endpoint porque no pasa por el pipeline de guards estándar de NestJS para SSE

**¿El rediseño lo resuelve?** NO. Los endpoints SSE con autenticación por query param son un vector que queda fuera del alcance del TenantGuard. Requiere tratamiento especial.

### 1.3 — ALTO: `guardBulletinAccess` bypass cuando `institutionId` es null

**Evidencia:** `reports.controller.ts:25-28`

```typescript
const institutionId = req.user.institutionId;
if (!institutionId) return;  // ← BYPASS TOTAL del access check
```

Si un JWT llega sin `institutionId` (posible para SuperAdmin en el diseño propuesto), el guard de boletines **se salta completamente**. Esto significa que la lógica de "boletines no liberados para docentes" no aplica.

**¿El rediseño lo resuelve?** PARCIALMENTE. El diseño propone que SuperAdmin sin `institutionId` tiene acceso global. Pero el `return` silencioso no distingue entre "es SuperAdmin legítimo" y "es un token malformado". Debería verificarse explícitamente `isSuperAdmin` antes de hacer bypass.

### 1.4 — ALTO: Dos patrones divergentes de resolución de tenant (13 vs 23+ controllers)

**Hallazgo de auditoría del codebase:**

| Patrón | Controllers | Método |
|--------|------------|--------|
| **A: `resolveInstitutionId()`** | 13 controllers (academic, classroom, teacher-workspace, etc.) | Función centralizada con validación de SuperAdmin y fallback |
| **B: `req.user.institutionId` directo** | 23+ controllers (finance ×10, reports ×30 refs, timetabling, communications, storage, etc.) | Lee JWT sin validación adicional |

**Implicación:** El Patrón B confía ciegamente en el JWT. Si el JWT contiene un `institutionId` incorrecto (por ejemplo, durante la ventana de migración entre Release 2 y Release 3), esos 23+ controllers operarían con el tenant equivocado.

**¿El rediseño lo resuelve?** SÍ, pero con riesgo durante la transición. El TenantGuard global (Release 3) cubriría ambos patrones. Pero la ventana entre Release 2 (nuevo JWT) y Release 3 (TenantGuard) es peligrosa — los controllers de Patrón B seguirían confiando en el JWT sin validación independiente.

### 1.5 — MEDIO: `schedule-generator` tiene su propio `resolveInstitutionId` privado

**Evidencia:** `schedule-generator.controller.ts:35-38`

```typescript
private async resolveInstitutionId(req: any, academicYearId?: string): Promise<string | null> {
    if (req.user.institutionId) return req.user.institutionId;
    // SuperAdmin: derive from academicYearId
```

Este controller reimplementa la resolución de institución de forma independiente, sin usar la utilidad centralizada. Usa lógica distinta (derivar de `academicYearId`). El TenantGuard global no detectaría inconsistencias entre esta implementación y la centralizada.

---

## 2. RIESGOS NUEVOS INTRODUCIDOS POR EL REDISEÑO

### 2.1 — CRÍTICO: Privilege persistence tras `switch-institution`

**Escenario:**

1. Usuario hace login en Institución A → JWT con `roles: ["COORDINADOR"]`
2. Frontend carga capabilities, menús, permisos basados en JWT
3. En Institución A, un admin le REVOCA el rol de COORDINADOR
4. El usuario hace `switch-institution` a Institución B → nuevo JWT con roles de B
5. El usuario hace `switch-institution` DE VUELTA a Institución A
6. **Pregunta:** ¿De dónde vienen los roles del nuevo JWT para A?

**Riesgo:** Si `switch-institution` simplemente consulta `InstitutionUserRole` al momento del switch, el usuario recibiría un JWT actualizado (sin COORDINADOR). CORRECTO.

**Pero:** Si hay cache de roles/capabilities que NO se invalida al momento de la revocación, el usuario podría mantener privilegios stale hasta que el cache expire (60s propuestos).

**Evaluación:** El switch-institution POR SÍ MISMO no introduce privilege persistence — el riesgo está en la **combinación de cache + revocación asíncrona**. Ver sección 2.4.

### 2.2 — ALTO: Confusión de contexto post-switch en el frontend

**Escenario:**

1. Usuario en Institución A carga lista de estudiantes, reportes, workspace boards
2. Hace `switch-institution` a Institución B → nuevo JWT
3. El frontend actualiza el token pero **NO limpia el estado local**
4. El usuario ve datos de Institución A mientras opera en contexto de Institución B
5. Intenta editar un registro de A pensando que es de B

**Evaluación:** El diseño backend propuesto es correcto — el JWT nuevo solo permitiría operar en B. Las ediciones sobre IDs de A serían rechazadas por el TenantGuard (si está activo) o por los services que validan `institutionId`. **PERO** la confusión visual es un riesgo UX real que puede causar errores operativos.

**Recomendación:** El `switch-institution` DEBE:
- Forzar un full page reload o navegación a `/dashboard`
- Limpiar todo el estado local (React state, localStorage, React Query cache)
- El backend debe retornar la nueva institución con sus datos mínimos (nombre, logo, slug) para que el frontend reconstruya el contexto visual

### 2.3 — ALTO: JWT replay entre tenants

**Escenario:**

1. Usuario tiene JWT-A para Institución A y JWT-B para Institución B
2. Guarda JWT-A en localStorage/clipboard
3. Hace switch a B, obtiene JWT-B
4. Manualmente restaura JWT-A en el header de Authorization
5. Ahora opera como su rol en Institución A

**Evaluación:** Esto **NO es un ataque** — el usuario tiene acceso legítimo a Institución A con los roles de A. El JWT-A es válido hasta su expiración. **PERO** si se combinó con revocación de acceso a A (entre paso 1 y paso 5), el JWT-A seguiría siendo válido hasta expiración.

**Mitigación propuesta por el diseño:** No hay. El JWT es stateless por diseño.

**Mitigación necesaria para enterprise-grade:**
- **Opción A (ligera):** TTL corto (1h) + refresh token con rotación
- **Opción B (fuerte):** Token blacklist en Redis al hacer `switch-institution` (invalida JWT-A al emitir JWT-B)
- **Opción C (máxima):** `jti` (JWT ID) claim + server-side session store verificado en cada request

**Recomendación para Edusyn (500 instituciones):** Opción A es suficiente. TTL de 1h reduce la ventana de replay. El switch-institution no necesita invalidar el token anterior porque el usuario tiene acceso legítimo a ambas instituciones (si no fue revocado).

### 2.4 — MEDIO: Cache poisoning / stale permissions

**Escenario:**

1. Cache de capabilities se carga para `caps:user1:instA` con `["VIEW_OWN_SCHEDULE", "VIEW_REPORTS"]`
2. Admin revoca `VIEW_REPORTS` de este usuario
3. Durante los próximos 60 segundos, el cache sirve permissions obsoletas
4. El usuario puede acceder a reportes durante la ventana de staleness

**Evaluación:** 60 segundos de staleness es ACEPTABLE para un ERP educativo. No es un sistema financiero de alta frecuencia. Las operaciones críticas (cambio de notas, cierre de períodos) están protegidas por validaciones adicionales en los services.

**Pero:** El diseño propone invalidar cache "al cambiar capabilities o roles de un usuario" — esto requiere una **invalidación activa** (event-driven), no solo un TTL. Sin invalidación activa, el TTL de 60s es la única protección.

**Riesgo real:** Si un admin revoca un rol Y el usuario está activamente usando el sistema, hay 60s de acceso residual. Para cambios de seguridad críticos (revocación de admin institucional, desactivación de usuario), 60s es DEMASIADO.

**Recomendación:**
- Cache TTL de 60s para capabilities normales: ACEPTABLE
- Para operaciones destructivas (desactivar usuario, revocar admin): **invalidación inmediata + forzar re-login**
- Implementar un canal de invalidación: cuando se revoca un rol/permiso, insertar un registro en una tabla `TokenRevocation(userId, revokedAt)`. El TenantGuard o un middleware debe verificar `revokedAt > jwt.iat` → forzar re-autenticación.

### 2.5 — BAJO: `institutionUserId` en JWT como vector de confusión

El diseño propone incluir `institutionUserId` en el JWT para "referencia directa, evita JOINs". 

**Riesgo:** Si un desarrollador usa `institutionUserId` para autorización (ej: `WHERE id = jwt.institutionUserId`) en lugar de cruzar `userId + institutionId`, podría crear un shortcut que bypasse la validación de pertenencia.

**Evaluación:** El riesgo es bajo (requiere error del desarrollador, no ataque externo). Pero en un equipo que crece, los shortcuts son tentadores.

**Recomendación:** Documentar explícitamente que `institutionUserId` es SOLO para optimización de queries de lectura, NUNCA para autorización. La autorización siempre debe basarse en `userId + institutionId`.

---

## 3. VALIDACIÓN DEL TENANTGUARD

### 3.1 — Orden de ejecución: ¿Antes o después del AuthGuard?

**Respuesta: DESPUÉS del AuthGuard. Siempre.**

```
[JwtAuthGuard] → [TenantGuard] → [RolesGuard] → [CapabilitiesGuard]
```

**Razón:** El TenantGuard necesita `req.user` (que lo establece JwtAuthGuard). Si se ejecuta antes, `req.user` no existe y no puede extraer `institutionId`.

En NestJS, el orden de guards en `@UseGuards()` es el orden de ejecución. Si se registra como guard global en `app.module.ts`, se puede controlar el orden con `APP_GUARD` providers:

```
{ provide: APP_GUARD, useClass: JwtAuthGuard },    // 1ro
{ provide: APP_GUARD, useClass: TenantGuard },      // 2do
// RolesGuard y CapabilitiesGuard se aplican por decorator, no global
```

**Alerta:** Si JwtAuthGuard se registra como global, TODOS los endpoints requerirían autenticación. Los endpoints públicos (`/auth/login`, `/auth/institution/:slug`, `/auth/institutions/search`) necesitarían un decorator `@SkipAuth()` o `@Public()`.

### 3.2 — ¿Puede romper endpoints públicos?

**SÍ, si no se implementa el mecanismo de bypass correctamente.**

Endpoints que DEBEN excluirse del TenantGuard:

| Endpoint | Controller | Razón |
|----------|-----------|-------|
| `POST /auth/login` | `auth.controller.ts` | Pre-autenticación |
| `POST /auth/register` | `auth.controller.ts` | Ya protegido por RolesGuard |
| `GET /auth/institution/:slug` | `auth.controller.ts` | Público (lookup de institución) |
| `GET /auth/institutions/search` | `auth.controller.ts` | Público (autocompletado) |
| `GET /live-session/:id/stream` | `live-session.controller.ts` | SSE con auth por query param |

**Recomendación:** Usar un decorator `@SkipTenantCheck()` + un metadata key que el TenantGuard lea. Patrón idéntico al `@Public()` de NestJS para JwtAuthGuard.

### 3.3 — ¿Debe aplicarse a TODOS los módulos?

**SÍ, con excepciones explícitas.**

**Módulos que requieren TenantGuard:**

| Módulo | # Controllers | Patrón actual |
|--------|--------------|---------------|
| Academic | 19 | `resolveInstitutionId()` |
| Evaluation | 10 | Mixto |
| Finance | 10 | `req.user.institutionId` directo |
| Reports | 1 (640 líneas) | `req.user.institutionId` directo |
| Timetabling | 5+ | Reimplementación propia |
| Dashboard | 4 | Mixto |
| Teacher Workspace | 1 | `resolveInstitutionId()` |
| Classroom | 1 | `resolveInstitutionId()` |
| Attendance | 2 | `resolveInstitutionId()` |
| Communications | 1 | `req.user.institutionId` directo |
| Storage | 1 | `req.user.institutionId` directo |
| APD | 1 | Mixto |
| Elections | 1 | Desconocido |
| Observer | 1 | `req.user.institutionId` directo |
| Live Session | 1 | **NINGUNO** |
| IAM | 2 | Mixto |
| Capabilities | 1 | `req.user.institutionId` directo |
| Permissions | 1 | `req.user.institutionId` directo |

**Total: ~63 controllers, de los cuales solo 13 usan `resolveInstitutionId()` centralizada.**

**Conclusión:** El TenantGuard global es CRÍTICO porque la mayoría de controllers (50+) NO usan la validación centralizada. Sin el guard global, quedan 50+ controllers que confían ciegamente en el JWT.

### 3.4 — Problema de diseño del TenantGuard: ¿Contra qué se compara?

El diseño original propone:

> "Extraer institutionId del recurso: de query param, path param o body"

**Problema:** Muchos endpoints NO tienen `institutionId` en ninguno de esos lugares. Ejemplos:

- `GET /reports/report-card/:studentEnrollmentId` — el `studentEnrollmentId` pertenece a una institución, pero no hay `institutionId` explícito
- `GET /teacher-workspace/boards/:id` — el boardId pertenece a una institución, pero no hay `institutionId` en la ruta
- `POST /live-session/:id/answer` — el sessionId no tiene relación directa con `institutionId`

**Opciones de diseño:**

| Opción | Descripción | Pro | Contra |
|--------|------------|-----|--------|
| **A: Solo validar presencia** | TenantGuard solo verifica que `jwt.institutionId` existe y no es null | Simple, no rompe nada | No previene acceso a recursos de otro tenant |
| **B: Validar contra parámetro** | TenantGuard busca `institutionId` en query/body/path y lo cruza con JWT | Fuerte para endpoints que lo exponen | No funciona para endpoints sin `institutionId` explícito |
| **C: Inyectar y delegar** | TenantGuard inyecta `req.tenantId = jwt.institutionId` y cada servicio lo usa en sus queries | No requiere `institutionId` en la ruta | Sigue dependiendo de que cada service use `req.tenantId` |
| **D: Híbrido** | TenantGuard valida presencia (Opción A) + inyecta (Opción C). Los services DEBEN filtrar por `req.tenantId`. El TenantGuard bloquea si `institutionId` está ausente para no-SuperAdmin. | Mejor balance | Requiere que los services adopten el patrón |

**Recomendación: Opción D (Híbrido).**

El TenantGuard debe:
1. Verificar que `jwt.institutionId` existe (para no-SuperAdmin). Si no → 403.
2. Inyectar `req.resolvedInstitutionId` = `jwt.institutionId` (o query param para SuperAdmin).
3. Si el endpoint tiene `institutionId` en query/body/path Y no coincide con JWT → 403.
4. Los services leen de `req.resolvedInstitutionId` en vez de `req.user.institutionId`.

Esto centraliza la resolución Y permite que el TenantGuard funcione incluso cuando la ruta no expone `institutionId`.

---

## 4. VALIDACIÓN DEL JWT

### 4.1 — ¿El JWT enriched introduce nuevos riesgos?

**`institutionUserId` manipulado:**

No es un riesgo real. El JWT está firmado con `JWT_SECRET`. No se puede modificar ningún campo sin invalidar la firma. `jwt.verify()` rechazaría el token.

**¿Debe firmarse con algo adicional?**

El JWT actual usa HS256 (HMAC-SHA256) con un secret compartido. Esto es suficiente para un sistema monolítico. Para un sistema distribuido (múltiples API servers), se necesitaría RS256 (RSA) con key pair para que cualquier servidor pueda verificar sin conocer el secret de firma.

**Edusyn es monolítico (un solo servidor NestJS en Railway)** → HS256 es adecuado. No se necesita firma adicional.

**¿Token por tenant?**

El diseño ya propone esto implícitamente: cada JWT está vinculado a UN tenant (un `institutionId`). No es un "token por tenant" en el sentido de múltiples tokens simultáneos, sino un token que cambia al hacer switch. Esto es CORRECTO.

**No se recomienda** emitir múltiples tokens simultáneos (uno por cada institución del usuario) porque:
- Aumenta superficie de ataque (múltiples tokens válidos circulando)
- Complica el manejo en frontend
- No aporta beneficio funcional (el usuario solo opera en una institución a la vez)

### 4.2 — Validación de campos propuestos

| Campo propuesto | ¿Necesario? | ¿Seguro? | Notas |
|----------------|-------------|---------|-------|
| `sub` (userId) | ✅ Sí | ✅ | Estándar JWT |
| `email` | ⚠️ Conveniencia | ✅ | Evita 1 query. OK incluir. |
| `institutionId` | ✅ Sí | ✅ | Core del aislamiento |
| `roles` (filtrados) | ✅ Sí | ✅ | Filtrados por tenant = correcto |
| `isSuperAdmin` | ✅ Sí | ✅ | Resuelve detección rota |
| `institutionUserId` | ⚠️ Optimización | ⚠️ | Riesgo bajo de misuse por developers (ver 2.5) |
| `iat` / `exp` | ✅ Sí | ✅ | Estándar |

**Campos que FALTAN en la propuesta:**

| Campo recomendado | Razón |
|------------------|-------|
| `jti` (JWT ID) | Identificador único del token. Permite invalidación selectiva (token blacklist). Necesario para `switch-institution` seguro. |
| `tokenVersion` o `iat` refinado | Permite invalidar TODOS los tokens de un usuario cuando se revoca acceso (comprar `iat` contra `user.lastRevokedAt`). |

### 4.3 — TTL recomendado

| Rol | TTL recomendado | Razón |
|-----|----------------|-------|
| SuperAdmin | 2 horas | Acceso cross-tenant = riesgo alto. TTL corto. |
| Admin Institucional | 4 horas | Operaciones administrativas sensibles |
| Coordinador / Docente | 8 horas | Jornada laboral completa |
| Estudiante / Acudiente | 24 horas | Menos privilegios, más conveniencia |

Esto contrasta con un TTL único para todos. Un TTL escalonado reduce la ventana de replay para roles privilegiados.

---

## 5. IMPACTO MODULAR

### 5.1 — Aula Virtual (Classroom)

**Patrón actual:** Usa `resolveInstitutionId()` centralizada via `resolveCtx()`.

**Impacto del rediseño:**
- Release 1-2: CERO impacto. El `resolveInstitutionId` seguirá funcionando con el nuevo JWT (ahora con `institutionId` siempre presente).
- Release 3: El TenantGuard validaría ANTES de que el controller llame a `resolveCtx()`. Redundante pero no rompe.
- **Actividades, Foro, materiales:** Todos pasan por `resolveCtx()` → aislados.
- **Live Session:** Ver sección 1.1 — requiere trabajo adicional.

**Riesgo de ruptura: BAJO** (excepto Live Session).

### 5.2 — Teacher Workspace

**Patrón actual:** Usa `resolveInstitutionId()` centralizada via `resolveCtx()`.

**Impacto:** Idéntico a Classroom. CERO ruptura esperada.

**Nota específica:** Los boards tienen `institutionId` a nivel de relación con `Institution` (via `@relation("RlsInstitutionWB")`). El TenantGuard no interfiere porque la validación de pertenencia ya se hace en el servicio.

**Riesgo de ruptura: NULO.**

### 5.3 — Reportes

**Patrón actual:** `req.user.institutionId` directo (30 referencias). NO usa `resolveInstitutionId`.

**Impacto del rediseño:**
- Release 2: El nuevo JWT SIEMPRE tendrá `institutionId` para no-SuperAdmin → los reportes funcionan igual.
- Para SuperAdmin: El JWT puede tener `institutionId` si hizo login con uno, o `null` si no. Si `null`, `guardBulletinAccess` hace bypass silencioso (ver 1.3). Los reportes que leen `req.user.institutionId` recibirían `null` → queries sin filtro de institución → **potencial leak cross-tenant**.
- Release 3: El TenantGuard bloqueará requests sin `institutionId` para no-SuperAdmin. Para SuperAdmin, depende de la implementación del guard.

**Riesgo de ruptura: MEDIO.** Los reportes de SuperAdmin sin `institutionId` necesitan atención especial. Los de usuarios normales son seguros.

**Recomendación:** Antes de Release 2, migrar los 30 usos de `req.user.institutionId` en `reports.controller.ts` a `req.resolvedInstitutionId` (inyectado por TenantGuard). O al menos, agregar `if (!institutionId) throw` en lugar del `return` silencioso.

### 5.4 — Estados académicos (Academic Year Lifecycle)

**Patrón actual:** Usa `resolveInstitutionId()` para operaciones de cierre de período, promoción, etc.

**Impacto:** CERO ruptura. Estas operaciones ya están bien aisladas por tenant y protegidas por CapabilitiesGuard.

**Consideración de integridad:** Al hacer switch-institution, un coordinador NO debería ver los períodos de la institución anterior. Esto es manejado por el frontend (recarga de datos al switch). El backend ya filtra por `institutionId`.

**Riesgo de ruptura: NULO.**

### 5.5 — Sincronización de notas (Evaluation + Grades)

**Patrón actual:** Mixto. Los controllers de `evaluation/` usan `@UseGuards(JwtAuthGuard, RolesGuard)` a nivel de clase. Las notas se vinculan a `teacherAssignment` que está scoped a `institutionId` via `academicYear → institution`.

**Impacto:** La cadena de integridad referencial ya protege las notas:
```
PeriodFinalGrade → SubjectId → Subject → Institution
PartialGrade → TeacherAssignment → AcademicYear → Institution
```

Un usuario no puede crear una nota en otra institución porque la `teacherAssignment` no existiría.

**Pero:** Si el `RolesGuard` actual permite que un COORDINADOR de Institución B acceda al endpoint de notas (porque tiene el rol globalmente), el guard no lo detiene. El servicio sí lo detiene cuando intenta buscar assignments que no existen en B para ese usuario. **Es defensa en profundidad accidental.**

Con el rediseño:
- JWT solo tiene roles del tenant activo → el RolesGuard es correcto
- TenantGuard valida el tenant antes de llegar al servicio
- La integridad referencial sigue como 3ra capa

**Riesgo de ruptura: NULO.**

### 5.6 — Finance

**Patrón actual:** `req.user.institutionId` directo en 10 controllers (54 referencias). NO usa `resolveInstitutionId`.

**Impacto:** Similar a Reportes. Para usuarios normales, el nuevo JWT enriquecido no cambia nada. Para SuperAdmin sin `institutionId`, los queries financieros no filtrarían por institución → **potencial leak cross-tenant**.

**Riesgo de ruptura: MEDIO** (solo para SuperAdmin).

### 5.7 — Resumen de impacto modular

| Módulo | Patrón | Riesgo de ruptura | Acción requerida |
|--------|--------|-------------------|------------------|
| Classroom | `resolveInstitutionId` | BAJO | Tratar Live Session |
| Teacher Workspace | `resolveInstitutionId` | NULO | Ninguna |
| Reportes | `req.user.institutionId` | MEDIO | Manejar SuperAdmin null |
| Academic Lifecycle | `resolveInstitutionId` | NULO | Ninguna |
| Evaluation/Grades | Mixto + ref. integrity | NULO | Ninguna |
| Finance (×10) | `req.user.institutionId` | MEDIO | Manejar SuperAdmin null |
| Timetabling | Reimplementación propia | BAJO | Unificar resolución |
| Communications | `req.user.institutionId` | BAJO | — |
| Storage | `req.user.institutionId` | BAJO | — |
| Dashboard | Mixto | BAJO | — |
| Live Session | **NINGUNO** | **ALTO** | Agregar tenant isolation |
| Elections | Desconocido | MEDIO | Auditar |

---

## 6. VALIDACIÓN DE MIGRACIÓN

### 6.1 — ¿La compatibilidad dual puede generar huecos?

**Fase 1 (dual: `UserRole` + `InstitutionUserRole`):**

**Riesgo identificado: Escritura divergente.**

Después de crear `InstitutionUserRole` y migrar datos, ¿qué pasa si un admin asigna un nuevo rol?:
- Si el código de asignación de roles sigue escribiendo en `UserRole` (código viejo), la nueva tabla `InstitutionUserRole` no se actualiza → **desincronización**
- Si se actualiza el código para escribir en `InstitutionUserRole`, pero el código de lectura (JWT signing) sigue leyendo de `UserRole` → **JWT stale**

**Mitigación necesaria:** Durante la Fase 1, la asignación de roles debe escribir en AMBAS tablas (dual-write). El login (JWT) puede seguir leyendo de `UserRole` hasta la Fase 2.

**Operaciones afectadas:**
- `POST /auth/register` (crea usuario con roles)
- Cualquier endpoint que asigne/revoque roles (si existe)
- Bulk upload de usuarios
- Seed scripts

Todos deben hacer dual-write durante la coexistencia.

### 6.2 — ¿Existe ventana de vulnerabilidad entre Release 2 y 3?

**SÍ. Es la ventana más peligrosa de toda la migración.**

**Estado después de Release 2 (sin Release 3):**
- JWT nuevo con roles filtrados por tenant ✅
- `isSuperAdmin` en JWT ✅
- Login con selector de institución ✅
- **PERO: No hay TenantGuard global** ❌
- Los 50+ controllers de Patrón B siguen confiando solo en el JWT
- Si hay un bug en el nuevo flujo de login que asigna roles incorrectos al JWT, NO hay defensa adicional

**Escenario de riesgo:**
1. Bug en el login: un usuario multi-institución recibe roles de Institución A en el JWT de Institución B
2. Sin TenantGuard, el JWT es la ÚNICA fuente de verdad
3. El usuario opera con roles incorrectos hasta que se detecta el bug

**Duración de la ventana:** Depende del ciclo de release. Si Release 2 y 3 se despliegan el mismo día → ventana mínima. Si hay semanas entre ellos → ventana peligrosa.

**Recomendación: Combinar Release 2 y 3.** El TenantGuard es una adición aditiva que no rompe nada. Desplegarlo junto con el nuevo JWT minimiza la ventana a CERO.

Si no se pueden combinar: **Release 3 dentro de 48 horas de Release 2 máximo.**

### 6.3 — Verificación de consistencia post-migración

**Checks automatizados necesarios:**

**Post-Fase 1 (creación de `InstitutionUserRole`):**

| Check | Query lógica | Esperado |
|-------|-------------|----------|
| Cobertura | Cada `UserRole` tiene al menos 1 `InstitutionUserRole` | COUNT(UserRole) ≤ COUNT(InstitutionUserRole) |
| Sin huérfanos | No hay `InstitutionUserRole` cuyo `institutionUserId` no exista | COUNT = 0 |
| Completitud | Para cada `InstitutionUser`, hay al menos 1 `InstitutionUserRole` (si el user tenía roles) | LEFT JOIN con NULL check |
| Sin duplicados | `@@unique(institutionUserId, roleId)` se cumple | Constraint de BD lo garantiza |

**Post-Fase 2 (nuevo login):**

| Check | Método | Esperado |
|-------|--------|----------|
| JWT contiene `isSuperAdmin` | Decodificar token de SuperAdmin conocido | `isSuperAdmin: true` presente |
| Roles filtrados | Login con usuario multi-institución, verificar roles del JWT vs `InstitutionUserRole` | Solo roles del tenant seleccionado |
| Switch institution | Switch y verificar que roles cambian | Roles diferentes por institución |
| Login sin institución | Login de usuario con 2+ instituciones sin `institutionId` | Respuesta con `requiresInstitutionSelection` |
| `institutionUserId` presente | Decodificar token | Campo no null |

**Post-Fase 3 (TenantGuard):**

| Check | Método | Esperado |
|-------|--------|----------|
| Cross-tenant bloqueado | Request con JWT de Inst-A a recurso de Inst-B | 403 Forbidden |
| SuperAdmin override | SuperAdmin con query param `institutionId` | Funciona correctamente |
| Endpoint público | `GET /auth/institution/:slug` sin JWT | 200 OK |
| SSE stream | Conectar a SSE con token de otro tenant | Debe rechazar (post-fix de Live Session) |

### 6.4 — Plan de rollback por fase

| Fase | Rollback |
|------|----------|
| 1 | Eliminar `InstitutionUserRole` (DROP TABLE). Sin impacto — nadie la lee aún. |
| 2 | Revertir `auth.service.ts` al flujo de login anterior. JWTs nuevos se invalidan al re-deployar (nuevo secret o simplemente esperar TTL). |
| 3 | Remover TenantGuard del `APP_GUARD`. Instantáneo, sin migration. |
| 4 | No aplicable (cleanup, no hay rollback necesario). |

---

## 7. RECOMENDACIONES ADICIONALES ENTERPRISE

### 7.1 — Token revocation layer

**El diseño propuesto carece de un mecanismo de revocación inmediata de tokens.**

Para enterprise-grade:
- Agregar tabla `TokenRevocation(userId, revokedAt, reason)`
- En cada request autenticado, verificar: si existe `TokenRevocation WHERE userId = jwt.sub AND revokedAt > jwt.iat` → forzar re-login
- Esto cubre: desactivación de usuario, revocación de acceso a institución, cambio de contraseña
- La query es por PK (`userId`) + índice en `revokedAt` → ~1ms
- Cache este check con TTL de 10 segundos para no agregar latencia a cada request

### 7.2 — Audit trail de cambios de rol

Cada cambio en `InstitutionUserRole` debe generar un registro de auditoría:
- Quién asignó/revocó el rol
- En qué institución
- Cuándo
- Desde qué IP

La tabla `PermissionAuditLog` ya existe en el schema y soporta esto (tiene `ROLE_ASSIGN`, `ROLE_REMOVE` como actions). Solo falta usarla consistentemente.

### 7.3 — Rate limiting por tenant

Actualmente hay throttle global (`@Throttle`). Para multi-tenant enterprise:
- Rate limit por `institutionId` (no solo por IP)
- Previene que una institución consuma recursos que afecten a otras
- Especialmente crítico para endpoints pesados (reportes, exports Excel/PDF)

### 7.4 — Row-Level Security (RLS) en PostgreSQL

El diseño propuesto opera a nivel de aplicación (Guards + WHERE clauses). Para defensa en profundidad real:
- Activar RLS en PostgreSQL para tablas sensibles
- Policies que filtren por `institutionId` basado en `current_setting('app.institution_id')`
- Establecer la variable de sesión en el middleware de Prisma
- Esto garantiza aislamiento INCLUSO si un bug en la aplicación omite el WHERE clause

**Evaluación:** RLS es la diferencia entre 8.9 y 9.5+. Es costoso de implementar pero es el estándar gold para multi-tenancy.

### 7.5 — Jerarquía de roles al registrar usuarios

El riesgo 5 original (ADMIN_INSTITUTIONAL puede crear SUPERADMIN) requiere una validación de jerarquía:

```
SUPERADMIN > ADMIN_INSTITUTIONAL > RECTOR > COORDINADOR > DOCENTE > ESTUDIANTE > ACUDIENTE
```

Regla: Un usuario solo puede asignar roles ≤ su propio nivel. Un ADMIN_INSTITUTIONAL no puede crear otro ADMIN_INSTITUTIONAL ni un SUPERADMIN.

Esto no fue detallado en el diseño propuesto. Debe incluirse en la Fase 2 (refactor del login/register).

### 7.6 — Tratamiento del SuperAdmin sin institución

El diseño propone que SuperAdmin puede tener JWT sin `institutionId`. Esto crea dos categorías de tokens:

| Tipo | institutionId | Acceso |
|------|--------------|--------|
| Token con tenant | Presente | Solo datos de ese tenant |
| Token sin tenant (SuperAdmin) | Null | ¿Acceso global? ¿Sin acceso a datos? |

**Problema:** Un SuperAdmin con token sin tenant que llama a `GET /reports/subject-averages` obtendría `institutionId = null` → query sin filtro → **todos los datos de todas las instituciones mezclados**.

**Recomendación:** SuperAdmin SIEMPRE debe operar con un tenant activo. El token sin tenant solo debe permitir:
- `GET /auth/me` (perfil propio)
- `GET /institutions` (listar instituciones administrables)
- `POST /auth/switch-institution` (seleccionar tenant)

Todos los demás endpoints deben requerir `institutionId` presente, incluso para SuperAdmin. El SuperAdmin elige su tenant de trabajo activo, exactamente igual que cualquier otro usuario multi-institución.

---

## 8. SCORE FINAL REALISTA

### 8.1 — Score ajustado del diseño propuesto

| Aspecto | Score original | Score ajustado | Razón del ajuste |
|---------|---------------|---------------|-----------------|
| Aislamiento de roles por tenant | 9 | **9** | InstitutionUserRole resuelve correctamente |
| Validación de tenant en Guards | 9 | **7.5** | TenantGuard propuesto no cubre SSE, no cubre recursos sin institutionId explícito. Diseño del guard necesita Opción D (híbrido). |
| JWT correctness | 9 | **8.5** | Falta `jti` para revocación. Falta TTL escalonado por rol. |
| Multi-institución | 9 | **8.5** | Switch-institution no invalida token anterior. Sin full state cleanup en frontend. |
| SuperAdmin detection | 10 | **9** | Resuelto en JWT. Pero SuperAdmin sin tenant activo puede causar data leak en 50+ controllers. |
| Escalación de privilegios | 9 | **8** | No hay jerarquía de roles en register. Falta validación de nivel al asignar. |
| Permisos granulares | 8 | **8** | UserExtraPermission con institutionId: correcto. |
| Resistencia a ataques | 8 | **7** | Sin token revocation. Sin RLS. Cache staleness de 60s en revocaciones. Live Session sin tenant isolation. |

### 8.2 — Score final

**Diseño propuesto TAL COMO ESTÁ: 8.2 / 10**

(vs 8.9 de la autoevaluación original — diferencia de 0.7 puntos)

**Razones de la reducción:**
1. **-0.3** por Live Session sin tenant isolation (ataque concreto posible)
2. **-0.2** por ventana de vulnerabilidad entre Release 2 y 3
3. **-0.1** por SuperAdmin sin tenant puede causar data leak en Patrón B controllers
4. **-0.1** por ausencia de token revocation para revocaciones críticas

### 8.3 — Qué falta para llegar a 9.5+

| Mejora | Incremento estimado | Complejidad |
|--------|-------------------|-------------|
| **Combinar Release 2+3** (eliminar ventana) | +0.2 | Baja |
| **Live Session tenant isolation** (agregar institutionId check) | +0.3 | Media |
| **Token revocation layer** (tabla + check por request) | +0.2 | Media |
| **SuperAdmin forzar tenant activo** (eliminar JWT sin institutionId) | +0.1 | Baja |
| **Jerarquía de roles en register** | +0.1 | Baja |
| **`jti` claim + TTL escalonado** | +0.1 | Baja |
| Subtotal parcial | **9.2** | — |
| **Row-Level Security (RLS) en PostgreSQL** | +0.3 | Alta |
| **Total con RLS** | **9.5** | — |

### 8.4 — Roadmap hacia 9.5

```
Fase inmediata (junto con Release 2+3 combinado):
  ✓ InstitutionUserRole
  ✓ JWT enriched con jti + isSuperAdmin + TTL escalonado
  ✓ TenantGuard global (Opción D: híbrido)
  ✓ SuperAdmin siempre con tenant activo
  ✓ Jerarquía de roles en register
  ✓ Live Session: agregar institutionId check
  → Score: 9.2

Fase siguiente (1-2 sprints después):
  ✓ Token revocation layer
  ✓ Audit trail completo de cambios de rol
  ✓ Rate limiting por tenant
  → Score: 9.3

Fase avanzada (cuando escale a 100+ instituciones):
  ✓ Row-Level Security en PostgreSQL
  ✓ Refresh token rotation
  ✓ Security headers hardening (CSP, HSTS)
  → Score: 9.5+
```

---

## CONCLUSIÓN DEL AUDITOR

El diseño propuesto es **arquitectónicamente sólido** y resuelve los 6 riesgos críticos identificados. La estructura de `InstitutionUserRole`, el JWT enriched con roles filtrados por tenant, y el TenantGuard global son las decisiones correctas.

**Sin embargo, la propuesta sobreestimó su score final en 0.7 puntos** debido a:
1. No contemplar el módulo Live Session (sin tenant isolation)
2. No anticipar la ventana de vulnerabilidad entre Release 2 y 3
3. No resolver el caso de SuperAdmin sin tenant activo en los 50+ controllers de Patrón B
4. No incluir un mecanismo de revocación inmediata de tokens

**Las correcciones necesarias son relativamente simples** (combinar releases, forzar tenant en SuperAdmin, proteger Live Session) y no alteran la arquitectura fundamental del diseño.

**Score final ajustado: 8.2/10** (actual: 3.0/10) — incremento de **+5.2 puntos**, con camino claro a 9.5+ mediante RLS y token revocation.

---

*Auditoría independiente de validación. No se generó, modificó, ni refactorizó código.*
