/**
 * SEED DEMO COMPLETO — Institución Demo con TODOS los módulos
 *
 * Crea "Colegio Demo Excelencia Académica" (IED DEL SABER) con:
 * ✅ Año 2026: P1 FINALIZED, P2 FINALIZED, P3 OPEN, P4 DRAFT
 * ✅ 4 grados (6°-9°) × 2 grupos (A,B) = 8 grupos
 * ✅ 4 áreas × ~3 asignaturas = 12 asignaturas
 * ✅ 8 docentes + rector + coordinador + 1 estudiante demo
 * ✅ ~200 estudiantes con perfiles de rendimiento realistas
 * ✅ PeriodFinalGrade para P1, P2, P3
 * ✅ Asistencia P1, P2
 * ✅ Observaciones de estudiantes
 * ✅ Snapshots correctos P1 y P2 (estructura completa)
 * ✅ Recuperaciones de período (P1)
 * ✅ Módulo financiero (conceptos, eventos, pagos)
 * ✅ Proceso de elección finalizado
 * ✅ Mensajes entre docentes
 * ✅ Inclusión educativa (perfiles + planes)
 * ✅ RBAC dual-write (InstitutionUserRole)
 * ✅ Config de boletines
 *
 * IDEMPOTENTE: Busca por SLUG; si ya existe, aborta.
 * NO DESTRUCTIVO: No modifica ni elimina datos existentes.
 *
 * Ejecutar: npx tsx prisma/seed-demo-complete.ts
 */

import { PrismaClient, GradeStage, SchoolShift, AcademicTermType, PerformanceLevel } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

const SLUG = 'ied-del-saber';
const DANE = '999999999999';
const PWD = 'Demo2026!';

const AREAS = [
  { name: 'Matemáticas', code: 'MAT', subjects: [
    { name: 'Matemáticas', code: 'MAT01', hours: 5 },
    { name: 'Estadística', code: 'EST01', hours: 2 },
    { name: 'Geometría', code: 'GEO01', hours: 2 },
  ]},
  { name: 'Ciencias Naturales', code: 'CN', subjects: [
    { name: 'Biología', code: 'BIO01', hours: 3 },
    { name: 'Física', code: 'FIS01', hours: 3 },
    { name: 'Química', code: 'QUI01', hours: 3 },
  ]},
  { name: 'Humanidades', code: 'HUM', subjects: [
    { name: 'Lengua Castellana', code: 'LEN01', hours: 4 },
    { name: 'Inglés', code: 'ING01', hours: 3 },
    { name: 'Speaking and Life Skills', code: 'SLS01', hours: 2 },
  ]},
  { name: 'Ciencias Sociales', code: 'SOC', subjects: [
    { name: 'Ciencias Sociales', code: 'SOC01', hours: 3 },
    { name: 'Filosofía', code: 'FIL01', hours: 2 },
    { name: 'Ética y Valores', code: 'ETV01', hours: 1 },
  ]},
];

const GRADES_CFG = [
  { name: '6°', stage: 'BASICA_SECUNDARIA' as GradeStage, order: 6 },
  { name: '7°', stage: 'BASICA_SECUNDARIA' as GradeStage, order: 7 },
  { name: '8°', stage: 'BASICA_SECUNDARIA' as GradeStage, order: 8 },
  { name: '9°', stage: 'BASICA_SECUNDARIA' as GradeStage, order: 9 },
];

