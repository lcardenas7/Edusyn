/**
 * SEED DEMO - Institución Demo Completamente Funcional
 * 
 * Crea una institución "Colegio Demo Excelencia Académica" con:
 * - Año académico 2026 con 4 períodos (P1 FINALIZED, P2 OPEN, P3/P4 DRAFT)
 * - Grados de primaria, secundaria y media con grupos
 * - Áreas y asignaturas reales del sistema colombiano
 * - 12+ docentes con asignaciones
 * - ~300 estudiantes con distribución realista de rendimiento
 * - Notas por período coherentes
 * - Asistencia con distribución realista
 * - Usuarios demo con roles reales
 * - Snapshot legal del período 1
 * 
 * IDEMPOTENTE: Puede ejecutarse múltiples veces sin duplicar datos.
 * NO DESTRUCTIVO: No modifica ni elimina instituciones existentes.
 */

import { PrismaClient, GradeStage, SchoolShift, AcademicTermType, PerformanceLevel } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════
// DATOS ESTÁTICOS
// ═══════════════════════════════════════════════════════════════════════════

const DEMO_INSTITUTION_SLUG = 'ied-del-saber';
const DEMO_DANE_CODE = '999999999999';
const DEMO_PASSWORD = 'Demo2026!';

const FIRST_NAMES_M = [
  'Santiago', 'Samuel', 'Matías', 'Sebastián', 'Nicolás', 'Alejandro', 'Daniel', 'Andrés',
  'Juan Pablo', 'David', 'Carlos', 'Miguel', 'Felipe', 'José', 'Luis', 'Tomás',
  'Emilio', 'Joaquín', 'Gabriel', 'Rafael', 'Diego', 'Esteban', 'Julián', 'Camilo',
  'Ángel', 'Martín', 'Pablo', 'Iván', 'Ricardo', 'Fernando', 'Eduardo', 'Simón',
  'Cristian', 'Johan', 'Brayan', 'Kevin', 'Jhon', 'Oscar', 'Manuel', 'Javier',
];

const FIRST_NAMES_F = [
  'Valentina', 'Isabella', 'Sofía', 'Mariana', 'Luciana', 'Camila', 'Gabriela', 'María José',
  'Sara', 'Laura', 'Ana María', 'Paula', 'Daniela', 'Natalia', 'Valeria', 'Carolina',
  'Andrea', 'Catalina', 'Alejandra', 'Juliana', 'Manuela', 'Salomé', 'Isabela', 'Luna',
  'Antonella', 'Emilia', 'Victoria', 'Renata', 'Martina', 'Elena', 'Diana', 'Marcela',
  'Tatiana', 'Paola', 'Lorena', 'Viviana', 'Angélica', 'Sandra', 'Gloria', 'Claudia',
];

const LAST_NAMES = [
  'García', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández', 'Pérez', 'Sánchez',
  'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Morales',
  'Cruz', 'Ortiz', 'Gutiérrez', 'Chávez', 'Ramos', 'Vargas', 'Castillo', 'Jiménez',
  'Moreno', 'Romero', 'Herrera', 'Medina', 'Aguilar', 'Vega', 'Rojas', 'Acosta',
  'Suárez', 'Valencia', 'Mendoza', 'Pardo', 'Arias', 'Castaño', 'Ospina', 'Cardona',
];

const TEACHER_NAMES = [
  { firstName: 'Roberto', lastName: 'Mejía Castillo', email: 'roberto.mejia@demo.edu' },
  { firstName: 'Carmen', lastName: 'Salazar Ríos', email: 'carmen.salazar@demo.edu' },
  { firstName: 'Francisco', lastName: 'Velasco Parra', email: 'francisco.velasco@demo.edu' },
  { firstName: 'Patricia', lastName: 'Duarte Montes', email: 'patricia.duarte@demo.edu' },
  { firstName: 'Jorge', lastName: 'Navarro Ruiz', email: 'jorge.navarro@demo.edu' },
  { firstName: 'Marta', lastName: 'Cifuentes León', email: 'marta.cifuentes@demo.edu' },
  { firstName: 'Álvaro', lastName: 'Pineda Soto', email: 'alvaro.pineda@demo.edu' },
  { firstName: 'Gloria', lastName: 'Bermúdez Orozco', email: 'gloria.bermudez@demo.edu' },
  { firstName: 'Héctor', lastName: 'Quintero Ávila', email: 'hector.quintero@demo.edu' },
  { firstName: 'Luz Marina', lastName: 'Cárdenas Peña', email: 'luz.cardenas@demo.edu' },
  { firstName: 'Enrique', lastName: 'Molina Cano', email: 'enrique.molina@demo.edu' },
  { firstName: 'Isabel', lastName: 'Arango Zapata', email: 'isabel.arango@demo.edu' },
  { firstName: 'Raúl', lastName: 'Escobar Gil', email: 'raul.escobar@demo.edu' },
  { firstName: 'Adriana', lastName: 'Correa Muñoz', email: 'adriana.correa@demo.edu' },
  { firstName: 'Óscar', lastName: 'Bedoya Trujillo', email: 'oscar.bedoya@demo.edu' },
];

