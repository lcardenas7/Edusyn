import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Nombres y apellidos colombianos comunes
const firstNames = [
  'Juan', 'Carlos', 'Andrés', 'Miguel', 'José', 'Luis', 'David', 'Santiago', 'Sebastián', 'Daniel',
  'María', 'Laura', 'Valentina', 'Camila', 'Sofía', 'Isabella', 'Daniela', 'Paula', 'Andrea', 'Carolina',
  'Diego', 'Alejandro', 'Felipe', 'Nicolás', 'Mateo', 'Samuel', 'Julián', 'Tomás', 'Gabriel', 'Martín',
  'Ana', 'Natalia', 'Mariana', 'Gabriela', 'Lucía', 'Sara', 'Valeria', 'Juliana', 'Manuela', 'Catalina',
  'Esteban', 'Cristian', 'Óscar', 'Iván', 'Ricardo', 'Fernando', 'Jorge', 'Sergio', 'Mauricio', 'Fabián',
];

const lastNames = [
  'García', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández', 'Pérez', 'Sánchez', 'Ramírez', 'Torres',
  'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Morales', 'Jiménez', 'Ruiz', 'Álvarez', 'Romero',
  'Vargas', 'Castro', 'Ortiz', 'Rubio', 'Molina', 'Delgado', 'Moreno', 'Muñoz', 'Rojas', 'Navarro',
  'Ramos', 'Gil', 'Santos', 'Guerrero', 'Medina', 'Castillo', 'Herrera', 'Mendoza', 'Aguilar', 'Vega',
  'Córdoba', 'Ospina', 'Arias', 'Valencia', 'Cardona', 'Mejía', 'Salazar', 'Parra', 'Duque', 'Castaño',
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDocumentNumber(): string {
  return Math.floor(1000000000 + Math.random() * 900000000).toString();
}

function generateBirthDate(gradeNumber: number): Date {
  // Edad aproximada según el grado (6° = 11-12 años, 11° = 16-17 años)
  const baseAge = gradeNumber + 5;
  const year = 2026 - baseAge - Math.floor(Math.random() * 2);
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(year, month, day);
}

function getGradeNumber(gradeName: string): number {
  const match = gradeName.match(/(\d+)/);
  return match ? parseInt(match[1]) : 6;
}

function generateRandomScore(): number {
  // Generar notas con distribución realista (más notas entre 3.0 y 4.5)
  const rand = Math.random();
  if (rand < 0.1) return Math.round((1.0 + Math.random() * 1.9) * 10) / 10; // 10% bajo (1.0-2.9)
  if (rand < 0.4) return Math.round((3.0 + Math.random() * 0.9) * 10) / 10; // 30% básico (3.0-3.9)
  if (rand < 0.8) return Math.round((4.0 + Math.random() * 0.5) * 10) / 10; // 40% alto (4.0-4.5)
  return Math.round((4.5 + Math.random() * 0.5) * 10) / 10; // 20% superior (4.5-5.0)
}

async function main() {
  console.log('=== Generando 100+ estudiantes de prueba ===\n');

  // Obtener datos base
  const institution = await prisma.institution.findFirst();
  if (!institution) {
    console.log('❌ No hay institución. Ejecuta el seed primero.');
    return;
  }
  console.log('Institución:', institution.name);

  const academicYear = await prisma.academicYear.findFirst({
    orderBy: { year: 'desc' },
    include: { terms: true }
  });
  if (!academicYear) {
    console.log('❌ No hay año académico.');
    return;
  }
  console.log('Año académico:', academicYear.year);
  console.log('Períodos:', academicYear.terms.length);

  const groups = await prisma.group.findMany({
    include: { grade: true }
  });
  if (groups.length === 0) {
    console.log('❌ No hay grupos.');
    return;
  }
  console.log('Grupos disponibles:', groups.length);

  // Limpiar datos existentes
  console.log('\n=== Limpiando datos existentes ===');
  await prisma.studentGrade.deleteMany({});
  await prisma.attendanceRecord.deleteMany({});
  await prisma.periodFinalGrade.deleteMany({});
  await prisma.studentObservation.deleteMany({});
  await prisma.preventiveAlert.deleteMany({});
  await prisma.studentEnrollment.deleteMany({});
  await prisma.student.deleteMany({});
  console.log('✓ Datos limpiados');

  // Obtener asignaciones de docentes
  const assignments = await prisma.teacherAssignment.findMany({
    include: { subject: true, group: true }
  });
  console.log('Asignaciones de docentes:', assignments.length);

  // Obtener o crear componente de evaluación
  let component = await prisma.evaluationComponent.findFirst({
    where: { institutionId: institution.id }
  });
  if (!component) {
    component = await prisma.evaluationComponent.create({
      data: {
        institutionId: institution.id,
        name: 'Cognitivo',
        code: 'COG',
      }
    });
  }

  // Crear estudiantes - aproximadamente 8-10 por grupo
  console.log('\n=== Creando estudiantes ===');
  const studentsPerGroup = 9; // ~108 estudiantes en 12 grupos
  let totalStudents = 0;
  let totalEnrollments = 0;
  let totalGrades = 0;
  let totalAttendance = 0;

  for (const group of groups) {
    const gradeNumber = getGradeNumber(group.grade.name);
    
    for (let i = 0; i < studentsPerGroup; i++) {
      const firstName = randomElement(firstNames);
      const lastName1 = randomElement(lastNames);
      const lastName2 = randomElement(lastNames);
      const gender = ['M', 'F'][Math.floor(Math.random() * 2)];
      
      // Crear estudiante
      const student = await prisma.student.create({
        data: {
          institutionId: institution.id,
          firstName,
          lastName: `${lastName1} ${lastName2}`,
          documentType: 'TI',
          documentNumber: generateDocumentNumber(),
          birthDate: generateBirthDate(gradeNumber),
          gender,
          email: `${firstName.toLowerCase()}.${lastName1.toLowerCase()}${totalStudents}@estudiante.edu.co`,
          phone: `300${Math.floor(1000000 + Math.random() * 9000000)}`,
        }
      });
      totalStudents++;

      // Matricular estudiante
      const enrollment = await prisma.studentEnrollment.create({
        data: {
          studentId: student.id,
          academicYearId: academicYear.id,
          groupId: group.id,
          status: 'ACTIVE',
        }
      });
      totalEnrollments++;

      // Buscar asignaciones para este grupo
      const groupAssignments = assignments.filter(a => a.groupId === group.id);

      // Para cada período y asignación, crear calificaciones
      for (const term of academicYear.terms) {
        for (const assignment of groupAssignments) {
          // Buscar o crear plan de evaluación
          let evalPlan = await prisma.evaluationPlan.findFirst({
            where: {
              teacherAssignmentId: assignment.id,
              academicTermId: term.id,
            }
          });

          if (!evalPlan) {
            evalPlan = await prisma.evaluationPlan.create({
              data: {
                teacherAssignmentId: assignment.id,
                academicTermId: term.id,
              }
            });
          }

          // Buscar o crear actividad evaluativa
          let activity = await prisma.evaluativeActivity.findFirst({
            where: {
              teacherAssignmentId: assignment.id,
              academicTermId: term.id,
            }
          });

          if (!activity) {
            activity = await prisma.evaluativeActivity.create({
              data: {
                teacherAssignmentId: assignment.id,
                academicTermId: term.id,
                evaluationPlanId: evalPlan.id,
                componentId: component.id,
                name: `Evaluación ${term.name}`,
                dueDate: new Date(),
              }
            });
          }

          // Crear calificación
          const score = generateRandomScore();
          await prisma.studentGrade.create({
            data: {
              studentEnrollmentId: enrollment.id,
              evaluativeActivityId: activity.id,
              score,
            }
          });
          totalGrades++;

          // Crear nota final de período
          await prisma.periodFinalGrade.upsert({
            where: {
              studentEnrollmentId_academicTermId_subjectId: {
                studentEnrollmentId: enrollment.id,
                academicTermId: term.id,
                subjectId: assignment.subjectId,
              }
            },
            update: { finalScore: score },
            create: {
              studentEnrollmentId: enrollment.id,
              academicTermId: term.id,
              subjectId: assignment.subjectId,
              finalScore: score,
              enteredById: assignment.teacherId,
            }
          });

          // Crear registros de asistencia (últimos 5 días)
          for (let d = 0; d < 5; d++) {
            const date = new Date();
            date.setDate(date.getDate() - d);
            
            // 85% presente, 10% ausente, 5% tardanza
            const rand = Math.random();
            const status = rand < 0.85 ? 'PRESENT' : rand < 0.95 ? 'ABSENT' : 'LATE';
            
            try {
              await prisma.attendanceRecord.create({
                data: {
                  teacherAssignmentId: assignment.id,
                  studentEnrollmentId: enrollment.id,
                  date,
                  status,
                }
              });
              totalAttendance++;
            } catch (e) {
              // Ignorar duplicados
            }
          }
        }
      }
    }
    
    console.log(`  ✓ ${group.grade.name} - ${group.name}: ${studentsPerGroup} estudiantes`);
  }

  console.log('\n=== ✅ Generación completada ===');
  console.log(`Total estudiantes: ${totalStudents}`);
  console.log(`Total matrículas: ${totalEnrollments}`);
  console.log(`Total calificaciones: ${totalGrades}`);
  console.log(`Total registros asistencia: ${totalAttendance}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
