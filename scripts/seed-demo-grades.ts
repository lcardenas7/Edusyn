/**
 * Script para insertar notas demo en el primer período de todos los cursos
 * de la institución demo. SOLO afecta la institución demo.
 *
 * Uso:
 *   npx ts-node scripts/seed-demo-grades.ts
 *
 * O via Railway CLI:
 *   railway run npx ts-node scripts/seed-demo-grades.ts
 *
 * Requiere DATABASE_URL en el entorno.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Nombre parcial para identificar la institución demo
const DEMO_INSTITUTION_NAME = 'demo';

function randomGrade(min: number, max: number): number {
  // Genera nota con 1 decimal
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

function generateRealisticGrade(passingGrade: number, maxGrade: number): number {
  // Distribución realista: 70% aprueba, 15% en riesgo, 15% reprueba
  const roll = Math.random();
  if (roll < 0.15) {
    // Reprobado: entre 1.0 y passingGrade - 0.5
    return randomGrade(1.0, Math.max(1.5, passingGrade - 0.5));
  } else if (roll < 0.30) {
    // En riesgo: entre passingGrade - 0.5 y passingGrade + 0.3
    return randomGrade(Math.max(1.0, passingGrade - 0.5), passingGrade + 0.3);
  } else if (roll < 0.70) {
    // Básico: entre passingGrade y passingGrade + 1.0
    return randomGrade(passingGrade, Math.min(maxGrade, passingGrade + 1.0));
  } else if (roll < 0.90) {
    // Alto
    return randomGrade(Math.min(maxGrade, passingGrade + 1.0), Math.min(maxGrade, passingGrade + 1.5));
  } else {
    // Superior
    return randomGrade(Math.min(maxGrade, passingGrade + 1.5), maxGrade);
  }
}

async function main() {
  console.log('🔍 Buscando institución demo...');

  // 1. Encontrar la institución demo
  const institution = await prisma.institution.findFirst({
    where: { name: { contains: DEMO_INSTITUTION_NAME, mode: 'insensitive' } },
    select: { id: true, name: true, gradingConfig: true },
  });

  if (!institution) {
    console.error('❌ No se encontró institución demo. Abortando.');
    process.exit(1);
  }

  console.log(`✅ Institución: ${institution.name} (${institution.id})`);

  // 2. Obtener nota mínima aprobatoria de la config
  const gradingConfig = institution.gradingConfig as any;
  const passingGrade = gradingConfig?.minPassingGrade ?? 3.0;
  const maxGrade = 5.0;
  console.log(`📊 Escala: 1.0 - ${maxGrade}, Nota mínima: ${passingGrade}`);

  // 3. Encontrar el año académico activo
  const academicYear = await prisma.academicYear.findFirst({
    where: { institutionId: institution.id, status: 'ACTIVE' },
    select: { id: true, year: true, name: true },
  });

  if (!academicYear) {
    console.error('❌ No se encontró año académico activo. Abortando.');
    process.exit(1);
  }

  console.log(`📅 Año académico: ${academicYear.name || academicYear.year} (${academicYear.id})`);

  // 4. Encontrar el primer período
  const firstTerm = await prisma.academicTerm.findFirst({
    where: { academicYearId: academicYear.id },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, status: true },
  });

  if (!firstTerm) {
    console.error('❌ No se encontró ningún período. Abortando.');
    process.exit(1);
  }

  if (firstTerm.status === 'FINALIZED') {
    console.error(`⚠️ El período "${firstTerm.name}" está FINALIZADO. No se pueden insertar notas.`);
    process.exit(1);
  }

  console.log(`📋 Período: ${firstTerm.name} (${firstTerm.id}) - Estado: ${firstTerm.status}`);

  // 5. Obtener todos los teacher assignments del año
  const teacherAssignments = await prisma.teacherAssignment.findMany({
    where: { academicYearId: academicYear.id, institutionId: institution.id },
    select: {
      id: true,
      groupId: true,
      subjectId: true,
      subject: { select: { name: true } },
      group: { select: { name: true, grade: { select: { name: true } } } },
    },
  });

  console.log(`👨‍🏫 Teacher assignments encontrados: ${teacherAssignments.length}`);

  if (teacherAssignments.length === 0) {
    console.error('❌ No hay teacher assignments. Abortando.');
    process.exit(1);
  }

  // 6. Obtener componentes de evaluación de la institución
  const components = await prisma.evaluationComponent.findMany({
    where: { institutionId: institution.id, parentId: null },
    select: { id: true, code: true, name: true },
  });

  console.log(`📝 Componentes de evaluación: ${components.map(c => c.code).join(', ')}`);

  if (components.length === 0) {
    console.error('❌ No hay componentes de evaluación. Abortando.');
    process.exit(1);
  }

  // 7. Para cada teacher assignment, crear EvaluationPlan si no existe
  let plansCreated = 0;
  for (const ta of teacherAssignments) {
    const existing = await prisma.evaluationPlan.findUnique({
      where: {
        teacherAssignmentId_academicTermId: {
          teacherAssignmentId: ta.id,
          academicTermId: firstTerm.id,
        },
      },
    });

    if (!existing) {
      const plan = await prisma.evaluationPlan.create({
        data: {
          teacherAssignmentId: ta.id,
          academicTermId: firstTerm.id,
        },
      });

      // Distribuir porcentajes equitativamente entre componentes
      const pctEach = Math.floor(100 / components.length);
      const remainder = 100 - pctEach * components.length;

      for (let i = 0; i < components.length; i++) {
        await prisma.evaluationPlanComponentWeight.create({
          data: {
            evaluationPlanId: plan.id,
            componentId: components[i].id,
            percentage: pctEach + (i === 0 ? remainder : 0),
          },
        });
      }
      plansCreated++;
    }
  }

  if (plansCreated > 0) {
    console.log(`📋 EvaluationPlans creados: ${plansCreated}`);
  }

  // 8. Obtener todas las matrículas activas agrupadas por grupo
  const groupIds = [...new Set(teacherAssignments.map(ta => ta.groupId))];
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { groupId: { in: groupIds }, status: 'ACTIVE' },
    select: { id: true, groupId: true, student: { select: { firstName: true, lastName: true } } },
  });

  console.log(`🎓 Estudiantes matriculados: ${enrollments.length} en ${groupIds.length} grupos`);

  // Map<groupId, enrollmentId[]>
  const enrollmentsByGroup = new Map<string, string[]>();
  for (const e of enrollments) {
    const list = enrollmentsByGroup.get(e.groupId) || [];
    list.push(e.id);
    enrollmentsByGroup.set(e.groupId, list);
  }

  // 9. Verificar si ya hay notas para evitar duplicados
  const existingCount = await prisma.partialGrade.count({
    where: {
      institutionId: institution.id,
      academicTermId: firstTerm.id,
    },
  });

  if (existingCount > 0) {
    console.log(`⚠️ Ya existen ${existingCount} notas parciales para este período.`);
    console.log('   Si desea regenerar, elimine las existentes primero.');
    console.log('   Continuando solo para combinaciones faltantes...');
  }

  // 10. Insertar notas parciales
  let totalInserted = 0;
  let totalSkipped = 0;
  const ACTIVITIES_PER_COMPONENT = 3;

  for (const ta of teacherAssignments) {
    const groupEnrollments = enrollmentsByGroup.get(ta.groupId) || [];
    if (groupEnrollments.length === 0) continue;

    for (const enrollmentId of groupEnrollments) {
      for (const comp of components) {
        for (let actIdx = 1; actIdx <= ACTIVITIES_PER_COMPONENT; actIdx++) {
          // Verificar si ya existe
          const exists = await prisma.partialGrade.findUnique({
            where: {
              studentEnrollmentId_teacherAssignmentId_academicTermId_componentType_activityIndex: {
                studentEnrollmentId: enrollmentId,
                teacherAssignmentId: ta.id,
                academicTermId: firstTerm.id,
                componentType: comp.code,
                activityIndex: actIdx,
              },
            },
            select: { id: true },
          });

          if (exists) {
            totalSkipped++;
            continue;
          }

          const grade = generateRealisticGrade(passingGrade, maxGrade);
          const activityNames = ['Evaluación', 'Taller', 'Trabajo'];

          await prisma.partialGrade.create({
            data: {
              institutionId: institution.id,
              studentEnrollmentId: enrollmentId,
              teacherAssignmentId: ta.id,
              academicTermId: firstTerm.id,
              componentType: comp.code,
              activityIndex: actIdx,
              activityName: `${activityNames[(actIdx - 1) % 3]} ${actIdx}`,
              activityType: activityNames[(actIdx - 1) % 3].toUpperCase(),
              score: grade,
            },
          });
          totalInserted++;
        }
      }
    }

    const groupName = ta.group?.grade?.name
      ? `${ta.group.grade.name} ${ta.group.name}`
      : ta.group?.name || ta.groupId;
    process.stdout.write(`\r   ✏️ ${groupName} - ${ta.subject?.name}: ${groupEnrollments.length} estudiantes`);
  }

  console.log('');
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log(`✅ Seed completado para: ${institution.name}`);
  console.log(`   📊 Notas insertadas: ${totalInserted}`);
  console.log(`   ⏭️ Notas omitidas (ya existían): ${totalSkipped}`);
  console.log(`   📋 Período: ${firstTerm.name}`);
  console.log(`   👨‍🏫 Asignaciones: ${teacherAssignments.length}`);
  console.log(`   🎓 Estudiantes: ${enrollments.length}`);
  console.log(`   📝 Componentes: ${components.length} × ${ACTIVITIES_PER_COMPONENT} actividades`);
  console.log('═══════════════════════════════════════════════════');
}

main()
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
