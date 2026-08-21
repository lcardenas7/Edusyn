// Diagnóstico READ-ONLY de asistencia. Solo agregados: nada de nombres de estudiantes.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const years = await prisma.academicYear.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, year: true, institutionId: true, institution: { select: { name: true } } },
  });
  console.log('=== AÑOS ACTIVOS ===');
  years.forEach(y => console.log(`  ${y.institution.name} | ${y.year} | yearId=${y.id}`));

  for (const y of years) {
    console.log(`\n########## ${y.institution.name} (${y.year}) ##########`);

    // ---- ASISTENCIA POR ASIGNATURA ----
    const recs = await prisma.attendanceRecord.findMany({
      where: { institutionId: y.institutionId },
      select: {
        date: true,
        status: true,
        teacherAssignment: {
          select: {
            academicYearId: true,
            subject: { select: { name: true } },
            group: { select: { name: true, grade: { select: { name: true } } } },
          },
        },
        studentEnrollment: { select: { academicYearId: true, status: true } },
      },
    });
    console.log(`\n-- AttendanceRecord (asignaturas): ${recs.length} registros en total`);

    const bySubject = new Map();
    for (const r of recs) {
      const k = r.teacherAssignment?.subject?.name || '(sin asignatura)';
      const e = bySubject.get(k) || { n: 0, dates: new Set() };
      e.n++; e.dates.add(r.date.toISOString().slice(0, 10));
      bySubject.set(k, e);
    }
    console.log('   por asignatura (registros / dias distintos):');
    [...bySubject.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) =>
      console.log(`     ${k}: ${v.n} registros en ${v.dates.size} dias`));

    // ¿el año del assignment coincide con el año del enrollment?
    const mismatch = recs.filter(r =>
      r.teacherAssignment?.academicYearId !== r.studentEnrollment?.academicYearId);
    console.log(`   desajuste año(assignment) vs año(enrollment): ${mismatch.length}`);
    const otherYear = recs.filter(r => r.studentEnrollment?.academicYearId !== y.id);
    console.log(`   registros cuyo enrollment NO es del año activo: ${otherYear.length}`);
    const notActive = recs.filter(r => r.studentEnrollment?.status !== 'ACTIVE');
    console.log(`   registros con enrollment NO ACTIVE (el reporte los descarta): ${notActive.length}`);

    const allDates = [...new Set(recs.map(r => r.date.toISOString().slice(0, 10)))].sort();
    console.log(`   rango de fechas: ${allDates[0] || '-'} .. ${allDates[allDates.length - 1] || '-'} (${allDates.length} dias)`);

    // ---- TUTORÍA ----
    const feat = await prisma.institutionModule.findFirst({
      where: { institutionId: y.institutionId, module: 'ATTENDANCE' },
      select: { isActive: true, features: true },
    });
    console.log(`\n-- Feature ATTENDANCE: isActive=${feat?.isActive} features=${JSON.stringify(feat?.features)}`);

    const tut = await prisma.tutoringAttendance.findMany({
      where: { institutionId: y.institutionId },
      select: {
        date: true, status: true, groupId: true,
        group: { select: { name: true, grade: { select: { name: true } } } },
        studentEnrollment: { select: { academicYearId: true, status: true, groupId: true } },
      },
    });
    console.log(`-- TutoringAttendance: ${tut.length} registros en total`);
    const byDate = new Map();
    for (const t of tut) {
      const k = t.date.toISOString().slice(0, 10);
      const e = byDate.get(k) || { n: 0, st: {} };
      e.n++; e.st[t.status] = (e.st[t.status] || 0) + 1;
      byDate.set(k, e);
    }
    console.log('   por fecha (ultimas 15):');
    [...byDate.entries()].sort().slice(-15).forEach(([k, v]) =>
      console.log(`     ${k}: ${v.n} registros ${JSON.stringify(v.st)}`));

    const tutBadYear = tut.filter(t => t.studentEnrollment?.academicYearId !== y.id);
    console.log(`   tutoria con enrollment de OTRO año: ${tutBadYear.length}`);
    const tutNotActive = tut.filter(t => t.studentEnrollment?.status !== 'ACTIVE');
    console.log(`   tutoria con enrollment NO ACTIVE: ${tutNotActive.length}`);
    const tutGroupMismatch = tut.filter(t => t.studentEnrollment?.groupId !== t.groupId);
    console.log(`   tutoria donde groupId del registro != grupo del enrollment: ${tutGroupMismatch.length}`);

    // grupos con director asignado
    const groups = await prisma.group.count({ where: { campus: { institutionId: y.institutionId } } });
    const withDirector = await prisma.group.count({ where: { campus: { institutionId: y.institutionId }, directorId: { not: null } } });
    console.log(`   grupos: ${groups} | con director de grupo: ${withDirector}`);
  }
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
