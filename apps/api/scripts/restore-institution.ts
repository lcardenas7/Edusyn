/**
 * RESTAURACIÓN - Institución Educativa Digital En Buenos Mares
 * 
 * Recrea la estructura base:
 * - Institución + módulos
 * - Sede + jornadas
 * - Año académico 2026 + períodos
 * - Grados 6-11 con grupos A-D
 * - Usuario admin institucional
 */

import { PrismaClient, SchoolShift, GradeStage, AcademicTermType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function restore() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🔄 RESTAURACIÓN - Institución Educativa Digital En Buenos Mares');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ═══════════════════════════════════════════════════════════════
  // 1. INSTITUCIÓN
  // ═══════════════════════════════════════════════════════════════
  console.log('🏫 Creando institución...');
  const institution = await prisma.institution.upsert({
    where: { slug: 'ie-digital-buenos-mares' },
    update: {},
    create: {
      name: 'Institución Educativa Digital En Buenos Mares',
      slug: 'ie-digital-buenos-mares',
      daneCode: '108001000001',
      nit: '900000001-1',
      status: 'ACTIVE',
    },
  });
  console.log(`   ✅ ${institution.name} (${institution.id})\n`);

  // ═══════════════════════════════════════════════════════════════
  // 2. MÓDULOS
  // ═══════════════════════════════════════════════════════════════
  console.log('📦 Habilitando módulos...');
  const modules = [
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
    { module: 'TIMETABLING', features: ['TIMETABLING_GENERATE', 'TIMETABLING_EDIT'] },
    { module: 'ELECTIONS', features: ['ELECTIONS_CREATE', 'ELECTIONS_VOTE'] },
    { module: 'FINANCE', features: ['FINANCE_PAYMENTS', 'FINANCE_REPORTS'] },
  ];

  for (const mod of modules) {
    try {
      await prisma.institutionModule.upsert({
        where: { institutionId_module: { institutionId: institution.id, module: mod.module as any } },
        update: { isActive: true, features: mod.features },
        create: { institutionId: institution.id, module: mod.module as any, isActive: true, features: mod.features },
      });
    } catch (e) {
      // Ignorar si el módulo no existe en el enum
    }
  }
  console.log(`   ✅ Módulos habilitados\n`);

  // ═══════════════════════════════════════════════════════════════
  // 3. SEDE + JORNADAS
  // ═══════════════════════════════════════════════════════════════
  console.log('🏢 Creando sede y jornadas...');
  const campus = await prisma.campus.upsert({
    where: { institutionId_name: { institutionId: institution.id, name: 'Sede Principal' } },
    update: {},
    create: { name: 'Sede Principal', institutionId: institution.id },
  });

  const morningShift = await prisma.shift.upsert({
    where: { campusId_type: { campusId: campus.id, type: SchoolShift.MORNING } },
    update: {},
    create: { name: 'Mañana', type: SchoolShift.MORNING, campusId: campus.id },
  });

  const afternoonShift = await prisma.shift.upsert({
    where: { campusId_type: { campusId: campus.id, type: SchoolShift.AFTERNOON } },
    update: {},
    create: { name: 'Tarde', type: SchoolShift.AFTERNOON, campusId: campus.id },
  });
  console.log(`   ✅ Sede: ${campus.name}, 2 jornadas\n`);

  // ═══════════════════════════════════════════════════════════════
  // 4. AÑO ACADÉMICO + PERÍODOS
  // ═══════════════════════════════════════════════════════════════
  console.log('📅 Creando año académico 2026...');
  const academicYear = await prisma.academicYear.upsert({
    where: { institutionId_year: { institutionId: institution.id, year: 2026 } },
    update: {},
    create: {
      year: 2026,
      startDate: new Date('2026-01-20'),
      endDate: new Date('2026-11-30'),
      institutionId: institution.id,
    },
  });

  const periods = [
    { name: 'Período 1', order: 1, weight: 25, start: '2026-01-20', end: '2026-04-05' },
    { name: 'Período 2', order: 2, weight: 25, start: '2026-04-06', end: '2026-06-20' },
    { name: 'Período 3', order: 3, weight: 25, start: '2026-07-15', end: '2026-09-30' },
    { name: 'Período 4', order: 4, weight: 25, start: '2026-10-01', end: '2026-11-30' },
  ];

  for (const p of periods) {
    await prisma.academicTerm.upsert({
      where: { academicYearId_order: { academicYearId: academicYear.id, order: p.order } },
      update: {},
      create: {
        name: p.name, type: AcademicTermType.PERIOD, order: p.order,
        weightPercentage: p.weight,
        startDate: new Date(p.start), endDate: new Date(p.end),
        academicYearId: academicYear.id,
      },
    });
  }
  console.log(`   ✅ Año ${academicYear.year}, ${periods.length} períodos\n`);

  // ═══════════════════════════════════════════════════════════════
  // 5. GRADOS (6-11) CON GRUPOS (A-D)
  // ═══════════════════════════════════════════════════════════════
  console.log('🎓 Creando grados y grupos...');
  
  const gradesConfig: { name: string; stage: GradeStage; number: number; groups: string[] }[] = [
    { name: 'Sexto', stage: GradeStage.BASICA_SECUNDARIA, number: 6, groups: ['A', 'B', 'C', 'D'] },
    { name: 'Séptimo', stage: GradeStage.BASICA_SECUNDARIA, number: 7, groups: ['A', 'B', 'C', 'D'] },
    { name: 'Octavo', stage: GradeStage.BASICA_SECUNDARIA, number: 8, groups: ['A', 'B', 'C', 'D'] },
    { name: 'Noveno', stage: GradeStage.BASICA_SECUNDARIA, number: 9, groups: ['A', 'B', 'C', 'D'] },
    { name: 'Décimo', stage: GradeStage.MEDIA, number: 10, groups: ['A', 'B', 'C', 'D'] },
    { name: 'Once', stage: GradeStage.MEDIA, number: 11, groups: ['A', 'B', 'C'] },
  ];

  let totalGroups = 0;
  for (const gc of gradesConfig) {
    const grade = await prisma.grade.upsert({
      where: { stage_name: { stage: gc.stage, name: gc.name } },
      update: { number: gc.number },
      create: { name: gc.name, stage: gc.stage, number: gc.number },
    });

    for (const gName of gc.groups) {
      await prisma.group.upsert({
        where: {
          campusId_shiftId_gradeId_name: {
            campusId: campus.id,
            shiftId: morningShift.id,
            gradeId: grade.id,
            name: gName,
          },
        },
        update: {},
        create: {
          name: gName,
          campusId: campus.id,
          gradeId: grade.id,
          shiftId: morningShift.id,
          maxCapacity: 40,
        },
      });
      totalGroups++;
    }
    console.log(`   ✅ ${gc.name} (${gc.number}°): ${gc.groups.join(', ')}`);
  }
  console.log(`   → Total: ${totalGroups} grupos\n`);

  // ═══════════════════════════════════════════════════════════════
  // 6. USUARIO ADMIN INSTITUCIONAL
  // ═══════════════════════════════════════════════════════════════
  console.log('👤 Creando usuario admin institucional...');
  const hashedPassword = await bcrypt.hash('Admin2026!', 10);

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN_INSTITUTIONAL' } });
  if (!adminRole) throw new Error('Rol ADMIN_INSTITUTIONAL no encontrado');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@buenosmares.edu.co' },
    update: {},
    create: {
      email: 'admin@buenosmares.edu.co',
      username: 'admin',
      passwordHash: hashedPassword,
      firstName: 'Administrador',
      lastName: 'Institucional',
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  await prisma.institutionUser.upsert({
    where: { userId_institutionId: { userId: adminUser.id, institutionId: institution.id } },
    update: { isAdmin: true },
    create: { userId: adminUser.id, institutionId: institution.id, isAdmin: true },
  });

  // También asociar el SuperAdmin a esta institución
  const superAdmin = await prisma.user.findFirst({ where: { isSuperAdmin: true } });
  if (superAdmin) {
    await prisma.institutionUser.upsert({
      where: { userId_institutionId: { userId: superAdmin.id, institutionId: institution.id } },
      update: {},
      create: { userId: superAdmin.id, institutionId: institution.id, isAdmin: true },
    });
  }

  console.log(`   ✅ Admin: admin@buenosmares.edu.co / Admin2026!\n`);

  // ═══════════════════════════════════════════════════════════════
  // RESUMEN
  // ═══════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✅ RESTAURACIÓN COMPLETADA');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('📧 CREDENCIALES:');
  console.log('   SuperAdmin:  superadmin@edusyn.co / EdusynAdmin2026!');
  console.log('   Admin Inst:  admin@buenosmares.edu.co / Admin2026!');
  console.log('');
  console.log('🏫 Institución: Institución Educativa Digital En Buenos Mares');
  console.log(`   ID: ${institution.id}`);
  console.log(`   Slug: ${institution.slug}`);
  console.log('');
  console.log('📋 SIGUIENTES PASOS:');
  console.log('   1. Ingresar como admin y verificar la institución');
  console.log('   2. Reimportar carga académica (Excel de timetabling)');
  console.log('   3. Reimportar estudiantes (Excel de estudiantes)');
  console.log('═══════════════════════════════════════════════════════════════');

  await prisma.$disconnect();
}

restore().catch(async (e) => {
  console.error('❌ Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
