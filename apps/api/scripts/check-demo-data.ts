import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  const inst = await p.institution.findFirst({
    where: { slug: 'colegio-demo-excelencia-academica' },
    select: { id: true, name: true },
  });
  if (!inst) { console.log('NO EXISTE'); return; }
  console.log('INST:', inst.id, inst.name);

  const comps = await p.evaluationComponent.findMany({
    where: { institutionId: inst.id, parentId: null },
    select: { id: true, code: true, name: true },
  });
  console.log('COMPONENTS:', JSON.stringify(comps));

  const plans = await p.evaluationPlan.count({
    where: { teacherAssignment: { institutionId: inst.id } },
  });
  console.log('EVAL_PLANS:', plans);

  const partials = await p.partialGrade.count({
    where: { institutionId: inst.id },
  });
  console.log('PARTIAL_GRADES:', partials);

  const pfg = await p.periodFinalGrade.count({
    where: { institutionId: inst.id },
  });
  console.log('PERIOD_FINAL_GRADES:', pfg);

  const terms = await p.academicTerm.findMany({
    where: { academicYear: { institutionId: inst.id, status: 'ACTIVE' } },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, status: true },
  });
  console.log('TERMS:', JSON.stringify(terms));

  const tas = await p.teacherAssignment.count({
    where: { institutionId: inst.id },
  });
  console.log('TEACHER_ASSIGNMENTS:', tas);

  const enrollments = await p.studentEnrollment.count({
    where: { academicYear: { institutionId: inst.id, status: 'ACTIVE' }, status: 'ACTIVE' },
  });
  console.log('ENROLLMENTS:', enrollments);
}

main().catch(console.error).finally(() => p.$disconnect());
