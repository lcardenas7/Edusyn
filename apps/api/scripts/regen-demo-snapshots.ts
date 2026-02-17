/**
 * Regenera los TermReportCardSnapshot del P1 de la demo.
 * Los snapshots existentes tienen formato antiguo (sin areaGrades/subjectGrades).
 * Este script:
 *   1. Borra los snapshots viejos del P1 de la demo
 *   2. Llama buildGroupReportCards() para cada grupo
 *   3. Inserta snapshots nuevos con el formato correcto
 *
 * SOLO afecta la institución demo.
 *
 * Uso:
 *   $env:DATABASE_URL="<public_url>"; npx ts-node --project scripts/tsconfig.seed.json scripts/regen-demo-snapshots.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_SLUG = 'colegio-demo-excelencia-academica';

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

async function main() {
  console.log('🔍 Buscando institución demo...');
  const institution = await prisma.institution.findFirst({
    where: { slug: DEMO_SLUG },
    select: { id: true, name: true, nit: true },
  });
  if (!institution) { console.error('❌ No encontrada.'); process.exit(1); }
  console.log(`✅ ${institution.name}`);

  const academicYear = await prisma.academicYear.findFirst({
    where: { institutionId: institution.id, status: 'ACTIVE' },
    select: { id: true, name: true, year: true },
  });
  if (!academicYear) { console.error('❌ No hay año activo.'); process.exit(1); }

  // Obtener un usuario admin de la demo para generatedById
  const adminUser = await prisma.user.findFirst({
    where: {
      institutionUsers: { some: { institutionId: institution.id } },
      roles: { some: { role: { name: { contains: 'ADMIN' } } } },
    },
    select: { id: true },
  });
  if (!adminUser) { console.error('❌ No hay admin.'); process.exit(1); }
  console.log(`👤 Admin: ${adminUser.id}`);

  // Solo P1 (FINALIZED)
  const p1 = await prisma.academicTerm.findFirst({
    where: { academicYearId: academicYear.id, status: 'FINALIZED' },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, type: true, status: true },
  });
  if (!p1) { console.error('❌ No hay período FINALIZED.'); process.exit(1); }
  console.log(`📋 ${p1.name} (${p1.status})`);

  // Contar snapshots viejos
  const oldCount = await prisma.termReportCardSnapshot.count({
    where: { academicTermId: p1.id },
  });
  console.log(`📸 Snapshots existentes: ${oldCount}`);

  // Borrar snapshots viejos del P1 demo
  console.log('\n🗑️ Borrando snapshots viejos...');
  const deleted = await prisma.termReportCardSnapshot.deleteMany({
    where: {
      academicTermId: p1.id,
      studentEnrollment: { academicYear: { institutionId: institution.id } },
    },
  });
  console.log(`   Borrados: ${deleted.count}`);

  // Obtener grupos con estudiantes activos
  const groups = await prisma.group.findMany({
    where: {
      studentEnrollments: {
        some: { academicYearId: academicYear.id, status: 'ACTIVE' },
      },
    },
    select: { id: true, name: true, grade: { select: { name: true } } },
  });
  console.log(`\n👥 Grupos: ${groups.length}`);

  // Teacher assignments
  const teacherAssignments = await prisma.teacherAssignment.findMany({
    where: { academicYearId: academicYear.id, institutionId: institution.id },
    include: {
      subject: { include: { area: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });
  // Map by groupId+subjectId for correct per-group resolution
  const taByGroupSubject = new Map<string, typeof teacherAssignments[0]>();
  for (const ta of teacherAssignments) {
    taByGroupSubject.set(`${ta.groupId}|${ta.subjectId}`, ta);
  }
  const teacherAssignmentIds = teacherAssignments.map(ta => ta.id);

  // EvaluationPlans
  const evaluationPlans = await prisma.evaluationPlan.findMany({
    where: { teacherAssignmentId: { in: teacherAssignmentIds }, academicTermId: p1.id },
    include: { components: { include: { component: true } } },
  });
  const plansMap = new Map<string, { components: { componentId: string; code: string; name: string; percentage: number }[] }>();
  for (const plan of evaluationPlans) {
    plansMap.set(`${plan.teacherAssignmentId}_${plan.academicTermId}`, {
      components: plan.components.map(cw => ({
        componentId: cw.componentId,
        code: cw.component.code,
        name: cw.component.name,
        percentage: cw.percentage,
      })),
    });
  }

  // PerformanceScale
  const performanceScales = await prisma.performanceScale.findMany({
    where: { institutionId: institution.id },
    orderBy: { minScore: 'asc' },
  });
  const scaleArray = performanceScales.map(s => ({
    level: s.level,
    minScore: Number(s.minScore),
    maxScore: Number(s.maxScore),
  }));

  function getPerformanceLevel(score: number) {
    const rounded = roundToOneDecimal(score);
    return scaleArray.find(s => rounded >= s.minScore && rounded <= s.maxScore)?.level || null;
  }

  // Generar snapshots por grupo
  let totalSnapshots = 0;

  for (const group of groups) {
    console.log(`\n   📦 ${group.grade?.name} ${group.name}...`);

    // Enrollments del grupo
    const enrollments = await prisma.studentEnrollment.findMany({
      where: { groupId: group.id, academicYearId: academicYear.id, status: 'ACTIVE' },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, documentType: true, documentNumber: true } },
        group: { select: { id: true, name: true, grade: { select: { name: true } } } },
      },
    });

    const enrollmentIds = enrollments.map(e => e.id);

    // EnrollmentAreas + Subjects (snapshots de estructura)
    const enrollmentAreas = await prisma.enrollmentArea.findMany({
      where: { enrollmentId: { in: enrollmentIds } },
      include: { enrollmentSubjects: true },
    });
    const enrollmentAreasMap = new Map<string, typeof enrollmentAreas>();
    for (const area of enrollmentAreas) {
      const list = enrollmentAreasMap.get(area.enrollmentId) || [];
      list.push(area);
      enrollmentAreasMap.set(area.enrollmentId, list);
    }

    // PartialGrades
    const allPartialGrades = await prisma.partialGrade.findMany({
      where: { studentEnrollmentId: { in: enrollmentIds }, academicTermId: p1.id },
    });
    const partialsMap = new Map<string, { teacherAssignmentId: string; academicTermId: string; componentType: string; score: number }[]>();
    for (const pg of allPartialGrades) {
      const list = partialsMap.get(pg.studentEnrollmentId) || [];
      list.push({
        teacherAssignmentId: pg.teacherAssignmentId,
        academicTermId: pg.academicTermId,
        componentType: pg.componentType,
        score: Number(pg.score),
      });
      partialsMap.set(pg.studentEnrollmentId, list);
    }

    // Procesar cada estudiante
    const snapshotBatch: any[] = [];

    for (const enrollment of enrollments) {
      const enrollmentId = enrollment.id;

      // Resolver estructura académica desde snapshot
      const areas = enrollmentAreasMap.get(enrollmentId) || [];
      let resolvedAreas: any[];

      if (areas.length > 0) {
        resolvedAreas = areas.map(area => ({
          name: area.areaName,
          code: area.areaCode,
          weightPercentage: area.weightPercentage,
          calculationType: area.calculationType,
          subjects: area.enrollmentSubjects.map(es => {
            const ta = es.subjectId ? taByGroupSubject.get(`${group.id}|${es.subjectId}`) : null;
            return {
              id: es.subjectId,
              name: es.subjectName,
              code: es.subjectCode,
              weightPercentage: es.weightPercentage,
              teacherAssignmentId: ta?.id ?? null,
              teacher: ta ? `${ta.teacher.firstName} ${ta.teacher.lastName}` : (es.teacherName || null),
            };
          }),
        }));
      } else {
        // Fallback: desde TeacherAssignments
        const areaMap = new Map<string, { name: string; code: string | null; subjects: any[] }>();
        for (const ta of teacherAssignments.filter(t => t.groupId === group.id)) {
          const areaId = ta.subject.areaId;
          if (!areaMap.has(areaId)) {
            areaMap.set(areaId, { name: ta.subject.area.name, code: ta.subject.area.code, subjects: [] });
          }
          areaMap.get(areaId)!.subjects.push({
            id: ta.subjectId, name: ta.subject.name, code: ta.subject.code,
            weightPercentage: 0, teacherAssignmentId: ta.id,
            teacher: `${ta.teacher.firstName} ${ta.teacher.lastName}`,
          });
        }
        resolvedAreas = Array.from(areaMap.entries()).map(([, data]) => ({
          name: data.name, code: data.code, weightPercentage: 100 / areaMap.size,
          calculationType: 'AVERAGE',
          subjects: data.subjects.map(s => ({ ...s, weightPercentage: 100 / data.subjects.length })),
        }));
      }

      // Calcular notas por área
      const areaGrades = resolvedAreas.map(area => {
        const subjectResults = area.subjects.map((subject: any) => {
          let grade: number | null = null;
          let components: any[] = [];

          if (subject.teacherAssignmentId) {
            const planKey = `${subject.teacherAssignmentId}_${p1.id}`;
            const plan = plansMap.get(planKey);
            if (plan) {
              const allPartials = partialsMap.get(enrollmentId) || [];
              const partials = allPartials.filter(
                p => p.teacherAssignmentId === subject.teacherAssignmentId && p.academicTermId === p1.id,
              );
              const scoresByType = new Map<string, number[]>();
              for (const p of partials) {
                const scores = scoresByType.get(p.componentType) || [];
                scores.push(p.score);
                scoresByType.set(p.componentType, scores);
              }
              components = plan.components.map(cw => {
                const scores = scoresByType.get(cw.code) || [];
                const avg = scores.length > 0
                  ? roundToOneDecimal(scores.reduce((a, b) => a + b, 0) / scores.length)
                  : null;
                return { componentId: cw.componentId, name: cw.name, average: avg, percentage: cw.percentage };
              });
              const valid = components.filter((c: any) => c.average !== null);
              if (valid.length > 0) {
                const ws = valid.reduce((acc: number, c: any) => acc + (c.average * c.percentage) / 100, 0);
                const tp = valid.reduce((acc: number, c: any) => acc + c.percentage, 0);
                grade = tp > 0 ? roundToOneDecimal((ws * 100) / tp) : null;
              }
            }
          }

          return {
            subject: subject.name, subjectCode: subject.code, teacher: subject.teacher,
            grade, weightPercentage: subject.weightPercentage,
            performanceLevel: grade ? getPerformanceLevel(grade) : null,
            components, achievement: null, achievementObservation: null, judgment: null,
          };
        });

        const validGrades = subjectResults.filter((s: any) => s.grade !== null);
        let areaAverage: number | null = null;
        if (validGrades.length > 0) {
          areaAverage = roundToOneDecimal(validGrades.reduce((acc: number, s: any) => acc + s.grade, 0) / validGrades.length);
        }

        return {
          area: area.name, areaCode: area.code, weightPercentage: area.weightPercentage,
          calculationType: area.calculationType, areaAverage,
          areaPerformanceLevel: areaAverage ? getPerformanceLevel(areaAverage) : null,
          subjects: subjectResults,
        };
      });

      const subjectGrades = areaGrades.flatMap((a: any) => a.subjects);

      snapshotBatch.push({
        academicTermId: p1.id,
        studentEnrollmentId: enrollmentId,
        version: 3,
        generatedById: adminUser.id,
        data: {
          institution: { id: institution.id, name: institution.name, nit: institution.nit },
          academicYear: { id: academicYear.id, year: academicYear.year, name: academicYear.name },
          term: { id: p1.id, name: p1.name, type: p1.type },
          student: enrollment.student,
          group: { id: enrollment.group.id, name: enrollment.group.name, gradeLevel: enrollment.group.grade?.name || '' },
          areaGrades,
          subjectGrades,
          structureSource: areas.length > 0 ? 'snapshot' : 'calculated',
          attendance: { total: 0, present: 0, absent: 0, late: 0, excused: 0, attendanceRate: 0 },
          achievements: [],
          observations: [],
          generatedAt: new Date(),
        },
      });
    }

    // Bulk insert with skipDuplicates for re-run safety
    const result = await prisma.termReportCardSnapshot.createMany({
      data: snapshotBatch,
      skipDuplicates: true,
    });
    totalSnapshots += result.count;
    console.log(`      ✅ ${snapshotBatch.length} snapshots`);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('✅ Snapshots regenerados');
  console.log(`   📸 Total: ${totalSnapshots}`);
  console.log(`   📋 ${p1.name}`);
  console.log('═══════════════════════════════════════════════════');
}

main()
  .catch((err) => { console.error('❌ Error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
