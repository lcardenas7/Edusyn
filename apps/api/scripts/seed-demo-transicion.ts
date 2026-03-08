/**
 * SEED DEMO - Agregar Transición (Preescolar) a la institución demo
 * 
 * Crea:
 * - Grado Transición con academicStructure = DIMENSIONS
 * - Grupo Transición-A
 * - 7 dimensiones del desarrollo (catálogo Dimension + Area/Subject operativo)
 * - Plantilla académica para preescolar (TemplateDimension + TemplateArea)
 * - 1 docente titular (directora de grupo) con TeacherAssignments
 * - 15 estudiantes con matrículas
 * - EnrollmentDimension (snapshot cualitativo) + EnrollmentArea/EnrollmentSubject (flujo operativo)
 * - Logros cualitativos por dimensión (P1 y P2) vía Achievement/StudentAchievement
 * 
 * MODELO DUAL:
 *   Dimension (catálogo/display) ← TemplateDimension ← EnrollmentDimension
 *   Area/Subject (flujo operativo) ← TeacherAssignment ← Achievement ← StudentAchievement
 * 
 * INCREMENTAL: No borra nada. Se puede ejecutar sobre el demo existente.
 * IDEMPOTENTE: Verifica si ya existe antes de crear.
 * 
 * Ejecutar: npx ts-node -P tsconfig.seed.json scripts/seed-demo-transicion.ts
 */

import { PrismaClient, GradeStage } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_INSTITUTION_SLUG = 'colegio-demo-excelencia-academica';

// Dimensiones del desarrollo para preescolar
const DIMENSIONS = [
  { name: 'Dimensión Cognitiva', code: 'COG', description: 'Desarrollo del pensamiento lógico, resolución de problemas y construcción de conocimiento.' },
  { name: 'Dimensión Comunicativa', code: 'COM', description: 'Desarrollo del lenguaje oral, escrito, gestual y expresión de ideas.' },
  { name: 'Dimensión Corporal', code: 'COR', description: 'Desarrollo de habilidades motrices, coordinación y conciencia corporal.' },
  { name: 'Dimensión Socioafectiva', code: 'SOC', description: 'Desarrollo emocional, relaciones interpersonales y autoestima.' },
  { name: 'Dimensión Estética', code: 'EST', description: 'Desarrollo de la sensibilidad artística, creatividad y apreciación estética.' },
  { name: 'Dimensión Ética', code: 'ETI', description: 'Desarrollo de valores, normas de convivencia y responsabilidad.' },
  { name: 'Dimensión Espiritual', code: 'ESP', description: 'Desarrollo de la trascendencia, sentido de vida y valores espirituales.' },
];

// Logros cualitativos por dimensión (keys match dimension codes)
const QUALITATIVE_ACHIEVEMENTS: Record<string, { descriptions: string[]; observations: string[] }> = {
  'COG': {
    descriptions: [
      'Identifica y clasifica objetos según forma, color y tamaño',
      'Resuelve problemas sencillos de la vida cotidiana usando el pensamiento lógico',
      'Establece relaciones de causa y efecto en situaciones simples',
    ],
    observations: [
      'Muestra curiosidad e interés por explorar su entorno',
      'Requiere acompañamiento para completar secuencias lógicas',
      'Demuestra avances significativos en clasificación y seriación',
    ],
  },
  'COM': {
    descriptions: [
      'Expresa sus ideas y sentimientos de forma oral con claridad',
      'Reconoce y traza las vocales y algunas consonantes',
      'Comprende instrucciones orales y las ejecuta correctamente',
    ],
    observations: [
      'Participa activamente en conversaciones grupales',
      'Se recomienda reforzar la expresión escrita en casa',
      'Excelente capacidad narrativa para su edad',
    ],
  },
  'COR': {
    descriptions: [
      'Coordina movimientos gruesos y finos con precisión adecuada para su edad',
      'Participa con entusiasmo en actividades de motricidad gruesa',
      'Maneja adecuadamente herramientas como tijeras, crayones y pinceles',
    ],
    observations: [
      'Excelente coordinación óculo-manual',
      'Se sugiere practicar recorte y coloreado para fortalecer motricidad fina',
      'Disfruta de las actividades al aire libre y deportivas',
    ],
  },
  'SOC': {
    descriptions: [
      'Interactúa con sus compañeros de manera respetuosa y colaborativa',
      'Reconoce y expresa sus emociones de forma adecuada',
      'Sigue las normas de convivencia del aula',
    ],
    observations: [
      'Demuestra empatía y solidaridad con sus compañeros',
      'En ocasiones necesita apoyo para manejar la frustración',
      'Líder natural en actividades grupales',
    ],
  },
  'EST': {
    descriptions: [
      'Expresa su creatividad a través del dibujo, la pintura y el modelado',
      'Disfruta y participa en actividades musicales y de expresión corporal',
      'Aprecia las manifestaciones artísticas de su entorno',
    ],
    observations: [
      'Muestra gran sensibilidad artística y creatividad',
      'Se recomienda estimular la expresión artística en el hogar',
      'Talento notable en actividades de expresión plástica',
    ],
  },
  'ETI': {
    descriptions: [
      'Practica valores como el respeto, la honestidad y la responsabilidad',
      'Diferencia entre acciones correctas e incorrectas en situaciones cotidianas',
      'Cuida los materiales del aula y respeta los espacios comunes',
    ],
    observations: [
      'Demuestra un sólido sentido de justicia y equidad',
      'Se sugiere reforzar el valor de la responsabilidad con las tareas',
      'Ejemplo de buen comportamiento para sus compañeros',
    ],
  },
  'ESP': {
    descriptions: [
      'Muestra respeto por las creencias y tradiciones de su comunidad',
      'Reflexiona sobre el cuidado de la naturaleza y los seres vivos',
      'Participa con respeto en momentos de reflexión grupal',
    ],
    observations: [
      'Demuestra sensibilidad hacia el cuidado del medio ambiente',
      'Participa con interés en actividades de reflexión',
      'Muestra respeto por la diversidad de pensamiento',
    ],
  },
};

