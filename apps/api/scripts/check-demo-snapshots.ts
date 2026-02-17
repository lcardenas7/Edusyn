import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const inst = await p.institution.findFirst({
    where: { slug: 'colegio-demo-excelencia-academica' },
    select: { id: true },
  });
  if (!inst) { console.log('NO EXISTE'); return; }

  const enrollments = await p.studentEnrollment.findMany({
    where: { academicYear: { institutionId: inst.id, status: 'ACTIVE' }, status: 'ACTIVE' },
    select: { id: true },
    take: 5,
  });

  console.log(`Checking ${enrollments.length} enrollments...`);

  for (const e of enrollments) {
    const areas = await p.enrollmentArea.count({ where: { enrollmentId: e.id } });
    const subjects = await p.enrollmentSubject.count({
      where: { enrollmentArea: { enrollmentId: e.id } },
    });
    console.log(`  ${e.id}: ${areas} areas, ${subjects} subjects`);
  }

  // Total counts
  const totalAreas = await p.enrollmentArea.count({
    where: { enrollment: { academicYear: { institutionId: inst.id } } },
  });
  const totalSubjects = await p.enrollmentSubject.count({
    where: { enrollmentArea: { enrollment: { academicYear: { institutionId: inst.id } } } },
  });
  console.log(`\nTOTAL: ${totalAreas} EnrollmentAreas, ${totalSubjects} EnrollmentSubjects`);
}

main().catch(console.error).finally(() => p.$disconnect());
