import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Listar todos los usuarios y su estado de isSuperAdmin
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isSuperAdmin: true,
      roles: {
        include: { role: true }
      }
    }
  });

  console.log('\n=== USUARIOS EN EL SISTEMA ===\n');
  users.forEach(u => {
    const roles = u.roles.map(r => r.role.name).join(', ');
    console.log(`- ${u.email} | isSuperAdmin: ${u.isSuperAdmin} | Roles: ${roles}`);
  });

  // Buscar usuarios que deberían ser SuperAdmin (por email o rol)
  const superAdminCandidates = users.filter(u => 
    u.email.includes('superadmin') || 
    u.email.includes('admin@edusyn') ||
    u.roles.some(r => r.role.name === 'SUPER_ADMIN')
  );

  console.log('\n=== CANDIDATOS A SUPERADMIN ===\n');
  if (superAdminCandidates.length === 0) {
    console.log('No se encontraron candidatos a SuperAdmin');
  } else {
    superAdminCandidates.forEach(u => {
      console.log(`- ${u.email} (isSuperAdmin actualmente: ${u.isSuperAdmin})`);
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
