import { PrismaClient, SchoolShift, GradeStage, AcademicTermType, PerformanceLevel } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...\n');

  // ============================================
  // 1. CREAR ROLES DEL SISTEMA
  // ============================================
  console.log('📋 Creando roles...');
  
  const roles = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE'];
  const createdRoles: Record<string, any> = {};
  
  for (const roleName of roles) {
    createdRoles[roleName] = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }
  console.log(`   ✅ ${roles.length} roles creados\n`);

  // ============================================
  // 2. CREAR INSTITUCIÓN
  // ============================================
  console.log('🏫 Creando institución...');
  
  const institution = await prisma.institution.upsert({
    where: { daneCode: '108001001234' },
    update: {},
    create: {
      name: 'Institución Educativa Villa San Pablo',
      daneCode: '108001001234',
      nit: '900123456-7',
    },
  });
  console.log(`   ✅ Institución: ${institution.name}\n`);

  // ============================================
  // 3. CREAR SEDE PRINCIPAL
  // ============================================
  console.log('🏢 Creando sede...');
  
  const campus = await prisma.campus.upsert({
    where: { institutionId_name: { institutionId: institution.id, name: 'Sede Principal' } },
    update: {},
    create: {
      name: 'Sede Principal',
      address: 'Calle 45 # 23-15',
      institutionId: institution.id,
    },
  });
  console.log(`   ✅ Sede: ${campus.name}\n`);

  // ============================================
  // 4. CREAR JORNADAS
  // ============================================
  console.log('⏰ Creando jornadas...');
  
  const morningShift = await prisma.shift.upsert({
    where: { campusId_type: { campusId: campus.id, type: SchoolShift.MORNING } },
    update: {},
    create: {
      name: 'Mañana',
      type: SchoolShift.MORNING,
      campusId: campus.id,
    },
  });

  const afternoonShift = await prisma.shift.upsert({
    where: { campusId_type: { campusId: campus.id, type: SchoolShift.AFTERNOON } },
    update: {},
    create: {
      name: 'Tarde',
      type: SchoolShift.AFTERNOON,
      campusId: campus.id,
    },
  });
  console.log(`   ✅ 2 jornadas creadas\n`);

  // ============================================
  // 5. CREAR AÑO ACADÉMICO
  // ============================================
  console.log('📅 Creando año académico...');
  
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
  console.log(`   ✅ Año académico: ${academicYear.year}\n`);

  // ============================================
  // 6. CREAR PERÍODOS ACADÉMICOS
  // ============================================
  console.log('📆 Creando períodos académicos...');
  
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
        name: p.name,
        type: AcademicTermType.PERIOD,
        order: p.order,
        weightPercentage: p.weight,
        startDate: new Date(p.start),
        endDate: new Date(p.end),
        academicYearId: academicYear.id,
      },
    });
  }
  console.log(`   ✅ ${periods.length} períodos creados\n`);

  // ============================================
  // 7. CREAR GRADOS
  // ============================================
  console.log('🎓 Creando grados...');
  
  const gradesData = [
    { name: '6°', stage: GradeStage.BASICA_SECUNDARIA, number: 6 },
    { name: '7°', stage: GradeStage.BASICA_SECUNDARIA, number: 7 },
    { name: '8°', stage: GradeStage.BASICA_SECUNDARIA, number: 8 },
    { name: '9°', stage: GradeStage.BASICA_SECUNDARIA, number: 9 },
    { name: '10°', stage: GradeStage.MEDIA, number: 10 },
    { name: '11°', stage: GradeStage.MEDIA, number: 11 },
  ];
  const createdGrades: Record<string, any> = {};

  for (const g of gradesData) {
    createdGrades[g.name] = await prisma.grade.upsert({
      where: { stage_name: { stage: g.stage, name: g.name } },
      update: {},
      create: {
        name: g.name,
        stage: g.stage,
        number: g.number,
      },
    });
  }
  console.log(`   ✅ ${gradesData.length} grados creados\n`);

  // ============================================
  // 8. CREAR GRUPOS
  // ============================================
  console.log('👥 Creando grupos...');
  
  const groupNames = ['A', 'B'];
  let groupCount = 0;

  for (const g of gradesData) {
    for (const groupName of groupNames) {
      await prisma.group.upsert({
        where: { 
          campusId_shiftId_gradeId_name: { 
            campusId: campus.id, 
            shiftId: groupName === 'A' ? morningShift.id : afternoonShift.id,
            gradeId: createdGrades[g.name].id,
            name: groupName 
          } 
        },
        update: {},
        create: {
          name: groupName,
          campusId: campus.id,
          gradeId: createdGrades[g.name].id,
          shiftId: groupName === 'A' ? morningShift.id : afternoonShift.id,
        },
      });
      groupCount++;
    }
  }
  console.log(`   ✅ ${groupCount} grupos creados\n`);

  // ============================================
  // 9. CREAR ÁREAS Y ASIGNATURAS
  // ============================================
  console.log('📚 Creando áreas y asignaturas...');
  
  const areasData = [
    { name: 'Matemáticas', subjects: ['Matemáticas', 'Geometría', 'Estadística'] },
    { name: 'Ciencias Naturales', subjects: ['Biología', 'Química', 'Física'] },
    { name: 'Ciencias Sociales', subjects: ['Historia', 'Geografía', 'Democracia'] },
    { name: 'Humanidades', subjects: ['Lengua Castellana', 'Inglés', 'Filosofía'] },
    { name: 'Educación Artística', subjects: ['Artes Plásticas', 'Música'] },
    { name: 'Educación Física', subjects: ['Educación Física', 'Deportes'] },
    { name: 'Tecnología', subjects: ['Tecnología e Informática'] },
  ];

  let subjectCount = 0;
  for (const areaData of areasData) {
    const area = await prisma.area.upsert({
      where: { institutionId_name: { institutionId: institution.id, name: areaData.name } },
      update: {},
      create: {
        name: areaData.name,
        institutionId: institution.id,
      },
    });

    for (const subjectName of areaData.subjects) {
      await prisma.subject.upsert({
        where: { areaId_name: { areaId: area.id, name: subjectName } },
        update: {},
        create: {
          name: subjectName,
          areaId: area.id,
          weeklyHours: 4,
        },
      });
      subjectCount++;
    }
  }
  console.log(`   ✅ ${areasData.length} áreas y ${subjectCount} asignaturas creadas\n`);

  // ============================================
  // 10. CREAR USUARIOS DEL SISTEMA
  // ============================================
  console.log('👤 Creando usuarios...');
  
  const hashedPassword = await bcryptjs.hash('Demo2026!', 10);

  // Admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@villasanpablo.edu.co' },
    update: { username: 'admin' },
    create: {
      email: 'admin@villasanpablo.edu.co',
      username: 'admin',
      passwordHash: hashedPassword,
      firstName: 'Administrador',
      lastName: 'Sistema',
      documentType: 'CC',
      documentNumber: '1234567890',
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: createdRoles['ADMIN_INSTITUTIONAL'].id } },
    update: {},
    create: { userId: adminUser.id, roleId: createdRoles['ADMIN_INSTITUTIONAL'].id },
  });

  // Coordinador
  const coordinatorUser = await prisma.user.upsert({
    where: { email: 'coordinador@villasanpablo.edu.co' },
    update: { username: 'mcoordinadora' },
    create: {
      email: 'coordinador@villasanpablo.edu.co',
      username: 'mcoordinadora',
      passwordHash: hashedPassword,
      firstName: 'María',
      lastName: 'Coordinadora',
      documentType: 'CC',
      documentNumber: '9876543210',
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: coordinatorUser.id, roleId: createdRoles['COORDINADOR'].id } },
    update: {},
    create: { userId: coordinatorUser.id, roleId: createdRoles['COORDINADOR'].id },
  });

  // Docente de ejemplo
  const teacherUser = await prisma.user.upsert({
    where: { email: 'docente@villasanpablo.edu.co' },
    update: { username: 'cdocente' },
    create: {
      email: 'docente@villasanpablo.edu.co',
      username: 'cdocente',
      passwordHash: hashedPassword,
      firstName: 'Carlos',
      lastName: 'Docente',
      documentType: 'CC',
      documentNumber: '5555555555',
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: teacherUser.id, roleId: createdRoles['DOCENTE'].id } },
    update: {},
    create: { userId: teacherUser.id, roleId: createdRoles['DOCENTE'].id },
  });

  console.log(`   ✅ 3 usuarios creados (con usernames: admin, mcoordinadora, cdocente)\n`);

  // ============================================
  // 11. CREAR ASIGNACIONES DEL DOCENTE
  // ============================================
  console.log('📚 Creando asignaciones del docente...');

  // Obtener algunas asignaturas y grupos para asignar al docente
  const matematicas = await prisma.subject.findFirst({ where: { name: 'Matemáticas' } });
  const fisica = await prisma.subject.findFirst({ where: { name: 'Física' } });
  const grupo6A = await prisma.group.findFirst({ where: { name: 'A', grade: { name: 'Sexto' } } });
  const grupo6B = await prisma.group.findFirst({ where: { name: 'B', grade: { name: 'Sexto' } } });
  const grupo7A = await prisma.group.findFirst({ where: { name: 'A', grade: { name: 'Séptimo' } } });

  if (matematicas && grupo6A && academicYear) {
    await prisma.teacherAssignment.create({
      data: {
        teacherId: teacherUser.id,
        subjectId: matematicas.id,
        groupId: grupo6A.id,
        academicYearId: academicYear.id,
        weeklyHours: 5,
      },
    });
  }

  if (matematicas && grupo6B && academicYear) {
    await prisma.teacherAssignment.create({
      data: {
        teacherId: teacherUser.id,
        subjectId: matematicas.id,
        groupId: grupo6B.id,
        academicYearId: academicYear.id,
        weeklyHours: 5,
      },
    });
  }

  if (fisica && grupo7A && academicYear) {
    await prisma.teacherAssignment.create({
      data: {
        teacherId: teacherUser.id,
        subjectId: fisica.id,
        groupId: grupo7A.id,
        academicYearId: academicYear.id,
        weeklyHours: 4,
      },
    });
  }

  console.log(`   ✅ Asignaciones creadas para el docente Carlos\n`);

  // ============================================
  // 12. CREAR ESCALA DE VALORACIÓN
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
      create: {
        level: pl.level,
        minScore: pl.minScore,
        maxScore: pl.maxScore,
        institutionId: institution.id,
      },
    });
  }
  console.log(`   ✅ ${performanceLevels.length} niveles de desempeño creados\n`);

  // ============================================
  // RESUMEN FINAL
  // ============================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ SEED COMPLETADO EXITOSAMENTE');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📧 USUARIOS DE PRUEBA (contraseña: Demo2026!):\n');
  console.log('   🔑 Admin:       admin@villasanpablo.edu.co');
  console.log('   🔑 Coordinador: coordinador@villasanpablo.edu.co');
  console.log('   🔑 Docente:     docente@villasanpablo.edu.co');
  console.log('\n📌 Ahora puede importar estudiantes y docentes desde Excel.');
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