const AREAS_AND_SUBJECTS = [
  { name: 'Matemáticas', code: 'MAT', subjects: [
    { name: 'Matemáticas', code: 'MAT01', hours: 5 },
    { name: 'Geometría', code: 'GEO01', hours: 2 },
    { name: 'Estadística', code: 'EST01', hours: 2 },
  ]},
  { name: 'Ciencias Naturales', code: 'NAT', subjects: [
    { name: 'Ciencias Naturales', code: 'NAT01', hours: 4 },
  ]},
  { name: 'Ciencias Sociales', code: 'SOC', subjects: [
    { name: 'Ciencias Sociales', code: 'SOC01', hours: 4 },
  ]},
  { name: 'Humanidades', code: 'HUM', subjects: [
    { name: 'Lengua Castellana', code: 'LEN01', hours: 5 },
    { name: 'Inglés', code: 'ING01', hours: 3 },
  ]},
  { name: 'Educación Física', code: 'EFI', subjects: [
    { name: 'Educación Física', code: 'EFI01', hours: 2 },
  ]},
  { name: 'Tecnología', code: 'TEC', subjects: [
    { name: 'Tecnología e Informática', code: 'TEC01', hours: 2 },
  ]},
  { name: 'Ética y Valores', code: 'ETI', subjects: [
    { name: 'Ética y Valores', code: 'ETI01', hours: 1 },
  ]},
  { name: 'Educación Artística', code: 'ART', subjects: [
    { name: 'Educación Artística', code: 'ART01', hours: 2 },
  ]},
];

