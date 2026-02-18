/**
 * SEED ACHIEVEMENTS - Agregar logros de ejemplo al primer periodo
 * 
 * Este script agrega logros de ejemplo para las asignaturas del primer periodo
 * de la institución demo "Colegio Demo Excelencia Académica".
 * 
 * Ejecutar con: npx ts-node prisma/seed-achievements.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Buscar por nombre en lugar de slug para mayor flexibilidad
const DEMO_INSTITUTION_NAME = 'Colegio Demo Excelencia Académica';

// Logros de ejemplo por asignatura
const ACHIEVEMENTS_BY_SUBJECT: Record<string, string[]> = {
  'Matemáticas': [
    'Resuelve operaciones básicas con números enteros aplicando las propiedades de la adición y la multiplicación.',
    'Identifica y aplica el concepto de fracción en situaciones cotidianas.',
    'Analiza y resuelve problemas matemáticos utilizando ecuaciones de primer grado.',
  ],
  'Geometría': [
    'Reconoce y clasifica figuras geométricas según sus propiedades.',
    'Calcula el área y perímetro de figuras planas regulares e irregulares.',
  ],
  'Lengua Castellana': [
    'Produce textos narrativos coherentes aplicando las normas ortográficas básicas.',
    'Comprende e interpreta textos literarios identificando sus elementos estructurales.',
    'Argumenta sus ideas de forma oral respetando los turnos de participación.',
  ],
  'Inglés': [
    'Comprende y utiliza vocabulario básico en contextos comunicativos.',
    'Construye oraciones simples en presente simple y presente continuo.',
  ],
  'Ciencias Naturales': [
    'Describe las características de los seres vivos y su clasificación.',
    'Explica el ciclo del agua y su importancia para los ecosistemas.',
  ],
  'Biología': [
    'Identifica las estructuras celulares y sus funciones principales.',
    'Comprende los procesos de reproducción celular: mitosis y meiosis.',
  ],
  'Química': [
    'Reconoce los elementos de la tabla periódica y sus propiedades.',
    'Balancea ecuaciones químicas sencillas aplicando la ley de conservación de la masa.',
  ],
  'Física': [
    'Aplica las leyes del movimiento de Newton en situaciones cotidianas.',
    'Calcula magnitudes físicas como velocidad, aceleración y fuerza.',
  ],
  'Historia': [
    'Analiza los principales acontecimientos históricos de Colombia en el siglo XIX.',
    'Relaciona causas y consecuencias de los procesos de independencia latinoamericana.',
  ],
  'Geografía': [
    'Ubica las regiones naturales de Colombia y describe sus características.',
    'Interpreta mapas y utiliza coordenadas geográficas.',
  ],
  'Ciencias Sociales': [
    'Comprende la organización política y administrativa del Estado colombiano.',
    'Analiza problemáticas sociales actuales desde una perspectiva crítica.',
  ],
  'Educación Física': [
    'Ejecuta movimientos coordinados en actividades deportivas grupales.',
    'Demuestra actitudes de respeto y trabajo en equipo durante las actividades físicas.',
  ],
  'Artes': [
    'Expresa ideas y emociones a través de técnicas artísticas variadas.',
    'Aprecia manifestaciones artísticas de diferentes culturas.',
  ],
  'Música': [
    'Reconoce elementos básicos del lenguaje musical: ritmo, melodía y armonía.',
    'Interpreta piezas musicales sencillas con instrumentos de percusión.',
  ],
  'Tecnología': [
    'Utiliza herramientas tecnológicas para la búsqueda y organización de información.',
    'Diseña soluciones tecnológicas a problemas del entorno.',
  ],
  'Informática': [
    'Maneja procesadores de texto y hojas de cálculo para tareas académicas.',
    'Comprende conceptos básicos de programación y algoritmos.',
  ],
  'Ética': [
    'Reflexiona sobre valores éticos y su aplicación en la vida cotidiana.',
    'Demuestra actitudes de respeto hacia la diversidad cultural y de pensamiento.',
  ],
  'Religión': [
    'Comprende los principios fundamentales de las principales religiones del mundo.',
    'Reflexiona sobre el sentido de la vida desde diferentes perspectivas espirituales.',
  ],
  'Filosofía': [
    'Identifica las principales corrientes filosóficas de la antigüedad.',
    'Argumenta posiciones filosóficas sobre problemas éticos contemporáneos.',
  ],
};

async function seedAchievements() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📚 SEED ACHIEVEMENTS - Logros de ejemplo para Primer Periodo');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Buscar la institución demo por nombre
  const institution = await prisma.institution.findFirst({
    where: { 
      OR: [
        { name: { contains: 'Demo Excelencia', mode: 'insensitive' } },
        { name: { contains: 'Colegio Demo', mode: 'insensitive' } },
      ]
    },
  });

  if (!institution) {
    // Listar instituciones disponibles para debug
    const allInstitutions = await prisma.institution.findMany({ select: { id: true, name: true } });
    console.log('❌ No se encontró la institución demo.');
    console.log('   Instituciones disponibles:', allInstitutions.map(i => i.name).join(', '));
    return;
  }

  console.log(`✅ Institución encontrada: ${institution.name}\n`);

  // Buscar el primer periodo (P1) del año activo
  const academicYear = await prisma.academicYear.findFirst({
    where: { institutionId: institution.id, status: 'ACTIVE' },
    include: {
      terms: {
        orderBy: { startDate: 'asc' },
      },
    },
  });

  if (!academicYear || academicYear.terms.length === 0) {
    console.log('❌ No se encontró año académico activo con periodos.');
    return;
  }

  const firstTerm = academicYear.terms[0];
  console.log(`📅 Periodo seleccionado: ${firstTerm.name} (${firstTerm.status})\n`);

  // Buscar todas las asignaciones de docentes para este periodo
  const teacherAssignments = await prisma.teacherAssignment.findMany({
    where: {
      institutionId: institution.id,
      academicYearId: academicYear.id,
    },
    include: {
      subject: true,
      group: { include: { grade: true } },
    },
  });

  console.log(`👨‍🏫 Asignaciones de docentes encontradas: ${teacherAssignments.length}\n`);

  let achievementsCreated = 0;
  let assignmentsProcessed = 0;

  for (const assignment of teacherAssignments) {
    const subjectName = assignment.subject.name;
    const achievements = ACHIEVEMENTS_BY_SUBJECT[subjectName];

    if (!achievements || achievements.length === 0) {
      continue;
    }

    // Verificar si ya existen logros para esta asignación y periodo
    const existingCount = await prisma.achievement.count({
      where: {
        teacherAssignmentId: assignment.id,
        academicTermId: firstTerm.id,
      },
    });

    if (existingCount > 0) {
      console.log(`   ⏭️  ${subjectName} (${assignment.group.name}) - Ya tiene ${existingCount} logros`);
      continue;
    }

    // Crear logros para esta asignación
    for (let i = 0; i < achievements.length; i++) {
      const code = `LOG-${subjectName.substring(0, 3).toUpperCase()}-P1-${String(i + 1).padStart(2, '0')}`;
      
      await prisma.achievement.create({
        data: {
          institutionId: institution.id,
          teacherAssignmentId: assignment.id,
          academicTermId: firstTerm.id,
          code,
          orderNumber: i + 1,
          achievementType: 'ACADEMIC',
          baseDescription: achievements[i],
          isPromotional: false,
        },
      });
      achievementsCreated++;
    }

    assignmentsProcessed++;
    console.log(`   ✅ ${subjectName} (${assignment.group.name}) - ${achievements.length} logros creados`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`✅ COMPLETADO: ${achievementsCreated} logros creados en ${assignmentsProcessed} asignaciones`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

seedAchievements()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
