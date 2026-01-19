import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const studentCount = await prisma.student.count();
  console.log('Total estudiantes:', studentCount);
  
  const enrollmentCount = await prisma.studentEnrollment.count();
  console.log('Total matrículas:', enrollmentCount);
  
  const gradeCount = await prisma.studentGrade.count();
  console.log('Total calificaciones:', gradeCount);
  
  // Ver algunos estudiantes
  const students = await prisma.student.findMany({
    take: 5,
    include: { enrollments: { include: { group: { include: { grade: true } } } } }
  });
  
  console.log('\nPrimeros 5 estudiantes:');
  students.forEach(s => {
    const group = s.enrollments[0]?.group;
    console.log(`  - ${s.firstName} ${s.lastName} -> ${group?.grade?.name || 'Sin grupo'} ${group?.name || ''}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
