const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Check teacher assignments
  const assignments = await p.teacherAssignment.findMany({
    take: 20,
    include: {
      group: { include: { grade: true } },
      subject: true,
    },
  });
  
  console.log('Teacher assignments (first 20):');
  assignments.forEach(a => {
    console.log(`  ${a.group?.grade?.name || '?'} ${a.group?.name || '?'} - ${a.subject?.name || '?'}`);
  });
  
  // Check if group names match
  const groups = await p.group.findMany({
    where: { name: { contains: '11' } },
    include: { grade: true },
  });
  console.log('\nGroups with "11" in name:');
  groups.forEach(g => {
    console.log(`  ${g.grade?.name || '?'} ${g.name} (id: ${g.id})`);
  });
  
  await p.$disconnect();
}

main().catch(console.error);
