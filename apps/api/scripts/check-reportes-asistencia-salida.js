// READ-ONLY. Replica las consultas EXACTAS de los reportes de asistencia para
// ver cuantas filas devuelven realmente, y distinguir "bug de codigo" de
// "problema de datos/filtros del usuario".
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const y = await prisma.academicYear.findFirst({
    where: { status: 'ACTIVE', institution: { name: { contains: 'Ciudadela' } } },
    select: { id: true, year: true, institutionId: true, institution: { select: { name: true } } },
  });
  if (!y) return console.log('no encontrada');
  console.log(`### ${y.institution.name} (${y.year})\n`);

  // ---- CONSOLIDADO (bySubject) ----
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { academicYearId: y.id, status: 'ACTIVE' },
    select: { id: true },
  });
  const enrollmentIds = enrollments.map(e => e.id);
  const recs = await prisma.attendanceRecord.findMany({
    where: { studentEnrollmentId: { in: enrollmentIds } },
    select: { teacherAssignment: { select: { subjectId: true } } },
  });
  const subjIds = [...new Set(recs.map(r => r.teacherAssignment.subjectId))];
  const subs = await prisma.subject.findMany({ where: { id: { in: subjIds } }, select: { id: true, name: true } });
  console.log(`CONSOLIDADO -> ${recs.length} registros, ${subjIds.length} asignaturas:`);
  subs.forEach(s => console.log(`   - ${s.name}`));

  // ---- DETALLADO (att-student), sin filtro de grupo ni fechas ----
  const det = await prisma.attendanceRecord.count({
    where: { studentEnrollment: { academicYearId: y.id } },
  });
  console.log(`\nDETALLADO (todo el año, sin filtros) -> ${det} registros (el endpoint corta en take:1000)`);

  // ---- DETALLADO por grupo: cuantos grupos devuelven algo ----
  const groups = await prisma.group.findMany({
    where: { campus: { institutionId: y.institutionId } },
    select: { id: true, name: true, grade: { select: { name: true } } },
  });
  let conDatos = 0, sinDatos = [];
  for (const g of groups) {
    const n = await prisma.attendanceRecord.count({
      where: { studentEnrollment: { academicYearId: y.id, groupId: g.id, status: 'ACTIVE' } },
    });
    if (n > 0) conDatos++; else sinDatos.push(`${g.grade?.name || ''} ${g.name}`.trim());
  }
  console.log(`\nGRUPOS: ${groups.length} totales | ${conDatos} con asistencia | ${sinDatos.length} sin ninguna`);
  if (sinDatos.length) console.log(`   sin datos: ${sinDatos.join(', ')}`);

  // ---- TUTORIA por grupo (report-by-group) ----
  console.log('\nTUTORIA por grupo (solo grupos con registros):');
  for (const g of groups) {
    const n = await prisma.tutoringAttendance.count({
      where: { groupId: g.id, studentEnrollment: { academicYearId: y.id, status: 'ACTIVE' } },
    });
    if (n > 0) console.log(`   ${g.grade?.name || ''} ${g.name}: ${n} registros`);
  }
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
