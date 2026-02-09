import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const search = process.argv[2] || 'cardenas';
  
  console.log(`\nBuscando usuarios con "${search}"...\n`);
  
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      documentNumber: true,
      isActive: true,
      mustChangePassword: true,
    },
  });

  if (users.length === 0) {
    console.log('No se encontraron usuarios.');
  } else {
    console.log(`Encontrados ${users.length} usuarios:\n`);
    users.forEach(u => {
      console.log(`  ID: ${u.id}`);
      console.log(`  Username: ${u.username}`);
      console.log(`  Email: ${u.email}`);
      console.log(`  Nombre: ${u.firstName} ${u.lastName}`);
      console.log(`  Documento: ${u.documentNumber || '(sin doc)'}`);
      console.log(`  Activo: ${u.isActive} | MustChange: ${u.mustChangePassword}`);
      console.log('  ---');
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
