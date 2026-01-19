import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Creando asignaciones de docentes para todos los grupos ===\n');

  // Obtener datos base
  const subjects = await prisma.subject.findMany();
  console.log('Asignaturas:', subjects.length);

  const teachers = await prisma.user.findMany({
    where: { roles: { some: { role: { name: 'DOCENTE' } } } }
  });
  console.log('Docentes:', teachers.length);

  const groups = await prisma.group.findMany({ include: { grade: true } });
  console.log('Grupos:', groups.length);

  const academicYear = await prisma.academicYear.findFirst({ orderBy: { year: 'desc' } });
  if (!academicYear) {
    console.log('❌ No hay año académico');
    return;
  }
  console.log('Año académico:', academicYear.year);

  if (subjects.length === 0 || teachers.length === 0) {
    console.log('❌ Faltan asignaturas o docentes');
    return;
  }

  // Crear asignaciones para cada grupo con cada asignatura
  console.log('\n=== Creando asignaciones ===');
  let created = 0;
  let skipped = 0;

  for (const group of groups) {
    for (const subject of subjects) {
      // Asignar un docente aleatorio
      const teacher = teachers[Math.floor(Math.random() * teachers.length)];

      // Verificar si ya existe
      const existing = await prisma.teacherAssignment.findFirst({
        where: {
          academicYearId: academicYear.id,
          groupId: group.id,
          subjectId: subject.id,
        }
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.teacherAssignment.create({
        data: {
          academicYearId: academicYear.id,
          groupId: group.id,
          subjectId: subject.id,
          teacherId: teacher.id,
          weeklyHours: 4,
        }
      });
      created++;
    }
    console.log(`  ✓ ${group.grade.name} - ${group.name}: ${subjects.length} asignaturas`);
  }

  console.log(`\n=== ✅ Completado ===`);
  console.log(`Asignaciones creadas: ${created}`);
  console.log(`Asignaciones existentes: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