// Grados y grupos a crear
const GRADES_CONFIG = [
  // Primaria
  { name: '3°', stage: GradeStage.BASICA_PRIMARIA, number: 3, groups: ['A'] },
  { name: '4°', stage: GradeStage.BASICA_PRIMARIA, number: 4, groups: ['A'] },
  { name: '5°', stage: GradeStage.BASICA_PRIMARIA, number: 5, groups: ['A'] },
  // Secundaria
  { name: '6°', stage: GradeStage.BASICA_SECUNDARIA, number: 6, groups: ['A', 'B'] },
  { name: '7°', stage: GradeStage.BASICA_SECUNDARIA, number: 7, groups: ['A', 'B'] },
  { name: '8°', stage: GradeStage.BASICA_SECUNDARIA, number: 8, groups: ['A'] },
  // Media
  { name: '10°', stage: GradeStage.MEDIA, number: 10, groups: ['A'] },
  { name: '11°', stage: GradeStage.MEDIA, number: 11, groups: ['A'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════════════════════════

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function genDoc(): string {
  return Math.floor(1000000000 + Math.random() * 900000000).toString();
}

/**
 * Genera una nota según el perfil del estudiante.
 * profile: 'high' | 'average' | 'at_risk' | 'failing'
 */
function genGrade(profile: string): number {
  let min: number, max: number;
  switch (profile) {
    case 'high':    min = 4.5; max = 5.0; break;
    case 'average': min = 3.5; max = 4.4; break;
    case 'at_risk': min = 3.0; max = 3.4; break;
    case 'failing': min = 1.5; max = 2.9; break;
    default:        min = 3.0; max = 4.5; break;
  }
  // Añadir variación: ±0.3 con clamp 1.0-5.0
  const base = min + Math.random() * (max - min);
  const variation = (Math.random() - 0.5) * 0.6;
  const score = Math.round(Math.max(1.0, Math.min(5.0, base + variation)) * 10) / 10;
  return score;
}

function assignProfile(): string {
  const r = Math.random();
  if (r < 0.20) return 'high';       // 20% alto rendimiento
  if (r < 0.70) return 'average';    // 50% promedio
  if (r < 0.90) return 'at_risk';    // 20% en riesgo
  return 'failing';                   // 10% reprobando
}

function getWeekdaysBetween(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function pickAttendanceStatus(studentProfile: string, forceAbsent: boolean): string {
  if (forceAbsent) {
    // Estudiante con alta inasistencia
    const r = Math.random();
    if (r < 0.40) return 'PRESENT';
    if (r < 0.75) return 'ABSENT';
    if (r < 0.90) return 'LATE';
    return 'EXCUSED';
  }
  // Distribución normal: 70% present, 15% absent, 10% late, 5% excused
  const r = Math.random();
  if (r < 0.70) return 'PRESENT';
  if (r < 0.85) return 'ABSENT';
  if (r < 0.95) return 'LATE';
  return 'EXCUSED';
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

async function seedDemo() {
  // ─── PROTECCIÓN: Solo permitir en entornos autorizados ─────────────────
  if (!process.env.ALLOW_DEMO_SEED && process.env.NODE_ENV === 'production') {
    throw new Error(
      '❌ Demo seed no permitido en este entorno.\n' +
      '   Para habilitar, agrega la variable ALLOW_DEMO_SEED=true en Railway.'
    );
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🏫 SEED DEMO - IED DEL SABER');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ─── PASO 0: Verificar idempotencia ────────────────────────────────────
  const existing = await prisma.institution.findFirst({
    where: { slug: DEMO_INSTITUTION_SLUG },
  });

  if (existing) {
    console.log('⚠️  La institución demo ya existe. Eliminando datos previos para regenerar...');
    // Borrar solo la institución demo (cascade borra todo lo relacionado)
    await prisma.institution.delete({ where: { id: existing.id } });
    console.log('   ✅ Institución demo anterior eliminada.\n');
  }

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ─── PASO 1: Crear Institución ─────────────────────────────────────────
  console.log('📌 PASO 1: Creando institución...');
  const institution = await prisma.institution.create({
    data: {
      name: 'IED DEL SABER',
      slug: DEMO_INSTITUTION_SLUG,
      daneCode: DEMO_DANE_CODE,
      nit: '999999999-0',
      status: 'ACTIVE',
      isDemo: true, // Marca como institución demo - permite seed y limpieza
      email: 'info@ieddelsaber.edu.co',
      phone: '3001234567',
      address: 'Calle 100 # 50-25, Bogotá D.C.',
    },
  });
  console.log(`   ✅ Institución creada: ${institution.name} (${institution.id})\n`);

  // ─── PASO 1.5: Habilitar módulos ──────────────────────────────────────
  console.log('📦 Habilitando módulos...');
  const modulesToEnable = [
    { module: 'DASHBOARD', features: ['DASHBOARD_STATS', 'DASHBOARD_ALERTS'] },
    { module: 'ACADEMIC', features: ['ACADEMIC_GRADES', 'ACADEMIC_AREAS', 'ACADEMIC_LOAD'] },
    { module: 'ATTENDANCE', features: ['ATTENDANCE_DAILY', 'ATTENDANCE_REPORTS'] },
    { module: 'EVALUATION', features: ['EVALUATION_ACTIVITIES', 'EVALUATION_RUBRICS'] },
    { module: 'RECOVERY', features: ['RECOVERY_PERIOD', 'RECOVERY_FINAL'] },
    { module: 'REPORTS', features: [
      'RPT_ADMIN', 'RPT_ACAD', 'RPT_BULLETINS', 'RPT_EXPORT',
      'RPT_ATT_GROUP', 'RPT_ATT_STUDENT', 'RPT_ATT_SUBJECT',
      'RPT_ATT_TEACHER', 'RPT_ATT_CRITICAL', 'RPT_ATT_CONSOLIDATED',
      'RPT_EVAL_COMPLIANCE', 'RPT_EVAL_CRITERIA', 'RPT_EVAL_WEIGHTS',
      'RPT_EVAL_RECOVERY', 'RPT_EVAL_PROMOTION', 'RPT_EVAL_SCALE',
      'RPT_BULLETIN_PARTIAL', 'RPT_BULLETIN_FINAL', 'RPT_CERTIFICATE',
      'RPT_CONSTANCY', 'RPT_PROMOTION_ACT',
      'RPT_ALERT_LOW', 'RPT_ALERT_FAIL', 'RPT_ALERT_ATT',
      'RPT_LOAD_TEACHER', 'RPT_LOAD_GROUP', 'RPT_TEACHERS_ACTIVE',
      'RPT_TEACHERS_NOLOAD', 'RPT_COVERAGE', 'RPT_HOURS',
      'RPT_STAFF', 'RPT_ENROLLMENT',
    ] },
    { module: 'COMMUNICATIONS', features: ['COMM_MESSAGES', 'COMM_ANNOUNCEMENTS'] },
    { module: 'OBSERVER', features: ['OBSERVER_CREATE', 'OBSERVER_VIEW'] },
    { module: 'PERFORMANCE', features: ['PERF_VIEW', 'PERF_EDIT'] },
    { module: 'USERS', features: ['USERS_MANAGE', 'USERS_IMPORT'] },
    { module: 'CONFIG', features: ['CONFIG_GENERAL', 'CONFIG_ACADEMIC'] },
  ];
  for (const mod of modulesToEnable) {
    await prisma.institutionModule.create({
      data: {
        institutionId: institution.id,
        module: mod.module as any,
        isActive: true,
        features: mod.features,
      },
    });
  }
  console.log(`   ✅ ${modulesToEnable.length} módulos habilitados\n`);

  // ─── PASO 2: Escala de Valoración ──────────────────────────────────────
  console.log('📊 PASO 2: Creando escala de valoración...');
  const performanceLevels = [
    { level: PerformanceLevel.SUPERIOR, minScore: 4.6, maxScore: 5.0 },
    { level: PerformanceLevel.ALTO, minScore: 4.0, maxScore: 4.5 },
    { level: PerformanceLevel.BASICO, minScore: 3.0, maxScore: 3.9 },
    { level: PerformanceLevel.BAJO, minScore: 1.0, maxScore: 2.9 },
  ];
  for (const pl of performanceLevels) {
    await prisma.performanceScale.create({
      data: { level: pl.level, minScore: pl.minScore, maxScore: pl.maxScore, institutionId: institution.id },
    });
  }
  console.log('   ✅ Escala de valoración creada\n');

  // ─── PASO 3: Sede y Jornada ────────────────────────────────────────────
  console.log('🏢 PASO 3: Creando sede y jornada...');
  const campus = await prisma.campus.create({
    data: { name: 'Sede Principal', address: 'Calle 100 # 50-25, Bogotá D.C.', institutionId: institution.id },
  });
  const shift = await prisma.shift.create({
    data: { name: 'Mañana', type: SchoolShift.MORNING, campusId: campus.id },
  });
  console.log('   ✅ Sede y jornada creadas\n');

  // ─── PASO 4: Año Académico y Períodos ──────────────────────────────────
  console.log('📅 PASO 4: Creando año académico y períodos...');
  const academicYear = await prisma.academicYear.create({
    data: {
      year: 2026,
      name: 'Año Lectivo 2026',
      startDate: new Date('2026-01-20'),
      endDate: new Date('2026-11-30'),
      status: 'ACTIVE',
      institutionId: institution.id,
    },
  });

  const periodsData = [
    { name: 'Período 1', order: 1, weight: 25, start: '2026-01-20', end: '2026-04-05' },
    { name: 'Período 2', order: 2, weight: 25, start: '2026-04-14', end: '2026-06-20' },
    { name: 'Período 3', order: 3, weight: 25, start: '2026-07-15', end: '2026-09-30' },
    { name: 'Período 4', order: 4, weight: 25, start: '2026-10-01', end: '2026-11-30' },
  ];

  const terms: any[] = [];
  for (const p of periodsData) {
    const term = await prisma.academicTerm.create({
      data: {
        name: p.name,
        type: AcademicTermType.PERIOD,
        order: p.order,
        weightPercentage: p.weight,
        startDate: new Date(p.start),
        endDate: new Date(p.end),
        academicYearId: academicYear.id,
      },
    });
    terms.push(term);
  }

  // Set P1 to CLOSED (ready for finalization later)
  await prisma.$executeRawUnsafe(
    `UPDATE "AcademicTerm" SET status = 'CLOSED' WHERE id = $1`, terms[0].id
  );
  console.log(`   ✅ Año académico 2026 con ${terms.length} períodos\n`);

  // ─── PASO 5: Grados y Grupos ───────────────────────────────────────────
  console.log('🎓 PASO 5: Creando grados y grupos...');
  const gradeMap: Record<string, any> = {};
  const groupMap: Record<string, any> = {};

  for (const gc of GRADES_CONFIG) {
    // Buscar o crear grado PARA ESTA INSTITUCIÓN
    let grade = await prisma.grade.findFirst({
      where: { institutionId: institution.id, stage: gc.stage, name: gc.name },
    });
    if (!grade) {
      grade = await prisma.grade.create({
        data: { institutionId: institution.id, name: gc.name, stage: gc.stage, number: gc.number },
      });
    }
    gradeMap[gc.name] = grade;

    for (const gName of gc.groups) {
      const group = await prisma.group.create({
        data: {
          name: gName,
          campusId: campus.id,
          gradeId: grade.id,
          shiftId: shift.id,
          maxCapacity: 40,
        },
      });
      const key = `${gc.name}-${gName}`;
      groupMap[key] = group;
    }
  }
  const allGroups = Object.values(groupMap);
  console.log(`   ✅ ${Object.keys(gradeMap).length} grados, ${allGroups.length} grupos\n`);

  // ─── PASO 6: Áreas y Asignaturas ──────────────────────────────────────
  console.log('📚 PASO 6: Creando áreas y asignaturas...');
  const areaMap: Record<string, any> = {};
  const subjectMap: Record<string, any> = {};

  for (let i = 0; i < AREAS_AND_SUBJECTS.length; i++) {
    const ad = AREAS_AND_SUBJECTS[i];
    const area = await prisma.area.create({
      data: { name: ad.name, code: ad.code, institutionId: institution.id, order: i },
    });
    areaMap[ad.name] = area;

    for (let j = 0; j < ad.subjects.length; j++) {
      const sd = ad.subjects[j];
      const subject = await prisma.subject.create({
        data: { name: sd.name, code: sd.code, areaId: area.id, order: j },
      });
      subjectMap[sd.name] = subject;
    }
  }
  const allSubjects = Object.values(subjectMap);
  console.log(`   ✅ ${Object.keys(areaMap).length} áreas, ${allSubjects.length} asignaturas\n`);

  // ─── PASO 7: Usuarios Demo ─────────────────────────────────────────────
  console.log('👤 PASO 7: Creando usuarios demo...');

  // Buscar roles existentes
  const roleAdmin = await prisma.role.findFirst({ where: { name: 'ADMIN_INSTITUTIONAL' } });
  const roleCoord = await prisma.role.findFirst({ where: { name: 'COORDINADOR' } });
  const roleDocente = await prisma.role.findFirst({ where: { name: 'DOCENTE' } });

  if (!roleAdmin || !roleCoord || !roleDocente) {
    throw new Error('Roles del sistema no encontrados. Ejecuta primero el seed de producción.');
  }

  // Rector/Admin
  const rectorUser = await prisma.user.upsert({
    where: { email: 'rector@demo.edu' },
    update: { passwordHash: hashedPassword },
    create: {
      email: 'rector@demo.edu',
      username: 'rector.demo',
      passwordHash: hashedPassword,
      firstName: 'Rector',
      lastName: 'Demo Excelencia',
      documentType: 'CC',
      documentNumber: '9990000001',
      isActive: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: rectorUser.id, roleId: roleAdmin.id } },
    update: {},
    create: { userId: rectorUser.id, roleId: roleAdmin.id },
  });
  await prisma.institutionUser.upsert({
    where: { userId_institutionId: { userId: rectorUser.id, institutionId: institution.id } },
    update: { isAdmin: true },
    create: { userId: rectorUser.id, institutionId: institution.id, isAdmin: true },
  });

  // Coordinador
  const coordUser = await prisma.user.upsert({
    where: { email: 'coordinador@demo.edu' },
    update: { passwordHash: hashedPassword },
    create: {
      email: 'coordinador@demo.edu',
      username: 'coordinador.demo',
      passwordHash: hashedPassword,
      firstName: 'Coordinador',
      lastName: 'Demo Excelencia',
      documentType: 'CC',
      documentNumber: '9990000002',
      isActive: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: coordUser.id, roleId: roleCoord.id } },
    update: {},
    create: { userId: coordUser.id, roleId: roleCoord.id },
  });
  await prisma.institutionUser.upsert({
    where: { userId_institutionId: { userId: coordUser.id, institutionId: institution.id } },
    update: {},
    create: { userId: coordUser.id, institutionId: institution.id, isAdmin: false },
  });

  console.log('   ✅ rector@demo.edu (ADMIN_INSTITUTIONAL)');
  console.log('   ✅ coordinador@demo.edu (COORDINADOR)\n');

  // ─── PASO 8: Docentes ─────────────────────────────────────────────────
  console.log('👨‍🏫 PASO 8: Creando docentes...');
  const teacherUsers: any[] = [];

  for (let i = 0; i < TEACHER_NAMES.length; i++) {
    const t = TEACHER_NAMES[i];
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: { passwordHash: hashedPassword },
      create: {
        email: t.email,
        username: t.email.split('@')[0],
        passwordHash: hashedPassword,
        firstName: t.firstName,
        lastName: t.lastName,
        documentType: 'CC',
        documentNumber: `999100000${(i + 1).toString().padStart(2, '0')}`,
        isActive: true,
      },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: roleDocente.id } },
      update: {},
      create: { userId: user.id, roleId: roleDocente.id },
    });
    await prisma.institutionUser.upsert({
      where: { userId_institutionId: { userId: user.id, institutionId: institution.id } },
      update: {},
      create: { userId: user.id, institutionId: institution.id, isAdmin: false },
    });
    teacherUsers.push(user);
  }

  // Crear usuario docente@demo.edu como docente demo principal
  const docenteDemoUser = await prisma.user.upsert({
    where: { email: 'docente@demo.edu' },
    update: { passwordHash: hashedPassword },
    create: {
      email: 'docente@demo.edu',
      username: 'docente.demo',
      passwordHash: hashedPassword,
      firstName: 'Docente',
      lastName: 'Demo Excelencia',
      documentType: 'CC',
      documentNumber: '9990000003',
      isActive: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: docenteDemoUser.id, roleId: roleDocente.id } },
    update: {},
    create: { userId: docenteDemoUser.id, roleId: roleDocente.id },
  });
  await prisma.institutionUser.upsert({
    where: { userId_institutionId: { userId: docenteDemoUser.id, institutionId: institution.id } },
    update: {},
    create: { userId: docenteDemoUser.id, institutionId: institution.id, isAdmin: false },
  });
  teacherUsers.push(docenteDemoUser);

  console.log(`   ✅ ${TEACHER_NAMES.length} docentes + docente@demo.edu\n`);

  // ─── PASO 9: Teacher Assignments ───────────────────────────────────────
  console.log('📋 PASO 9: Creando asignaciones docentes...');
  const assignmentMap: Record<string, any> = {}; // key: groupId-subjectId

  let teacherIdx = 0;
  for (const group of allGroups) {
    for (const subject of allSubjects) {
      // Rotar docentes entre asignaturas
      const teacher = teacherUsers[teacherIdx % teacherUsers.length];
      teacherIdx++;

      const assignment = await prisma.teacherAssignment.create({
        data: {
          institutionId: institution.id,
          academicYearId: academicYear.id,
          groupId: group.id,
          subjectId: subject.id,
          teacherId: teacher.id,
          weeklyHours: 4,
        },
      });
      assignmentMap[`${group.id}-${subject.id}`] = assignment;
    }
  }
  const totalAssignments = Object.keys(assignmentMap).length;
  console.log(`   ✅ ${totalAssignments} asignaciones docentes\n`);

  // ─── PASO 10: Plantillas Académicas ────────────────────────────────────
  console.log('📝 PASO 10: Creando plantillas académicas...');

  // Crear plantilla para secundaria y media
  const templateSecundaria = await prisma.academicTemplate.create({
    data: {
      institutionId: institution.id,
      academicYearId: academicYear.id,
      name: 'Plantilla Secundaria Demo',
      level: 'SECUNDARIA',
      isDefault: true,
    },
  });
  const templateMedia = await prisma.academicTemplate.create({
    data: {
      institutionId: institution.id,
      academicYearId: academicYear.id,
      name: 'Plantilla Media Demo',
      level: 'MEDIA',
      isDefault: true,
    },
  });
  const templatePrimaria = await prisma.academicTemplate.create({
    data: {
      institutionId: institution.id,
      academicYearId: academicYear.id,
      name: 'Plantilla Primaria Demo',
      level: 'PRIMARIA',
      isDefault: true,
    },
  });

  // Crear TemplateAreas y TemplateSubjects para cada plantilla
  for (const template of [templatePrimaria, templateSecundaria, templateMedia]) {
    const areaWeight = Math.round(100 / AREAS_AND_SUBJECTS.length * 10) / 10;
    for (let i = 0; i < AREAS_AND_SUBJECTS.length; i++) {
      const ad = AREAS_AND_SUBJECTS[i];
      const area = areaMap[ad.name];
      const tplArea = await prisma.templateArea.create({
        data: {
          templateId: template.id,
          areaId: area.id,
          weightPercentage: areaWeight,
          order: i,
        },
      });
      const subWeight = ad.subjects.length > 0 ? Math.round(100 / ad.subjects.length * 10) / 10 : 100;
      for (let j = 0; j < ad.subjects.length; j++) {
        const sd = ad.subjects[j];
        const subject = subjectMap[sd.name];
        await prisma.templateSubject.create({
          data: {
            templateAreaId: tplArea.id,
            subjectId: subject.id,
            weeklyHours: sd.hours,
            weightPercentage: subWeight,
            order: j,
          },
        });
      }
    }
  }

  // Asignar plantillas a grados
  for (const gc of GRADES_CONFIG) {
    const grade = gradeMap[gc.name];
    let template;
    if (gc.stage === GradeStage.BASICA_PRIMARIA) template = templatePrimaria;
    else if (gc.stage === GradeStage.BASICA_SECUNDARIA) template = templateSecundaria;
    else template = templateMedia;

    await prisma.gradeTemplate.create({
      data: {
        gradeId: grade.id,
        templateId: template.id,
        academicYearId: academicYear.id,
      },
    });
  }
  console.log('   ✅ Plantillas académicas creadas y asignadas\n');

  // ─── PASO 11: Estudiantes y Matrículas ─────────────────────────────────
  console.log('🎒 PASO 11: Creando estudiantes y matrículas...');
  
  // Distribución: ~30-40 estudiantes por grupo para llegar a ~300
  const studentsPerGroup: Record<string, number> = {};
  let targetTotal = 300;
  const groupKeys = Object.keys(groupMap);
  const basePerGroup = Math.floor(targetTotal / groupKeys.length);
  let remaining = targetTotal - basePerGroup * groupKeys.length;
  for (const key of groupKeys) {
    studentsPerGroup[key] = basePerGroup + (remaining > 0 ? 1 : 0);
    if (remaining > 0) remaining--;
  }

  interface StudentRecord {
    student: any;
    enrollment: any;
    profile: string;
    groupKey: string;
  }
  const allStudentRecords: StudentRecord[] = [];

  // Estudiante demo - será el primero
  let demoStudentRecord: StudentRecord | null = null;

  // Crear usuario para estudiante@demo.edu
  const estudianteDemoUser = await prisma.user.upsert({
    where: { email: 'estudiante@demo.edu' },
    update: { passwordHash: hashedPassword },
    create: {
      email: 'estudiante@demo.edu',
      username: 'estudiante.demo',
      passwordHash: hashedPassword,
      firstName: 'Estudiante',
      lastName: 'Demo Excelencia',
      documentType: 'CC',
      documentNumber: '9990000004',
      isActive: true,
    },
  });
  // Buscar si hay rol ESTUDIANTE
  let roleEstudiante = await prisma.role.findFirst({ where: { name: 'ESTUDIANTE' } });
  if (!roleEstudiante) {
    roleEstudiante = await prisma.role.create({ data: { name: 'ESTUDIANTE' } });
  }
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: estudianteDemoUser.id, roleId: roleEstudiante.id } },
    update: {},
    create: { userId: estudianteDemoUser.id, roleId: roleEstudiante.id },
  });

  let isFirstStudent = true;
  for (const [groupKey, count] of Object.entries(studentsPerGroup)) {
    const group = groupMap[groupKey];
    for (let i = 0; i < count; i++) {
      const isFemale = Math.random() > 0.5;
      const firstName = isFemale ? rand(FIRST_NAMES_F) : rand(FIRST_NAMES_M);
      const lastName = `${rand(LAST_NAMES)} ${rand(LAST_NAMES)}`;
      const profile = assignProfile();

      // Para el primer estudiante, vincularlo con el usuario demo
      const linkUser = isFirstStudent;

      const student = await prisma.student.create({
        data: {
          institutionId: institution.id,
          firstName: linkUser ? 'Estudiante' : firstName,
          lastName: linkUser ? 'Demo Excelencia' : lastName,
          documentType: 'TI',
          documentNumber: linkUser ? '9990000004' : genDoc(),
          birthDate: new Date(2008 + randInt(0, 8), randInt(0, 11), randInt(1, 28)),
          gender: isFemale ? 'F' : 'M',
          ...(linkUser ? { userId: estudianteDemoUser.id } : {}),
        },
      });

      const enrollment = await prisma.studentEnrollment.create({
        data: {
          institutionId: institution.id,
          studentId: student.id,
          groupId: group.id,
          academicYearId: academicYear.id,
          status: 'ACTIVE',
          enrollmentType: 'NEW',
        },
      });

      const record: StudentRecord = { student, enrollment, profile, groupKey };
      allStudentRecords.push(record);

      if (linkUser) {
        demoStudentRecord = record;
        isFirstStudent = false;
      } else {
        isFirstStudent = false;
      }
    }
  }
  console.log(`   ✅ ${allStudentRecords.length} estudiantes creados y matriculados\n`);

  // ─── PASO 12: Enrollment Areas y Subjects (Snapshots) ──────────────────
  console.log('📎 PASO 12: Creando snapshots de estructura académica por matrícula...');
  
  for (const record of allStudentRecords) {
    const group = groupMap[record.groupKey];
    // Encontrar la asignación del grupo para obtener los docentes
    for (let i = 0; i < AREAS_AND_SUBJECTS.length; i++) {
      const ad = AREAS_AND_SUBJECTS[i];
      const area = areaMap[ad.name];
      
      const enrollmentArea = await prisma.enrollmentArea.create({
        data: {
          institutionId: institution.id,
          enrollmentId: record.enrollment.id,
          areaId: area.id,
          areaName: ad.name,
          areaCode: ad.code,
          weightPercentage: Math.round(100 / AREAS_AND_SUBJECTS.length * 10) / 10,
          calculationType: 'AVERAGE',
          approvalRule: 'AREA_AVERAGE',
          recoveryRule: 'INDIVIDUAL_SUBJECT',
          order: i,
        },
      });

      for (let j = 0; j < ad.subjects.length; j++) {
        const sd = ad.subjects[j];
        const subject = subjectMap[sd.name];
        const assignment = assignmentMap[`${group.id}-${subject.id}`];
        
        await prisma.enrollmentSubject.create({
          data: {
            institutionId: institution.id,
            enrollmentId: record.enrollment.id,
            enrollmentAreaId: enrollmentArea.id,
            subjectId: subject.id,
            subjectName: sd.name,
            subjectCode: sd.code,
            weeklyHours: sd.hours,
            weightPercentage: ad.subjects.length > 0 ? Math.round(100 / ad.subjects.length * 10) / 10 : 100,
            order: j,
            teacherId: assignment?.teacherId || null,
            teacherName: assignment ? `Docente ${assignment.teacherId.substring(0, 8)}` : null,
          },
        });
      }
    }
  }
  console.log('   ✅ Snapshots de estructura académica creados\n');

  // ─── PASO 13: Notas por Período ────────────────────────────────────────
  console.log('📊 PASO 13: Generando notas...');

  // Solo P1 y P2 tendrán notas
  const termsWithGrades = [terms[0], terms[1]]; // P1, P2
  const GRADE_BATCH_SIZE = 500;

  for (const term of termsWithGrades) {
    const gradesBatch: any[] = [];
    for (const record of allStudentRecords) {
      const group = groupMap[record.groupKey];
      for (const subject of allSubjects) {
        const assignment = assignmentMap[`${group.id}-${subject.id}`];
        if (!assignment) continue;

        gradesBatch.push({
          institutionId: institution.id,
          studentEnrollmentId: record.enrollment.id,
          academicTermId: term.id,
          subjectId: subject.id,
          finalScore: genGrade(record.profile),
          enteredById: assignment.teacherId,
        });
      }
    }
    // Insert in batches
    for (let i = 0; i < gradesBatch.length; i += GRADE_BATCH_SIZE) {
      const batch = gradesBatch.slice(i, i + GRADE_BATCH_SIZE);
      await prisma.periodFinalGrade.createMany({ data: batch });
    }
    console.log(`   📝 ${term.name}: ${gradesBatch.length} notas generadas`);
  }
  console.log('   ✅ Notas generadas para P1 y P2\n');

  // ─── PASO 14: Asistencia ───────────────────────────────────────────────
  console.log('📋 PASO 14: Generando asistencia...');

  // Generar fechas de clase por período (solo P1 y P2)
  const p1Weekdays = getWeekdaysBetween(new Date('2026-01-20'), new Date('2026-04-05'));
  const p2Weekdays = getWeekdaysBetween(new Date('2026-04-14'), new Date('2026-06-20'));

  // Limitar días por período para rendimiento (todos los subjects × menos días)
  const p1Dates = p1Weekdays.slice(0, 8);
  const p2Dates = p2Weekdays.slice(0, 8);

  // Seleccionar algunos estudiantes con alta inasistencia
  const highAbsenceStudents = new Set<string>();
  const shuffled = [...allStudentRecords].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(15, shuffled.length); i++) {
    highAbsenceStudents.add(shuffled[i].enrollment.id);
  }

  let attendanceCount = 0;
  const ATTENDANCE_BATCH_SIZE = 500;
  const periodDates = [
    { term: terms[0], dates: p1Dates },
    { term: terms[1], dates: p2Dates },
  ];

  for (const { term, dates } of periodDates) {
    const attendanceBatch: any[] = [];

    for (const groupKey of groupKeys) {
      const group = groupMap[groupKey];
      const groupStudents = allStudentRecords.filter(r => r.groupKey === groupKey);
      const groupSubjects = allSubjects; // Todas las asignaturas

      for (const date of dates) {
        for (const subject of groupSubjects) {
          const assignment = assignmentMap[`${group.id}-${subject.id}`];
          if (!assignment) continue;

          for (const sr of groupStudents) {
            const isHighAbsence = highAbsenceStudents.has(sr.enrollment.id);
            const status = pickAttendanceStatus(sr.profile, isHighAbsence);
            attendanceBatch.push({
              institutionId: institution.id,
              studentEnrollmentId: sr.enrollment.id,
              teacherAssignmentId: assignment.id,
              date,
              status: status as any,
            });
          }
        }
      }
    }

    // Insert in batches
    for (let i = 0; i < attendanceBatch.length; i += ATTENDANCE_BATCH_SIZE) {
      const batch = attendanceBatch.slice(i, i + ATTENDANCE_BATCH_SIZE);
      await prisma.attendanceRecord.createMany({ data: batch });
    }
    attendanceCount += attendanceBatch.length;
    console.log(`   📋 ${term.name}: ${attendanceBatch.length} registros de asistencia`);
  }
  console.log(`   ✅ ${attendanceCount} registros de asistencia total\n`);

  // ─── PASO 15: Finalización Período 1 (Snapshot) ────────────────────────
  console.log('🔒 PASO 15: Finalizando Período 1 con snapshot...');

  const term1 = terms[0];

  // Fetch all P1 grades in one query
  const allP1Grades = await prisma.periodFinalGrade.findMany({
    where: { academicTermId: term1.id },
    include: { subject: { include: { area: true } } },
  });

  // Index grades by enrollmentId
  const gradesByEnrollment = new Map<string, typeof allP1Grades>();
  for (const g of allP1Grades) {
    const list = gradesByEnrollment.get(g.studentEnrollmentId) || [];
    list.push(g);
    gradesByEnrollment.set(g.studentEnrollmentId, list);
  }

  // Build and batch insert snapshots
  const SNAPSHOT_BATCH_SIZE = 200;
  const snapshotBatch: any[] = [];
  const generatedAt = new Date().toISOString();

  for (const record of allStudentRecords) {
    const studentGrades = gradesByEnrollment.get(record.enrollment.id) || [];
    const snapshotData = {
      student: {
        id: record.student.id,
        firstName: record.student.firstName,
        lastName: record.student.lastName,
        documentNumber: record.student.documentNumber,
      },
      term: { id: term1.id, name: term1.name, order: term1.order },
      grades: studentGrades.map(g => ({
        subjectId: g.subjectId,
        subjectName: g.subject.name,
        areaName: g.subject.area.name,
        finalScore: Number(g.finalScore),
      })),
      generatedAt,
    };

    snapshotBatch.push({
      academicTermId: term1.id,
      studentEnrollmentId: record.enrollment.id,
      version: 1,
      generatedById: rectorUser.id,
      data: snapshotData,
    });
  }

  for (let i = 0; i < snapshotBatch.length; i += SNAPSHOT_BATCH_SIZE) {
    const batch = snapshotBatch.slice(i, i + SNAPSHOT_BATCH_SIZE);
    await prisma.termReportCardSnapshot.createMany({ data: batch });
  }

  // Marcar período 1 como FINALIZED
  await prisma.$executeRawUnsafe(
    `UPDATE "AcademicTerm" SET status = 'FINALIZED', "finalizedAt" = NOW() WHERE id = $1`, term1.id
  );

  console.log(`   ✅ ${snapshotBatch.length} snapshots generados, P1 FINALIZED\n`);

  // ─── PASO 16: Configuración de Boletines ───────────────────────────────
  console.log('📄 PASO 16: Creando configuración de boletines...');
  await prisma.reportCardConfig.create({
    data: {
      institutionId: institution.id,
      showLogo: true,
      showShield: false,
      evaluationType: 'NUMERIC',
      showNumericGrade: true,
      showPerformanceLevel: true,
      showAchievements: true,
      showRecommendations: true,
      showMotivationalMsg: true,
      showAttendance: true,
      showRanking: true,
      showObservations: true,
      showAreaAverages: true,
      showGeneralAverage: true,
      showScale: true,
      signatureConfig: JSON.stringify([
        { role: 'RECTOR', label: 'Rector(a)', name: 'Rector Demo Excelencia', enabled: true },
        { role: 'COORDINADOR', label: 'Coordinador(a)', name: 'Coordinador Demo Excelencia', enabled: true },
        { role: 'DOCENTE', label: 'Director(a) de Grupo', name: '', enabled: true },
      ]),
    },
  });
  console.log('   ✅ Configuración de boletines creada\n');

  // ═══════════════════════════════════════════════════════════════════════════
  // RESUMEN FINAL
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ SEED DEMO COMPLETADO EXITOSAMENTE');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('🏫 Institución: IED DEL SABER');
  console.log(`📅 Año académico: 2026 (${terms.length} períodos)`);
  console.log(`   - P1: FINALIZED (con snapshot)`);
  console.log(`   - P2: OPEN`);
  console.log(`   - P3, P4: DRAFT`);
  console.log(`🎓 ${Object.keys(gradeMap).length} grados, ${allGroups.length} grupos`);
  console.log(`📚 ${Object.keys(areaMap).length} áreas, ${allSubjects.length} asignaturas`);
  console.log(`👨‍🏫 ${teacherUsers.length} docentes`);
  console.log(`🎒 ${allStudentRecords.length} estudiantes`);
  console.log(`📊 Notas en P1 y P2`);
  console.log(`📋 ${attendanceCount} registros de asistencia`);
  console.log('');
  console.log('🔐 USUARIOS DEMO (contraseña: Demo2026!):');
  console.log('   📧 rector@demo.edu       (ADMIN_INSTITUTIONAL)');
  console.log('   📧 coordinador@demo.edu  (COORDINADOR)');
  console.log('   📧 docente@demo.edu      (DOCENTE)');
  console.log('   📧 estudiante@demo.edu   (ESTUDIANTE)');
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
