// READ-ONLY. /tutoring-attendance/status exige @Roles(SUPERADMIN, ADMIN_INSTITUTIONAL,
// COORDINADOR, RECTOR, DOCENTE) leidos de InstitutionUserRole. Un superadmin de
// plataforma (User.isSuperAdmin) que NO tenga uno de esos roles nombrados recibe 403,
// y entonces el frontend cree que la tutoria esta apagada y esconde el reporte.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PERMITIDOS = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE'];

async function main() {
  const supers = await prisma.user.findMany({
    where: { isSuperAdmin: true },
    select: { id: true, username: true },
  });
  console.log(`Usuarios con User.isSuperAdmin=true: ${supers.length}`);

  for (const u of supers) {
    const links = await prisma.institutionUser.findMany({
      where: { userId: u.id, isActive: true },
      select: {
        institution: { select: { name: true } },
        institutionUserRoles: { select: { role: { select: { name: true } } } },
      },
    });
    const roles = links.flatMap(l => l.institutionUserRoles.map(r => r.role.name));
    const ok = roles.some(r => PERMITIDOS.includes(r));
    console.log(`  ${u.username}: roles=[${roles.join(', ') || 'NINGUNO'}] -> /status ${ok ? 'OK' : '403 => TUTORIA SE OCULTA'}`);
    links.forEach(l => console.log(`      institucion: ${l.institution.name}`));
  }

  // Todos los usuarios cuyos roles no incluyen ninguno permitido pero que
  // igualmente entran a reportes (admins mal nombrados)
  console.log('\nRoles existentes en la plataforma y cuantos usuarios los tienen:');
  const roles = await prisma.role.findMany({ select: { id: true, name: true } });
  for (const r of roles) {
    const n = await prisma.institutionUserRole.count({ where: { roleId: r.id } });
    const permitido = PERMITIDOS.includes(r.name) ? 'permite /status' : 'NO permite /status';
    console.log(`   ${r.name}: ${n} usuarios (${permitido})`);
  }
}

main()
  .catch(e => { console.error('ERROR:', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
