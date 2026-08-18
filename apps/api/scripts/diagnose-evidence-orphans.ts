/**
 * diagnose-evidence-orphans.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * DIAGNÓSTICO DE SOLO LECTURA. No escribe, no repara, no borra, no migra.
 *
 * Mide el daño causado por el vector corregido en F1: `updateAchievement` hacía
 * `deleteMany` + `createMany` sobre `AchievementEvidence` en cada guardado del
 * catálogo, regenerando los ids. Como `StudentEvidenceValuation.achievementEvidenceId`
 * es un escalar SIN clave foránea, las valoraciones que apuntaban a los ids viejos
 * quedaron huérfanas: invisibles para la planilla y para el boletín, sin error.
 *
 * Desglosa por institución, año, período, estudiante y evidencia perdida, y clasifica
 * cada huérfana en:
 *
 *   A. Potencialmente recuperable desde snapshot
 *      → existe TermReportCardSnapshot de esa matrícula+período Y su JSON contiene
 *        `evidenceItems` con nivel: el texto del imprescindible y su valoración
 *        sobrevivieron congelados en el boletín oficial.
 *   B. Potencialmente identificable con otros datos históricos
 *      → existe snapshot pero sin `evidenceItems` (formato anterior o modo PURPOSE);
 *        conserva el propósito y sus textos, permite acotar pero no reconstruir.
 *   C. Probablemente irrecuperable
 *      → no hay snapshot de esa matrícula+período. Solo sobrevive el nivel y la fecha,
 *        sin forma de saber a qué imprescindible correspondía.
 *
 * NO realiza recuperación automática. Es la decisión pendiente D-13.
 *
 * Uso:
 *   cd apps/api
 *   railway run npx ts-node scripts/diagnose-evidence-orphans.ts     # inyecta DATABASE_URL
 *   DATABASE_URL="postgresql://…" npx ts-node scripts/diagnose-evidence-orphans.ts
 */

import { PrismaClient } from '@prisma/client';

// Desde una máquina local, el `DATABASE_URL` de Railway apunta al hostname interno
// (`*.railway.internal`), que no resuelve fuera de la red del proyecto. Cuando existe
// `DATABASE_PUBLIC_URL` se prefiere esa. El valor nunca se imprime.
const connectionUrl = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient(
  connectionUrl ? { datasources: { db: { url: connectionUrl } } } : undefined,
);

const TOP = 25; // filas por tabla de desglose

function pct(n: number, total: number): string {
  if (total <= 0) return '0.0 %';
  return `${((n / total) * 100).toFixed(1)} %`;
}

