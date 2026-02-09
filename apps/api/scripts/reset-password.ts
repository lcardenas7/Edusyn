import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const identifier = process.argv[2] || 'lcardenas0000d';
  const newPassword = process.argv[3] || 'temporal123';

  console.log(`\nBuscando usuario: "${identifier}"...`);

  // Buscar por username, email o documento
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: identifier },
        { email: identifier },
        { documentNumber: identifier },
      ],
    },
    select: {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      documentNumber: true,
      isActive: true,
      passwordHash: true,
      mustChangePassword: true,
      roles: { include: { role: true } },
    },
  });

  if (!user) {
    console.log('❌ Usuario NO encontrado con ese identificador.');
    console.log('\nBuscando usuarios similares...');
    const similar = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: identifier.substring(0, 5) } },
          { email: { contains: identifier.substring(0, 5) } },
        ],
      },
      select: { id: true, username: true, email: true, firstName: true, lastName: true, isActive: true },
      take: 10,
    });
    if (similar.length > 0) {
      console.log('Usuarios similares:');
      similar.forEach(u => {
        console.log(`  - username: ${u.username} | email: ${u.email} | ${u.firstName} ${u.lastName} | activo: ${u.isActive}`);
      });
    } else {
      console.log('No se encontraron usuarios similares.');
    }
    return;
  }

  const roles = user.roles.map(r => r.role.name).join(', ');
  console.log('\n✅ Usuario encontrado:');
  console.log(`  ID:        ${user.id}`);
  console.log(`  Username:  ${user.username}`);
  console.log(`  Email:     ${user.email}`);
  console.log(`  Nombre:    ${user.firstName} ${user.lastName}`);
  console.log(`  Documento: ${user.documentNumber || '(sin documento)'}`);
  console.log(`  Roles:     ${roles}`);
  console.log(`  Activo:    ${user.isActive}`);
  console.log(`  MustChange: ${user.mustChangePassword}`);

  // Verificar si la contraseña actual funciona
  const currentPasswordWorks = await bcrypt.compare(newPassword, user.passwordHash);
  if (currentPasswordWorks) {
    console.log(`\n⚠️  La contraseña "${newPassword}" YA es correcta para este usuario.`);
    console.log('El problema puede ser otro (usuario inactivo, institución incorrecta, etc.)');
    return;
  }

  // Resetear contraseña
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  console.log(`\n✅ Contraseña reseteada exitosamente`);
  console.log(`\n=== CREDENCIALES ===`);
  console.log(`Username:    ${user.username}`);
  console.log(`Email:       ${user.email}`);
  console.log(`Contraseña:  ${newPassword}`);
  console.log(`====================`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