const FIRST_NAMES_M = ['Santiago', 'Mateo', 'Samuel', 'Sebastián', 'Nicolás', 'Alejandro', 'Daniel', 'Juan', 'Andrés', 'David', 'Carlos', 'Miguel', 'Felipe', 'Diego', 'Camilo'];
const FIRST_NAMES_F = ['Valentina', 'Sofía', 'Isabella', 'Mariana', 'Gabriela', 'Daniela', 'Laura', 'María', 'Natalia', 'Camila', 'Sara', 'Paula', 'Andrea', 'Juliana', 'Ana'];
const LAST_NAMES = ['García', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales', 'Reyes', 'Vargas', 'Castillo', 'Ortiz', 'Jiménez', 'Gutiérrez', 'Mendoza', 'Ruiz', 'Rojas'];

type Profile = 'excellent' | 'good' | 'average' | 'struggling' | 'failing';

function genGrade(profile: Profile, min = 1.0, max = 5.0): number {
  const r = Math.random();
  let g: number;
  switch (profile) {
    case 'excellent': g = 4.5 + r * 0.5; break;
    case 'good': g = 3.8 + r * 0.7; break;
    case 'average': g = 3.0 + r * 1.0; break;
    case 'struggling': g = 2.0 + r * 1.5; break;
    case 'failing': g = 1.0 + r * 1.5; break;
  }
  return Math.round(Math.max(min, Math.min(max, g)) * 10) / 10;
}

function pickProfile(): Profile {
  const r = Math.random();
  if (r < 0.15) return 'excellent';
  if (r < 0.40) return 'good';
  if (r < 0.70) return 'average';
  if (r < 0.90) return 'struggling';
  return 'failing';
}

function pickAttendance(profile: Profile, highAbsence: boolean): string {
  const r = Math.random();
  if (highAbsence) return r < 0.35 ? 'ABSENT' : r < 0.45 ? 'LATE' : 'PRESENT';
  switch (profile) {
    case 'excellent': return r < 0.02 ? 'ABSENT' : r < 0.05 ? 'LATE' : 'PRESENT';
    case 'good': return r < 0.05 ? 'ABSENT' : r < 0.10 ? 'LATE' : 'PRESENT';
    case 'average': return r < 0.08 ? 'ABSENT' : r < 0.15 ? 'LATE' : 'PRESENT';
    case 'struggling': return r < 0.12 ? 'ABSENT' : r < 0.20 ? 'LATE' : 'PRESENT';
    case 'failing': return r < 0.20 ? 'ABSENT' : r < 0.30 ? 'LATE' : 'PRESENT';
  }
}

function weekdaysBetween(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const d = new Date(start);
  while (d <= end) {
    if (d.getDay() !== 0 && d.getDay() !== 6) dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

function sha256(data: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function seedDemo() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏫 SEED DEMO COMPLETO — Institución Demo con todos los módulos');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ─── Idempotencia ────────────────────────────────────────────────────
  const existing = await prisma.institution.findFirst({ where: { slug: SLUG } });
  if (existing) {
    console.log(`⚠️  Institución "${SLUG}" ya existe (id: ${existing.id}). Abortando.`);
    return;
  }

  const hashedPwd = await bcrypt.hash(PWD, 10);

  // ─── PASO 1: Institución + módulos ──────────────────────────────────
  console.log('🏫 PASO 1: Creando institución...');
  const institution = await prisma.institution.create({
    data: {
      name: 'Colegio Demo Excelencia Académica',
      slug: SLUG,
      daneCode: DANE,
      nit: '900123456-7',
      address: 'Calle 100 #15-20, Bogotá D.C.',
      phone: '601-555-0001',
      email: 'contacto@demo-excelencia.edu.co',
      isDemo: true,
      modules: {
        create: [
          { module: 'ACADEMIC' }, { module: 'ENROLLMENTS' }, { module: 'EVALUATION' },
          { module: 'ATTENDANCE' }, { module: 'REPORTS' }, { module: 'FINANCE' },
          { module: 'ELECTIONS' }, { module: 'COMMUNICATIONS' }, { module: 'OBSERVER' },
        ],
      },
    },
  });
  console.log(`   ✅ ${institution.name} (${institution.id})\n`);

  // ─── PASO 2: Escala de desempeño ───────────────────────────────────
  console.log('📊 PASO 2: Escala de desempeño...');
  const scales: Array<{ level: PerformanceLevel; min: number; max: number }> = [
    { level: 'BAJO', min: 1.0, max: 2.9 },
    { level: 'BASICO', min: 3.0, max: 3.9 },
    { level: 'ALTO', min: 4.0, max: 4.5 },
    { level: 'SUPERIOR', min: 4.6, max: 5.0 },
  ];
  for (const s of scales) {
    await prisma.performanceScale.create({
      data: { institutionId: institution.id, level: s.level, minScore: s.min, maxScore: s.max },
    });
  }
  console.log('   ✅ Escala 1.0–5.0\n');

  // ─── PASO 3: Campus + Jornada ───────────────────────────────────────
  console.log('🏢 PASO 3: Campus + jornada...');
  const campus = await prisma.campus.create({
    data: { institutionId: institution.id, name: 'Sede Principal', address: 'Calle 100 #15-20' },
  });
  const shift = await prisma.shift.create({
    data: { campusId: campus.id, name: 'Mañana', type: 'MORNING' as SchoolShift },
  });
  console.log('   ✅ Sede Principal / Mañana\n');

  // ─── PASO 4: Año académico + 4 Períodos ──────────────────────────
  console.log('📅 PASO 4: Año académico + períodos...');
  const academicYear = await prisma.academicYear.create({
    data: {
      institutionId: institution.id, year: 2026, name: 'Año Lectivo 2026',
      startDate: new Date('2026-01-20'), endDate: new Date('2026-11-30'),
      status: 'ACTIVE',
    },
  });

  const termsCfg = [
    { name: 'Período 1', type: 'PERIOD' as AcademicTermType, order: 1, weight: 25, start: '2026-01-20', end: '2026-04-05', status: 'FINALIZED' },
    { name: 'Período 2', type: 'PERIOD' as AcademicTermType, order: 2, weight: 25, start: '2026-04-14', end: '2026-06-20', status: 'FINALIZED' },
    { name: 'Período 3', type: 'PERIOD' as AcademicTermType, order: 3, weight: 25, start: '2026-07-13', end: '2026-09-19', status: 'OPEN' },
    { name: 'Período 4', type: 'PERIOD' as AcademicTermType, order: 4, weight: 25, start: '2026-09-28', end: '2026-11-28', status: 'DRAFT' },
  ];

  const terms: any[] = [];
  for (const t of termsCfg) {
    const term = await prisma.academicTerm.create({
      data: {
        academicYearId: academicYear.id, name: t.name, type: t.type, order: t.order,
        weightPercentage: t.weight, startDate: new Date(t.start), endDate: new Date(t.end),
        // Status will be set later for FINALIZED
      },
    });
    terms.push(term);
  }
  console.log(`   ✅ ${terms.length} períodos creados\n`);

  // ─── PASO 5: Grados + Grupos ──────────────────────────────────────
  console.log('🎓 PASO 5: Grados + grupos...');
  const gradeMap: Record<string, any> = {};
  const allGroups: any[] = [];
  const groupMap: Record<string, any> = {};

  for (const gc of GRADES_CFG) {
    const grade = await prisma.grade.upsert({
      where: { institutionId_stage_name: { institutionId: institution.id, stage: gc.stage, name: gc.name } },
      update: {},
      create: { institutionId: institution.id, name: gc.name, stage: gc.stage, number: gc.order },
    });
    gradeMap[gc.name] = grade;
    for (const gName of ['A', 'B']) {
      const group = await prisma.group.create({
        data: {
          campusId: campus.id, gradeId: grade.id, shiftId: shift.id,
          name: gName, maxCapacity: 35,
        },
      });
      allGroups.push(group);
      groupMap[`${gc.name}-${gName}`] = group;
    }
  }
  console.log(`   ✅ ${GRADES_CFG.length} grados, ${allGroups.length} grupos\n`);

  // ─── PASO 6: Áreas + Asignaturas ─────────────────────────────────
  console.log('📚 PASO 6: Áreas + asignaturas...');
  const areaMap: Record<string, any> = {};
  const allSubjects: any[] = [];

  for (const ad of AREAS) {
    const area = await prisma.area.create({
      data: { institutionId: institution.id, name: ad.name, code: ad.code },
    });
    areaMap[ad.code] = area;
    for (const sd of ad.subjects) {
      const subject = await prisma.subject.create({
        data: {
          areaId: area.id,
          name: sd.name, code: sd.code,
        },
      });
      allSubjects.push(subject);
    }
  }
  console.log(`   ✅ ${Object.keys(areaMap).length} áreas, ${allSubjects.length} asignaturas\n`);

  // ─── PASO 7: Roles (lookup) ──────────────────────────────────────
  console.log('🔑 PASO 7: Usuarios + roles + RBAC...');
  const roleAdmin = await prisma.role.findFirst({ where: { name: 'ADMIN_INSTITUTIONAL' } });
  const roleCoord = await prisma.role.findFirst({ where: { name: 'COORDINADOR' } });
  const roleDoc = await prisma.role.findFirst({ where: { name: 'DOCENTE' } });
  const roleEst = await prisma.role.findFirst({ where: { name: 'ESTUDIANTE' } });

  if (!roleAdmin || !roleCoord || !roleDoc || !roleEst) {
    throw new Error('Roles no encontrados. Asegúrese de que los roles ADMIN_INSTITUTIONAL, COORDINADOR, DOCENTE, ESTUDIANTE existan.');
  }

  // Helper: create user + link to institution + UserRole + InstitutionUserRole
  async function createDemoUser(data: { email: string; firstName: string; lastName: string; roleId: string; isAdmin?: boolean }) {
    const user = await prisma.user.create({
      data: {
        email: data.email, passwordHash: hashedPwd,
        firstName: data.firstName, lastName: data.lastName, isActive: true,
      },
    });
    // UserRole (legacy dual-write)
    await prisma.userRole.create({ data: { userId: user.id, roleId: data.roleId } });
    // InstitutionUser + InstitutionUserRole (RBAC)
    const iu = await prisma.institutionUser.create({
      data: { userId: user.id, institutionId: institution.id, isAdmin: data.isAdmin || false },
    });
    await (prisma as any).institutionUserRole.create({
      data: { institutionUserId: iu.id, roleId: data.roleId },
    });
    return user;
  }

  const rectorUser = await createDemoUser({ email: 'rector@demo.edu', firstName: 'Carlos', lastName: 'Rector Demo', roleId: roleAdmin.id, isAdmin: true });
  const coordUser = await createDemoUser({ email: 'coordinador@demo.edu', firstName: 'Ana', lastName: 'Coordinadora Demo', roleId: roleCoord.id });

  // 8 docentes
  const teacherNames = [
    { first: 'Pedro', last: 'García Docente' }, { first: 'María', last: 'López Docente' },
    { first: 'Jorge', last: 'Martínez Docente' }, { first: 'Carmen', last: 'Rodríguez Docente' },
    { first: 'Luis', last: 'Pérez Docente' }, { first: 'Diana', last: 'Torres Docente' },
    { first: 'Alberto', last: 'Sánchez Docente' }, { first: 'Patricia', last: 'Gómez Docente' },
  ];

  const teacherUsers: any[] = [];
  for (let i = 0; i < teacherNames.length; i++) {
    const t = await createDemoUser({
      email: `docente${i + 1}@demo.edu`,
      firstName: teacherNames[i].first, lastName: teacherNames[i].last,
      roleId: roleDoc.id,
    });
    teacherUsers.push(t);
  }

  const studentDemoUser = await createDemoUser({ email: 'estudiante@demo.edu', firstName: 'Demo', lastName: 'Estudiante', roleId: roleEst.id });
  console.log(`   ✅ Rector, coordinador, ${teacherUsers.length} docentes, 1 estudiante demo\n`);

  // ─── PASO 8: Asignaciones docentes ─────────────────────────────────
  console.log('👨‍🏫 PASO 8: Asignaciones docentes...');
  const assignmentMap: Record<string, any> = {};

  // Distribute subjects across teachers round-robin style per group
  for (const group of allGroups) {
    for (let si = 0; si < allSubjects.length; si++) {
      const subject = allSubjects[si];
      const teacher = teacherUsers[si % teacherUsers.length];
      const assignment = await prisma.teacherAssignment.create({
        data: {
          institutionId: institution.id,
          academicYearId: academicYear.id, groupId: group.id,
          subjectId: subject.id, teacherId: teacher.id,
          startDate: new Date('2026-01-20'),
        },
      });
      assignmentMap[`${group.id}-${subject.id}`] = assignment;
    }
  }
  // Set first teacher as director of first group
  await prisma.group.update({
    where: { id: allGroups[0].id },
    data: { directorId: teacherUsers[0].id },
  });
  console.log(`   ✅ ${Object.keys(assignmentMap).length} asignaciones\n`);

  // ─── PASO 9: Componentes de evaluación + Planes ────────────────────
  console.log('📋 PASO 9: Componentes de evaluación...');
  const compCognitivo = await prisma.evaluationComponent.create({
    data: { institutionId: institution.id, code: 'COG', name: 'Cognitivo' },
  });
  const compProcedimental = await prisma.evaluationComponent.create({
    data: { institutionId: institution.id, code: 'PROC', name: 'Procedimental' },
  });
  const compActitudinal = await prisma.evaluationComponent.create({
    data: { institutionId: institution.id, code: 'ACT', name: 'Actitudinal' },
  });

  // Create evaluation plans for each assignment × active terms (P1, P2, P3)
  const plansCreated: any[] = [];
  const activeTerms = [terms[0], terms[1], terms[2]]; // P1, P2, P3
  for (const group of allGroups) {
    for (const subject of allSubjects) {
      const aKey = `${group.id}-${subject.id}`;
      const assignment = assignmentMap[aKey];
      if (!assignment) continue;
      for (const term of activeTerms) {
        const plan = await prisma.evaluationPlan.create({
          data: { teacherAssignmentId: assignment.id, academicTermId: term.id },
        });
        // Weights: 40% COG, 30% PROC, 30% ACT
        await prisma.evaluationPlanComponentWeight.createMany({
          data: [
            { evaluationPlanId: plan.id, componentId: compCognitivo.id, percentage: 40 },
            { evaluationPlanId: plan.id, componentId: compProcedimental.id, percentage: 30 },
            { evaluationPlanId: plan.id, componentId: compActitudinal.id, percentage: 30 },
          ],
        });
        plansCreated.push(plan);
      }
    }
  }
  console.log(`   ✅ ${plansCreated.length} planes de evaluación con pesos\n`);

  // ─── PASO 10: Estudiantes + Matrículas ────────────────────────────
  console.log('🎒 PASO 10: Generando estudiantes...');
  const STUDENTS_PER_GROUP = 25;
  type StudentRecord = { student: any; enrollment: any; groupKey: string; profile: Profile };
  const allStudentRecords: StudentRecord[] = [];
  let studentIdx = 0;
  let studentDemoLinked = false;

  for (const gc of GRADES_CFG) {
    for (const gName of ['A', 'B']) {
      const key = `${gc.name}-${gName}`;
      const group = groupMap[key];
      for (let i = 0; i < STUDENTS_PER_GROUP; i++) {
        const isFemale = Math.random() > 0.5;
        const fn = isFemale ? FIRST_NAMES_F[studentIdx % FIRST_NAMES_F.length] : FIRST_NAMES_M[studentIdx % FIRST_NAMES_M.length];
        const ln = LAST_NAMES[studentIdx % LAST_NAMES.length];
        const sn = Math.random() > 0.6 ? (isFemale ? FIRST_NAMES_F[(studentIdx + 5) % FIRST_NAMES_F.length] : FIRST_NAMES_M[(studentIdx + 5) % FIRST_NAMES_M.length]) : null;
        const sln = LAST_NAMES[(studentIdx + 7) % LAST_NAMES.length];
        const docNum = `10${String(70000000 + studentIdx).padStart(8, '0')}`;

        // Link demo user to first student
        const userId = (!studentDemoLinked && gc.name === '6°' && gName === 'A' && i === 0) ? studentDemoUser.id : null;
        if (userId) studentDemoLinked = true;

        const student = await prisma.student.create({
          data: {
            institutionId: institution.id,
            userId,
            documentType: 'TI', documentNumber: docNum,
            firstName: fn, secondName: sn, lastName: ln, secondLastName: sln,
            birthDate: new Date(2012 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28)),
            gender: isFemale ? 'F' : 'M',
          },
        });

        const enrollment = await prisma.studentEnrollment.create({
          data: {
            institutionId: institution.id,
            studentId: student.id, academicYearId: academicYear.id,
            groupId: group.id, status: 'ACTIVE',
            enrollmentDate: new Date('2026-01-15'),
          },
        });

        const profile = pickProfile();
        allStudentRecords.push({ student, enrollment, groupKey: key, profile });
        studentIdx++;
      }
    }
  }
  console.log(`   ✅ ${allStudentRecords.length} estudiantes matriculados\n`);

  // ─── PASO 11: EnrollmentArea + EnrollmentSubject (snapshots) ──────
  console.log('📸 PASO 11: Snapshots de estructura académica...');
  for (const record of allStudentRecords) {
    const group = groupMap[record.groupKey];
    for (const ad of AREAS) {
      const area = areaMap[ad.code];
      const enrollmentArea = await prisma.enrollmentArea.create({
        data: {
          institutionId: institution.id, enrollmentId: record.enrollment.id,
          areaId: area.id, areaName: ad.name, areaCode: ad.code,
          weightPercentage: 100 / AREAS.length, order: AREAS.indexOf(ad),
          calculationType: 'AVERAGE', approvalRule: 'ALL_SUBJECTS_PASS', recoveryRule: 'INDIVIDUAL_SUBJECT',
        },
      });
      for (let j = 0; j < ad.subjects.length; j++) {
        const sd = ad.subjects[j];
        const subject = allSubjects.find(s => s.code === sd.code)!;
        const assignment = assignmentMap[`${group.id}-${subject.id}`];
        await prisma.enrollmentSubject.create({
          data: {
            institutionId: institution.id, enrollmentId: record.enrollment.id,
            enrollmentAreaId: enrollmentArea.id, subjectId: subject.id,
            subjectName: sd.name, subjectCode: sd.code, weeklyHours: sd.hours,
            weightPercentage: Math.round(100 / ad.subjects.length * 10) / 10,
            order: j,
            teacherId: assignment?.teacherId || null,
            teacherName: assignment ? `${teacherUsers.find((t: any) => t.id === assignment.teacherId)?.firstName || ''} ${teacherUsers.find((t: any) => t.id === assignment.teacherId)?.lastName || ''}`.trim() : null,
          },
        });
      }
    }
  }
  console.log('   ✅ Snapshots de estructura académica\n');

  // ─── PASO 12: PeriodFinalGrade (P1, P2, P3) ──────────────────────
  console.log('📊 PASO 12: Notas por período...');
  const BATCH = 500;
  const termsWithGrades = [terms[0], terms[1], terms[2]]; // P1, P2, P3

  for (const term of termsWithGrades) {
    const batch: any[] = [];
    for (const record of allStudentRecords) {
      const group = groupMap[record.groupKey];
      for (const subject of allSubjects) {
        const assignment = assignmentMap[`${group.id}-${subject.id}`];
        if (!assignment) continue;
        batch.push({
          institutionId: institution.id,
          studentEnrollmentId: record.enrollment.id,
          academicTermId: term.id,
          subjectId: subject.id,
          finalScore: genGrade(record.profile),
          enteredById: assignment.teacherId,
        });
      }
    }
    for (let i = 0; i < batch.length; i += BATCH) {
      await prisma.periodFinalGrade.createMany({ data: batch.slice(i, i + BATCH) });
    }
    console.log(`   📝 ${term.name}: ${batch.length} notas`);
  }
  console.log('   ✅ Notas P1, P2, P3\n');

  // ─── PASO 13: Asistencia (P1, P2) ─────────────────────────────────
  console.log('📋 PASO 13: Asistencia...');
  const highAbsenceSet = new Set<string>();
  const shuffled = [...allStudentRecords].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(15, shuffled.length); i++) highAbsenceSet.add(shuffled[i].enrollment.id);

  const p1Dates = weekdaysBetween(new Date('2026-01-20'), new Date('2026-02-05'));
  const p2Dates = weekdaysBetween(new Date('2026-04-14'), new Date('2026-04-28'));
  const periodDates = [{ term: terms[0], dates: p1Dates }, { term: terms[1], dates: p2Dates }];
  let attendanceCount = 0;

  for (const { term, dates } of periodDates) {
    const batch: any[] = [];
    for (const gKey of Object.keys(groupMap)) {
      const group = groupMap[gKey];
      const gStudents = allStudentRecords.filter(r => r.groupKey === gKey);
      for (const date of dates) {
        // Pick 3 random subjects per day
        const daySubjects = [...allSubjects].sort(() => Math.random() - 0.5).slice(0, 3);
        for (const subject of daySubjects) {
          const assignment = assignmentMap[`${group.id}-${subject.id}`];
          if (!assignment) continue;
          for (const sr of gStudents) {
            batch.push({
              institutionId: institution.id,
              studentEnrollmentId: sr.enrollment.id,
              teacherAssignmentId: assignment.id,
              date, status: pickAttendance(sr.profile, highAbsenceSet.has(sr.enrollment.id)) as any,
            });
          }
        }
      }
    }
    for (let i = 0; i < batch.length; i += BATCH) {
      await prisma.attendanceRecord.createMany({ data: batch.slice(i, i + BATCH) });
    }
    attendanceCount += batch.length;
    console.log(`   📋 ${term.name}: ${batch.length} registros`);
  }
  console.log(`   ✅ ${attendanceCount} registros de asistencia\n`);

  // ─── PASO 14: Observaciones de estudiantes ────────────────────────
  console.log('🔍 PASO 14: Observaciones de estudiantes...');
  const obsTypes: Array<{ type: string; category: string }> = [
    { type: 'POSITIVE', category: 'ACADEMIC' },
    { type: 'POSITIVE', category: 'BEHAVIORAL' },
    { type: 'PEDAGOGICAL', category: 'ACADEMIC' },
    { type: 'BEHAVIORAL_MILD', category: 'BEHAVIORAL' },
    { type: 'ACTA_TYPE_I', category: 'BEHAVIORAL' },
  ];
  const obsDescriptions: Record<string, string[]> = {
    POSITIVE: [
      'Excelente participación en clase, demuestra liderazgo académico.',
      'Destacado desempeño en actividad grupal, apoyó a sus compañeros.',
      'Obtuvo el mejor resultado en evaluación, felicitaciones.',
    ],
    PEDAGOGICAL: [
      'Dificultad para comprender los temas del período. Se recomienda refuerzo.',
      'Bajo rendimiento sostenido. Se programa tutoría adicional.',
    ],
    BEHAVIORAL_MILD: [
      'Conversación frecuente durante la clase. Se hace llamado de atención.',
      'Llegada tarde reiterada. Se notifica a acudiente.',
    ],
    ACTA_TYPE_I: [
      'Agresión verbal hacia compañero. Se remite a coordinación.',
    ],
  };

  let obsCount = 0;
  // Generate ~40 observations spread across students
  for (let i = 0; i < 40; i++) {
    const sr = allStudentRecords[Math.floor(Math.random() * allStudentRecords.length)];
    const obsTypeCfg = obsTypes[Math.floor(Math.random() * obsTypes.length)];
    const descs = obsDescriptions[obsTypeCfg.type] || obsDescriptions['POSITIVE'];
    const desc = descs[Math.floor(Math.random() * descs.length)];
    const teacher = teacherUsers[Math.floor(Math.random() * teacherUsers.length)];
    const date = new Date('2026-02-01');
    date.setDate(date.getDate() + Math.floor(Math.random() * 120));

    await prisma.studentObservation.create({
      data: {
        institutionId: institution.id,
        studentEnrollmentId: sr.enrollment.id,
        authorId: teacher.id,
        date,
        type: obsTypeCfg.type as any,
        category: obsTypeCfg.category as any,
        description: desc,
        actionTaken: (obsTypeCfg.type === 'BEHAVIORAL_MILD' || obsTypeCfg.type === 'ACTA_TYPE_I') ? 'Se dialogó con el estudiante y se firmó compromiso.' : null,
        parentNotified: obsTypeCfg.type === 'ACTA_TYPE_I',
      },
    });
    obsCount++;
  }
  console.log(`   ✅ ${obsCount} observaciones\n`);

  // ─── PASO 15–16: Finalizar P1 y P2 con snapshots correctos ────────
  console.log('🔒 PASO 15-16: Finalizando P1 y P2 con snapshots...');
  const passingGrade = 3.0;

  for (const termIdx of [0, 1]) { // P1, P2
    const term = terms[termIdx];

    // Fetch grades
    const allGrades = await prisma.periodFinalGrade.findMany({
      where: { academicTermId: term.id },
      include: { subject: { include: { area: true } } },
    });

    // Index by enrollment
    const gradesByEnr = new Map<string, typeof allGrades>();
    for (const g of allGrades) {
      const list = gradesByEnr.get(g.studentEnrollmentId) || [];
      list.push(g);
      gradesByEnr.set(g.studentEnrollmentId, list);
    }

    // Group students by group for ranking
    const studentsByGroup = new Map<string, StudentRecord[]>();
    for (const sr of allStudentRecords) {
      const list = studentsByGroup.get(sr.groupKey) || [];
      list.push(sr);
      studentsByGroup.set(sr.groupKey, list);
    }

    const snapshotBatch: any[] = [];
    const generatedAt = new Date().toISOString();

    // Per-group ranking
    for (const [gKey, gStudents] of studentsByGroup) {
      const group = groupMap[gKey];
      const grade = GRADES_CFG.find(gc => gKey.startsWith(gc.name))!;

      // Compute stats for ranking
      const statsArr: Array<{ enrollmentId: string; avg: number | null; failed: number; approved: number }> = [];
      for (const sr of gStudents) {
        const grades = gradesByEnr.get(sr.enrollment.id) || [];
        const scored = grades.filter(g => g.finalScore !== null);
        const avg = scored.length > 0
          ? Math.round(scored.reduce((s, g) => s + Number(g.finalScore), 0) / scored.length * 10) / 10
          : null;
        const failed = scored.filter(g => Number(g.finalScore) < passingGrade).length;
        statsArr.push({ enrollmentId: sr.enrollment.id, avg, failed, approved: scored.length - failed });
      }

      // Rank
      const ranked = [...statsArr].filter(s => s.avg !== null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
      const rankMap = new Map<string, number>();
      ranked.forEach((s, i) => rankMap.set(s.enrollmentId, i + 1));

      for (const sr of gStudents) {
        const studentGrades = gradesByEnr.get(sr.enrollment.id) || [];
        const stats = statsArr.find(s => s.enrollmentId === sr.enrollment.id)!;

        // Build areaGrades (matching buildGroupReportCards output)
        const areaGradesMap = new Map<string, { area: string; areaAverage: number | null; subjects: any[] }>();
        for (const ad of AREAS) {
          areaGradesMap.set(ad.name, { area: ad.name, areaAverage: null, subjects: [] });
        }
        for (const g of studentGrades) {
          const areaName = g.subject.area?.name || 'Sin Área';
          if (!areaGradesMap.has(areaName)) {
            areaGradesMap.set(areaName, { area: areaName, areaAverage: null, subjects: [] });
          }
          areaGradesMap.get(areaName)!.subjects.push({
            subject: g.subject.name,
            grade: Number(g.finalScore),
            achievement: null,
            recommendation: null,
            absences: 0,
          });
        }
        // Compute area averages
        for (const ag of areaGradesMap.values()) {
          const scored = ag.subjects.filter((s: any) => s.grade !== null);
          ag.areaAverage = scored.length > 0
            ? Math.round(scored.reduce((s: number, x: any) => s + x.grade, 0) / scored.length * 10) / 10
            : null;
        }
        const areaGrades = Array.from(areaGradesMap.values());

        // subjectGrades flat list
        const subjectGrades = studentGrades.map(g => ({
          subject: g.subject.name,
          grade: Number(g.finalScore),
          achievement: null,
          recommendation: null,
          absences: 0,
        }));

        const promotionStatus = stats.avg === null ? 'PENDIENTE' : stats.failed === 0 ? 'APRUEBA' : 'NO_APRUEBA';

        snapshotBatch.push({
          academicTermId: term.id,
          studentEnrollmentId: sr.enrollment.id,
          version: 1,
          generatedById: rectorUser.id,
          data: {
            institution: { id: institution.id, name: institution.name, nit: institution.nit },
            academicYear: { id: academicYear.id, year: academicYear.year, name: academicYear.name },
            term: { id: term.id, name: term.name, order: term.order },
            student: {
              id: sr.student.id,
              firstName: sr.student.firstName,
              secondName: sr.student.secondName,
              lastName: sr.student.lastName,
              secondLastName: sr.student.secondLastName,
              documentType: sr.student.documentType,
              documentNumber: sr.student.documentNumber,
            },
            group: {
              id: group.id,
              name: group.name,
              gradeLevel: grade.name,
              director: null,
            },
            areaGrades,
            subjectGrades,
            structureSource: 'enrollment_snapshot',
            attendance: null,
            achievements: [],
            observations: [],
            generatedAt,
            // Enriched fields (Fase 0.2)
            rank: rankMap.get(sr.enrollment.id) ?? null,
            totalStudentsRanked: ranked.length,
            generalAverage: stats.avg,
            approvedSubjectsCount: stats.approved,
            failedSubjectsCount: stats.failed,
            promotionStatus,
          },
        });
      }
    }

    // Batch insert snapshots
    for (let i = 0; i < snapshotBatch.length; i += 200) {
      await prisma.termReportCardSnapshot.createMany({ data: snapshotBatch.slice(i, i + 200) });
    }

    // Mark term as FINALIZED
    await prisma.$executeRawUnsafe(
      `UPDATE "AcademicTerm" SET status = 'FINALIZED', "finalizedAt" = NOW() WHERE id = $1`, term.id
    );

    console.log(`   🔒 ${term.name}: ${snapshotBatch.length} snapshots, FINALIZED`);
  }
  console.log('   ✅ P1 y P2 finalizados con snapshots completos\n');

  // ─── PASO 17: Recuperación de período ──────────────────────────────
  console.log('🔄 PASO 17: Configuración + procesos de recuperación...');
  await prisma.recoveryConfig.create({
    data: {
      institutionId: institution.id,
      academicYearId: academicYear.id,
      minPassingScore: 3.0,
      periodRecoveryEnabled: true,
      periodMaxScore: 3.0,
      periodImpactType: 'ADJUST_TO_MINIMUM',
      finalRecoveryEnabled: true,
      finalMaxScore: 3.0,
      finalImpactType: 'ADJUST_TO_MINIMUM',
      maxAreasRecoverable: 2,
      periodRecoveryStartDate: new Date('2026-04-07'),
      periodRecoveryEndDate: new Date('2026-04-12'),
    },
  });

  // Create recovery processes for students who failed subjects in P1
  const p1Grades = await prisma.periodFinalGrade.findMany({
    where: { academicTermId: terms[0].id, finalScore: { lt: 3.0 } },
    take: 30, // Limit to 30 recoveries
  });

  let recoveryCount = 0;
  for (const g of p1Grades) {
    const sr = allStudentRecords.find(r => r.enrollment.id === g.studentEnrollmentId);
    if (!sr) continue;
    const group = groupMap[sr.groupKey];
    const assignment = assignmentMap[`${group.id}-${g.subjectId}`];
    if (!assignment) continue;

    const isCompleted = Math.random() > 0.4;
    const recoveryScore = isCompleted ? genGrade('average', 2.5, 4.0) : null;

    await prisma.periodRecovery.create({
      data: {
        institutionId: institution.id,
        studentEnrollmentId: g.studentEnrollmentId,
        academicTermId: terms[0].id,
        subjectId: g.subjectId,
        originalScore: g.finalScore,
        status: isCompleted ? 'COMPLETED' : 'PENDING',
        activityDescription: 'Taller de refuerzo y sustentación escrita sobre los temas del período.',
        scheduledDate: new Date('2026-04-08'),
        completedDate: isCompleted ? new Date('2026-04-10') : null,
        reinforcedDimension: 'COGNITIVA',
        recoveryScore: recoveryScore,
        finalScore: isCompleted ? Math.max(Number(g.finalScore), Math.min(recoveryScore || 0, 3.0)) : null,
        impactType: isCompleted ? 'ADJUST_TO_MINIMUM' : null,
        assignedById: assignment.teacherId,
        evaluatedById: isCompleted ? assignment.teacherId : null,
      },
    });
    recoveryCount++;
  }
  console.log(`   ✅ Config de recuperación + ${recoveryCount} procesos de recuperación\n`);

  // ─── PASO 18: Módulo financiero ───────────────────────────────────
  console.log('💰 PASO 18: Módulo financiero...');
  // Payment concepts
  const conceptMatricula = await prisma.paymentConcept.create({
    data: { institutionId: institution.id, name: 'Matrícula', description: 'Matrícula anual', defaultAmount: 350000, isRecurrent: false },
  });
  const conceptPension = await prisma.paymentConcept.create({
    data: { institutionId: institution.id, name: 'Pensión', description: 'Pensión mensual', defaultAmount: 180000, isRecurrent: true },
  });
  const conceptDerechoGrado = await prisma.paymentConcept.create({
    data: { institutionId: institution.id, name: 'Derecho a grado', description: 'Derechos de grado para estudiantes de último año', defaultAmount: 250000, isRecurrent: false },
  });

  // Payment events
  const eventMatricula = await prisma.paymentEvent.create({
    data: {
      institutionId: institution.id, conceptId: conceptMatricula.id, academicYearId: academicYear.id,
      name: 'Matrícula 2026', amount: 350000, dueDate: new Date('2026-01-31'),
      scope: 'INSTITUTION', createdById: rectorUser.id,
    },
  });
  const eventPension1 = await prisma.paymentEvent.create({
    data: {
      institutionId: institution.id, conceptId: conceptPension.id, academicYearId: academicYear.id,
      name: 'Pensión Febrero 2026', amount: 180000, dueDate: new Date('2026-02-28'),
      scope: 'INSTITUTION', createdById: rectorUser.id,
    },
  });
  const eventPension2 = await prisma.paymentEvent.create({
    data: {
      institutionId: institution.id, conceptId: conceptPension.id, academicYearId: academicYear.id,
      name: 'Pensión Marzo 2026', amount: 180000, dueDate: new Date('2026-03-31'),
      scope: 'INSTITUTION', createdById: rectorUser.id,
    },
  });

  // Student payments + transactions (sample for first 50 students)
  const sampleStudents = allStudentRecords.slice(0, 50);
  let paymentCount = 0;
  let txCount = 0;

  for (const sr of sampleStudents) {
    // Matrícula — all paid
    const spMat = await prisma.studentPayment.create({
      data: {
        studentId: sr.student.id, eventId: eventMatricula.id,
        totalAmount: 350000, paidAmount: 350000, status: 'PAID',
      },
    });
    await prisma.paymentTransaction.create({
      data: {
        studentPaymentId: spMat.id, amount: 350000,
        paymentMethod: 'Transferencia', reference: `MAT-${sr.student.documentNumber}`,
        receivedById: rectorUser.id, receivedAt: new Date('2026-01-20'),
      },
    });
    paymentCount++;
    txCount++;

    // Pensión Feb — 70% paid, 15% partial, 15% pending
    const r = Math.random();
    const pensionStatus = r < 0.70 ? 'PAID' : r < 0.85 ? 'PARTIAL' : 'PENDING';
    const pensionPaid = pensionStatus === 'PAID' ? 180000 : pensionStatus === 'PARTIAL' ? 90000 : 0;

    const spPen1 = await prisma.studentPayment.create({
      data: {
        studentId: sr.student.id, eventId: eventPension1.id,
        totalAmount: 180000, paidAmount: pensionPaid, status: pensionStatus as any,
      },
    });
    if (pensionPaid > 0) {
      await prisma.paymentTransaction.create({
        data: {
          studentPaymentId: spPen1.id, amount: pensionPaid,
          paymentMethod: pensionPaid === 180000 ? 'Efectivo' : 'Transferencia',
          reference: `PEN-FEB-${sr.student.documentNumber}`,
          receivedById: rectorUser.id, receivedAt: new Date('2026-02-15'),
        },
      });
      txCount++;
    }
    paymentCount++;

    // Pensión Mar — 50% paid, 20% partial, 30% pending
    const r2 = Math.random();
    const p2Status = r2 < 0.50 ? 'PAID' : r2 < 0.70 ? 'PARTIAL' : 'PENDING';
    const p2Paid = p2Status === 'PAID' ? 180000 : p2Status === 'PARTIAL' ? 100000 : 0;

    const spPen2 = await prisma.studentPayment.create({
      data: {
        studentId: sr.student.id, eventId: eventPension2.id,
        totalAmount: 180000, paidAmount: p2Paid, status: p2Status as any,
      },
    });
    if (p2Paid > 0) {
      await prisma.paymentTransaction.create({
        data: {
          studentPaymentId: spPen2.id, amount: p2Paid,
          paymentMethod: 'Efectivo',
          reference: `PEN-MAR-${sr.student.documentNumber}`,
          receivedById: rectorUser.id, receivedAt: new Date('2026-03-10'),
        },
      });
      txCount++;
    }
    paymentCount++;
  }
  console.log(`   ✅ 3 conceptos, 3 eventos, ${paymentCount} pagos, ${txCount} transacciones\n`);

  // ─── PASO 19: Proceso de elección ─────────────────────────────────
  console.log('🗳️ PASO 19: Proceso de elección...');
  const electionProcess = await prisma.electionProcess.create({
    data: {
      institutionId: institution.id, academicYearId: academicYear.id,
      name: 'Elecciones Gobierno Escolar 2026',
      description: 'Proceso electoral para personero, contralor y representantes de grado.',
      registrationStart: new Date('2026-02-01'), registrationEnd: new Date('2026-02-15'),
      campaignStart: new Date('2026-02-16'), campaignEnd: new Date('2026-02-28'),
      votingStart: new Date('2026-03-01'), votingEnd: new Date('2026-03-01'),
      status: 'CLOSED',
      allowBlankVote: true,
      closedAt: new Date('2026-03-02'),
      closedById: rectorUser.id,
      createdById: rectorUser.id,
    },
  });

  // Election: Personero (toda la institución)
  const electionPersonero = await prisma.election.create({
    data: { electionProcessId: electionProcess.id, type: 'PERSONERO', status: 'ACTIVE' },
  });

  // 3 candidates for personero (pick random students from different grades)
  const candidateStudents = [allStudentRecords[0], allStudentRecords[50], allStudentRecords[100]];
  const candidates: any[] = [];
  const candidateProposals = [
    'Más espacios deportivos y culturales para todos.',
    'WiFi gratuito en toda la institución y mejores recursos tecnológicos.',
    'Jornadas complementarias de refuerzo académico y alimentación escolar.',
  ];

  for (let ci = 0; ci < candidateStudents.length; ci++) {
    const cs = candidateStudents[ci];
    const cand = await prisma.candidate.create({
      data: {
        electionId: electionPersonero.id, studentId: cs.student.id,
        slogan: candidateProposals[ci].substring(0, 50),
        proposals: candidateProposals[ci],
        ballotNumber: ci + 1,
        status: 'APPROVED',
        approvedById: rectorUser.id,
        approvedAt: new Date('2026-02-16'),
      },
    });
    candidates.push(cand);
  }

  // Votes for personero (all students vote)
  let voteCount = 0;
  const voteCounts = [0, 0, 0, 0]; // candidate 0, 1, 2, blank

  for (const sr of allStudentRecords) {
    const r = Math.random();
    let candidateId: string | null;
    if (r < 0.40) { candidateId = candidates[0].id; voteCounts[0]++; }
    else if (r < 0.70) { candidateId = candidates[1].id; voteCounts[1]++; }
    else if (r < 0.92) { candidateId = candidates[2].id; voteCounts[2]++; }
    else { candidateId = null; voteCounts[3]++; } // blank

    await prisma.vote.create({
      data: {
        electionId: electionPersonero.id, voterId: sr.student.id,
        candidateId, votedAt: new Date('2026-03-01'),
      },
    });
    voteCount++;
  }

  // Election results
  const totalVotes = voteCount;
  const resultsData = [
    ...candidates.map((c: any, i: number) => ({
      electionId: electionPersonero.id, candidateId: c.id,
      votes: voteCounts[i], percentage: Math.round(voteCounts[i] / totalVotes * 1000) / 10,
      position: 0, isWinner: false,
    })),
    {
      electionId: electionPersonero.id, candidateId: null,
      votes: voteCounts[3], percentage: Math.round(voteCounts[3] / totalVotes * 1000) / 10,
      position: 0, isWinner: false,
    },
  ];

  // Sort by votes desc and assign positions
  resultsData.sort((a, b) => b.votes - a.votes);
  resultsData.forEach((r, i) => { r.position = i + 1; if (i === 0 && r.candidateId) r.isWinner = true; });

  for (const r of resultsData) {
    await prisma.electionResult.create({ data: r });
  }

  // Audit log
  await prisma.electionAuditLog.create({
    data: {
      processId: electionProcess.id, electionId: electionPersonero.id,
      action: 'RESULTS_CALCULATED',
      actorId: rectorUser.id, actorType: 'USER',
      payload: { totalVotes, results: resultsData.map(r => ({ candidateId: r.candidateId, votes: r.votes })) },
      checksum: sha256(JSON.stringify(resultsData)),
    },
  });

  console.log(`   ✅ Elección personero: ${voteCount} votos, ganador: candidato #1 (${voteCounts[0]} votos)\n`);

  // ─── PASO 20: Mensajes entre docentes ─────────────────────────────
  console.log('✉️ PASO 20: Mensajes entre docentes...');
  const messages = [
    {
      author: teacherUsers[0], subject: 'Reunión de área - Matemáticas',
      content: 'Compañeros, les recuerdo la reunión de área del próximo viernes a las 10:00 am en la sala de profesores. Temas: ajuste del plan de estudios y actividades del tercer período.',
      recipients: [teacherUsers[1], teacherUsers[2]],
    },
    {
      author: teacherUsers[3], subject: 'Estudiante Santiago García - Seguimiento',
      content: 'Colegas, quiero informarles que el estudiante Santiago García del 7°A ha mostrado dificultades de atención en las últimas semanas. ¿Han notado lo mismo en sus clases?',
      recipients: [teacherUsers[0], teacherUsers[1], teacherUsers[4]],
    },
    {
      author: coordUser, subject: 'Entrega de notas - Período 2',
      content: 'Estimados docentes, la fecha límite para la entrega de notas del segundo período es el 18 de junio. Por favor verificar que todas las calificaciones estén cargadas en el sistema.',
      recipients: teacherUsers,
    },
    {
      author: teacherUsers[5], subject: 'Proyecto interdisciplinario',
      content: 'Hola a todos, propongo realizar un proyecto interdisciplinario de ciencias y humanidades para la feria escolar. ¿Quién se anima a participar?',
      recipients: [teacherUsers[2], teacherUsers[6], teacherUsers[7]],
    },
  ];

  let msgCount = 0;
  for (const msg of messages) {
    const message = await prisma.message.create({
      data: {
        institutionId: institution.id, authorId: msg.author.id,
        type: 'NOTIFICATION', subject: msg.subject, content: msg.content,
        status: 'SENT', sentAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      },
    });
    for (const recipient of msg.recipients) {
      await prisma.messageRecipient.create({
        data: {
          messageId: message.id, recipientType: 'USER', recipientId: recipient.id,
          readAt: Math.random() > 0.3 ? new Date() : null,
        },
      });
    }
    msgCount++;
  }
  console.log(`   ✅ ${msgCount} mensajes enviados\n`);

  // ─── PASO 21: Inclusión educativa ──────────────────────────────────
  console.log('🤝 PASO 21: Inclusión educativa...');
  // Pick 5 students for support profiles
  const inclusionStudents = allStudentRecords.filter(r => r.profile === 'struggling' || r.profile === 'failing').slice(0, 5);
  let inclusionCount = 0;

  const supportCategories = [
    'Ritmo de aprendizaje diferenciado',
    'Barrera comunicativa',
    'Dificultad de atención y concentración',
    'Necesidades educativas especiales',
    'Situación de vulnerabilidad social',
  ];

  for (let i = 0; i < inclusionStudents.length; i++) {
    const sr = inclusionStudents[i];
    const profile = await prisma.educationalSupportProfile.create({
      data: {
        institutionId: institution.id, studentId: sr.student.id,
        supportCategory: supportCategories[i % supportCategories.length],
        pedagogicalNotes: `Se identifica necesidad de acompañamiento pedagógico diferenciado. El estudiante presenta ${supportCategories[i % supportCategories.length].toLowerCase()}.`,
        parentConsentAccepted: true,
        consentDate: new Date('2026-02-10'),
        active: true,
      },
    });

    // Create 1-2 support plans per student
    for (let j = 0; j < (i < 3 ? 2 : 1); j++) {
      await prisma.pedagogicalSupportPlan.create({
        data: {
          institutionId: institution.id,
          studentEnrollmentId: sr.enrollment.id,
          academicTermId: terms[j].id,
          supportProfileId: profile.id,
          supportStrategy: `Estrategia de acompañamiento: ${j === 0 ? 'Tutorías individuales dos veces por semana con material diferenciado.' : 'Trabajo colaborativo con pares y evaluaciones orales como alternativa.'}`,
          familyCommitment: 'La familia se compromete a apoyar las actividades de refuerzo en casa y asistir a las reuniones de seguimiento programadas.',
          followUpDate: new Date(`2026-0${3 + j}-15`),
          observations: j === 0 ? 'Se evidencia avance en comprensión lectora tras las primeras sesiones de tutoría.' : null,
          objectives: JSON.stringify(['Mejorar comprensión lectora', 'Fortalecer habilidades matemáticas básicas', 'Desarrollar autonomía en el aprendizaje']),
          adaptationStrategies: JSON.stringify(['Material visual complementario', 'Tiempo adicional en evaluaciones', 'Evaluaciones orales']),
          evaluationAdjustments: JSON.stringify(['Tiempo extendido 50%', 'Evaluación oral permitida', 'Uso de material de apoyo']),
          progressPercentage: j === 0 ? 45 : 20,
          status: j === 0 && i < 2 ? 'COMPLETED' : 'ACTIVE',
          completedAt: j === 0 && i < 2 ? new Date('2026-04-05') : null,
          completedById: j === 0 && i < 2 ? teacherUsers[0].id : null,
        },
      });
    }
    inclusionCount++;
  }
  console.log(`   ✅ ${inclusionCount} perfiles de inclusión con planes de acompañamiento\n`);

  // ─── PASO 22: Configuración de boletines ──────────────────────────
  console.log('📄 PASO 22: Configuración de boletines...');
  await prisma.reportCardConfig.create({
    data: {
      institutionId: institution.id,
      showLogo: true, showShield: false,
      evaluationType: 'NUMERIC',
      showNumericGrade: true, showPerformanceLevel: true,
      showAchievements: true, showRecommendations: true,
      showMotivationalMsg: true, showAttendance: true,
      showRanking: true, showObservations: true,
      showAreaAverages: true, showGeneralAverage: true, showScale: true,
      signatureConfig: JSON.stringify([
        { role: 'RECTOR', label: 'Rector(a)', name: 'Carlos Rector Demo', enabled: true },
        { role: 'COORDINADOR', label: 'Coordinador(a)', name: 'Ana Coordinadora Demo', enabled: true },
        { role: 'DOCENTE', label: 'Director(a) de Grupo', name: '', enabled: true },
      ]),
    },
  });
  console.log('   ✅ Configuración de boletines\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUMEN FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ SEED DEMO COMPLETO — TODOS LOS MÓDULOS');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('🏫 Institución: Colegio Demo Excelencia Académica (IED DEL SABER)');
  console.log(`📅 Año 2026: 4 períodos (P1 FINALIZED, P2 FINALIZED, P3 OPEN, P4 DRAFT)`);
  console.log(`🎓 ${GRADES_CFG.length} grados (6°-9°), ${allGroups.length} grupos`);
  console.log(`📚 ${Object.keys(areaMap).length} áreas, ${allSubjects.length} asignaturas`);
  console.log(`👨‍🏫 ${teacherUsers.length} docentes con planes de evaluación`);
  console.log(`🎒 ${allStudentRecords.length} estudiantes`);
  console.log(`📊 Notas en P1, P2 y P3`);
  console.log(`📋 ${attendanceCount} registros de asistencia (P1+P2)`);
  console.log(`🔍 ${obsCount} observaciones del observador`);
  console.log(`🔒 P1 y P2 FINALIZED con snapshots completos + ranking`);
  console.log(`🔄 ${recoveryCount} procesos de recuperación (P1)`);
  console.log(`💰 Financiero: 3 conceptos, 3 eventos, ${paymentCount} pagos, ${txCount} tx`);
  console.log(`🗳️ Elección personero: ${voteCount} votos, resultados calculados`);
  console.log(`✉️ ${msgCount} mensajes entre docentes`);
  console.log(`🤝 ${inclusionCount} perfiles de inclusión educativa`);
  console.log('📄 Configuración de boletines');
  console.log('');
  console.log('🔐 USUARIOS DEMO (contraseña: Demo2026!):');
  console.log('   📧 rector@demo.edu          (ADMIN_INSTITUTIONAL)');
  console.log('   📧 coordinador@demo.edu     (COORDINADOR)');
  console.log('   📧 docente1..8@demo.edu     (DOCENTE)');
  console.log('   📧 estudiante@demo.edu      (ESTUDIANTE)');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// EJECUCIÓN
// ═══════════════════════════════════════════════════════════════════════════

seedDemo()
  .catch((e) => {
    console.error('❌ Error durante el seed demo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
