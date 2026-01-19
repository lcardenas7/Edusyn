// Test script to verify grading-period-config API
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Verificar si existe la tabla GradingPeriodConfig
  try {
    const count = await prisma.gradingPeriodConfig.count();
    console.log('GradingPeriodConfig count:', count);
  } catch (err: any) {
    console.error('Error accessing GradingPeriodConfig:', err.message);
  }

  // Verificar períodos académicos
  const terms = await prisma.academicTerm.findMany({
    take: 5,
    orderBy: { order: 'asc' }
  });
  console.log('\nAcademic Terms:');
  terms.forEach(t => console.log(`  - ${t.name} (ID: ${t.id})`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
