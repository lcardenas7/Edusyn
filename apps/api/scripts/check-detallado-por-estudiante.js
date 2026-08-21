// READ-ONLY. Replica getDetailedReport (reporte "Asistencia por estudiante")
// bajo distintas combinaciones de filtros, para ver cual deja solo 2 filas.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const y = await prisma.academicYear.findFirst({
    where: { status: 'ACTIVE', institution: { name: { contains: 'Ciudadela' } } },
    select: { id: true, year: true, institutionId: true, institution: { select: { name: true } } },
  });
  console.log(`### ${y.institution.name} (${y.year})\n`);

  const base = { studentEnrollment: { academicYearId: y.id } };

  const total = await prisma.attendanceRecord.count({ where: base });
  console.log(`SIN filtros -> ${total} registros (el endpoint devuelve como mucho 1000)`);

  // Por estado
  console.log('\nPor ESTADO (filtro "Estado" del reporte):');
  for (const st of ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']) {
    const n = await prisma.attendanceRecord.count({ where: { ...base, status: st } });
    console.log(`   ${st}: ${n}`);
  }

  // Por grupo
  console.log('\nPor GRUPO (top 30):');
  const groups = await prisma.group.findMany({
    where: { campus: { institutionId: y.institutionId } },
    select: { id: true, name: true, grade: { select: { name: true } } },
  });
  const rows = [];
  for (const g of groups) {
    const n = await prisma.attendanceRecord.count({
      where: { studentEnrollment: { academicYearId: y.id, groupId: g.id } },
    });
    rows.push({ g: `${g.grade?.name || ''} ${g.name}`.trim(), n });
  }
  rows.sort((a, b) => b.n - a.n).forEach(r => console.log(`   ${r.g}: ${r.n}`));

  // Distribucion por estudiante: ¿hay matriculas con muy pocos registros?
  const perEnr = await prisma.attendanceRecord.groupBy({
    by: ['studentEnrollmentId'],
    where: base,
    _count: { _all: true },
  });
  const counts = perEnr.map(p => p._count._all).sort((a, b) => a - b);
  const conPocos = counts.filter(c => c <= 3).length;
  console.log(`\nMatriculas con registros: ${counts.length}`);
  console.log(`   minimo=${counts[0]} mediana=${counts[Math.floor(counts.length / 2)]} maximo=${counts[counts.length - 1]}`);
  console.log(`   matriculas con 3 registros o menos: ${conPocos}`);

  // Combinacion sospechosa: un estado poco frecuente + un grupo
  console.log('\nCombinacion ESTADO+GRUPO que deja 1-3 filas (primeras 15):');
  let shown = 0;
  for (const g of groups) {
    for (const st of ['LATE', 'EXCUSED']) {
      const n = await prisma.attendanceRecord.count({
        where: { studentEnrollment: { academicYearId: y.id, groupId: g.id }, status: st },
      });
      if (n >= 1 && n <= 3 && shown < 15) {
        console.log(`   ${g.grade?.name || ''} ${g.name} + ${st} -> ${n} filas`);
        shown++;
      }
    }
  }

  // ¿Que asignaturas aparecen en los registros mas recientes? (orden del endpoint)
  const recent = await prisma.attendanceRecord.findMany({
    where: base,
    orderBy: [{ date: 'desc' }],
    take: 5,
    select: { date: true, status: true, teacherAssignment: { select: { subject: { select: { name: true } } } } },
  });
  console.log('\nUltimos 5 registros (orden del reporte, date desc):');
  recent.forEach(r => console.log(`   ${r.date.toISOString().slice(0, 10)} ${r.teacherAssignment?.subject?.name} ${r.status}`));
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
