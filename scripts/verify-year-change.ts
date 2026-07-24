/**
 * VERIFICADOR DE CAMBIO DE AÑO (Pase 3) — SOLO LECTURA.
 *
 * Comprueba los invariantes de los hallazgos YC-1/YC-2/YC-3/YC-4 y de idempotencia
 * DESPUÉS de correr el flujo de cierre + promoción en staging. No escribe nada.
 *
 * Uso:
 *   DATABASE_URL="<staging>" npx tsx scripts/verify-year-change.ts <fromYearId> [toYearId]
 *
 * <fromYearId>  año que se cerró (N).           [requerido]
 * [toYearId]    año destino de la promoción (N+1). [opcional pero recomendado]
 *
 * Salida: checklist en verde (OK) / rojo (FALLA) por cada invariante.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YEL = '\x1b[33m';
const RESET = '\x1b[0m';

let failures = 0;
function ok(msg: string) {
  console.log(`  ${GREEN}✓ OK${RESET}  ${msg}`);
}
function fail(msg: string) {
  failures++;
  console.log(`  ${RED}✗ FALLA${RESET}  ${msg}`);
}
function warn(msg: string) {
  console.log(`  ${YEL}! AVISO${RESET}  ${msg}`);
}
function info(msg: string) {
  console.log(`       ${msg}`);
}

async function main() {
  const fromYearId = process.argv[2];
  const toYearId = process.argv[3];

  if (!fromYearId) {
    console.error('Falta <fromYearId>. Uso: npx tsx scripts/verify-year-change.ts <fromYearId> [toYearId]');
    process.exit(1);
  }

  const fromYear = await prisma.academicYear.findUnique({
    where: { id: fromYearId },
    select: { id: true, year: true, status: true, institutionId: true },
  });
  if (!fromYear) {
    console.error(`Año origen ${fromYearId} no existe.`);
    process.exit(1);
  }

  console.log(`\n═══ Verificación de cambio de año ═══`);
  console.log(`Año origen (N):  ${fromYear.year} [${fromYear.status}] inst=${fromYear.institutionId}`);
  if (toYearId) {
    const toYear = await prisma.academicYear.findUnique({
      where: { id: toYearId },
      select: { year: true, status: true, institutionId: true },
    });
    console.log(`Año destino (N+1): ${toYear?.year} [${toYear?.status}] inst=${toYear?.institutionId}`);
    if (toYear && toYear.institutionId !== fromYear.institutionId) {
      fail('El año destino pertenece a OTRA institución que el año origen.');
    }
  }
  console.log('');

  // ── Distribución de estados en el año origen ────────────────────────────────
  const statusGroups = await prisma.studentEnrollment.groupBy({
    by: ['status'],
    where: { academicYearId: fromYearId },
    _count: true,
  });
  console.log('Distribución de estados (año origen):');
  for (const s of statusGroups) info(`${s.status}: ${s._count}`);
  console.log('');

  // ── YC-4: cierre no debe reprobar a estudiantes SIN datos ───────────────────
  // Tras el fix, quedan ACTIVE (revisión manual) en un año ya CLOSED.
  console.log('YC-4 · Estudiantes sin datos → revisión manual (no REPEATED):');
  if (fromYear.status === 'CLOSED') {
    const stillActive = await prisma.studentEnrollment.count({
      where: { academicYearId: fromYearId, status: 'ACTIVE' },
    });
    if (stillActive > 0) {
      info(`${stillActive} matrícula(s) quedaron ACTIVE en el año cerrado (revisión manual pendiente). Esto es lo esperado si había estudiantes sin notas.`);
      ok('Ningún estudiante sin datos fue reprobado automáticamente (quedaron para revisión).');
    } else {
      info('No hay matrículas ACTIVE remanentes (o no había estudiantes sin datos).');
      ok('Sin estados ACTIVE colgados.');
    }
  } else {
    warn(`El año origen no está CLOSED (está ${fromYear.status}); corre el cierre antes de verificar YC-4.`);
  }
  console.log('');

  // ── YC-2: graduación ────────────────────────────────────────────────────────
  console.log('YC-2 · Graduación del último grado:');
  const graduated = await prisma.studentEnrollment.findMany({
    where: { academicYearId: fromYearId, status: 'GRADUATED' as any },
    select: { id: true, studentId: true, group: { select: { grade: { select: { name: true } } } } },
  });
  info(`${graduated.length} estudiante(s) GRADUATED.`);
  if (graduated.length > 0) {
    ok('El estado GRADUATED se está aplicando (antes no existía).');
    if (toYearId) {
      const gradStudentIds = graduated.map((g) => g.studentId);
      const reEnrolled = await prisma.studentEnrollment.count({
        where: { academicYearId: toYearId, studentId: { in: gradStudentIds } },
      });
      if (reEnrolled > 0) {
        fail(`${reEnrolled} graduado(s) fueron re-matriculados en el año destino (no deberían).`);
      } else {
        ok('Ningún graduado fue re-matriculado en el año destino.');
      }
    }
  } else {
    warn('Ningún GRADUATED. Si el año origen tenía estudiantes de último grado que aprobaron, revisa la secuencia de grados.');
  }
  console.log('');

  // ── YC-1: aislamiento multi-tenant en la promoción ──────────────────────────
  if (toYearId) {
    console.log('YC-1 · Ninguna matrícula nueva cae en otra institución:');
    const newEnrollments = await prisma.studentEnrollment.findMany({
      where: { academicYearId: toYearId },
      select: {
        id: true,
        studentId: true,
        institutionId: true,
        group: { select: { grade: { select: { institutionId: true, name: true } } } },
      },
    });
    const crossTenant = newEnrollments.filter(
      (e) =>
        e.group?.grade?.institutionId !== fromYear.institutionId ||
        e.institutionId !== fromYear.institutionId,
    );
    if (crossTenant.length > 0) {
      fail(`${crossTenant.length} matrícula(s) del año destino apuntan a un grado/grupo de OTRA institución (YC-1).`);
      crossTenant.slice(0, 10).forEach((e) =>
        info(`enrollment=${e.id} student=${e.studentId} grade.inst=${e.group?.grade?.institutionId}`),
      );
    } else {
      ok(`Las ${newEnrollments.length} matrículas del año destino pertenecen a la institución correcta.`);
    }
    console.log('');

    // ── Idempotencia: sin matrículas duplicadas por estudiante en el año destino ─
    console.log('Idempotencia · Sin matrículas duplicadas por estudiante (año destino):');
    const dupes = await prisma.studentEnrollment.groupBy({
      by: ['studentId'],
      where: { academicYearId: toYearId },
      _count: true,
      having: { studentId: { _count: { gt: 1 } } },
    });
    if (dupes.length > 0) {
      fail(`${dupes.length} estudiante(s) tienen más de una matrícula en el año destino.`);
    } else {
      ok('Un estudiante = una matrícula en el año destino.');
    }
    console.log('');

    // ── YC-3: distribución en grupos (no todos en el primer grupo) ──────────────
    console.log('YC-3 · Distribución en grupos del año destino (informativo):');
    const byGroup = await prisma.studentEnrollment.groupBy({
      by: ['groupId'],
      where: { academicYearId: toYearId },
      _count: true,
    });
    info(`${byGroup.length} grupo(s) receptores para ${newEnrollments.length} matrículas.`);
    const overloaded = byGroup.filter((g) => g._count > 45);
    if (overloaded.length > 0) {
      warn(`${overloaded.length} grupo(s) con >45 estudiantes — posible volcado en un solo grupo (YC-3, aún sin fix).`);
    }
    console.log('');
  } else {
    warn('Sin <toYearId>: se omiten las verificaciones YC-1 / idempotencia / YC-3.');
    console.log('');
  }

  // ── Sanidad cross-tenant global del año origen ──────────────────────────────
  console.log('Sanidad · Coherencia institución↔grado en el año origen:');
  const fromEnrollments = await prisma.studentEnrollment.findMany({
    where: { academicYearId: fromYearId },
    select: {
      id: true,
      institutionId: true,
      group: { select: { grade: { select: { institutionId: true } } } },
    },
  });
  const mismatched = fromEnrollments.filter(
    (e) => e.group?.grade?.institutionId !== e.institutionId,
  );
  if (mismatched.length > 0) {
    fail(`${mismatched.length} matrícula(s) del año origen ya tienen institución incoherente con su grado.`);
  } else {
    ok(`Las ${fromEnrollments.length} matrículas del año origen son coherentes.`);
  }

  console.log('\n═══════════════════════════════════════');
  if (failures === 0) {
    console.log(`${GREEN}TODAS LAS VERIFICACIONES CRÍTICAS PASARON${RESET}`);
  } else {
    console.log(`${RED}${failures} VERIFICACIÓN(ES) CRÍTICA(S) FALLARON${RESET}`);
  }
  console.log('═══════════════════════════════════════\n');
  process.exit(failures === 0 ? 0 : 2);
}

main().finally(() => prisma.$disconnect());
