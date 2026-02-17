import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const institutions = await prisma.institution.findMany({
    select: { id: true, name: true },
  });
  console.log('Instituciones:');
  institutions.forEach(i => console.log(`  - ${i.name} (${i.id})`));
}

main().finally(() => prisma.$disconnect());
