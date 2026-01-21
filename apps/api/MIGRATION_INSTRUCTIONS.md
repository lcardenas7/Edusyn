# Instrucciones de Migración - Multi-tenant

## Cambios en el Schema

Se han agregado los siguientes cambios al schema de Prisma para soportar multi-tenant:

### Nuevos Enums
- `InstitutionStatus`: ACTIVE, SUSPENDED, TRIAL, INACTIVE
- `SystemModule`: ACADEMIC, ATTENDANCE, EVALUATION, RECOVERY, REPORTS, COMMUNICATIONS, OBSERVER, PERFORMANCE, MEN_REPORTS, DASHBOARD

### Cambios en User
- `isSuperAdmin`: Boolean (flag para SuperAdmin del sistema)
- `institutionUsers`: Relación con InstitutionUser
- `institutionsCreated`: Instituciones creadas por este SuperAdmin

### Cambios en Institution
- `slug`: String único (URL amigable para login)
- `logo`: String opcional (URL del logo)
- `status`: InstitutionStatus (estado de la institución)
- `trialEndsAt`: DateTime opcional (fin del período de prueba)
- `createdById`: String opcional (SuperAdmin que creó la institución)
- `modules`: Relación con InstitutionModule
- `users`: Relación con InstitutionUser

### Nuevos Modelos
- `InstitutionModule`: Módulos habilitados por institución
- `InstitutionUser`: Relación Usuario-Institución (multi-tenant)

## Ejecutar Migración

```bash
cd apps/api

# 1. Generar migración
npx prisma migrate dev --name add_multitenant_support

# 2. Regenerar cliente de Prisma
npx prisma generate
```

## Crear SuperAdmin Inicial

Después de la migración, ejecuta este SQL para crear el primer SuperAdmin:

```sql
-- Actualizar un usuario existente como SuperAdmin
UPDATE "User" SET "isSuperAdmin" = true WHERE email = 'superadmin@edusyn.co';

-- O crear uno nuevo (reemplaza el hash con uno válido)
INSERT INTO "User" (id, email, "passwordHash", "firstName", "lastName", "isSuperAdmin", "createdAt", "updatedAt")
VALUES (
  'superadmin-001',
  'superadmin@edusyn.co',
  '$2a$10$...', -- Hash de la contraseña
  'Super',
  'Admin',
  true,
  NOW(),
  NOW()
);
```

## Flujo de Login Multi-tenant

1. Usuario accede a `/login` o `/login/{slug}`
2. Ingresa código de institución (slug)
3. Sistema verifica que la institución existe y está activa
4. Usuario ingresa credenciales
5. Login vinculado a esa institución

## Rutas

- `/login` - Login por institución (multi-tenant)
- `/login/:slug` - Login directo a una institución
- `/superadmin` - Dashboard de SuperAdmin
- `/superadmin/login` - Login de SuperAdmin
