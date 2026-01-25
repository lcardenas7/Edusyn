import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllStudents() {
  const institutionId = 'cmkozdwzi0003j66rz6sr3rkp';
  
  console.log('Buscando estudiantes de la institución...');
  
  // Contar estudiantes
  const count = await prisma.student.count({
    where: { institutionId }
  });
  console.log(`Encontrados ${count} estudiantes`);
  
  if (count === 0) {
    console.log('No hay estudiantes para eliminar');
    return;
  }
  
  console.log('Eliminando registros relacionados con SQL...');
  
  // Usar SQL raw para eliminar en cascada
  await prisma.$executeRaw`
    DELETE FROM "StudentObservation" 
    WHERE "enrollmentId" IN (
      SELECT se.id FROM "StudentEnrollment" se 
      JOIN "Student" s ON se."studentId" = s.id 
      WHERE s."institutionId" = ${institutionId}
    )
  `;
  console.log('- StudentObservation eliminados');
  
  await prisma.$executeRaw`
    DELETE FROM "AttendanceRecord" 
    WHERE "enrollmentId" IN (
      SELECT se.id FROM "StudentEnrollment" se 
      JOIN "Student" s ON se."studentId" = s.id 
      WHERE s."institutionId" = ${institutionId}
    )
  `;
  console.log('- AttendanceRecord eliminados');
  
  await prisma.$executeRaw`
    DELETE FROM "Grade" 
    WHERE "enrollmentId" IN (
      SELECT se.id FROM "StudentEnrollment" se 
      JOIN "Student" s ON se."studentId" = s.id 
      WHERE s."institutionId" = ${institutionId}
    )
  `;
  console.log('- Grade eliminados');
  
  await prisma.$executeRaw`
    DELETE FROM "PartialGrade" 
    WHERE "enrollmentId" IN (
      SELECT se.id FROM "StudentEnrollment" se 
      JOIN "Student" s ON se."studentId" = s.id 
      WHERE s."institutionId" = ${institutionId}
    )
  `;
  console.log('- PartialGrade eliminados');
  
  await prisma.$executeRaw`
    DELETE FROM "PeriodFinalGrade" 
    WHERE "enrollmentId" IN (
      SELECT se.id FROM "StudentEnrollment" se 
      JOIN "Student" s ON se."studentId" = s.id 
      WHERE s."institutionId" = ${institutionId}
    )
  `;
  console.log('- PeriodFinalGrade eliminados');
  
  await prisma.$executeRaw`
    DELETE FROM "PreventiveAlert" 
    WHERE "enrollmentId" IN (
      SELECT se.id FROM "StudentEnrollment" se 
      JOIN "Student" s ON se."studentId" = s.id 
      WHERE s."institutionId" = ${institutionId}
    )
  `;
  console.log('- PreventiveAlert eliminados');
  
  await prisma.$executeRaw`
    DELETE FROM "StudentEnrollment" 
    WHERE "studentId" IN (
      SELECT id FROM "Student" WHERE "institutionId" = ${institutionId}
    )
  `;
  console.log('- StudentEnrollment eliminados');
  
  await prisma.$executeRaw`
    DELETE FROM "StudentGuardian" 
    WHERE "studentId" IN (
      SELECT id FROM "Student" WHERE "institutionId" = ${institutionId}
    )
  `;
  console.log('- StudentGuardian eliminados');
  
  await prisma.$executeRaw`
    DELETE FROM "StudentDocument" 
    WHERE "studentId" IN (
      SELECT id FROM "Student" WHERE "institutionId" = ${institutionId}
    )
  `;
  console.log('- StudentDocument eliminados');
  
  await prisma.$executeRaw`
    DELETE FROM "Candidate" 
    WHERE "studentId" IN (
      SELECT id FROM "Student" WHERE "institutionId" = ${institutionId}
    )
  `;
  console.log('- Candidate eliminados');
  
  await prisma.$executeRaw`
    DELETE FROM "StudentPayment" 
    WHERE "studentId" IN (
      SELECT id FROM "Student" WHERE "institutionId" = ${institutionId}
    )
  `;
  console.log('- StudentPayment eliminados');
  
  // Finalmente eliminar estudiantes
  const deleted = await prisma.student.deleteMany({
    where: { institutionId }
  });
  console.log(`\n✅ Eliminados ${deleted.count} estudiantes`);
}

deleteAllStudents()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
