import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Obtener institución
  const institution = await prisma.institution.findFirst();
  console.log('Institución:', institution?.id);

  // Query como lo hace el servicio para Students (sin groupId)
  const students = await prisma.student.findMany({
    where: {
      institutionId: institution?.id,
    },
    include: {
      enrollments: {
        include: {
          group: {
            include: {
              grade: true,
            },
          },
          academicYear: true,
        },
        orderBy: {
          academicYear: {
            year: 'desc',
          },
        },
        take: 1,
      },
    },
    orderBy: {
      lastName: 'asc',
    },
  });

  console.log('\nEstudiantes encontrados:', students.length);
  console.log('Primeros 3:');
  students.slice(0, 3).forEach(s => {
    console.log(`  - ${s.firstName} ${s.lastName}`);
    console.log(`    Enrollments: ${s.enrollments.length}`);
    if (s.enrollments[0]) {
      console.log(`    Grupo: ${s.enrollments[0].group?.grade?.name} ${s.enrollments[0].group?.name}`);
    }
  });

  // Query como lo hace el servicio para Grades (con groupId)
  const group = await prisma.group.findFirst();
  console.log('\n\nGrupo de prueba:', group?.id);

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      groupId: group?.id,
    },
    include: {
      student: true,
      group: {
        include: {
          grade: true,
        },
      },
    },
    orderBy: {
      student: {
        lastName: 'asc',
      },
    },
  });

  console.log('Enrollments encontrados:', enrollments.length);
  console.log('Primeros 3:');
  enrollments.slice(0, 3).forEach(e => {
    console.log(`  - ${e.student.firstName} ${e.student.lastName} -> ${e.group?.grade?.name} ${e.group?.name}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
