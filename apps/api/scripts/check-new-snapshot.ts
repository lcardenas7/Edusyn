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
    where: { academicYearId: ay!.id, status: 'FINALIZED' },
    select: { id: true, name: true },
  });
  console.log('TERM:', p1!.name);

  const snap = await p.termReportCardSnapshot.findFirst({
    where: { academicTermId: p1!.id },
    orderBy: { version: 'desc' },
  });

  if (snap) {
    const data = snap.data as any;
    console.log('\nSNAPSHOT KEYS:', Object.keys(data));
    console.log('areaGrades count:', data.areaGrades?.length ?? 'N/A');
    console.log('subjectGrades count:', data.subjectGrades?.length ?? 'N/A');
    
    if (data.areaGrades?.length > 0) {
      const firstArea = data.areaGrades[0];
      console.log('\nFirst area:', firstArea.area);
      console.log('  - subjects count:', firstArea.subjects?.length);
      if (firstArea.subjects?.length > 0) {
        const firstSubject = firstArea.subjects[0];
        console.log('  - first subject:', firstSubject.subject);
        console.log('  - grade:', firstSubject.grade);
        console.log('  - teacher:', firstSubject.teacher);
      }
    }
  }
}

main().catch(console.error).finally(() => p.$disconnect());
