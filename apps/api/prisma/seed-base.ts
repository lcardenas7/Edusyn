/**
 * SEED BASE — Infraestructura del Sistema
 * 
 * Se ejecuta 1 sola vez en producción.
 * Crea:
 * - SuperAdmin
 * - Roles globales
 * - Permisos del sistema
 * 
 * Uso:
 *   npx ts-node prisma/seed-base.ts
 *   railway run npx ts-node prisma/seed-base.ts
 * 
 * Es IDEMPOTENTE (usa upsert).
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN
// ═══════════════════════════════════════════════════════════════════════════

const SUPERADMIN_EMAIL = 'superadmin@edusyn.co';
const SUPERADMIN_PASSWORD = 'Super2026!'; // Cambiar en producción real

// ═══════════════════════════════════════════════════════════════════════════
// ROLES DEL SISTEMA
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM_ROLES = [
  'SUPERADMIN',
  'ADMIN_INSTITUTIONAL',
  'COORDINADOR',
  'DOCENTE',
  'ESTUDIANTE',
  'ACUDIENTE',
  'SECRETARIA',
  'RECTOR',
];

// ═══════════════════════════════════════════════════════════════════════════
// PERMISOS DEL SISTEMA
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM_PERMISSIONS = [
  // Gestión de usuarios
  { code: 'IAM_USERS_VIEW', module: 'IAM', function: 'USERS', subFunction: 'VIEW', name: 'Ver usuarios' },
  { code: 'IAM_USERS_CREATE', module: 'IAM', function: 'USERS', subFunction: 'CREATE', name: 'Crear usuarios' },
  { code: 'IAM_USERS_EDIT', module: 'IAM', function: 'USERS', subFunction: 'EDIT', name: 'Editar usuarios' },
  { code: 'IAM_USERS_DELETE', module: 'IAM', function: 'USERS', subFunction: 'DELETE', name: 'Eliminar usuarios' },
  
  // Gestión académica
  { code: 'ACADEMIC_VIEW', module: 'ACADEMIC', function: 'ACADEMIC', subFunction: 'VIEW', name: 'Ver información académica' },
  { code: 'ACADEMIC_MANAGE', module: 'ACADEMIC', function: 'ACADEMIC', subFunction: 'MANAGE', name: 'Gestionar año académico' },
  { code: 'GRADES_VIEW', module: 'GRADES', function: 'GRADES', subFunction: 'VIEW', name: 'Ver calificaciones' },
  { code: 'GRADES_EDIT', module: 'GRADES', function: 'GRADES', subFunction: 'EDIT', name: 'Editar calificaciones' },
  
  // Reportes
  { code: 'REPORTS_VIEW', module: 'REPORTS', function: 'REPORTS', subFunction: 'VIEW', name: 'Ver reportes' },
  { code: 'REPORTS_EXPORT', module: 'REPORTS', function: 'REPORTS', subFunction: 'EXPORT', name: 'Exportar reportes' },
  
  // Configuración institucional
  { code: 'CONFIG_INSTITUTION', module: 'CONFIG', function: 'INSTITUTION', subFunction: 'MANAGE', name: 'Configurar institución' },
  { code: 'CONFIG_MODULES', module: 'CONFIG', function: 'MODULES', subFunction: 'MANAGE', name: 'Gestionar módulos' },
  
  // SuperAdmin
  { code: 'SUPERADMIN_ACCESS', module: 'SYSTEM', function: 'SUPERADMIN', subFunction: 'ACCESS', name: 'Acceso SuperAdmin' },
  { code: 'SUPERADMIN_INSTITUTIONS', module: 'SYSTEM', function: 'SUPERADMIN', subFunction: 'INSTITUTIONS', name: 'Gestionar instituciones' },
];

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES DE SEED
// ═══════════════════════════════════════════════════════════════════════════

async function seedRoles() {
  console.log('🔧 Creando roles del sistema...');
  
  for (const roleName of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }
  
  console.log(`   ✅ ${SYSTEM_ROLES.length} roles creados/actualizados`);
}

async function seedPermissions() {
  console.log('🔧 Creando permisos del sistema...');
  
  for (const perm of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module, function: perm.function, subFunction: perm.subFunction },
      create: {
        code: perm.code,
        name: perm.name,
        module: perm.module,
        function: perm.function,
        subFunction: perm.subFunction,
      },
    });
  }
  
  console.log(`   ✅ ${SYSTEM_PERMISSIONS.length} permisos creados/actualizados`);
}

async function seedSuperAdmin() {
  console.log('🔧 Creando SuperAdmin...');
  
  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);
  
  const superadmin = await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: {
      passwordHash,
      isActive: true,
      isSuperAdmin: true,
    },
    create: {
      email: SUPERADMIN_EMAIL,
      username: 'superadmin',
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
      isSuperAdmin: true,
    },
  });
  
  // Asignar rol SUPERADMIN
  const superadminRole = await prisma.role.findUnique({
    where: { name: 'SUPERADMIN' },
  });
  
  if (superadminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: superadmin.id,
          roleId: superadminRole.id,
        },
      },
      update: {},
      create: {
        userId: superadmin.id,
        roleId: superadminRole.id,
      },
    });
  }
  
  console.log(`   ✅ SuperAdmin creado: ${SUPERADMIN_EMAIL}`);
  console.log(`   🔑 Contraseña: ${SUPERADMIN_PASSWORD}`);
}

async function assignRolePermissions() {
  console.log('🔧 Asignando permisos a roles...');
  
  const allPermissions = await prisma.permission.findMany();
  
  // Definir qué permisos tiene cada rol
  const rolePermissionMap: Record<string, string[]> = {
    'SUPERADMIN': allPermissions.map(p => p.code), // Todos
    'ADMIN_INSTITUTIONAL': allPermissions.filter(p => !p.code.startsWith('SUPERADMIN')).map(p => p.code),
    'COORDINADOR': ['ACADEMIC_VIEW', 'ACADEMIC_MANAGE', 'GRADES_VIEW', 'GRADES_EDIT', 'REPORTS_VIEW', 'REPORTS_EXPORT', 'IAM_USERS_VIEW'],
    'DOCENTE': ['ACADEMIC_VIEW', 'GRADES_VIEW', 'GRADES_EDIT'],
  };
  
  for (const [roleName, permCodes] of Object.entries(rolePermissionMap)) {
    for (const code of permCodes) {
      const perm = allPermissions.find(p => p.code === code);
      if (!perm) continue;
      
      // Usar RoleBasePermission en lugar de RolePermission
      const existing = await prisma.roleBasePermission.findFirst({
        where: { role: roleName, permissionId: perm.id },
      });
      
      if (!existing) {
        await prisma.roleBasePermission.create({
          data: {
            role: roleName,
            permissionId: perm.id,
          },
        });
      }
    }
  }
  
  console.log('   ✅ Permisos asignados a roles');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SEED BASE — Infraestructura del Sistema');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  await seedRoles();
  await seedPermissions();
  await seedSuperAdmin();
  await assignRolePermissions();
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  ✅ SEED BASE COMPLETADO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('  📧 SuperAdmin: superadmin@edusyn.co');
  console.log('  🔑 Contraseña: Super2026!');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed base:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
