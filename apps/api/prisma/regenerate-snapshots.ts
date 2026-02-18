/**
 * REGENERATE SNAPSHOTS - Regenerar snapshots del Período 1
 * 
 * Este script regenera los snapshots de boletines para el primer período
 * de la institución demo, incluyendo los logros recién agregados.
 * 
 * Ejecutar con: 
 *   $env:DATABASE_URL="..."; npx ts-node prisma/regenerate-snapshots.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function regenerateSnapshots() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔄 REGENERATE SNAPSHOTS - Período 1 con logros');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Buscar la institución demo
  const institution = await prisma.institution.findFirst({
    where: {
      OR: [
        { name: { contains: 'Demo Excelencia', mode: 'insensitive' } },
        { name: { contains: 'Colegio Demo', mode: 'insensitive' } },
      ],
    },
  });

  if (!institution) {
    console.log('❌ No se encontró la institución demo.');
    return;
  }
  console.log(`✅ Institución: ${institution.name}\n`);

  // Buscar el año activo y el primer período
  const academicYear = await prisma.academicYear.findFirst({
    where: { institutionId: institution.id, status: 'ACTIVE' },
    include: {
      terms: { orderBy: { startDate: 'asc' } },
    },
  });

  if (!academicYear || academicYear.terms.length === 0) {
    console.log('❌ No se encontró año académico activo.');
    return;
  }

  const firstTerm = academicYear.terms[0];
  console.log(`📅 Período: ${firstTerm.name} (status: ${firstTerm.status})\n`);

  if (firstTerm.status !== 'FINALIZED') {
    console.log('⚠️  El período no está FINALIZED, no necesita regeneración de snapshots.');
    console.log('   Los boletines se calculan en vivo para períodos no finalizados.');
    return;
  }

  // Obtener la versión actual más alta
  const lastVersion = await prisma.termReportCardSnapshot.aggregate({
    where: { academicTermId: firstTerm.id },
    _max: { version: true },
  });

  const currentVersion = lastVersion._max.version ?? 0;
  const newVersion = currentVersion + 1;
  console.log(`📊 Versión actual de snapshots: ${currentVersion}`);
  console.log(`📊 Nueva versión a generar: ${newVersion}\n`);

  // Eliminar snapshots de la versión actual para regenerar
  // (Mejor: crear nueva versión para mantener historial)
  
  // Obtener todos los grupos con estudiantes activos
  const groups = await prisma.group.findMany({
    where: {
      studentEnrollments: {
        some: {
          academicYearId: academicYear.id,
          status: 'ACTIVE',
        },
      },
    },
    select: { id: true, name: true },
  });

  console.log(`👥 Grupos encontrados: ${groups.length}\n`);

  // Para cada grupo, obtener enrollments y regenerar snapshots
  let totalSnapshots = 0;

  for (const group of groups) {
    try {
      // Obtener enrollments del grupo
      const enrollments = await prisma.studentEnrollment.findMany({
        where: { groupId: group.id, status: 'ACTIVE', academicYearId: academicYear.id },
        include: {
          student: true,
          group: { include: { grade: true } },
          academicYear: { include: { institution: true } },
        },
        orderBy: { student: { lastName: 'asc' } },
      });

      if (enrollments.length === 0) continue;

      const enrollmentIds = enrollments.map(e => e.id);

      // Obtener teacher assignments
      const teacherAssignments = await prisma.teacherAssignment.findMany({
        where: { groupId: group.id, academicYearId: academicYear.id },
        include: {
          subject: { include: { area: true } },
          teacher: { select: { firstName: true, lastName: true } },
        },
      });

      const taBySubjectId = new Map<string, (typeof teacherAssignments)[0]>();
      for (const ta of teacherAssignments) {
        taBySubjectId.set(ta.subjectId, ta);
      }
      const teacherAssignmentIds = teacherAssignments.map(ta => ta.id);

      // Obtener enrollment areas (snapshot de estructura)
      const enrollmentAreas = await prisma.enrollmentArea.findMany({
        where: { enrollmentId: { in: enrollmentIds } },
        include: {
          enrollmentSubjects: {
            include: { subject: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      });

      const enrollmentAreasMap = new Map<string, typeof enrollmentAreas>();
      for (const area of enrollmentAreas) {
        const list = enrollmentAreasMap.get(area.enrollmentId) || [];
        list.push(area);
        enrollmentAreasMap.set(area.enrollmentId, list);
      }

      // Obtener evaluation plans
      const evaluationPlans = await prisma.evaluationPlan.findMany({
        where: {
          teacherAssignmentId: { in: teacherAssignmentIds },
          academicTermId: firstTerm.id,
        },
        include: { components: { include: { component: true } } },
      });

      const plansMap = new Map<string, { components: { componentId: string; code: string; name: string; percentage: number }[] }>();
      for (const plan of evaluationPlans) {
        const key = `${plan.teacherAssignmentId}_${plan.academicTermId}`;
        plansMap.set(key, {
          components: plan.components.map(cw => ({
            componentId: cw.componentId,
            code: cw.component.code,
            name: cw.component.name,
            percentage: cw.percentage,
          })),
        });
      }

      // Obtener partial grades
      const allPartialGrades = await prisma.partialGrade.findMany({
        where: { studentEnrollmentId: { in: enrollmentIds }, academicTermId: firstTerm.id },
      });

      const partialsMap = new Map<string, { teacherAssignmentId: string; componentType: string; score: number }[]>();
      for (const pg of allPartialGrades) {
        const list = partialsMap.get(pg.studentEnrollmentId) || [];
        list.push({
          teacherAssignmentId: pg.teacherAssignmentId,
          componentType: pg.componentType,
          score: Number(pg.score),
        });
        partialsMap.set(pg.studentEnrollmentId, list);
      }

      // Obtener performance scales
      const performanceScales = await prisma.performanceScale.findMany({
        where: { institutionId: institution.id },
        orderBy: { minScore: 'asc' },
      });
      const scaleArray = performanceScales.map(s => ({
        level: s.level,
        minScore: Number(s.minScore),
        maxScore: Number(s.maxScore),
      }));

      // Obtener achievements (LOGROS) - esto es lo que faltaba en el snapshot anterior
      const allAchievements = await prisma.studentAchievement.findMany({
        where: {
          studentEnrollmentId: { in: enrollmentIds },
          achievement: { academicTermId: firstTerm.id },
        },
        include: {
          achievement: {
            include: {
              teacherAssignment: { include: { subject: true } },
            },
          },
        },
        orderBy: { achievement: { orderNumber: 'asc' } },
      });

      const achievementsMap = new Map<string, typeof allAchievements>();
      for (const sa of allAchievements) {
        const list = achievementsMap.get(sa.studentEnrollmentId) || [];
        list.push(sa);
        achievementsMap.set(sa.studentEnrollmentId, list);
      }

      // Obtener logros base (Achievement) por teacherAssignment para asignar a asignaturas
      const baseAchievements = await prisma.achievement.findMany({
        where: {
          academicTermId: firstTerm.id,
          teacherAssignmentId: { in: teacherAssignmentIds },
        },
        include: {
          teacherAssignment: { include: { subject: true } },
        },
        orderBy: { orderNumber: 'asc' },
      });

      // Map<subjectName, baseDescription> (primer logro por asignatura)
      const baseAchievementBySubject = new Map<string, string>();
      for (const ba of baseAchievements) {
        const subjectName = ba.teacherAssignment?.subject?.name;
        if (subjectName && !baseAchievementBySubject.has(subjectName)) {
          baseAchievementBySubject.set(subjectName, ba.baseDescription);
        }
      }

      // Obtener attendance
      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (firstTerm.startDate) dateFilter.gte = firstTerm.startDate;
      if (firstTerm.endDate) dateFilter.lte = firstTerm.endDate;

      const allAttendance = await prisma.attendanceRecord.findMany({
        where: {
          studentEnrollmentId: { in: enrollmentIds },
          ...(Object.keys(dateFilter).length > 0 ? { date: dateFilter } : {}),
        },
      });

      const attendanceMap = new Map<string, { total: number; present: number; absent: number; late: number; excused: number; attendanceRate: number }>();
      const attByEnrollment = new Map<string, (typeof allAttendance)>();
      for (const rec of allAttendance) {
        const list = attByEnrollment.get(rec.studentEnrollmentId) || [];
        list.push(rec);
        attByEnrollment.set(rec.studentEnrollmentId, list);
      }
      for (const eid of enrollmentIds) {
        const records = attByEnrollment.get(eid) || [];
        const total = records.length;
        const present = records.filter(r => r.status === 'PRESENT').length;
        const absent = records.filter(r => r.status === 'ABSENT').length;
        const late = records.filter(r => r.status === 'LATE').length;
        const excused = records.filter(r => r.status === 'EXCUSED').length;
        const attendanceRate = total > 0 ? Math.round(((present + late + excused) / total) * 100) : 0;
        attendanceMap.set(eid, { total, present, absent, late, excused, attendanceRate });
      }

      // Obtener observations
      const obsWhere: any = { studentEnrollmentId: { in: enrollmentIds } };
      if (firstTerm.startDate || firstTerm.endDate) {
        obsWhere.date = {};
        if (firstTerm.startDate) obsWhere.date.gte = firstTerm.startDate;
        if (firstTerm.endDate) obsWhere.date.lte = firstTerm.endDate;
      }
      const allObservations = await prisma.studentObservation.findMany({
        where: obsWhere,
        include: { author: { select: { firstName: true, lastName: true } } },
        orderBy: { date: 'desc' },
      });

      const observationsMap = new Map<string, typeof allObservations>();
      for (const obs of allObservations) {
        const list = observationsMap.get(obs.studentEnrollmentId) || [];
        list.push(obs);
        observationsMap.set(obs.studentEnrollmentId, list);
      }

      // Procesar cada estudiante
      for (const enrollment of enrollments) {
        const eid = enrollment.id;

        // Resolver estructura
        const areas = enrollmentAreasMap.get(eid);
        let resolvedAreas: Array<{
          name: string; code: string | null; weightPercentage: number; calculationType: string;
          subjects: Array<{ id: string | null; name: string; code: string | null; weightPercentage: number; teacherAssignmentId: string | null; teacher: string | null }>;
        }>;

        if (areas && areas.length > 0) {
          resolvedAreas = areas.map(area => ({
            name: area.areaName,
            code: area.areaCode,
            weightPercentage: area.weightPercentage,
            calculationType: area.calculationType,
            subjects: area.enrollmentSubjects.map(es => {
              const ta = es.subjectId ? taBySubjectId.get(es.subjectId) : null;
              return {
                id: es.subjectId,
                name: es.subjectName,
                code: es.subjectCode,
                weightPercentage: es.weightPercentage,
                teacherAssignmentId: ta?.id ?? null,
                teacher: es.teacherName ?? (ta ? `${ta.teacher.firstName} ${ta.teacher.lastName}` : null),
              };
            }),
          }));
        } else {
          const areaMap = new Map<string, { name: string; code: string | null; subjects: any[] }>();
          for (const ta of teacherAssignments) {
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
            name: data.name, code: data.code, weightPercentage: 100 / areaMap.size, calculationType: 'AVERAGE',
            subjects: data.subjects.map((s: any) => ({ ...s, weightPercentage: 100 / data.subjects.length })),
          }));
        }

        // Calcular notas
        const areaGrades = resolvedAreas.map(area => {
          const subjectResults = area.subjects.map(subject => {
            let grade: number | null = null;
            const components: { componentId: string; name: string; average: number | null; percentage: number }[] = [];

            if (subject.teacherAssignmentId) {
              const planKey = `${subject.teacherAssignmentId}_${firstTerm.id}`;
              const plan = plansMap.get(planKey);
              const studentPartials = partialsMap.get(eid) || [];
              const taPartials = studentPartials.filter(p => p.teacherAssignmentId === subject.teacherAssignmentId);

              if (plan && plan.components.length > 0) {
                let weightedSum = 0;
                let totalWeight = 0;
                for (const comp of plan.components) {
                  const scores = taPartials.filter(p => p.componentType === comp.code);
                  const avg = scores.length > 0 ? scores.reduce((s, p) => s + p.score, 0) / scores.length : null;
                  components.push({ componentId: comp.componentId, name: comp.name, average: avg, percentage: comp.percentage });
                  if (avg !== null) {
                    weightedSum += avg * comp.percentage;
                    totalWeight += comp.percentage;
                  }
                }
                grade = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
              } else {
                const scores = taPartials;
                if (scores.length > 0) {
                  grade = Math.round((scores.reduce((s, p) => s + p.score, 0) / scores.length) * 10) / 10;
                }
              }
            }

            const performanceLevel = grade !== null
              ? (scaleArray.find(s => grade! >= s.minScore && grade! <= s.maxScore)?.level || null)
              : null;

            // Logro base por asignatura
            const baseAch = baseAchievementBySubject.get(subject.name) || null;

            return {
              subject: subject.name, subjectCode: subject.code, teacher: subject.teacher,
              grade, weightPercentage: subject.weightPercentage, performanceLevel, components,
              achievement: baseAch, achievementObservation: null as string | null, judgment: null as string | null,
            };
          });

          const validGrades = subjectResults.filter(s => s.grade !== null);
          let areaAverage: number | null = null;
          if (validGrades.length > 0) {
            if (area.calculationType === 'WEIGHTED') {
              const ws = validGrades.reduce((acc, s) => acc + (s.grade! * s.weightPercentage), 0);
              const tw = validGrades.reduce((acc, s) => acc + s.weightPercentage, 0);
              areaAverage = tw > 0 ? Math.round((ws / tw) * 10) / 10 : null;
            } else {
              areaAverage = Math.round((validGrades.reduce((acc, s) => acc + s.grade!, 0) / validGrades.length) * 10) / 10;
            }
          }
          const areaPerformance = areaAverage
            ? (scaleArray.find(s => areaAverage! >= s.minScore && areaAverage! <= s.maxScore)?.level || null)
            : null;

          return {
            area: area.name, areaCode: area.code, weightPercentage: area.weightPercentage,
            calculationType: area.calculationType, areaAverage, areaPerformanceLevel: areaPerformance,
            subjects: subjectResults,
          };
        });

        const subjectGrades = areaGrades.flatMap(a => a.subjects);

        // Student achievements
        const studentAchs = achievementsMap.get(eid) || [];
        const achievements = studentAchs.map(sa => ({
          subject: sa.achievement.teacherAssignment?.subject?.name || '',
          orderNumber: sa.achievement.orderNumber,
          description: sa.approvedText || sa.suggestedText || sa.achievement.baseDescription,
          performanceLevel: sa.performanceLevel,
          observation: sa.observation || null,
          judgment: sa.approvedJudgment || sa.suggestedJudgment || null,
        }));

        const attendance = attendanceMap.get(eid) || { total: 0, present: 0, absent: 0, late: 0, excused: 0, attendanceRate: 0 };
        const studentObs = (observationsMap.get(eid) || []).slice(0, 10);
        const observations = studentObs.map(o => ({
          date: o.date, type: o.type, category: o.category, description: o.description,
          author: `${o.author.firstName} ${o.author.lastName}`,
        }));

        // Crear snapshot
        await prisma.termReportCardSnapshot.create({
          data: {
            academicTermId: firstTerm.id,
            studentEnrollmentId: eid,
            version: newVersion,
            generatedById: null,
            data: {
              institution: { id: institution.id, name: institution.name, nit: institution.nit },
              academicYear: { id: academicYear.id, year: academicYear.year, name: academicYear.name },
              term: { id: firstTerm.id, name: firstTerm.name, type: firstTerm.type },
              student: {
                id: enrollment.student.id, firstName: enrollment.student.firstName,
                lastName: enrollment.student.lastName, documentType: enrollment.student.documentType,
                documentNumber: enrollment.student.documentNumber,
              },
              group: { id: enrollment.group.id, name: enrollment.group.name, gradeLevel: enrollment.group.grade?.name || '' },
              areaGrades, subjectGrades, structureSource: 'snapshot',
              attendance, achievements, observations,
              generatedAt: new Date(),
            },
          },
        });
        totalSnapshots++;
      }

      console.log(`   ✅ ${group.name} - ${enrollments.length} snapshots regenerados`);
    } catch (error: any) {
      console.error(`   ❌ Error en grupo ${group.name}: ${error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`✅ COMPLETADO: ${totalSnapshots} snapshots regenerados (versión ${newVersion})`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

regenerateSnapshots()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
