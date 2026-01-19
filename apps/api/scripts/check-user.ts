import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Ver usuarios con sus asignaciones
  const users = await prisma.user.findMany({
    include: {
      roles: { include: { role: true } },
      teacherAssignments: {
        include: {
          group: {
            include: {
              campus: {
                include: { institution: true }
              }
            }
          }
        },
        take: 1
      }
    }
  });

  console.log('Usuarios:');
  users.forEach(u => {
    const roles = u.roles.map(r => r.role.name).join(', ');
    const institution = u.teacherAssignments[0]?.group?.campus?.institution;
    console.log(`  - ${u.firstName} ${u.lastName} (${u.email})`);
    console.log(`    Roles: ${roles}`);
    console.log(`    Institución: ${institution?.name || 'N/A'} (ID: ${institution?.id || 'N/A'})`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
