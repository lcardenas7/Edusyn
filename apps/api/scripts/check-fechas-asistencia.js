// READ-ONLY. El frontend calcula "hoy" con new Date().toISOString().split('T')[0],
// que es UTC. En Colombia (UTC-5) a partir de las 19:00 locales eso devuelve el dia
// SIGUIENTE. Si es asi, habria asistencia guardada con fecha corrida: buscamos
// registros en fin de semana y registros cuya fecha va por delante del createdAt.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DIA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
// createdAt esta en UTC; la fecha de pared en Colombia es UTC-5.
const bogota = (d) => new Date(d.getTime() - 5 * 3600 * 1000);

async function main() {
  const inst = await prisma.institution.findFirst({
    where: { name: { contains: 'Ciudadela' } },
    select: { id: true, name: true },
  });
  console.log(`Acotado a: ${inst.name}`);
  for (const [label, model] of [['AttendanceRecord', 'attendanceRecord'], ['TutoringAttendance', 'tutoringAttendance']]) {
    const recs = await prisma[model].findMany({
      where: { institutionId: inst.id },
      select: { date: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20000,
    });
    console.log(`\n===== ${label}: ${recs.length} registros analizados =====`);

    // 1) Registros en fin de semana (sospechoso en un colegio)
    const finde = recs.filter(r => [0, 6].includes(r.date.getUTCDay()));
    console.log(`  en FIN DE SEMANA: ${finde.length}`);
    const findePorDia = {};
    finde.forEach(r => {
      const k = `${r.date.toISOString().slice(0, 10)} (${DIA[r.date.getUTCDay()]})`;
      findePorDia[k] = (findePorDia[k] || 0) + 1;
    });
    Object.entries(findePorDia).sort().slice(0, 12).forEach(([k, n]) => console.log(`     ${k}: ${n}`));

    // 2) date por DELANTE de la fecha de pared en Colombia al momento de crearlo
    let adelantados = 0;
    let tardeYCorrido = 0;
    const ejemplos = [];
    for (const r of recs) {
      const wall = bogota(r.createdAt);
      const wallDay = wall.toISOString().slice(0, 10);
      const recDay = r.date.toISOString().slice(0, 10);
      if (recDay > wallDay) {
        adelantados++;
        // ¿se creo despues de las 19:00 hora Colombia?
        if (wall.getUTCHours() >= 19) tardeYCorrido++;
        if (ejemplos.length < 6) {
          ejemplos.push(`fecha=${recDay} creado=${wallDay} ${String(wall.getUTCHours()).padStart(2, '0')}:${String(wall.getUTCMinutes()).padStart(2, '0')} (hora Colombia)`);
        }
      }
    }
    console.log(`  con fecha POR DELANTE del dia en que se guardo: ${adelantados}`);
    console.log(`     de esos, guardados despues de las 19:00 Colombia: ${tardeYCorrido}`);
    ejemplos.forEach(e => console.log(`     ej: ${e}`));

    // 3) Distribucion horaria de creacion (hora Colombia)
    const horas = {};
    recs.forEach(r => {
      const h = bogota(r.createdAt).getUTCHours();
      horas[h] = (horas[h] || 0) + 1;
    });
    const noche = Object.entries(horas).filter(([h]) => Number(h) >= 19).reduce((a, [, n]) => a + n, 0);
    console.log(`  guardados a partir de las 19:00 hora Colombia: ${noche} (${Math.round(noche / recs.length * 100)}%)`);
  }
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
