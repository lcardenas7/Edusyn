import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const configs = await prisma.gradingPeriodConfig.findMany({
    include: {
      academicTerm: true
    }
  });

  console.log('Grading Period Configurations:');
  configs.forEach(c => {
    console.log(`\n${c.academicTerm.name}:`);
    console.log(`  isOpen: ${c.isOpen}`);
    console.log(`  openDate: ${c.openDate}`);
    console.log(`  closeDate: ${c.closeDate}`);
    console.log(`  allowLateEntry: ${c.allowLateEntry}`);
    console.log(`  lateEntryDays: ${c.lateEntryDays}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
