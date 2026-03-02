const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const grades = await p.grade.findMany();
  console.log('Grades in DB:', grades.length);
  console.log(JSON.stringify(grades, null, 2));
  await p.$disconnect();
}

main().catch(console.error);
