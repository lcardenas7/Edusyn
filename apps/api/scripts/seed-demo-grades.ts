/**
 * Crea EvaluationComponents, EvaluationPlans y PartialGrades para la
 * institución demo. Genera notas parciales coherentes con las PeriodFinalGrade
 * existentes para que la planilla de calificaciones y los boletines muestren datos.
 *
 * SOLO afecta la institución demo. Idempotente (skipDuplicates / findFirst).
 *
 * Uso (desde apps/api):
 *   $env:DATABASE_URL="<public_url>"; npx ts-node --project scripts/tsconfig.seed.json scripts/seed-demo-grades.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_SLUG = 'colegio-demo-excelencia-academica';

const COMPONENTS = [
  { code: 'COGNITIVO', name: 'Cognitivo', percentage: 40 },
  { code: 'PROCEDIMENTAL', name: 'Procedimental', percentage: 40 },
  { code: 'ACTITUDINAL', name: 'Actitudinal', percentage: 20 },
];

const ACTIVITIES_PER_COMPONENT = 3;
const ACTIVITY_NAMES = ['Evaluación', 'Taller', 'Trabajo'];
const BATCH_SIZE = 500;

function vary(base: number, range: number): number {
  const v = base + (Math.random() - 0.5) * range;
  return Math.round(Math.max(1.0, Math.min(5.0, v)) * 10) / 10;
}

async function main() {
  console.log('🔍 Buscando institución demo...');

  const institution = await prisma.institution.findFirst({
    where: { slug: DEMO_SLUG },
    select: { id: true, name: true },
  });
  if (!institution) { console.error('❌ No se encontró institución demo.'); process.exit(1); }
  console.log(`✅ ${institution.name} (${institution.id})`);

  // ─── Año y períodos ──────────────────────────────────────────────────
  const academicYear = await prisma.academicYear.findFirst({
    where: { institutionId: institution.id, status: 'ACTIVE' },
    select: { id: true, name: true },
  });
  if (!academicYear) { console.error('❌ No hay año activo.'); process.exit(1); }

  const terms = await prisma.academicTerm.findMany({
    where: { academicYearId: academicYear.id },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, status: true, order: true },
  });
  console.log(`📅 ${academicYear.name} — ${terms.length} períodos`);

  // Períodos con PeriodFinalGrade
  const termsWithGrades: typeof terms = [];
  for (const t of terms) {
    const cnt = await prisma.periodFinalGrade.count({
      where: { institutionId: institution.id, academicTermId: t.id },
    });
    console.log(`   ${t.name} (${t.status}): ${cnt} PeriodFinalGrades`);
    if (cnt > 0) termsWithGrades.push(t);
  }

  if (termsWithGrades.length === 0) {
    console.error('❌ No hay PeriodFinalGrade. Ejecute seed-demo primero.');
    process.exit(1);
  }

  // ─── PASO 1: Crear EvaluationComponents ──────────────────────────────
  console.log('\n📝 PASO 1: Creando componentes de evaluación...');
  const componentIds: Record<string, string> = {};

  for (const comp of COMPONENTS) {
    const existing = await prisma.evaluationComponent.findFirst({
      where: { institutionId: institution.id, code: comp.code, parentId: null },
    });
    if (existing) {
      componentIds[comp.code] = existing.id;
      console.log(`   ⏭️ ${comp.code} ya existe`);
    } else {
      const created = await prisma.evaluationComponent.create({
        data: { institutionId: institution.id, code: comp.code, name: comp.name },
      });
      componentIds[comp.code] = created.id;
      console.log(`   ✅ ${comp.code} creado`);
    }
  }

  // ─── PASO 2: Teacher Assignments ─────────────────────────────────────
  const assignments = await prisma.teacherAssignment.findMany({
    where: { academicYearId: academicYear.id, institutionId: institution.id },
    select: {
      id: true, groupId: true, subjectId: true, teacherId: true,
      subject: { select: { name: true } },
      group: { select: { name: true, grade: { select: { name: true } } } },
    },
  });
  console.log(`\n👨‍🏫 Asignaciones: ${assignments.length}`);

  // ─── PASO 3: Matrículas ──────────────────────────────────────────────
  const groupIds = [...new Set(assignments.map(a => a.groupId))];
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { groupId: { in: groupIds }, status: 'ACTIVE' },
    select: { id: true, groupId: true },
  });
  console.log(`🎓 Estudiantes: ${enrollments.length} en ${groupIds.length} grupos`);

  const enrollmentsByGroup = new Map<string, string[]>();
  for (const e of enrollments) {
    const list = enrollmentsByGroup.get(e.groupId) || [];
    list.push(e.id);
    enrollmentsByGroup.set(e.groupId, list);
  }

  // ─── PASO 4: Cargar PeriodFinalGrades existentes ─────────────────────
  // Map<"enrollmentId|termId|subjectId", finalScore>
  console.log('\n📊 PASO 4: Cargando PeriodFinalGrades existentes...');
  const pfgMap = new Map<string, number>();
  for (const t of termsWithGrades) {
    const grades = await prisma.periodFinalGrade.findMany({
      where: { institutionId: institution.id, academicTermId: t.id },
      select: { studentEnrollmentId: true, subjectId: true, finalScore: true },
    });
    for (const g of grades) {
      pfgMap.set(`${g.studentEnrollmentId}|${t.id}|${g.subjectId}`, Number(g.finalScore));
    }
    console.log(`   ${t.name}: ${grades.length} notas cargadas`);
  }

  // ─── PASO 5: Crear EvaluationPlans por cada TA + término ────────────
  console.log('\n📋 PASO 5: Creando EvaluationPlans...');
  let plansCreated = 0;
  let plansSkipped = 0;

  for (const ta of assignments) {
    for (const t of termsWithGrades) {
      const existing = await prisma.evaluationPlan.findFirst({
        where: { teacherAssignmentId: ta.id, academicTermId: t.id },
      });
      if (existing) {
        plansSkipped++;
        continue;
      }

      const plan = await prisma.evaluationPlan.create({
        data: { teacherAssignmentId: ta.id, academicTermId: t.id },
      });

      for (const comp of COMPONENTS) {
        await prisma.evaluationPlanComponentWeight.create({
          data: {
            evaluationPlanId: plan.id,
            componentId: componentIds[comp.code],
            percentage: comp.percentage,
          },
        });
      }
      plansCreated++;
    }
  }
  console.log(`   ✅ Creados: ${plansCreated}, Omitidos: ${plansSkipped}`);

  // ─── PASO 6: Crear PartialGrades ─────────────────────────────────────
  console.log('\n✏️ PASO 6: Generando PartialGrades...');

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const t of termsWithGrades) {
    console.log(`\n   📋 ${t.name}...`);
    const partialsBatch: any[] = [];

    for (const ta of assignments) {
      const groupEnrollments = enrollmentsByGroup.get(ta.groupId) || [];

      for (const enrollmentId of groupEnrollments) {
        // Buscar la nota final existente para este estudiante/asignatura/período
        const finalScore = pfgMap.get(`${enrollmentId}|${t.id}|${ta.subjectId}`);
        if (finalScore === undefined) continue;

        // Generar notas parciales coherentes con la nota final
        // La nota final = sum(componentAvg * componentWeight)
        // Generamos 3 actividades por componente con variación alrededor de la nota final
        for (const comp of COMPONENTS) {
          for (let actIdx = 1; actIdx <= ACTIVITIES_PER_COMPONENT; actIdx++) {
            // Variar ±0.5 alrededor de la nota final para cada actividad
            const score = vary(finalScore, 1.0);
            partialsBatch.push({
              institutionId: institution.id,
              studentEnrollmentId: enrollmentId,
              teacherAssignmentId: ta.id,
              academicTermId: t.id,
              componentType: comp.code,
              activityIndex: actIdx,
              activityName: `${ACTIVITY_NAMES[(actIdx - 1) % 3]} ${actIdx}`,
              activityType: ACTIVITY_NAMES[(actIdx - 1) % 3].toUpperCase(),
              score: score,
            });
          }
        }
      }
    }

    console.log(`   📝 ${partialsBatch.length} notas parciales a insertar`);

    // Insert in batches
    for (let i = 0; i < partialsBatch.length; i += BATCH_SIZE) {
      const batch = partialsBatch.slice(i, i + BATCH_SIZE);
      const result = await prisma.partialGrade.createMany({
        data: batch,
        skipDuplicates: true,
      });
      totalInserted += result.count;
      totalSkipped += batch.length - result.count;
      process.stdout.write(`\r   ✏️ [${t.name}] Insertadas: ${totalInserted} (omitidas: ${totalSkipped})`);
    }
    console.log('');
  }

  // ─── RESUMEN ─────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ Seed de notas parciales completado');
  console.log(`   🏫 ${institution.name}`);
  console.log(`   📝 Componentes: ${COMPONENTS.map(c => `${c.code}(${c.percentage}%)`).join(', ')}`);
  console.log(`   📋 EvaluationPlans creados: ${plansCreated}`);
  console.log(`   ✏️ PartialGrades insertadas: ${totalInserted}`);
  console.log(`   ⏭️ Omitidas (duplicadas): ${totalSkipped}`);
  console.log(`   📅 Períodos: ${termsWithGrades.map(t => t.name).join(', ')}`);
  console.log(`   🎓 Estudiantes: ${enrollments.length}`);
  console.log(`   👨‍🏫 Asignaciones: ${assignments.length}`);
  console.log('═══════════════════════════════════════════════════');
}

main()
  .catch((err) => { console.error('❌ Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
