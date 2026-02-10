import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const grades = await prisma.grade.findMany({
    include: {
      groups: {
        include: { campus: true },
        orderBy: { name: 'asc' },
      },
    },
    orderBy: [{ stage: 'asc' }, { number: 'asc' }],
  });

  console.log('\n=== GRADOS Y GRUPOS ===\n');
  for (const grade of grades) {
    const groupNames = grade.groups.map(g => `"${g.name}" (campus: ${g.campus?.institutionId})`).join(', ');
    console.log(`[${grade.stage}] ${grade.name} (number: ${grade.number ?? 'NULL'}) → ${grade.groups.length} grupos: ${groupNames || 'NINGUNO'}`);
  }

  // Verificar si existe Undécimo
  const undecimo = grades.find(g => g.number === 11 || g.name.toLowerCase().includes('undecimo') || g.name.toLowerCase().includes('undécimo') || g.name.toLowerCase().includes('once'));
  if (!undecimo) {
    console.log('\n⚠️  NO existe grado "Undécimo" (11) en el sistema');
  }

  // Verificar grupos con nombres combinados (posibles errores de datos)
  console.log('\n=== GRUPOS CON NOMBRE > 2 CHARS (posible nombre combinado) ===\n');
  for (const grade of grades) {
    for (const group of grade.groups) {
      if (group.name.length > 2) {
        console.log(`⚠️  Grade "${grade.name}" (${grade.number}) → Group "${group.name}" — posible nombre combinado`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
