/**
 * POBLAR Grade.number A PARTIR DEL NOMBRE DEL GRADO.
 *
 * La promoción ordena los grados por `number` (getGradeOrder = stageOrder + number).
 * Cuando `number` está en NULL, todos los grados de una etapa colapsan al mismo
 * orden y la promoción/graduación queda indefinida. Este script deriva el número
 * desde el nombre (Primero=1 … Undécimo=11) SOLO para los grados que hoy tienen
 * number=NULL, sin tocar los que ya tienen valor.
 *
 * SEGURO POR DEFECTO: corre en modo DRY-RUN (solo muestra). Para aplicar de verdad,
 * pasa "apply" como segundo argumento.
 *
 * Uso:
 *   # ver qué cambiaría (no escribe):
 *   DATABASE_URL="<staging público>" npx tsx scripts/set-grade-numbers.ts <institutionId>
 *   # aplicar:
 *   DATABASE_URL="<staging público>" npx tsx scripts/set-grade-numbers.ts <institutionId> apply
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const WORD_TO_NUMBER: Record<string, number> = {
  primero: 1, primer: 1, segundo: 2, tercero: 3, tercer: 3, cuarto: 4, quinto: 5,
  sexto: 6, septimo: 7, octavo: 8, noveno: 9, decimo: 10,
  undecimo: 11, once: 11, duodecimo: 12, doce: 12,
};

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Deriva el número del grado desde su nombre. null si no se puede mapear con confianza. */
function deriveNumber(name: string): number | null {
  const n = norm(name).trim();
  // 1) Token-palabra exacto (evita el falso positivo undecimo⊃decimo).
  const tokens = n.split(/[^a-z]+/).filter(Boolean);
  for (const t of tokens) {
    if (WORD_TO_NUMBER[t] != null) return WORD_TO_NUMBER[t];
  }
  // 2) Nombre puramente numérico tipo "6", "6°", "10°" (no "CICLO 6").
  const onlyNum = n.replace(/[°º\s]/g, '');
  if (/^\d{1,2}$/.test(onlyNum)) return parseInt(onlyNum, 10);
  return null;
}

async function main() {
  const institutionId = process.argv[2];
  const apply = process.argv[3] === 'apply';
  if (!institutionId) throw new Error('Falta <institutionId>');

  const grades = await prisma.grade.findMany({
    where: { institutionId },
    select: { id: true, name: true, number: true, stage: true },
    orderBy: [{ stage: 'asc' }, { name: 'asc' }],
  });

  console.log(`\nInstitución ${institutionId} — ${grades.length} grados. Modo: ${apply ? 'APPLY (escribe)' : 'DRY-RUN (no escribe)'}\n`);

  const toUpdate: { id: string; name: string; number: number }[] = [];
  const unmapped: string[] = [];

  for (const g of grades) {
    if (g.number != null) {
      console.log(`  = ${g.stage} "${g.name}"  → ya tiene number=${g.number} (se deja igual)`);
      continue;
    }
    const derived = deriveNumber(g.name);
    if (derived == null) {
      unmapped.push(`${g.stage} "${g.name}"`);
      console.log(`  ? ${g.stage} "${g.name}"  → NO se pudo derivar (revisar a mano)`);
    } else {
      toUpdate.push({ id: g.id, name: g.name, number: derived });
      console.log(`  ${apply ? '✓' : '→'} ${g.stage} "${g.name}"  → number = ${derived}`);
    }
  }

  if (apply && toUpdate.length > 0) {
    for (const u of toUpdate) {
      await prisma.grade.update({ where: { id: u.id }, data: { number: u.number } });
    }
    console.log(`\n✓ Aplicado: ${toUpdate.length} grados actualizados.`);
  } else if (!apply) {
    console.log(`\n(DRY-RUN) ${toUpdate.length} grados se actualizarían. Para aplicar: agrega "apply".`);
  }

  if (unmapped.length > 0) {
    console.log(`\n⚠ ${unmapped.length} grado(s) sin mapear (asigna number a mano): ${unmapped.join(' | ')}`);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
