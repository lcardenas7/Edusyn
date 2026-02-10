/**
 * Script seguro: Renombrar grado "Once" a "Undécimo"
 * NO borra datos, solo hace UPDATE del nombre.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const grade = await prisma.grade.findFirst({
    where: { name: 'Once' },
  });

  if (!grade) {
    console.log('⚠️  No se encontró grado "Once". Puede que ya se haya renombrado.');
    await prisma.$disconnect();
    return;
  }

  console.log(`Encontrado: "${grade.name}" (id: ${grade.id}, number: ${grade.number})`);

  await prisma.grade.update({
    where: { id: grade.id },
    data: { name: 'Undécimo' },
  });

  console.log('✅ Renombrado: "Once" → "Undécimo"');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
