/**
 * Consolida la bitácora del docente Antonio Castellón en producción.
 *
 * Antonio tiene 15 tableros CLASS_LOG titulados por curso+materia
 * ("7° A FUNDAMENTOS", "10° C SPEAKING", "11° A"...). La idea es dejar
 * UNA tarjeta por curso ("7° A", "10° C", "11° A") y conservar la materia
 * como ETIQUETA en cada anotación, sin perder información.
 *
 * Seguro y reversible:
 *   - Mueve los items al tablero contenedor (no los borra).
 *   - Etiqueta cada item con su materia (FUNDAMENTOS/SPEAKING) — aditivo.
 *   - Archiva los tableros sobrantes (isArchived=true), NO los elimina.
 *   - Idempotente: si un curso ya quedó en 1 tablero, no hace nada.
 *
 * Uso:
 *   node scripts/consolidate-antonio.cjs "<DATABASE_URL>"            (dry-run, solo imprime)
 *   node scripts/consolidate-antonio.cjs "<DATABASE_URL>" --apply    (ejecuta)
 */
const { PrismaClient } = require('@prisma/client');

const TEACHER_ID = 'cmm8j384n02ns1434047snsnr';      // Antonio Castellón
const INSTITUTION_ID = 'cmm8e3ztw0002m201rjd2vjg3';

const url = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!url) { console.error('Falta la URL de la BD'); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } } });

// "7° A FUNDAMENTOS" -> { course: "7° A", subject: "FUNDAMENTOS" }
// "11° A"            -> { course: "11° A", subject: null }
function parseTitle(raw) {
  const t = (raw || '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(\d+)\s*°?\s*([A-Za-z])\b\s*(.*)$/);
  if (!m) return { course: t, subject: null };
  const course = `${m[1]}° ${m[2].toUpperCase()}`;
  const subject = (m[3] || '').trim().toUpperCase() || null;
  return { course, subject };
}

async function main() {
  const boards = await prisma.workspaceBoard.findMany({
    where: { teacherId: TEACHER_ID, institutionId: INSTITUTION_ID, type: 'CLASS_LOG', isArchived: false },
    include: { items: { where: { isArchived: false } } },
  });
  if (!boards.length) { console.log('Sin tableros CLASS_LOG activos.'); return; }

  // Agrupar por curso
  const byCourse = new Map();
  for (const b of boards) {
    const { course, subject } = parseTitle(b.title);
    if (!byCourse.has(course)) byCourse.set(course, []);
    byCourse.get(course).push({ board: b, subject });
  }

  console.log(`Modo: ${APPLY ? 'APLICAR' : 'DRY-RUN (solo plan)'}\n`);
  console.log(`${boards.length} tableros → ${byCourse.size} cursos:\n`);

  for (const [course, members] of [...byCourse.entries()].sort()) {
    const totalItems = members.reduce((a, m) => a + m.board.items.length, 0);
    const desc = members.map((m) => `"${m.board.title}"[${m.subject || 'sin materia'}](${m.board.items.length})`).join(' + ');
    console.log(`▸ ${course}  ←  ${desc}  =  ${totalItems} items`);

    if (!APPLY) continue;

    // Contenedor = el tablero con más items
    const sorted = [...members].sort((a, b) => b.board.items.length - a.board.items.length);
    const container = sorted[0].board;

    for (const { board, subject } of members) {
      // Etiquetar items con su materia (aditivo, sin duplicar)
      if (subject) {
        for (const it of board.items) {
          const tags = Array.isArray(it.tags) ? it.tags : [];
          if (!tags.includes(subject)) {
            await prisma.workspaceItem.update({
              where: { id: it.id },
              data: { tags: { set: [...tags, subject] } },
            });
          }
        }
      }
      // Mover items de los tableros sobrantes al contenedor
      if (board.id !== container.id && board.items.length) {
        await prisma.workspaceItem.updateMany({
          where: { boardId: board.id, isArchived: false },
          data: { boardId: container.id },
        });
      }
      // Archivar los tableros sobrantes
      if (board.id !== container.id) {
        await prisma.workspaceBoard.update({ where: { id: board.id }, data: { isArchived: true } });
      }
    }

    // Convertir el contenedor en espacio de curso con nombre limpio
    await prisma.workspaceBoard.update({
      where: { id: container.id },
      data: { title: course, isCourseSpace: true, emoji: '📖' },
    });
    console.log(`   ✓ "${course}" consolidado (contenedor ${container.id})`);
  }

  console.log(`\n${APPLY ? '✓ Hecho.' : 'Dry-run: nada se modificó. Repite con --apply para ejecutar.'}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
