import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const groups = await prisma.group.findMany({
    include: {
      grade: true,
      campus: {
        include: {
          institution: true
        }
      }
    },
    orderBy: {
      grade: { number: 'asc' }
    }
  });

  console.log('Total grupos:', groups.length);
  
  const byInst: Record<string, string[]> = {};
  groups.forEach(g => {
    const inst = g.campus?.institution?.name || 'Sin institución';
    if (!byInst[inst]) byInst[inst] = [];
    byInst[inst].push(`${g.name} - ${g.grade?.name || 'Sin grado'}`);
  });
  
  console.log('\nGrupos por institución:');
  for (const [inst, grps] of Object.entries(byInst)) {
    console.log(`\n${inst} (${grps.length} grupos):`);
    grps.forEach(g => console.log(`  - ${g}`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
