import { PrismaClient, SchoolShift, GradeStage, AcademicTermType, PerformanceLevel } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';
import { seedPermissions } from './seeds/permissions.seed';

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
      slug: 'ie-villa-san-pablo',
      daneCode: '108001001234',
      nit: '900123456-7',
      status: 'ACTIVE',
    },
  });
  console.log(`   ✅ Institución: ${institution.name}\n`);

  // ============================================
  // 2.5 HABILITAR MÓDULOS DE LA INSTITUCIÓN
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
      create: {
        institutionId: institution.id,
        module: mod.module as any,
        isActive: true,
        features: mod.features,
      },
    });
  }
  console.log(`   ✅ ${modulesToEnable.length} módulos habilitados\n`);

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
    // Buscar área existente o crear nueva
    let area = await prisma.area.findFirst({
      where: { 
        institutionId: institution.id, 
        name: areaData.name,
      },
    });
    
    if (!area) {
      area = await prisma.area.create({
        data: {
          name: areaData.name,
          institutionId: institution.id,
        },
      });
    }

    for (const subjectName of areaData.subjects) {
      // Buscar asignatura existente o crear nueva
      let subject = await prisma.subject.findFirst({
        where: { 
          areaId: area.id, 
          name: subjectName,
        },
      });
      
      if (!subject) {
        subject = await prisma.subject.create({
          data: {
            name: subjectName,
            areaId: area.id,
            order: subjectCount,
          },
        });
      }
      subjectCount++;
    }
  }
  console.log(`   ✅ ${areasData.length} áreas y ${subjectCount} asignaturas creadas\n`);

  // ============================================
  // 10. CREAR USUARIOS DEL SISTEMA
  // ============================================
  console.log('👤 Creando usuarios...');
  
  const hashedPassword = await bcryptjs.hash('Demo2026!', 10);
  const superAdminPassword = await bcryptjs.hash('Super2026!', 10);

  // SuperAdmin del sistema (sin institución)
  const superAdminUser = await prisma.user.upsert({
    where: { email: 'superadmin@edusyn.co' },
    update: { username: 'superadmin', isSuperAdmin: true },
    create: {
      email: 'superadmin@edusyn.co',
      username: 'superadmin',
      passwordHash: superAdminPassword,
      firstName: 'Super',
      lastName: 'Administrador',
      documentType: 'CC',
      documentNumber: '0000000001',
      isActive: true,
      isSuperAdmin: true,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdminUser.id, roleId: createdRoles['SUPERADMIN'].id } },
    update: {},
    create: { userId: superAdminUser.id, roleId: createdRoles['SUPERADMIN'].id },
  });
  console.log('   ✅ SuperAdmin creado: superadmin / Super2026!');

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

  // Asociar usuarios a la institución (InstitutionUser)
  await prisma.institutionUser.upsert({
    where: { userId_institutionId: { userId: adminUser.id, institutionId: institution.id } },
    update: { isAdmin: true },
    create: { userId: adminUser.id, institutionId: institution.id, isAdmin: true },
  });

  await prisma.institutionUser.upsert({
    where: { userId_institutionId: { userId: coordinatorUser.id, institutionId: institution.id } },
    update: {},
    create: { userId: coordinatorUser.id, institutionId: institution.id, isAdmin: false },
  });

  await prisma.institutionUser.upsert({
    where: { userId_institutionId: { userId: teacherUser.id, institutionId: institution.id } },
    update: {},
    create: { userId: teacherUser.id, institutionId: institution.id, isAdmin: false },
  });

  console.log(`   ✅ 3 usuarios creados y asociados a la institución\n`);

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
  // 12. CREAR PERMISOS DEL SISTEMA
  // ============================================
  await seedPermissions();

  // ============================================
  // SEED DIMENSIONES DEL DESARROLLO (PREESCOLAR)
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
    // Buscar si ya existe una dimensión con este código
    const existing = await prisma.dimension.findFirst({ where: { code: dim.code } });
    if (existing) {
      await prisma.dimension.update({
        where: { id: existing.id },
        data: { name: dim.name, description: dim.description, order: dim.order },
      });
    } else {
      await prisma.dimension.create({
        data: { name: dim.name, code: dim.code, description: dim.description, order: dim.order },
      });
    }
  }
  console.log(`   ✅ ${dimensions.length} dimensiones creadas\n`);

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
