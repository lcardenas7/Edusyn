/**
 * BACKFILL — PerformanceScale desde la config de cada institución.
 *
 * Proyecta los niveles ya configurados (gradingConfig.performanceLevels o
 * academicLevelsConfig) a la tabla `PerformanceScale`, que es la fuente que leen
 * boletines, desempeños y promoción. Si la institución no tiene niveles en ningún
 * lado, siembra la escala por defecto 0–5 (Decreto 1290).
 *
 * NO destructivo: solo actúa sobre instituciones con la tabla VACÍA; las que ya
 * tienen filas se saltan.
 *
 * Ejecutar (desde apps/api):
 *   $env:DATABASE_URL="..."; npx ts-node scripts/backfill-performance-scale.ts
 *   # simulación sin escribir:
 *   $env:DATABASE_URL="..."; npx ts-node scripts/backfill-performance-scale.ts --dry
 */
import { PrismaClient } from '@prisma/client';
import { deriveScaleFromConfig } from '../src/modules/evaluation/performance-scale.util';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');

async function main() {
  const insts = await prisma.institution.findMany({
    select: { id: true, name: true, gradingConfig: true, academicLevelsConfig: true },
  });

  let seeded = 0;
  let skipped = 0;

  for (const inst of insts) {
    const existing = await prisma.performanceScale.count({ where: { institutionId: inst.id } });
    if (existing > 0) {
      console.log(`⏭️  ${inst.name}: ya tiene ${existing} filas, se salta`);
      skipped++;
      continue;
    }

    const rows = deriveScaleFromConfig(inst.gradingConfig, inst.academicLevelsConfig);
    console.log(
      `${DRY ? '🔎 [dry]' : '✅'} ${inst.name}: ${rows.length} niveles → ` +
        rows.map((r) => `${r.level}[${r.minScore}-${r.maxScore}]`).join(' '),
    );

    if (!DRY) {
      for (const r of rows) {
        await prisma.performanceScale.create({
          data: {
            institutionId: inst.id,
            level: r.level,
            minScore: r.minScore,
            maxScore: r.maxScore,
            label: r.label,
            order: r.order,
            isApproved: r.isApproved,
            descriptor: r.descriptor,
          },
        });
      }
    }
    seeded++;
  }

  console.log(`\nResumen: ${seeded} sembradas, ${skipped} saltadas${DRY ? ' (DRY-RUN, nada escrito)' : ''}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
