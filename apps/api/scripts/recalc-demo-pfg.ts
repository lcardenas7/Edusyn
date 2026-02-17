/**
 * Recalcula PeriodFinalGrade desde PartialGrade + EvaluationPlan
 * para la institución demo. Así consolidados y calificaciones coinciden.
 *
 * OPTIMIZADO: Calcula todo en memoria, luego hace UPDATEs en batch SQL.
 * ~6 queries totales en vez de ~13000.
 *
 * SOLO afecta la institución demo.
 *
 * Uso:
 *   $env:DATABASE_URL="<public_url>"; npx ts-node --project scripts/tsconfig.seed.json scripts/recalc-demo-pfg.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_SLUG = 'colegio-demo-excelencia-academica';
const BATCH_SIZE = 200;

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

async function main() {
  console.log('🔍 Buscando institución demo...');
  const institution = await prisma.institution.findFirst({
    where: { slug: DEMO_SLUG },
    select: { id: true, name: true },
  });
  if (!institution) { console.error('❌ No encontrada.'); process.exit(1); }
  console.log(`✅ ${institution.name} (${institution.id})`);

  const academicYear = await prisma.academicYear.findFirst({
    where: { institutionId: institution.id, status: 'ACTIVE' },
    select: { id: true, name: true },
  });
  if (!academicYear) { console.error('❌ No hay año activo.'); process.exit(1); }

  const terms = await prisma.academicTerm.findMany({
    where: { academicYearId: academicYear.id },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, status: true },
  });

  const assignments = await prisma.teacherAssignment.findMany({
    where: { academicYearId: academicYear.id, institutionId: institution.id },
    select: { id: true, groupId: true, subjectId: true, teacherId: true },
  });

  console.log(`📅 ${academicYear.name}`);
  console.log(`👨‍🏫 ${assignments.length} asignaciones\n`);

  // Index: taId -> assignment
  const taMap = new Map<string, typeof assignments[0]>();
  for (const a of assignments) taMap.set(a.id, a);

  let totalUpdated = 0;

  for (const term of terms) {
    console.log(`\n📋 Procesando ${term.name}...`);

    // 1. Cargar EvaluationPlans (1 query)
    const plans = await prisma.evaluationPlan.findMany({
      where: {
        teacherAssignmentId: { in: assignments.map(a => a.id) },
        academicTermId: term.id,
      },
      include: { components: { include: { component: true } } },
    });

    if (plans.length === 0) {
      console.log(`   ⏭️ Sin EvaluationPlans`);
      continue;
    }

    const plansByTA = new Map<string, typeof plans[0]>();
    for (const p of plans) plansByTA.set(p.teacherAssignmentId, p);

    // 2. Cargar PartialGrades (1 query)
    const partials = await prisma.partialGrade.findMany({
      where: { institutionId: institution.id, academicTermId: term.id },
      select: {
        studentEnrollmentId: true,
        teacherAssignmentId: true,
        componentType: true,
        score: true,
      },
    });

    if (partials.length === 0) {
      console.log(`   ⏭️ Sin PartialGrades`);
      continue;
    }
    console.log(`   📊 ${partials.length} PartialGrades cargadas`);

    // 3. Cargar PeriodFinalGrades existentes (1 query)
    const existingPFGs = await prisma.periodFinalGrade.findMany({
      where: { institutionId: institution.id, academicTermId: term.id },
      select: { id: true, studentEnrollmentId: true, subjectId: true, finalScore: true },
    });
    // Map<"enrollmentId|subjectId", pfg>
    const pfgIndex = new Map<string, typeof existingPFGs[0]>();
    for (const pfg of existingPFGs) {
      pfgIndex.set(`${pfg.studentEnrollmentId}|${pfg.subjectId}`, pfg);
    }
    console.log(`   📋 ${existingPFGs.length} PeriodFinalGrades existentes`);

    // 4. Calcular todo en memoria
    const gradeData = new Map<string, Map<string, number[]>>();
    for (const p of partials) {
      const key = `${p.studentEnrollmentId}|${p.teacherAssignmentId}`;
      if (!gradeData.has(key)) gradeData.set(key, new Map());
      const compMap = gradeData.get(key)!;
      const scores = compMap.get(p.componentType) || [];
      scores.push(Number(p.score));
      compMap.set(p.componentType, scores);
    }

    // Calcular notas finales en memoria
    const updates: { pfgId: string; newScore: number }[] = [];

    for (const [key, compScores] of gradeData.entries()) {
      const [enrollmentId, taId] = key.split('|');
      const plan = plansByTA.get(taId);
      if (!plan) continue;

      const componentResults = plan.components.map(cw => {
        const scores = compScores.get(cw.component.code) || [];
        const avg = scores.length > 0
          ? roundToOneDecimal(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;
        return { avg, percentage: cw.percentage };
      });

      const valid = componentResults.filter(c => c.avg !== null);
      if (valid.length === 0) continue;

      const weightedSum = valid.reduce((acc, c) => acc + (c.avg! * c.percentage) / 100, 0);
      const totalPct = valid.reduce((acc, c) => acc + c.percentage, 0);
      const finalGrade = totalPct > 0 ? roundToOneDecimal((weightedSum * 100) / totalPct) : null;
      if (finalGrade === null) continue;

      const ta = taMap.get(taId);
      if (!ta) continue;

      const pfg = pfgIndex.get(`${enrollmentId}|${ta.subjectId}`);
      if (pfg) {
        updates.push({ pfgId: pfg.id, newScore: finalGrade });
      }
    }

    console.log(`   🔄 ${updates.length} notas a actualizar`);

    // 5. Batch UPDATE via SQL — mucho más rápido que updates individuales
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);

      // Construir CASE WHEN para batch update
      const cases = batch.map(u => `WHEN '${u.pfgId}' THEN ${u.newScore}`).join(' ');
      const ids = batch.map(u => `'${u.pfgId}'`).join(',');

      await prisma.$executeRawUnsafe(`
        UPDATE "PeriodFinalGrade"
        SET "finalScore" = CASE "id" ${cases} END,
            "updatedAt" = NOW()
        WHERE "id" IN (${ids})
      `);

      totalUpdated += batch.length;
      process.stdout.write(`\r   ✏️ Actualizadas: ${totalUpdated}`);
    }
    console.log('');
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ Recálculo completado');
  console.log(`   📊 Total actualizadas: ${totalUpdated}`);
  console.log('═══════════════════════════════════════════════════');
}

main()
  .catch((err) => { console.error('❌ Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
