// READ-ONLY. Replica la consulta EXACTA del nuevo reporte "Tutoria por estudiante"
// filtrando por LATE, para comprobar que devuelve las tardanzas de hoy.
// Tambien comprueba el efecto del nuevo filtro includeWithdrawn.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TZ = 'America/Bogota';
const hoyBogota = () => new Date().toLocaleString('sv-SE', { timeZone: TZ }).slice(0, 10);

async function detailed({ institutionId, academicYearId, groupIds, status, includeWithdrawn, startDate, endDate }) {
  const enrollmentWhere = {
    academicYearId,
    ...(includeWithdrawn ? {} : { status: 'ACTIVE' }),
    ...(groupIds ? { groupId: { in: groupIds } } : {}),
  };
  const where = { institutionId, studentEnrollment: enrollmentWhere };
  if (status && ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(status)) where.status = status;
  if (startDate || endDate) {
    where.date = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };
  }
  return prisma.tutoringAttendance.findMany({
    where,
    include: {
      studentEnrollment: { include: { student: true, group: { include: { grade: true } } } },
      teacher: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ date: 'desc' }],
    take: 1000,
  });
}

async function main() {
  const y = await prisma.academicYear.findFirst({
    where: { status: 'ACTIVE', institution: { name: { contains: 'Ciudadela' } } },
    select: { id: true, institutionId: true, institution: { select: { name: true } } },
  });
  const hoy = hoyBogota();
  console.log(`${y.institution.name} · hoy (Colombia) = ${hoy}\n`);

  const casos = [
    ['TARDANZAS de hoy', { status: 'LATE', startDate: hoy, endDate: hoy }],
    ['TARDANZAS de todo el año', { status: 'LATE' }],
    ['TODOS los registros de hoy', { startDate: hoy, endDate: hoy }],
  ];

  for (const [label, extra] of casos) {
    const rows = await detailed({ institutionId: y.institutionId, academicYearId: y.id, ...extra });
    console.log(`${label}: ${rows.length} filas`);
    rows.slice(0, 5).forEach(r => {
      const g = `${r.studentEnrollment.group.grade?.name || ''} ${r.studentEnrollment.group.name}`.trim();
      const ini = `${r.studentEnrollment.student.lastName?.[0] || ''}${r.studentEnrollment.student.firstName?.[0] || ''}`;
      console.log(`     ${r.date.toISOString().slice(0, 10)} · ${g} · estudiante ${ini}** · ${r.status}`);
    });
  }

  // Efecto del filtro de retirados
  const cntTut = (incW) => prisma.tutoringAttendance.count({
    where: {
      institutionId: y.institutionId,
      studentEnrollment: { academicYearId: y.id, ...(incW ? {} : { status: 'ACTIVE' }) },
    },
  });
  const tSin = await cntTut(false), tCon = await cntTut(true);
  console.log('');
  console.log(`Filtro retirados TUTORIA -> sin: ${tSin} | con: ${tCon} (diferencia ${tCon - tSin})`);

  const aSin = await prisma.attendanceRecord.count({
    where: { institutionId: y.institutionId, studentEnrollment: { academicYearId: y.id, status: 'ACTIVE' } } });
  const aCon = await prisma.attendanceRecord.count({
    where: { institutionId: y.institutionId, studentEnrollment: { academicYearId: y.id } } });
  console.log(`Filtro retirados ASIGNATURAS -> sin: ${aSin} | con: ${aCon} (diferencia ${aCon - aSin})`);
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
