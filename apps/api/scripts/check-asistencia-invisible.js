// READ-ONLY. Por qué hay asistencia guardada que el reporte no muestra.
// Los reportes filtran enrollments por status ACTIVE: todo registro cuyo
// estudiante ya no esté ACTIVE desaparece del reporte aunque exista en la BD.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const years = await prisma.academicYear.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, year: true, institutionId: true, institution: { select: { name: true } } },
  });

  for (const y of years) {
    const recs = await prisma.attendanceRecord.count({ where: { institutionId: y.institutionId } });
    if (recs === 0) continue;
    console.log(`\n########## ${y.institution.name} (${y.year}) ##########`);

    // Estados de matrícula presentes
    const enr = await prisma.studentEnrollment.groupBy({
      by: ['status'],
      where: { academicYearId: y.id },
      _count: { _all: true },
    });
    console.log('-- Matriculas por estado:');
    enr.forEach(e => console.log(`     ${e.status}: ${e._count._all}`));

    // Registros de asistencia cuyo enrollment NO es ACTIVE → invisibles en reporte
    const invis = await prisma.attendanceRecord.findMany({
      where: {
        institutionId: y.institutionId,
        studentEnrollment: { status: { not: 'ACTIVE' } },
      },
      select: {
        date: true,
        studentEnrollment: { select: { status: true, groupId: true } },
        teacherAssignment: { select: { subject: { select: { name: true } } } },
      },
    });
    console.log(`-- AttendanceRecord invisibles por matricula no-ACTIVE: ${invis.length}`);
    const byStatus = {};
    const bySubj = {};
    for (const r of invis) {
      const st = r.studentEnrollment.status;
      byStatus[st] = (byStatus[st] || 0) + 1;
      const s = r.teacherAssignment?.subject?.name || '(sin asignatura)';
      bySubj[s] = (bySubj[s] || 0) + 1;
    }
    console.log(`     por estado de matricula: ${JSON.stringify(byStatus)}`);
    console.log(`     por asignatura: ${JSON.stringify(bySubj)}`);

    const tutInvis = await prisma.tutoringAttendance.count({
      where: { institutionId: y.institutionId, studentEnrollment: { status: { not: 'ACTIVE' } } },
    });
    console.log(`-- TutoringAttendance invisibles por matricula no-ACTIVE: ${tutInvis}`);

    // ¿Cuantos estudiantes distintos quedan ocultos?
    const hidden = new Set(invis.map(r => r.studentEnrollment.groupId));
    console.log(`     grupos afectados: ${hidden.size}`);
  }
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
