import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'sarith@gmail.com';
  const newPassword = 'Sarith2026!';
  
  // Buscar usuario
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, username: true, firstName: true, lastName: true }
  });
  
  if (!user) {
    console.log('Usuario no encontrado');
    return;
  }
  
  console.log('Usuario encontrado:');
  console.log('  ID:', user.id);
  console.log('  Email:', user.email);
  console.log('  Username:', user.username);
  console.log('  Nombre:', user.firstName, user.lastName);
  
  // Hashear nueva contraseña
  const passwordHash = await bcrypt.hash(newPassword, 10);
  
  // Actualizar contraseña
  await prisma.user.update({
    where: { id: user.id },
    data: { 
      passwordHash,
      mustChangePassword: false 
    }
  });
  
  console.log('\n✅ Contraseña actualizada exitosamente');
  console.log('\n=== CREDENCIALES ===');
  console.log('Usuario:', user.username);
  console.log('Contraseña:', newPassword);
  console.log('====================');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