// Niveles cualitativos de desempeño para preescolar
const QUALITATIVE_LEVELS = ['LOGRADO', 'EN_PROCESO', 'INICIANDO'];
const QUALITATIVE_WEIGHTS = [0.50, 0.35, 0.15]; // Probabilidad de cada nivel

function pickQualitativeLevel(): string {
  const r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < QUALITATIVE_LEVELS.length; i++) {
    cumulative += QUALITATIVE_WEIGHTS[i];
    if (r < cumulative) return QUALITATIVE_LEVELS[i];
  }
  return QUALITATIVE_LEVELS[0];
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const FIRST_NAMES = [
  'Sofía', 'Mateo', 'Isabella', 'Santiago', 'Valentina', 'Samuel', 'Luciana',
  'Nicolás', 'Mariana', 'Sebastián', 'Camila', 'Alejandro', 'Sara', 'Daniel', 'Luna',
  'Emilio', 'Antonella', 'Tomás', 'Renata', 'Gabriel',
];

const LAST_NAMES = [
  'García López', 'Rodríguez Martínez', 'Torres Hernández', 'Gómez Sánchez',
  'Ramírez Flores', 'Díaz Rivera', 'Morales Cruz', 'Ortiz Reyes',
  'Vargas Castillo', 'Herrera Medina', 'Rojas Aguilar', 'Suárez Valencia',
  'Mendoza Pardo', 'Arias Castaño', 'Ospina Cardona', 'Vega Acosta',
  'Jiménez Moreno', 'Romero Gutiérrez', 'Pérez González', 'López Hernández',
];

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎨 SEED DEMO - Transición (Preescolar / DIMENSIONS)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ─── Verificar institución demo ────────────────────────────────────
  const institution = await prisma.institution.findFirst({
    where: { slug: DEMO_INSTITUTION_SLUG },
  });
  if (!institution) {
    console.error('❌ Institución demo no encontrada. Ejecuta seed-demo.ts primero.');
    process.exit(1);
  }
  console.log(`✅ Institución: ${institution.name} (${institution.id})\n`);

  // ─── Verificar año académico ───────────────────────────────────────
  const academicYear = await prisma.academicYear.findFirst({
    where: { institutionId: institution.id, status: 'ACTIVE' },
  });
  if (!academicYear) {
    console.error('❌ No hay año académico activo.');
    process.exit(1);
  }
  console.log(`✅ Año académico: ${academicYear.name} (${academicYear.id})`);

  const terms = await prisma.academicTerm.findMany({
    where: { academicYearId: academicYear.id },
    orderBy: { order: 'asc' },
  });
  console.log(`✅ ${terms.length} períodos encontrados\n`);

  // ─── Verificar si ya existe Transición ─────────────────────────────
  const existingGroup = await prisma.group.findFirst({
    where: {
      grade: { stage: GradeStage.PREESCOLAR },
      campus: { institutionId: institution.id },
    },
  });
  if (existingGroup) {
    console.log('⚠️  Ya existe un grupo de preescolar. Abortando para no duplicar.');
    process.exit(0);
  }

  // ─── PASO 1: Crear Grado Transición con DIMENSIONS ────────────────
  console.log('🎓 PASO 1: Creando grado Transición...');
  let gradeTransicion = await prisma.grade.findFirst({
    where: { institutionId: institution.id, stage: GradeStage.PREESCOLAR, name: 'Transición' },
  });
  if (!gradeTransicion) {
    gradeTransicion = await prisma.grade.create({
      data: {
        institutionId: institution.id,
        name: 'Transición',
        stage: GradeStage.PREESCOLAR,
        number: 0,
        academicStructure: 'DIMENSIONS',
      },
    });
  } else {
    // Asegurar que tenga DIMENSIONS
    await prisma.grade.update({
      where: { id: gradeTransicion.id },
      data: { academicStructure: 'DIMENSIONS' },
    });
  }
  console.log(`   ✅ Grado: ${gradeTransicion.name} (academicStructure: DIMENSIONS)\n`);

  // ─── PASO 2: Crear Grupo Transición-A ──────────────────────────────
  console.log('🏫 PASO 2: Creando grupo...');
  const campus = await prisma.campus.findFirst({
    where: { institutionId: institution.id },
  });
  const shift = await prisma.shift.findFirst({
    where: { campus: { institutionId: institution.id } },
  });
  if (!campus || !shift) {
    console.error('❌ No se encontró sede o jornada.');
    process.exit(1);
  }

  const groupTransicion = await prisma.group.create({
    data: {
      name: 'A',
      campusId: campus.id,
      gradeId: gradeTransicion.id,
      shiftId: shift.id,
      maxCapacity: 25,
    },
  });
  console.log(`   ✅ Grupo: Transición - ${groupTransicion.name}\n`);

  // ─── PASO 3: Crear Dimensiones (catálogo + operativo) ──────────────
  console.log('📚 PASO 3: Creando dimensiones...');
  const dimensionRecords: any[] = [];  // Dimension catalog records
  const dimensionAreas: any[] = [];    // Area (operativo)
  const dimensionSubjects: any[] = []; // Subject (operativo)

  for (let i = 0; i < DIMENSIONS.length; i++) {
    const dim = DIMENSIONS[i];

    // 3a. Catálogo global: Dimension
    let dimension = await prisma.dimension.findFirst({
      where: { code: dim.code },
    });
    if (!dimension) {
      dimension = await prisma.dimension.create({
        data: {
          name: dim.name,
          code: dim.code,
          description: dim.description,
          order: i + 1,
        },
      });
    }
    dimensionRecords.push(dimension);

    // 3b. Operativo: Area (para TeacherAssignment → Achievement)
    const area = await prisma.area.create({
      data: {
        name: dim.name,
        code: dim.code,
        institutionId: institution.id,
        order: 100 + i, // Offset para no colisionar con áreas existentes
      },
    });
    dimensionAreas.push(area);

    // 3c. Operativo: Subject (1:1 con dimensión)
    const subject = await prisma.subject.create({
      data: {
        name: dim.name,
        code: dim.code,
        areaId: area.id,
        order: 0,
      },
    });
    dimensionSubjects.push(subject);
  }
  console.log(`   ✅ ${DIMENSIONS.length} dimensiones (catálogo + áreas + asignaturas)\n`);

  // ─── PASO 4: Plantilla Académica para Preescolar ───────────────────
  console.log('📝 PASO 4: Creando plantilla académica...');
  const templatePreescolar = await prisma.academicTemplate.create({
    data: {
      institutionId: institution.id,
      academicYearId: academicYear.id,
      name: 'Plantilla Preescolar Demo',
      level: 'PREESCOLAR',
      isDefault: true,
      achievementsPerPeriod: 1,
      useAttitudinalAchievement: false,
    },
  });

  // 4a. TemplateDimension (catálogo → plantilla)
  for (let i = 0; i < dimensionRecords.length; i++) {
    await prisma.templateDimension.create({
      data: {
        templateId: templatePreescolar.id,
        dimensionId: dimensionRecords[i].id,
        order: i,
      },
    });
  }

  // 4b. TemplateArea + TemplateSubject (operativo → plantilla)
  for (let i = 0; i < dimensionAreas.length; i++) {
    const tplArea = await prisma.templateArea.create({
      data: {
        templateId: templatePreescolar.id,
        areaId: dimensionAreas[i].id,
        weightPercentage: 0, // No aplica ponderación en DIMENSIONS
        calculationType: 'INFORMATIVE',
        order: i,
      },
    });
    await prisma.templateSubject.create({
      data: {
        templateAreaId: tplArea.id,
        subjectId: dimensionSubjects[i].id,
        weeklyHours: 0,
        weightPercentage: 0,
        order: 0,
      },
    });
  }

  // Asignar plantilla al grado
  await prisma.gradeTemplate.create({
    data: {
      gradeId: gradeTransicion.id,
      templateId: templatePreescolar.id,
      academicYearId: academicYear.id,
    },
  });
  console.log(`   ✅ Plantilla preescolar creada y asignada\n`);

  // ─── PASO 5: Docente titular ───────────────────────────────────────
  console.log('👩‍🏫 PASO 5: Creando docente titular...');
  const hashedPassword = await bcrypt.hash('Demo2026!', 10);
  const roleDocente = await prisma.role.findFirst({ where: { name: 'DOCENTE' } });
  if (!roleDocente) {
    console.error('❌ Rol DOCENTE no encontrado.');
    process.exit(1);
  }

  const docenteTransicion = await prisma.user.upsert({
    where: { email: 'transicion@demo.edu' },
    update: { passwordHash: hashedPassword },
    create: {
      email: 'transicion@demo.edu',
      username: 'transicion.demo',
      passwordHash: hashedPassword,
      firstName: 'María Elena',
      lastName: 'Ríos Montoya',
      documentType: 'CC',
      documentNumber: '9992000001',
      isActive: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: docenteTransicion.id, roleId: roleDocente.id } },
    update: {},
    create: { userId: docenteTransicion.id, roleId: roleDocente.id },
  });
  await prisma.institutionUser.upsert({
    where: { userId_institutionId: { userId: docenteTransicion.id, institutionId: institution.id } },
    update: {},
    create: { userId: docenteTransicion.id, institutionId: institution.id, isAdmin: false },
  });

  // Asignar como directora de grupo
  await prisma.group.update({
    where: { id: groupTransicion.id },
    data: { directorId: docenteTransicion.id },
  });
  console.log(`   ✅ Docente: María Elena Ríos Montoya (transicion@demo.edu)\n`);

  // ─── PASO 6: Teacher Assignments (todas las dimensiones) ───────────
  console.log('📋 PASO 6: Creando asignaciones docentes...');
  const assignmentMap: Record<string, any> = {};

  for (const subject of dimensionSubjects) {
    const assignment = await prisma.teacherAssignment.create({
      data: {
        institutionId: institution.id,
        academicYearId: academicYear.id,
        groupId: groupTransicion.id,
        subjectId: subject.id,
        teacherId: docenteTransicion.id,
        weeklyHours: 0,
      },
    });
    assignmentMap[subject.id] = assignment;
  }
  console.log(`   ✅ ${dimensionSubjects.length} asignaciones (todas a la docente titular)\n`);

  // ─── PASO 7: Estudiantes y Matrículas ──────────────────────────────
  console.log('🎒 PASO 7: Creando 15 estudiantes...');
  const studentRecords: { enrollment: any; name: string }[] = [];

  for (let i = 0; i < 15; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const isFemale = ['Sofía', 'Isabella', 'Valentina', 'Luciana', 'Mariana', 'Camila', 'Sara', 'Luna', 'Antonella', 'Renata'].includes(firstName);

    const student = await prisma.student.create({
      data: {
        institutionId: institution.id,
        firstName,
        lastName,
        documentType: 'RC', // Registro Civil para preescolar
        documentNumber: `99920${(i + 1).toString().padStart(5, '0')}`,
        birthDate: new Date(2020, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
        gender: isFemale ? 'F' : 'M',
      },
    });

    const enrollment = await prisma.studentEnrollment.create({
      data: {
        institutionId: institution.id,
        studentId: student.id,
        groupId: groupTransicion.id,
        academicYearId: academicYear.id,
        status: 'ACTIVE',
        enrollmentType: 'NEW',
      },
    });

    studentRecords.push({ enrollment, name: `${firstName} ${lastName}` });
  }
  console.log(`   ✅ ${studentRecords.length} estudiantes creados\n`);

  // ─── PASO 8: Snapshots de estructura académica ─────────────────────
  console.log('📎 PASO 8: Creando snapshots de estructura académica...');
  for (const record of studentRecords) {
    for (let i = 0; i < DIMENSIONS.length; i++) {
      const dim = DIMENSIONS[i];
      const area = dimensionAreas[i];
      const subject = dimensionSubjects[i];

      // 8a. EnrollmentDimension (snapshot cualitativo)
      await prisma.enrollmentDimension.create({
        data: {
          institutionId: institution.id,
          enrollmentId: record.enrollment.id,
          dimensionId: dimensionRecords[i].id,
          dimensionName: dim.name,
          dimensionCode: dim.code,
          order: i,
        },
      });

      // 8b. EnrollmentArea + EnrollmentSubject (operativo para logros)
      const enrollmentArea = await prisma.enrollmentArea.create({
        data: {
          institutionId: institution.id,
          enrollmentId: record.enrollment.id,
          areaId: area.id,
          areaName: dim.name,
          areaCode: dim.code,
          weightPercentage: 0,
          calculationType: 'INFORMATIVE',
          approvalRule: 'AREA_AVERAGE',
          recoveryRule: 'INDIVIDUAL_SUBJECT',
          order: i,
        },
      });

      await prisma.enrollmentSubject.create({
        data: {
          institutionId: institution.id,
          enrollmentId: record.enrollment.id,
          enrollmentAreaId: enrollmentArea.id,
          subjectId: subject.id,
          subjectName: dim.name,
          subjectCode: dim.code,
          weeklyHours: 0,
          weightPercentage: 0,
          order: 0,
          teacherId: docenteTransicion.id,
          teacherName: `${docenteTransicion.firstName} ${docenteTransicion.lastName}`,
        },
      });
    }
  }
  console.log('   ✅ Snapshots creados (EnrollmentDimension + EnrollmentArea/Subject)\n');

  // ─── PASO 9: Logros cualitativos (P1 y P2) ─────────────────────────
  console.log('🎯 PASO 9: Creando logros cualitativos...');
  const termsWithData = terms.slice(0, 2); // P1 y P2

  for (const term of termsWithData) {
    for (const subject of dimensionSubjects) {
      const assignment = assignmentMap[subject.id];
      const dimCode = subject.code || '';
      const achData = QUALITATIVE_ACHIEVEMENTS[dimCode];
      if (!achData) continue;

      // Crear 1 logro base por dimensión por período
      const baseDescription = rand(achData.descriptions);
      const termOrder = terms.indexOf(term) + 1;
      const achievementCode = `LOG-${dimCode}-P${termOrder}-01`;

      const achievement = await prisma.achievement.create({
        data: {
          institutionId: institution.id,
          code: achievementCode,
          teacherAssignmentId: assignment.id,
          academicTermId: term.id,
          orderNumber: 1,
          achievementType: 'ACADEMIC',
          baseDescription,
        },
      });

      // Asignar logro a cada estudiante con nivel cualitativo
      for (const record of studentRecords) {
        const level = pickQualitativeLevel();
        const observation = rand(achData.observations);

        await prisma.studentAchievement.create({
          data: {
            institutionId: institution.id,
            studentEnrollmentId: record.enrollment.id,
            achievementId: achievement.id,
            performanceLevel: level === 'LOGRADO' ? 'SUPERIOR' : level === 'EN_PROCESO' ? 'BASICO' : 'BAJO',
            suggestedText: baseDescription,
            approvedText: baseDescription,
            isTextApproved: true,
            observation,
            suggestedJudgment: level === 'LOGRADO'
              ? 'Demuestra dominio completo de los indicadores de logro.'
              : level === 'EN_PROCESO'
              ? 'Avanza satisfactoriamente, requiere seguir practicando.'
              : 'Necesita mayor acompañamiento y práctica.',
            approvedJudgment: level === 'LOGRADO'
              ? 'Demuestra dominio completo de los indicadores de logro.'
              : level === 'EN_PROCESO'
              ? 'Avanza satisfactoriamente, requiere seguir practicando.'
              : 'Necesita mayor acompañamiento y práctica.',
            isJudgmentApproved: true,
          },
        });
      }
    }
    console.log(`   📝 ${term.name}: ${dimensionSubjects.length} logros × ${studentRecords.length} estudiantes`);
  }
  console.log('   ✅ Logros cualitativos creados\n');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ TRANSICIÓN CREADA EXITOSAMENTE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n📋 Resumen:');
  console.log(`   - Grado: Transición (DIMENSIONS)`);
  console.log(`   - Grupo: Transición - A (15 estudiantes)`);
  console.log(`   - Dimensiones: ${DIMENSIONS.length}`);
  console.log(`   - Docente: transicion@demo.edu / Demo2026!`);
  console.log(`   - Logros: P1 y P2 con descriptores cualitativos`);
  console.log(`\n🔍 Para verificar:`);
  console.log(`   1. Ingresar como rector@demo.edu → Boletines → Seleccionar Transición-A`);
  console.log(`   2. Ingresar como transicion@demo.edu → Calificaciones`);
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
