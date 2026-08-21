// READ-ONLY. Dos hipotesis concretas:
//  H1: el usuario eligio un estudiante que solo tiene 2 registros (Convivencia + Informatica).
//  H2: /tutoring-attendance/status resuelve la institucion EQUIVOCADA para un
//      superadmin (no recibe institutionId), y por eso la feature sale apagada.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // ---------- H1 ----------
  const y = await prisma.academicYear.findFirst({
    where: { status: 'ACTIVE', institution: { name: { contains: 'Ciudadela' } } },
    select: { id: true, institutionId: true },
  });

  const perEnr = await prisma.attendanceRecord.groupBy({
    by: ['studentEnrollmentId'],
    where: { studentEnrollment: { academicYearId: y.id } },
    _count: { _all: true },
  });
  const dos = perEnr.filter(p => p._count._all === 2).map(p => p.studentEnrollmentId);
  console.log(`H1 · matriculas con EXACTAMENTE 2 registros de asistencia: ${dos.length}`);

  if (dos.length) {
    const recs = await prisma.attendanceRecord.findMany({
      where: { studentEnrollmentId: { in: dos } },
      select: {
        studentEnrollmentId: true,
        teacherAssignment: { select: { subject: { select: { name: true } } } },
      },
    });
    const combos = {};
    const porMatricula = {};
    for (const r of recs) {
      const s = r.teacherAssignment?.subject?.name || '?';
      (porMatricula[r.studentEnrollmentId] ||= []).push(s);
    }
    for (const [, subs] of Object.entries(porMatricula)) {
      const k = subs.sort().join(' + ');
      combos[k] = (combos[k] || 0) + 1;
    }
    console.log('   combinaciones de asignaturas en esas matriculas:');
    Object.entries(combos).sort((a, b) => b[1] - a[1]).forEach(([k, n]) =>
      console.log(`     "${k}": ${n} estudiantes`));
  }

  // ---------- H2 ----------
  console.log('\nH2 · feature TUTORING_ATTENDANCE por institucion:');
  const insts = await prisma.institution.findMany({ select: { id: true, name: true } });
  for (const i of insts) {
    const m = await prisma.institutionModule.findFirst({
      where: { institutionId: i.id, module: 'ATTENDANCE' },
      select: { isActive: true, features: true },
    });
    const on = m?.features?.includes('TUTORING_ATTENDANCE');
    console.log(`   ${on ? 'ON ' : 'off'} | ${i.name}`);
  }

  console.log('\nH2 · usuarios con varias instituciones (a quienes /status puede resolverles la equivocada):');
  const multi = await prisma.institutionUser.groupBy({
    by: ['userId'],
    where: { isActive: true },
    _count: { _all: true },
  });
  const multiIds = multi.filter(m => m._count._all > 1).map(m => m.userId);
  console.log(`   usuarios con mas de una institucion activa: ${multiIds.length}`);
  for (const uid of multiIds.slice(0, 10)) {
    const u = await prisma.user.findUnique({
      where: { id: uid },
      select: { username: true, isSuperAdmin: true, institutionId: true },
    });
    const links = await prisma.institutionUser.findMany({
      where: { userId: uid, isActive: true },
      orderBy: { joinedAt: 'asc' },
      select: { institution: { select: { name: true } } },
    });
    const primera = links[0]?.institution?.name;
    const jwt = u.institutionId
      ? (await prisma.institution.findUnique({ where: { id: u.institutionId }, select: { name: true } }))?.name
      : '(sin institutionId en User)';
    console.log(`   ${u.username} superadmin=${u.isSuperAdmin} | User.institutionId=${jwt} | 1ra por joinedAt=${primera} | total=${links.length}`);
  }
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
