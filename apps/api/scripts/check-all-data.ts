import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== VERIFICACIÓN DE DATOS ===\n');

  // 1. Instituciones
  const institutions = await prisma.institution.findMany();
  console.log('INSTITUCIONES:', institutions.length);
  institutions.forEach(i => console.log(`  - ${i.name} (${i.id})`));

  // 2. Campus
  const campuses = await prisma.campus.findMany({ include: { institution: true } });
  console.log('\nCAMPUS:', campuses.length);
  campuses.forEach(c => console.log(`  - ${c.name} → ${c.institution?.name} (instId: ${c.institutionId})`));

  // 3. Grados
  const grades = await prisma.grade.findMany({ orderBy: { number: 'asc' } });
  console.log('\nGRADOS:', grades.length);
  grades.forEach(g => console.log(`  - ${g.name} (${g.stage}, number: ${g.number})`));

  // 4. Shifts
  const shifts = await prisma.shift.findMany();
  console.log('\nJORNADAS:', shifts.length);
  shifts.forEach(s => console.log(`  - ${s.name} (${s.type})`));

  // 5. Grupos
  const groups = await prisma.group.findMany({
    include: {
      grade: true,
      shift: true,
      campus: { include: { institution: true } }
    }
  });
  console.log('\nGRUPOS:', groups.length);
  groups.forEach(g => console.log(`  - ${g.name} - ${g.grade?.name} (${g.shift?.name}) → ${g.campus?.institution?.name}`));

  // 6. InstitutionUsers
  const instUsers = await prisma.institutionUser.findMany({
    include: { user: true, institution: true }
  });
  console.log('\nUSUARIOS POR INSTITUCIÓN:', instUsers.length);
  instUsers.forEach(iu => console.log(`  - ${iu.user?.firstName} ${iu.user?.lastName} → ${iu.institution?.name} (instId: ${iu.institutionId})`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
