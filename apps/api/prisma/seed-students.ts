import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Nombres colombianos para generar estudiantes
const firstNames = [
  'Santiago', 'Valentina', 'Samuel', 'Isabella', 'Matías', 'Sofía', 'Sebastián', 'Mariana',
  'Nicolás', 'Luciana', 'Alejandro', 'Camila', 'Daniel', 'Gabriela', 'Andrés', 'María José',
  'Juan Pablo', 'Sara', 'David', 'Laura', 'Carlos', 'Ana María', 'Miguel', 'Paula',
  'Felipe', 'Daniela', 'José', 'Natalia', 'Luis', 'Valeria'
];

const lastNames = [
  'García', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández', 'Pérez', 'Sánchez',
  'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Morales',
  'Cruz', 'Ortiz', 'Gutiérrez', 'Chávez', 'Ramos', 'Vargas', 'Castillo', 'Jiménez',
  'Moreno', 'Romero', 'Herrera', 'Medina', 'Aguilar', 'Vega'
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDocumentNumber(): string {
  return Math.floor(1000000000 + Math.random() * 900000000).toString();
}

function randomGrade(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

async function main() {
  console.log('🎓 Creando estudiantes y datos de prueba...\n');

  // Obtener la institución
  const institution = await prisma.institution.findFirst();
  if (!institution) {
    console.error('❌ No hay institución. Ejecuta primero el seed principal.');
    return;
  }
  console.log(`📍 Institución: ${institution.name}`);

  // Obtener el año académico activo
  const academicYear = await prisma.academicYear.findFirst({
    where: { institutionId: institution.id },
    include: { 
      terms: { orderBy: { order: 'asc' } },
      periods: { orderBy: { order: 'asc' } }
    },
    orderBy: { year: 'desc' }
  });
  if (!academicYear) {
    console.error('❌ No hay año académico. Ejecuta primero el seed principal.');
    return;
  }
  console.log(`📅 Año académico: ${academicYear.year}`);

  // Obtener grupos
  const groups = await prisma.group.findMany({
    include: { 
      grade: true,
      campus: true,
      teacherAssignments: {
        include: { subject: true }
      }
    }
  });
  if (groups.length === 0) {
    console.error('❌ No hay grupos. Ejecuta primero el seed principal.');
    return;
  }
  console.log(`👥 Grupos encontrados: ${groups.length}`);

  // Crear estudiantes para cada grupo
  let totalStudents = 0;
  const studentsPerGroup = 15;

  for (const group of groups) {
    console.log(`\n📚 Creando estudiantes para ${group.grade.name} - ${group.name}...`);
    
    for (let i = 0; i < studentsPerGroup; i++) {
      const firstName = randomElement(firstNames);
      const lastName1 = randomElement(lastNames);
      const lastName2 = randomElement(lastNames);
      const fullLastName = `${lastName1} ${lastName2}`;
      
      // Crear estudiante
      const student = await prisma.student.create({
        data: {
          institutionId: institution.id,
          firstName,
          lastName: fullLastName,
          documentType: 'TI',
          documentNumber: generateDocumentNumber(),
          birthDate: new Date(2010 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1),
          gender: Math.random() > 0.5 ? 'M' : 'F',
        }
      });

      // Matricular en el grupo
      const enrollment = await prisma.studentEnrollment.create({
        data: {
          institutionId: institution.id,
          studentId: student.id,
          groupId: group.id,
          academicYearId: academicYear.id,
          status: 'ACTIVE',
        }
      });

      // Crear calificaciones para cada período y asignatura
      for (const term of academicYear.terms) {
        for (const assignment of group.teacherAssignments) {
          // Nota del período (entre 2.0 y 5.0)
          const grade = randomGrade(2.0, 5.0);
          const performanceLevel = grade >= 4.6 ? 'SUPERIOR' : grade >= 4.0 ? 'ALTO' : grade >= 3.0 ? 'BASICO' : 'BAJO';

          await prisma.periodFinalGrade.create({
            data: {
              institutionId: institution.id,
              studentEnrollmentId: enrollment.id,
              subjectId: assignment.subjectId,
              academicTermId: term.id,
              finalScore: grade,
              enteredById: assignment.teacherId,
            }
          });
        }
      }

      // Crear registros de asistencia (últimos 30 días)
      const today = new Date();
      for (let d = 0; d < 30; d++) {
        const date = new Date(today);
        date.setDate(date.getDate() - d);
        
        // Solo días de semana
        if (date.getDay() === 0 || date.getDay() === 6) continue;

        for (const assignment of group.teacherAssignments.slice(0, 3)) { // Solo 3 asignaturas por día
          // 90% asistencia, 5% tardanza, 5% falta
          const rand = Math.random();
          const status = rand < 0.90 ? 'PRESENT' : rand < 0.95 ? 'LATE' : 'ABSENT';

          await prisma.attendanceRecord.create({
            data: {
              institutionId: institution.id,
              studentEnrollmentId: enrollment.id,
              teacherAssignmentId: assignment.id,
              date,
              status,
              observations: status === 'ABSENT' ? 'Falta justificada' : null,
            }
          });
        }
      }

      totalStudents++;
    }
    console.log(`   ✅ ${studentsPerGroup} estudiantes creados con calificaciones y asistencia`);
  }

  console.log(`\n🎉 Total: ${totalStudents} estudiantes creados`);
  console.log('   📊 Calificaciones generadas para todos los períodos');
  console.log('   📋 Asistencia de los últimos 30 días registrada');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