function bar(n: number, total: number, width = 30): string {
  if (total <= 0) return '';
  const filled = Math.max(0, Math.min(width, Math.round((n / total) * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function h1(t: string) {
  console.log(`\n${'═'.repeat(72)}\n ${t}\n${'═'.repeat(72)}`);
}
function h2(t: string) {
  console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 66 - t.length))}`);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** ¿El JSON del snapshot conserva valoraciones por imprescindible? */
function inspectSnapshot(data: any): { hasEvidenceItems: boolean; hasLearningBlocks: boolean } {
  let hasEvidenceItems = false;
  let hasLearningBlocks = false;
  const areas = data?.areaGrades;
  if (!Array.isArray(areas)) return { hasEvidenceItems, hasLearningBlocks };
  for (const area of areas) {
    for (const subject of area?.subjects ?? []) {
      const blocks = subject?.learningBlocks;
      if (!Array.isArray(blocks) || blocks.length === 0) continue;
      hasLearningBlocks = true;
      for (const b of blocks) {
        const items = b?.evidenceItems;
        if (Array.isArray(items) && items.some((i: any) => i && i.level)) {
          hasEvidenceItems = true;
          return { hasEvidenceItems, hasLearningBlocks };
        }
      }
    }
  }
  return { hasEvidenceItems, hasLearningBlocks };
}

async function main() {
  h1('DIAGNÓSTICO DE INTEGRIDAD HISTÓRICA — valoraciones por imprescindible');
  console.log(' Solo lectura. No modifica ningún registro.');

  // ── 1-3. Totales y huérfanas ──────────────────────────────────────────────
  const [totalEvidences, totalValuations] = await Promise.all([
    prisma.achievementEvidence.count(),
    prisma.studentEvidenceValuation.count(),
  ]);

  console.log(`\n AchievementEvidence vivas   : ${totalEvidences}`);
  console.log(` StudentEvidenceValuation    : ${totalValuations}`);

  if (totalValuations === 0) {
    console.log('\n No hay valoraciones por imprescindible registradas.');
    console.log(' Nada que diagnosticar: el vector se corrigió antes de acumular daño.\n');
    return;
  }

  const liveIds = new Set(
    (await prisma.achievementEvidence.findMany({ select: { id: true } })).map((e) => e.id),
  );

  const valuations = await prisma.studentEvidenceValuation.findMany({
    select: {
      id: true,
      institutionId: true,
      academicTermId: true,
      achievementEvidenceId: true,
      studentEnrollmentId: true,
      performanceLevel: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const orphans = valuations.filter((v) => !liveIds.has(v.achievementEvidenceId));

  h2('RESUMEN');
  console.log(` Valoraciones totales        : ${totalValuations}`);
  console.log(` Huérfanas                   : ${orphans.length}  (${pct(orphans.length, totalValuations)})`);
  console.log(` ${bar(orphans.length, totalValuations)}`);

  if (orphans.length === 0) {
    console.log('\n ✓ Ninguna valoración apunta a una evidencia inexistente.');
    console.log('   Integridad histórica intacta. No hay nada que decidir en D-13.\n');
    return;
  }

  const lostEvidenceIds = [...new Set(orphans.map((o) => o.achievementEvidenceId))];
  const affectedEnrollmentIds = [...new Set(orphans.map((o) => o.studentEnrollmentId))];
  const affectedTermIds = [...new Set(orphans.map((o) => o.academicTermId))];
  const affectedInstitutionIds = [...new Set(orphans.map((o) => o.institutionId))];

  console.log(` Evidencias perdidas (ids)   : ${lostEvidenceIds.length}`);
  console.log(` Matrículas afectadas        : ${affectedEnrollmentIds.length}`);
  console.log(` Períodos afectados          : ${affectedTermIds.length}`);
  console.log(` Instituciones afectadas     : ${affectedInstitutionIds.length}`);

  // ── Catálogos para nombrar ────────────────────────────────────────────────
  const [institutions, terms, enrollments] = await Promise.all([
    prisma.institution.findMany({
      where: { id: { in: affectedInstitutionIds } },
      select: { id: true, name: true },
    }),
    prisma.academicTerm.findMany({
      where: { id: { in: affectedTermIds } },
      select: {
        id: true, name: true, status: true, order: true,
        academicYear: { select: { id: true, year: true } },
      },
    }),
    prisma.studentEnrollment.findMany({
      where: { id: { in: affectedEnrollmentIds } },
      select: {
        id: true, status: true,
        student: { select: { firstName: true, secondName: true, lastName: true, secondLastName: true, documentNumber: true } },
        group: { select: { name: true, grade: { select: { name: true, stage: true } } } },
      },
    }),
  ]);

  const instName = new Map(institutions.map((i) => [i.id, i.name]));
  const termInfo = new Map(terms.map((t) => [t.id, t]));
  const enrInfo = new Map(enrollments.map((e) => [e.id, e]));
  const fullName = (e: any) =>
    [e?.student?.lastName, e?.student?.secondLastName, e?.student?.firstName, e?.student?.secondName]
      .filter(Boolean).join(' ') || '(sin nombre)';

  const tally = <K>(items: typeof orphans, key: (o: (typeof orphans)[0]) => K) => {
    const m = new Map<K, number>();
    for (const o of items) m.set(key(o), (m.get(key(o)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  // ── 4. Por institución ────────────────────────────────────────────────────
  h2('POR INSTITUCIÓN');
  for (const [id, count] of tally(orphans, (o) => o.institutionId)) {
    const totalInst = valuations.filter((v) => v.institutionId === id).length;
    console.log(`  ${String(count).padStart(7)} / ${String(totalInst).padEnd(7)} ${pct(count, totalInst).padStart(7)}  ${instName.get(id) ?? id}`);
  }

  // ── 5a. Por año ───────────────────────────────────────────────────────────
  h2('POR AÑO ACADÉMICO');
  for (const [year, count] of tally(orphans, (o) => termInfo.get(o.academicTermId)?.academicYear.year ?? 0)) {
    console.log(`  ${String(count).padStart(7)}  ${year || '(año desconocido)'}`);
  }

  // ── 5b. Por período ───────────────────────────────────────────────────────
  h2('POR PERÍODO');
  for (const [id, count] of tally(orphans, (o) => o.academicTermId)) {
    const t = termInfo.get(id);
    const label = t ? `${t.academicYear.year} · ${t.name} · ${t.status}` : `(período ${id} no encontrado)`;
    console.log(`  ${String(count).padStart(7)}  ${label}`);
  }

  // ── 6. Por estudiante ─────────────────────────────────────────────────────
  h2(`POR ESTUDIANTE (top ${TOP} de ${affectedEnrollmentIds.length})`);
  for (const [id, count] of tally(orphans, (o) => o.studentEnrollmentId).slice(0, TOP)) {
    const e = enrInfo.get(id);
    const grp = e?.group ? `${e.group.grade?.name ?? ''} ${e.group.name}`.trim() : '';
    console.log(`  ${String(count).padStart(7)}  ${fullName(e).padEnd(38)} ${grp.padEnd(16)} ${e?.status ?? '(matrícula no encontrada)'}`);
  }

  // ── 7. Por evidencia perdida ──────────────────────────────────────────────
  h2(`POR EVIDENCIA PERDIDA (top ${TOP} de ${lostEvidenceIds.length})`);
  console.log('  El texto NO está disponible: la fila fue borrada físicamente.');
  for (const [id, count] of tally(orphans, (o) => o.achievementEvidenceId).slice(0, TOP)) {
    const sample = orphans.filter((o) => o.achievementEvidenceId === id);
    const t = termInfo.get(sample[0].academicTermId);
    console.log(`  ${String(count).padStart(7)}  id=${id}  ${t ? `${t.academicYear.year} ${t.name}` : ''}`);
  }

  // ── 7b. Niveles perdidos ──────────────────────────────────────────────────
  h2('NIVELES CONTENIDOS EN LAS HUÉRFANAS');
  for (const [level, count] of tally(orphans, (o) => o.performanceLevel)) {
    console.log(`  ${String(count).padStart(7)}  ${level}`);
  }

  // ── 8. Snapshots disponibles ──────────────────────────────────────────────
  h2('SNAPSHOTS DISPONIBLES');
  const pairKey = (enrollmentId: string, termId: string) => `${enrollmentId}|${termId}`;
  const affectedPairs = new Set(orphans.map((o) => pairKey(o.studentEnrollmentId, o.academicTermId)));

  // Última versión de snapshot por (matrícula, período) afectado.
  const bestSnapshot = new Map<string, { version: number; data: any }>();
  for (const ids of chunk(affectedEnrollmentIds, 200)) {
    const snaps = await prisma.termReportCardSnapshot.findMany({
      where: { studentEnrollmentId: { in: ids }, academicTermId: { in: affectedTermIds } },
      select: { studentEnrollmentId: true, academicTermId: true, version: true, data: true },
      orderBy: { version: 'asc' },
    });
    for (const s of snaps) {
      const k = pairKey(s.studentEnrollmentId, s.academicTermId);
      if (!affectedPairs.has(k)) continue;
      const prev = bestSnapshot.get(k);
      if (!prev || s.version > prev.version) bestSnapshot.set(k, { version: s.version, data: s.data });
    }
  }

  const termsWithSnapshot = new Set<string>();
  for (const k of bestSnapshot.keys()) termsWithSnapshot.add(k.split('|')[1]);
  const termsWithoutSnapshot = affectedTermIds.filter((t) => !termsWithSnapshot.has(t));

  console.log(`  Pares (matrícula, período) afectados     : ${affectedPairs.size}`);
  console.log(`  …con snapshot disponible                 : ${bestSnapshot.size}`);
  console.log(`  …sin snapshot                            : ${affectedPairs.size - bestSnapshot.size}`);
  console.log(`  Períodos afectados CON snapshot          : ${termsWithSnapshot.size}`);
  console.log(`  Períodos afectados SIN snapshot          : ${termsWithoutSnapshot.length}`);
  for (const id of termsWithoutSnapshot) {
    const t = termInfo.get(id);
    console.log(`      · ${t ? `${t.academicYear.year} ${t.name} (${t.status})` : id}`);
  }

  // ── 9. Clasificación A / B / C ────────────────────────────────────────────
  h2('CLASIFICACIÓN DE RECUPERABILIDAD');
  const snapshotQuality = new Map<string, { hasEvidenceItems: boolean; hasLearningBlocks: boolean }>();
  for (const [k, snap] of bestSnapshot) snapshotQuality.set(k, inspectSnapshot(snap.data));

  let classA = 0, classB = 0, classC = 0;
  for (const o of orphans) {
    const q = snapshotQuality.get(pairKey(o.studentEnrollmentId, o.academicTermId));
    if (q?.hasEvidenceItems) classA++;
    else if (q?.hasLearningBlocks) classB++;
    else classC++;
  }

  console.log(`  A · Recuperables desde snapshot          : ${String(classA).padStart(7)}  ${pct(classA, orphans.length)}`);
  console.log(`      (el snapshot conserva evidenceItems con nivel)`);
  console.log(`  B · Identificables parcialmente          : ${String(classB).padStart(7)}  ${pct(classB, orphans.length)}`);
  console.log(`      (hay snapshot con learningBlocks, pero sin nivel por imprescindible)`);
  console.log(`  C · Probablemente irrecuperables         : ${String(classC).padStart(7)}  ${pct(classC, orphans.length)}`);
  console.log(`      (sin snapshot utilizable de esa matrícula y período)`);

  h2('CONCLUSIÓN');
  console.log(`  Valoraciones afectadas   : ${orphans.length} de ${totalValuations} (${pct(orphans.length, totalValuations)})`);
  console.log(`  Estudiantes afectados    : ${affectedEnrollmentIds.length}`);
  console.log(`  Irrecuperables (clase C) : ${classC}`);
  console.log('\n  NO se reparó ningún registro. La recuperación histórica es la decisión D-13.\n');
}

main()
  .catch((e) => {
    console.error('\n✗ Error ejecutando el diagnóstico:', e?.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
