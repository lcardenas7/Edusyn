import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const institutions = await prisma.institution.findMany({
    select: { id: true, name: true, slug: true },
  });
  console.log('Instituciones encontradas:');
  console.log(JSON.stringify(institutions, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
