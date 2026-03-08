import { PrismaClient, SchoolShift, GradeStage, AcademicTermType, PerformanceLevel } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';
import { seedPermissions } from './seeds/permissions.seed';

const prisma = new PrismaClient();

// ─── Generador determinista de notas (sin faker) ────────────────────────────
// Produce notas entre 1.0 y 5.0 con distribución realista
function deterministicScore(studentIdx: number, subjectIdx: number, termIdx: number, activityIdx: number): number {
  // Base por estudiante (simula capacidad académica)
  const studentBases = [4.2, 3.5, 2.8, 4.0, 3.8, 3.0, 4.5, 3.2, 3.6, 4.1];
  const base = studentBases[studentIdx % studentBases.length];
  // Variación por materia y actividad
  const variation = ((subjectIdx * 7 + termIdx * 13 + activityIdx * 3) % 15 - 7) / 10;
  const raw = base + variation;
  // Clamp entre 1.0 y 5.0, redondear a 1 decimal
  return Math.round(Math.max(1.0, Math.min(5.0, raw)) * 10) / 10;
}

async function main() {
  console.log('🌱 Iniciando seed de base de datos...\n');

  // ============================================
  // 1. CREAR ROLES DEL SISTEMA
  // ============================================
  console.log('📋 Creando roles...');
  
  const roleNames = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE'];
  const createdRoles: Record<string, any> = {};
  
  for (const roleName of roleNames) {
    createdRoles[roleName] = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }
  console.log(`   ✅ ${roleNames.length} roles creados\n`);

  // ============================================
  // 2. CREAR INSTITUCIÓN
  // ============================================
  console.log('🏫 Creando institución...');
  
  const institution = await prisma.institution.upsert({
    where: { daneCode: '108001001234' },
    update: {},
    create: {
      name: 'Institución Educativa Villa San Pablo',
      slug: 'ie-villa-san-pablo',
      daneCode: '108001001234',
      nit: '900123456-7',
      status: 'ACTIVE',
    },
  });
  console.log(`   ✅ Institución: ${institution.name}\n`);

  // ============================================
  // 2.5 HABILITAR MÓDULOS
  // ============================================
  console.log('📦 Habilitando módulos...');
  
  const modulesToEnable = [
    { module: 'DASHBOARD', features: ['DASHBOARD_STATS', 'DASHBOARD_ALERTS'] },
    { module: 'ACADEMIC', features: ['ACADEMIC_GRADES', 'ACADEMIC_AREAS', 'ACADEMIC_LOAD'] },
    { module: 'ATTENDANCE', features: ['ATTENDANCE_DAILY', 'ATTENDANCE_REPORTS'] },
    { module: 'EVALUATION', features: ['EVALUATION_ACTIVITIES', 'EVALUATION_RUBRICS'] },
    { module: 'RECOVERY', features: ['RECOVERY_PERIOD', 'RECOVERY_FINAL'] },
    { module: 'REPORTS', features: ['RPT_ADMIN', 'RPT_ACAD', 'RPT_BULLETINS', 'RPT_EXPORT'] },
    { module: 'COMMUNICATIONS', features: ['COMM_MESSAGES', 'COMM_ANNOUNCEMENTS'] },
    { module: 'OBSERVER', features: ['OBSERVER_CREATE', 'OBSERVER_VIEW'] },
    { module: 'PERFORMANCE', features: ['PERF_VIEW', 'PERF_EDIT'] },
    { module: 'USERS', features: ['USERS_MANAGE', 'USERS_IMPORT'] },
    { module: 'CONFIG', features: ['CONFIG_GENERAL', 'CONFIG_ACADEMIC'] },
  ];

  for (const mod of modulesToEnable) {
    await prisma.institutionModule.upsert({
      where: { institutionId_module: { institutionId: institution.id, module: mod.module as any } },
      update: { isActive: true, features: mod.features },
      create: { institutionId: institution.id, module: mod.module as any, isActive: true, features: mod.features },
    });
  }
  console.log(`   ✅ ${modulesToEnable.length} módulos habilitados\n`);

  // ============================================
  // 3. SEDE PRINCIPAL
  // ============================================
  console.log('🏢 Creando sede...');
  
  const campus = await prisma.campus.upsert({
    where: { institutionId_name: { institutionId: institution.id, name: 'Sede Principal' } },
    update: {},
    create: { name: 'Sede Principal', address: 'Calle 45 # 23-15', institutionId: institution.id },
  });
  console.log(`   ✅ Sede: ${campus.name}\n`);

  // ============================================
  // 4. JORNADA
  // ============================================
  console.log('⏰ Creando jornada...');
  
  const morningShift = await prisma.shift.upsert({
    where: { campusId_type: { campusId: campus.id, type: SchoolShift.MORNING } },
    update: {},
    create: { name: 'Mañana', type: SchoolShift.MORNING, campusId: campus.id },
  });
  console.log(`   ✅ Jornada: ${morningShift.name}\n`);

  // ============================================
  // 5. AÑO ACADÉMICO
  // ============================================
  console.log('📅 Creando año académico...');
  
  const academicYear = await prisma.academicYear.upsert({
    where: { institutionId_year: { institutionId: institution.id, year: 2026 } },
    update: {},
    create: {
      year: 2026,
      name: 'Año Lectivo 2026',
      startDate: new Date('2026-01-20'),
      endDate: new Date('2026-11-30'),
      status: 'ACTIVE',
      activatedAt: new Date('2026-01-20'),
      institutionId: institution.id,
    },
  });
  console.log(`   ✅ Año académico: ${academicYear.year}\n`);

  // ============================================
  // 6. PERÍODOS ACADÉMICOS (2 períodos como se solicitó)
  // ============================================
  console.log('📆 Creando períodos académicos...');
  
  const termsData = [
    { name: 'Período 1', order: 1, weight: 50, start: '2026-01-20', end: '2026-06-15' },
    { name: 'Período 2', order: 2, weight: 50, start: '2026-07-15', end: '2026-11-30' },
  ];

  const terms: any[] = [];
  for (const t of termsData) {
    const term = await prisma.academicTerm.upsert({
      where: { academicYearId_order: { academicYearId: academicYear.id, order: t.order } },
      update: {},
      create: {
        name: t.name,
        type: AcademicTermType.PERIOD,
        order: t.order,
        weightPercentage: t.weight,
        status: 'OPEN',
        startDate: new Date(t.start),
        endDate: new Date(t.end),
        academicYearId: academicYear.id,
      },
    });
    terms.push(term);
  }
  console.log(`   ✅ ${terms.length} períodos creados\n`);

  // ============================================
  // 7. GRADO (6° Secundaria)
  // ============================================
  console.log('🎓 Creando grado...');
  
  const grade = await prisma.grade.upsert({
    where: { institutionId_stage_name: { institutionId: institution.id, stage: GradeStage.BASICA_SECUNDARIA, name: '6°' } },
    update: {},
    create: { institutionId: institution.id, name: '6°', stage: GradeStage.BASICA_SECUNDARIA, number: 6 },
  });
  console.log(`   ✅ Grado: ${grade.name}\n`);

  // ============================================
  // 8. GRUPO (6°A)
  // ============================================
  console.log('👥 Creando grupo...');
  
  const group = await prisma.group.upsert({
    where: { campusId_shiftId_gradeId_name: { campusId: campus.id, shiftId: morningShift.id, gradeId: grade.id, name: 'A' } },
    update: {},
    create: { name: 'A', campusId: campus.id, gradeId: grade.id, shiftId: morningShift.id },
  });
  console.log(`   ✅ Grupo: 6°A\n`);

  // ============================================
  // 9. ÁREA Y ASIGNATURAS (1 área, 3 asignaturas)
  // ============================================
  console.log('📚 Creando área y asignaturas...');
  
  const area = await prisma.area.upsert({
    where: { institutionId_name: { institutionId: institution.id, name: 'Ciencias Básicas' } },
    update: {},
    create: { name: 'Ciencias Básicas', code: 'CB', institutionId: institution.id, order: 1 },
  });

  const subjectsData = [
    { name: 'Matemáticas', code: 'MAT', order: 1 },
    { name: 'Lenguaje', code: 'LEN', order: 2 },
    { name: 'Ciencias', code: 'CIE', order: 3 },
  ];

  const subjects: any[] = [];
  for (const s of subjectsData) {
    const subject = await prisma.subject.upsert({
      where: { areaId_name: { areaId: area.id, name: s.name } },
      update: {},
      create: { name: s.name, code: s.code, areaId: area.id, order: s.order },
    });
    subjects.push(subject);
  }
  console.log(`   ✅ 1 área, ${subjects.length} asignaturas\n`);

  // ============================================
  // 10. ESCALA DE VALORACIÓN
  // ============================================
  console.log('📊 Creando escala de valoración...');
  
  const performanceLevels = [
    { level: PerformanceLevel.SUPERIOR, minScore: 4.5, maxScore: 5.0 },
    { level: PerformanceLevel.ALTO, minScore: 4.0, maxScore: 4.4 },
    { level: PerformanceLevel.BASICO, minScore: 3.0, maxScore: 3.9 },
    { level: PerformanceLevel.BAJO, minScore: 1.0, maxScore: 2.9 },
  ];

  for (const pl of performanceLevels) {
    await prisma.performanceScale.upsert({
      where: { institutionId_level: { institutionId: institution.id, level: pl.level } },
      update: {},
      create: { level: pl.level, minScore: pl.minScore, maxScore: pl.maxScore, institutionId: institution.id },
    });
  }
  console.log(`   ✅ ${performanceLevels.length} niveles de desempeño\n`);

  // ============================================
  // 11. COMPONENTES EVALUATIVOS (institucional)
  // ============================================
  console.log('📝 Creando componentes evaluativos...');

  const componentCog = await prisma.evaluationComponent.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'COGNITIVO' } },
    update: {},
    create: { institutionId: institution.id, code: 'COGNITIVO', name: 'Cognitivo' },
  });

  const componentProc = await prisma.evaluationComponent.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'PROCEDIMENTAL' } },
    update: {},
    create: { institutionId: institution.id, code: 'PROCEDIMENTAL', name: 'Procedimental' },
  });
  console.log(`   ✅ 2 componentes evaluativos\n`);

  // ============================================
  // 12. USUARIOS: SuperAdmin, Admin, Coordinador, 3 Docentes
  // ============================================
  console.log('👤 Creando usuarios...');
  
  const hashedPassword = await bcryptjs.hash('Demo2026!', 10);

  // SuperAdmin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@edusyn.co' },
    update: {},
    create: {
      email: 'superadmin@edusyn.co', username: 'superadmin',
      passwordHash: await bcryptjs.hash('Super2026!', 10),
      firstName: 'Super', lastName: 'Administrador',
      documentType: 'CC', documentNumber: '0000000001', isSuperAdmin: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: createdRoles['SUPERADMIN'].id } },
    update: {},
    create: { userId: superAdmin.id, roleId: createdRoles['SUPERADMIN'].id },
  });

  // Admin institucional
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@villasanpablo.edu.co' },
    update: {},
    create: {
      email: 'admin@villasanpablo.edu.co', username: 'admin',
      passwordHash: hashedPassword,
      firstName: 'Administrador', lastName: 'Sistema',
      documentType: 'CC', documentNumber: '1234567890',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: createdRoles['ADMIN_INSTITUTIONAL'].id } },
    update: {},
    create: { userId: adminUser.id, roleId: createdRoles['ADMIN_INSTITUTIONAL'].id },
  });
  await prisma.institutionUser.upsert({
    where: { userId_institutionId: { userId: adminUser.id, institutionId: institution.id } },
    update: { isAdmin: true },
    create: { userId: adminUser.id, institutionId: institution.id, isAdmin: true },
  });

  // Coordinador
  const coordinatorUser = await prisma.user.upsert({
    where: { email: 'coordinador@villasanpablo.edu.co' },
    update: {},
    create: {
      email: 'coordinador@villasanpablo.edu.co', username: 'mcoordinadora',
      passwordHash: hashedPassword,
      firstName: 'María', lastName: 'Coordinadora',
      documentType: 'CC', documentNumber: '9876543210',
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: coordinatorUser.id, roleId: createdRoles['COORDINADOR'].id } },
    update: {},
    create: { userId: coordinatorUser.id, roleId: createdRoles['COORDINADOR'].id },
  });
  await prisma.institutionUser.upsert({
    where: { userId_institutionId: { userId: coordinatorUser.id, institutionId: institution.id } },
    update: {},
    create: { userId: coordinatorUser.id, institutionId: institution.id },
  });

  // 3 Docentes (uno por materia)
  const teachersData = [
    { email: 'prof.matematicas@villasanpablo.edu.co', username: 'profmat', firstName: 'Carlos', lastName: 'Ramírez', doc: '5500000001' },
    { email: 'prof.lenguaje@villasanpablo.edu.co', username: 'proflen', firstName: 'Laura', lastName: 'Gómez', doc: '5500000002' },
    { email: 'prof.ciencias@villasanpablo.edu.co', username: 'profcie', firstName: 'Andrés', lastName: 'Martínez', doc: '5500000003' },
  ];

  const teachers: any[] = [];
  for (const td of teachersData) {
    const teacher = await prisma.user.upsert({
      where: { email: td.email },
      update: {},
      create: {
        email: td.email, username: td.username,
        passwordHash: hashedPassword,
        firstName: td.firstName, lastName: td.lastName,
        documentType: 'CC', documentNumber: td.doc,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: teacher.id, roleId: createdRoles['DOCENTE'].id } },
      update: {},
      create: { userId: teacher.id, roleId: createdRoles['DOCENTE'].id },
    });
    await prisma.institutionUser.upsert({
      where: { userId_institutionId: { userId: teacher.id, institutionId: institution.id } },
      update: {},
      create: { userId: teacher.id, institutionId: institution.id },
    });
    teachers.push(teacher);
  }
  console.log(`   ✅ 1 SuperAdmin, 1 Admin, 1 Coordinador, ${teachers.length} Docentes\n`);

  // ============================================
  // 13. ASIGNACIONES DOCENTES (3: uno por materia)
  // ============================================
  console.log('📚 Creando asignaciones docentes...');

  const assignments: any[] = [];
  for (let i = 0; i < subjects.length; i++) {
    const existing = await prisma.teacherAssignment.findFirst({
      where: {
        academicYearId: academicYear.id,
        groupId: group.id,
        subjectId: subjects[i].id,
        teacherId: teachers[i].id,
      },
    });
    if (existing) {
      assignments.push(existing);
    } else {
      const assignment = await prisma.teacherAssignment.create({
        data: {
          institutionId: institution.id,
          teacherId: teachers[i].id,
          subjectId: subjects[i].id,
          groupId: group.id,
          academicYearId: academicYear.id,
          weeklyHours: 5,
          startDate: new Date('2026-01-20'),
        },
      });
      assignments.push(assignment);
    }
  }
  console.log(`   ✅ ${assignments.length} asignaciones (1 por materia)\n`);

  // ============================================
  // 14. PLANES Y ACTIVIDADES EVALUATIVAS (2 por materia × 2 períodos = 12 total)
  // ============================================
  console.log('📝 Creando planes y actividades evaluativas...');

  const allActivities: any[] = [];

  for (let si = 0; si < assignments.length; si++) {
    const assignment = assignments[si];
    for (let ti = 0; ti < terms.length; ti++) {
      const term = terms[ti];

      // Plan de evaluación (1 por asignación+período)
      const plan = await prisma.evaluationPlan.upsert({
        where: { teacherAssignmentId_academicTermId: { teacherAssignmentId: assignment.id, academicTermId: term.id } },
        update: {},
        create: { teacherAssignmentId: assignment.id, academicTermId: term.id },
      });

      // Ponderaciones del plan: 60% Cognitivo, 40% Procedimental
      await prisma.evaluationPlanComponentWeight.upsert({
        where: { evaluationPlanId_componentId: { evaluationPlanId: plan.id, componentId: componentCog.id } },
        update: {},
        create: { evaluationPlanId: plan.id, componentId: componentCog.id, percentage: 60 },
      });
      await prisma.evaluationPlanComponentWeight.upsert({
        where: { evaluationPlanId_componentId: { evaluationPlanId: plan.id, componentId: componentProc.id } },
        update: {},
        create: { evaluationPlanId: plan.id, componentId: componentProc.id, percentage: 40 },
      });

      // 2 actividades evaluativas por materia por período
      const activityDefs = [
        { name: `Examen ${subjectsData[si].name} P${ti + 1}`, component: componentCog, dueOffset: 30 },
        { name: `Taller ${subjectsData[si].name} P${ti + 1}`, component: componentProc, dueOffset: 60 },
      ];

      for (const ad of activityDefs) {
        const dueDate = new Date(term.startDate!);
        dueDate.setDate(dueDate.getDate() + ad.dueOffset);

        const activity = await prisma.evaluativeActivity.create({
          data: {
            institutionId: institution.id,
            teacherAssignmentId: assignment.id,
            academicTermId: term.id,
            evaluationPlanId: plan.id,
            componentId: ad.component.id,
            name: ad.name,
            dueDate,
          },
        });
        allActivities.push({ activity, si, ti, component: ad.component });
      }
    }
  }
  console.log(`   ✅ ${allActivities.length} actividades evaluativas (2 × 3 materias × 2 períodos)\n`);

  // ============================================
  // 15. ESTUDIANTES (10)
  // ============================================
  console.log('🧑‍🎓 Creando estudiantes...');

  const studentsData = [
    { firstName: 'Juan', lastName: 'Pérez', doc: '1100000001' },
    { firstName: 'María', lastName: 'López', doc: '1100000002' },
    { firstName: 'Santiago', lastName: 'García', doc: '1100000003' },
    { firstName: 'Valentina', lastName: 'Rodríguez', doc: '1100000004' },
    { firstName: 'Sebastián', lastName: 'Martínez', doc: '1100000005' },
    { firstName: 'Isabella', lastName: 'Hernández', doc: '1100000006' },
    { firstName: 'Mateo', lastName: 'Díaz', doc: '1100000007' },
    { firstName: 'Sofía', lastName: 'Torres', doc: '1100000008' },
    { firstName: 'Daniel', lastName: 'Ramírez', doc: '1100000009' },
    { firstName: 'Luciana', lastName: 'Castro', doc: '1100000010' },
  ];

  const students: any[] = [];
  for (const sd of studentsData) {
    const student = await prisma.student.upsert({
      where: { institutionId_documentNumber: { institutionId: institution.id, documentNumber: sd.doc } },
      update: {},
      create: {
        institutionId: institution.id,
        documentType: 'TI',
        documentNumber: sd.doc,
        firstName: sd.firstName,
        lastName: sd.lastName,
        birthDate: new Date('2014-03-15'),
        gender: sd.firstName.endsWith('a') ? 'F' : 'M',
      },
    });
    students.push(student);
  }
  console.log(`   ✅ ${students.length} estudiantes\n`);

  // ============================================
  // 16. MATRÍCULAS (10, todas ACTIVE)
  // ============================================
  console.log('📋 Creando matrículas...');

  const enrollments: any[] = [];
  for (const student of students) {
    const existing = await prisma.studentEnrollment.findUnique({
      where: { studentId_academicYearId: { studentId: student.id, academicYearId: academicYear.id } },
    });
    if (existing) {
      enrollments.push(existing);
    } else {
      const enrollment = await prisma.studentEnrollment.create({
        data: {
          institutionId: institution.id,
          studentId: student.id,
          academicYearId: academicYear.id,
          groupId: group.id,
          enrollmentType: 'NEW',
          status: 'ACTIVE',
          shift: SchoolShift.MORNING,
          enrollmentDate: new Date('2026-01-20'),
          enrolledById: adminUser.id,
        },
      });
      enrollments.push(enrollment);
    }
  }
  console.log(`   ✅ ${enrollments.length} matrículas activas\n`);

  // ============================================
  // 17. STUDENTGRADE (10 estudiantes × 12 actividades = 120)
  // ============================================
  console.log('📊 Creando notas por actividad (StudentGrade)...');

  let studentGradeCount = 0;
  for (let ei = 0; ei < enrollments.length; ei++) {
    const enrollment = enrollments[ei];
    for (const { activity, si, ti } of allActivities) {
      const score = deterministicScore(ei, si, ti, studentGradeCount % 2);
      await prisma.studentGrade.upsert({
        where: { studentEnrollmentId_evaluativeActivityId: { studentEnrollmentId: enrollment.id, evaluativeActivityId: activity.id } },
        update: { score },
        create: {
          institutionId: institution.id,
          studentEnrollmentId: enrollment.id,
          evaluativeActivityId: activity.id,
          score,
        },
      });
      studentGradeCount++;
    }
  }
  console.log(`   ✅ ${studentGradeCount} notas de actividades\n`);

  // ============================================
  // 18. PARTIALGRADES (10 × 3 materias × 2 períodos × 2 componentes = 120)
  // ============================================
  console.log('📊 Creando notas parciales (PartialGrade)...');

  let partialGradeCount = 0;
  for (let ei = 0; ei < enrollments.length; ei++) {
    const enrollment = enrollments[ei];
    for (let si = 0; si < assignments.length; si++) {
      const assignment = assignments[si];
      for (let ti = 0; ti < terms.length; ti++) {
        const term = terms[ti];
        const componentTypes = [
          { type: 'COGNITIVO', name: 'Examen' },
          { type: 'PROCEDIMENTAL', name: 'Taller' },
        ];
        for (let ci = 0; ci < componentTypes.length; ci++) {
          const ct = componentTypes[ci];
          const score = deterministicScore(ei, si, ti, ci);

          const existing = await prisma.partialGrade.findFirst({
            where: {
              studentEnrollmentId: enrollment.id,
              teacherAssignmentId: assignment.id,
              academicTermId: term.id,
              componentType: ct.type,
              activityIndex: 1,
            },
          });
          if (!existing) {
            await prisma.partialGrade.create({
              data: {
                institutionId: institution.id,
                studentEnrollmentId: enrollment.id,
                teacherAssignmentId: assignment.id,
                academicTermId: term.id,
                componentType: ct.type,
                activityIndex: 1,
                activityName: `${ct.name} ${subjectsData[si].name}`,
                activityType: ct.name,
                score,
              },
            });
          }
          partialGradeCount++;
        }
      }
    }
  }
  console.log(`   ✅ ${partialGradeCount} notas parciales\n`);

  // ============================================
  // 19. PERIODFINALGRADE (10 × 3 materias × 2 períodos = 60)
  // ============================================
  console.log('📊 Creando notas finales de período (PeriodFinalGrade)...');

  let periodFinalGradeCount = 0;
  for (let ei = 0; ei < enrollments.length; ei++) {
    const enrollment = enrollments[ei];
    for (let si = 0; si < subjects.length; si++) {
      const subject = subjects[si];
      const teacher = teachers[si];
      for (let ti = 0; ti < terms.length; ti++) {
        const term = terms[ti];
        // Promedio ponderado de las 2 actividades del período
        const scoreCog = deterministicScore(ei, si, ti, 0);
        const scoreProc = deterministicScore(ei, si, ti, 1);
        const finalScore = Math.round((scoreCog * 0.6 + scoreProc * 0.4) * 10) / 10;

        const existing = await prisma.periodFinalGrade.findUnique({
          where: { studentEnrollmentId_academicTermId_subjectId: { studentEnrollmentId: enrollment.id, academicTermId: term.id, subjectId: subject.id } },
        });
        if (!existing) {
          await prisma.periodFinalGrade.create({
            data: {
              institutionId: institution.id,
              studentEnrollmentId: enrollment.id,
              academicTermId: term.id,
              subjectId: subject.id,
              finalScore,
              enteredById: teacher.id,
            },
          });
        }
        periodFinalGradeCount++;
      }
    }
  }
  console.log(`   ✅ ${periodFinalGradeCount} notas finales de período\n`);

  // ============================================
  // 20. PERMISOS DEL SISTEMA
  // ============================================
  await seedPermissions();

  // ============================================
  // 21. DIMENSIONES DEL DESARROLLO (PREESCOLAR)
  // ============================================
  console.log('🎨 Creando dimensiones del desarrollo...');
  
  const dimensions = [
    { name: 'Dimensión Cognitiva', code: 'COG', description: 'Desarrollo del pensamiento lógico, resolución de problemas y construcción de conocimiento.', order: 1 },
    { name: 'Dimensión Comunicativa', code: 'COM', description: 'Desarrollo del lenguaje oral, escrito, gestual y expresión de ideas.', order: 2 },
    { name: 'Dimensión Corporal', code: 'COR', description: 'Desarrollo de habilidades motrices, coordinación y conciencia corporal.', order: 3 },
    { name: 'Dimensión Socioafectiva', code: 'SOC', description: 'Desarrollo emocional, relaciones interpersonales y autoestima.', order: 4 },
    { name: 'Dimensión Estética', code: 'EST', description: 'Desarrollo de la sensibilidad artística, creatividad y apreciación estética.', order: 5 },
    { name: 'Dimensión Ética', code: 'ETI', description: 'Desarrollo de valores, normas de convivencia y responsabilidad.', order: 6 },
    { name: 'Dimensión Espiritual', code: 'ESP', description: 'Desarrollo de la trascendencia, sentido de vida y valores espirituales.', order: 7 },
  ];
  
  for (const dim of dimensions) {
    const existing = await prisma.dimension.findFirst({ where: { code: dim.code } });
    if (existing) {
      await prisma.dimension.update({ where: { id: existing.id }, data: { name: dim.name, description: dim.description, order: dim.order } });
    } else {
      await prisma.dimension.create({ data: { name: dim.name, code: dim.code, description: dim.description, order: dim.order } });
    }
  }
  console.log(`   ✅ ${dimensions.length} dimensiones\n`);

  // ============================================
  // RESUMEN FINAL
  // ============================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ SEED COMPLETADO EXITOSAMENTE');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`   Estudiantes creados:        ${students.length}`);
  console.log(`   Matrículas activas:         ${enrollments.length}`);
  console.log(`   Asignaciones docentes:      ${assignments.length}`);
  console.log(`   Actividades evaluativas:    ${allActivities.length}`);
  console.log(`   StudentGrade (por actividad):  ${studentGradeCount}`);
  console.log(`   PartialGrade (parciales):      ${partialGradeCount}`);
  console.log(`   PeriodFinalGrade (finales):    ${periodFinalGradeCount}`);
  console.log(`   Total notas:                ${studentGradeCount + partialGradeCount + periodFinalGradeCount}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n📧 USUARIOS DE PRUEBA (contraseña: Demo2026!):');
  console.log('   🔑 Admin:            admin@villasanpablo.edu.co');
  console.log('   🔑 Coordinador:      coordinador@villasanpablo.edu.co');
  console.log('   🔑 Prof. Matemáticas: prof.matematicas@villasanpablo.edu.co');
  console.log('   🔑 Prof. Lenguaje:    prof.lenguaje@villasanpablo.edu.co');
  console.log('   🔑 Prof. Ciencias:    prof.ciencias@villasanpablo.edu.co');
  console.log('   🔑 SuperAdmin:       superadmin@edusyn.co (Super2026!)');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
