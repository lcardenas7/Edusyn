import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const inst = await p.institution.findFirst({
    where: { slug: 'colegio-demo-excelencia-academica' },
    select: { id: true },
  });
  if (!inst) { console.log('NO EXISTE'); return; }

  const ay = await p.academicYear.findFirst({
    where: { institutionId: inst.id, status: 'ACTIVE' },
    select: { id: true },
  });

  const p1 = await p.academicTerm.findFirst({
    where: { academicYearId: ay!.id },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, status: true },
  });
  console.log('TERM:', p1!.name, p1!.status);

  const snapCount = await p.termReportCardSnapshot.count({
    where: { academicTermId: p1!.id },
  });
  console.log('SNAPSHOTS:', snapCount);

  // Ver un snapshot de ejemplo
  const sample = await p.termReportCardSnapshot.findFirst({
    where: { academicTermId: p1!.id },
  });
  if (sample) {
    const data = sample.data as any;
    console.log('\nSAMPLE SNAPSHOT KEYS:', Object.keys(data));
    console.log('areaGrades count:', data.areaGrades?.length ?? 'N/A');
    console.log('subjectGrades count:', data.subjectGrades?.length ?? 'N/A');
    if (data.subjectGrades?.length > 0) {
      console.log('First subject:', JSON.stringify(data.subjectGrades[0]));
    }
    if (data.areaGrades?.length > 0) {
      const firstArea = data.areaGrades[0];
      console.log('First area:', firstArea.area, '- subjects:', firstArea.subjects?.length);
      if (firstArea.subjects?.length > 0) {
        console.log('First area subject:', JSON.stringify(firstArea.subjects[0]));
      }
    }
  }
}

main().catch(console.error).finally(() => p.$disconnect());
