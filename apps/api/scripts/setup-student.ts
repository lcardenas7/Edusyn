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

function generateBirthDate(gradeLevel: number): Date {
  // Edad aproximada según el grado (6° = 11-12 años, 11° = 16-17 años)
  const baseAge = gradeLevel + 5; // 6° -> 11 años, 11° -> 16 años
  const year = 2026 - baseAge - Math.floor(Math.random() * 2);
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 28) + 1;
  return new Date(year, month, day);
}

async function main() {
  console.log('=== Generando 100+ estudiantes de prueba ===\n');

  // Ver institución
  const institution = await prisma.institution.findFirst();
  console.log('Institución:', institution?.name, '(ID:', institution?.id, ')');

  // Ver estudiantes actuales
  const students = await prisma.student.findMany({
    include: { enrollments: true }
  });
  console.log('\nEstudiantes actuales:', students.length);
  students.forEach(s => console.log('  -', s.firstName, s.lastName, '(ID:', s.id, ')'));

  // Ver grupos disponibles
  const groups = await prisma.group.findMany({
    include: { grade: true }
  });
  console.log('\nGrupos disponibles:', groups.length);
  groups.forEach(g => console.log('  -', g.grade.name, '-', g.name, '(ID:', g.id, ')'));

  // Ver año académico (el más reciente)
  const academicYear = await prisma.academicYear.findFirst({
    orderBy: { year: 'desc' },
    include: { terms: true }
  });
  console.log('\nAño académico:', academicYear?.year, '(ID:', academicYear?.id, ')');
  console.log('Períodos:', academicYear?.terms?.map(t => t.name).join(', ') || 'ninguno');

  // Ver asignaciones de docentes
  const assignments = await prisma.teacherAssignment.findMany({
    include: { 
      subject: true, 
      group: { include: { grade: true } },
      teacher: true 
    }
  });
  console.log('\nAsignaciones de docentes:', assignments.length);
  assignments.forEach(a => console.log('  -', a.subject.name, 'en', a.group.grade.name + '-' + a.group.name, 'por', a.teacher.firstName, '(ID:', a.id, ')'));

  if (!institution || !academicYear || groups.length === 0) {
    console.log('\n❌ Faltan datos básicos. Asegúrate de tener institución, año académico y grupos.');
    return;
  }

  // Borrar estudiantes ficticios existentes
  if (students.length > 0) {
    console.log('\n=== Borrando estudiantes ficticios ===');
    
    // Primero borrar registros relacionados
    await prisma.studentGrade.deleteMany({});
    await prisma.attendanceRecord.deleteMany({});
    await prisma.periodFinalGrade.deleteMany({});
    await prisma.studentObservation.deleteMany({});
    await prisma.studentEnrollment.deleteMany({});
    await prisma.student.deleteMany({});
    
    console.log('✓ Estudiantes ficticios eliminados');
  }

  // Crear un estudiante real
  console.log('\n=== Creando estudiante de prueba ===');
  
  const firstGroup = groups[0];
  const firstTerm = academicYear.terms?.[0];
  
  // Crear estudiante (solo campos que existen en el schema)
  const student = await prisma.student.create({
    data: {
      institutionId: institution.id,
      firstName: 'Juan Carlos',
      lastName: 'Pérez García',
      documentType: 'TI',
      documentNumber: '1234567890',
      birthDate: new Date('2012-05-15'),
      gender: 'M',
      address: 'Calle 123 #45-67',
      phone: '3001234567',
      email: 'juancarlos.perez@estudiante.edu.co',
    }
  });
  console.log('✓ Estudiante creado:', student.firstName, student.lastName, '(ID:', student.id, ')');

  // Matricular estudiante
  const enrollment = await prisma.studentEnrollment.create({
    data: {
      studentId: student.id,
      academicYearId: academicYear.id,
      groupId: firstGroup.id,
      status: 'ACTIVE',
    }
  });
  console.log('✓ Matrícula creada en:', firstGroup.grade.name, '-', firstGroup.name, '(ID:', enrollment.id, ')');

  // Buscar asignaciones para este grupo
  let groupAssignments = assignments.filter(a => a.groupId === firstGroup.id);
  
  if (groupAssignments.length === 0) {
    console.log('\n⚠️ No hay asignaciones de docentes para este grupo. Creando una...');
    
    // Buscar una asignatura y un docente
    const subject = await prisma.subject.findFirst();
    const teacher = await prisma.user.findFirst({
      where: { roles: { some: { role: { name: 'DOCENTE' } } } }
    });
    
    if (subject && teacher) {
      const newAssignment = await prisma.teacherAssignment.create({
        data: {
          academicYearId: academicYear.id,
          groupId: firstGroup.id,
          subjectId: subject.id,
          teacherId: teacher.id,
          weeklyHours: 4,
        }
      });
      groupAssignments = [{
        ...newAssignment,
        subject,
        group: firstGroup,
        teacher,
      } as any];
      console.log('✓ Asignación creada:', subject.name, 'por', teacher.firstName);
    }
  }

  if (groupAssignments.length > 0 && firstTerm) {
    const assignment = groupAssignments[0];
    
    // Buscar o crear componente de evaluación
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
      console.log('✓ Componente de evaluación creado:', component.name);
    }

    // Buscar o crear plan de evaluación
    let evalPlan = await prisma.evaluationPlan.findFirst({
      where: {
        teacherAssignmentId: assignment.id,
        academicTermId: firstTerm.id,
      }
    });

    if (!evalPlan) {
      evalPlan = await prisma.evaluationPlan.create({
        data: {
          teacherAssignmentId: assignment.id,
          academicTermId: firstTerm.id,
        }
      });
      console.log('✓ Plan de evaluación creado');
    }

    // Crear actividad evaluativa
    const activity = await prisma.evaluativeActivity.create({
      data: {
        teacherAssignmentId: assignment.id,
        academicTermId: firstTerm.id,
        evaluationPlanId: evalPlan.id,
        componentId: component.id,
        name: 'Evaluación Diagnóstica',
        dueDate: new Date(),
      }
    });
    console.log('✓ Actividad evaluativa creada:', activity.name);

    // Registrar calificación
    const grade = await prisma.studentGrade.create({
      data: {
        studentEnrollmentId: enrollment.id,
        evaluativeActivityId: activity.id,
        score: 4.2,
      }
    });
    console.log('✓ Calificación registrada:', grade.score);

    // Registrar asistencia
    const attendance = await prisma.attendanceRecord.create({
      data: {
        teacherAssignmentId: assignment.id,
        studentEnrollmentId: enrollment.id,
        date: new Date(),
        status: 'PRESENT',
      }
    });
    console.log('✓ Asistencia registrada:', attendance.status);

    // Crear nota final de período
    const periodGrade = await prisma.periodFinalGrade.create({
      data: {
        studentEnrollmentId: enrollment.id,
        academicTermId: firstTerm.id,
        subjectId: assignment.subjectId,
        finalScore: 4.2,
        enteredById: assignment.teacherId,
      }
    });
    console.log('✓ Nota final de período registrada:', periodGrade.finalScore);
  } else {
    console.log('\n⚠️ No se pudo crear calificaciones/asistencia. Falta asignación o período académico.');
  }

  console.log('\n=== ✅ Configuración completada ===');
  console.log('Estudiante:', student.firstName, student.lastName);
  console.log('Grupo:', firstGroup.grade.name, '-', firstGroup.name);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
