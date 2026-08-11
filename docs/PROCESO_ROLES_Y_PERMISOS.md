# Proceso de Roles y Permisos (Institución)

> Fuente de verdad operativa para promover personal: **Docente → Coordinador → Administrador**.
> Basado en el código real: `apps/api/src/modules/iam/users.controller.ts`,
> `apps/api/src/modules/permissions/permissions.service.ts`,
> `apps/api/src/modules/auth/guards/roles.guard.ts`.

## Concepto clave (leer una sola vez)

En Edusyn conviven **dos** sistemas de control de acceso:

1. **Guard de roles** (`@Roles(...)`): mira SOLO el **nombre del rol**. Ignora los permisos granulares.
   Solo lo salta `isSuperAdmin`.
2. **Permisos granulares** (`userCan()`): permisos finos por usuario (extra/otorgados).
   El rol `ADMIN_INSTITUTIONAL` hace corto circuito → devuelve "sí" a todo.

**Consecuencia:** otorgar permisos sueltos a un coordinador **NO** lo iguala al admin,
porque muchos endpoints se protegen por *nombre de rol*. La única forma de darle
"lo mismo que el admin" es **otorgarle el rol `ADMIN_INSTITUTIONAL`**.

## Qué da cada rol

| Rol | Cómo se obtiene | Alcance |
|---|---|---|
| `DOCENTE` | Al crear el docente | Solo sus grupos (notas/observador/asistencia propios) |
| `COORDINADOR` | Editar staff → cambiar rol | Supervisión académica de toda la institución; **no** puede borrar áreas/asignaturas |
| `ADMIN_INSTITUTIONAL` | "Otorgar admin" (aditivo) | Acceso total dentro de la institución |
| `SUPERADMIN` (`isSuperAdmin`) | Cuenta global (Edusyn) | Todo, en todas las instituciones |

## Proceso A — Docente → Coordinador (con sus permisos)

Endpoint: `PUT /iam/staff/:id` (UI: **Gestión de Personal → editar usuario → Rol**).

1. Inicia sesión como **Administrador** o **Coordinador** de la institución.
2. Ve a **Gestión de Personal**, busca al docente y ábrelo para editar.
3. Cambia el **Rol** a **Coordinador** y guarda.
4. Resultado: queda **Docente + Coordinador** (el rol Docente se conserva).
   Los permisos base de Coordinador se aplican **automáticamente** y se abren todos
   los endpoints protegidos con `@Roles('...COORDINADOR...')`.

> Nota: cambiar el rol **reemplaza** otros roles de staff (Secretaria, Orientador, etc.),
> pero **nunca** toca Docente ni Estudiante.

## Proceso B — Coordinador (o Docente) → Administrador

Endpoint: `POST /iam/users/:id/grant-admin` (UI: **Gestión de Personal → "Administradores de la institución" → Otorgar admin**).

1. Inicia sesión con una cuenta que **ya sea `ADMIN_INSTITUTIONAL`** de esa institución.
2. Ve a la tarjeta **"Administradores de la institución"** (ícono de escudo rojo).
3. En **"Otorgar admin"**, elige al candidato (aparecen coordinadores y docentes que aún no son admin).
4. Clic en **"Otorgar admin"**.
5. Resultado: es **aditivo** → conserva su rol base (Coordinador/Docente) **y** gana acceso total.

## Proceso C — Revocar Administrador

Endpoint: `POST /iam/users/:id/revoke-admin`.

Protecciones automáticas:
- **No** puedes quitártelo a ti mismo.
- **No** puede quedar la institución con **cero** administradores.

> Por eso: mantén **al menos 2 administradores** para poder rotar sin quedar bloqueado.

## Reglas de quién puede hacer qué

| Acción | Quién puede |
|---|---|
| Docente → Coordinador (editar staff) | Administrador o Coordinador |
| Otorgar / revocar Administrador | Solo Administrador (o Superadmin*) |
| Crear área / asignatura | Admin, Coordinador |
| **Borrar** área / asignatura | Solo Admin (Coordinador NO) |

\* Ver "Puntos a blindar".

## Puntos a blindar (riesgos conocidos)

1. **El Superadmin global ya puede usar "Otorgar admin"** (RESUELTO).
   Los endpoints `getAdmins` / `grant-admin` / `revoke-admin` ahora resuelven la
   institución con `resolveInstitutionId(...)`:
   - **Admin institucional:** usa SIEMPRE su propia institución (ignora el parámetro por seguridad).
   - **Superadmin global:** puede pasar `?institutionId=<id>` para administrar cualquier institución.
   Cliente web: `staffApi.getAdmins(institutionId?)`, `grantAdmin(userId, institutionId?)`,
   `revokeAdmin(userId, institutionId?)` (el `institutionId` es opcional).

2. **Bootstrap del primer admin.**
   `grant-admin` exige rol `ADMIN_INSTITUTIONAL`. Si una institución nueva **no** tiene
   ningún admin todavía, nadie (salvo scripts de seed/creación) puede crear el primero
   desde esta pantalla. → Asegurar que toda institución nace con **≥1 admin** (el rector).

3. **Verificación recomendada al crear institución:**
   - ¿Existe al menos un `ADMIN_INSTITUTIONAL` asignado? ¿Quién es?
   - ¿Hay ≥2 admins para respaldo?
