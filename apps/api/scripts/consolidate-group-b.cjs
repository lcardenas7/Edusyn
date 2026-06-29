/**
 * Migración puntual: consolida los tableros del grupo Octavo B en UN espacio
 * de curso con módulos, y convierte los recaudos legacy (metadata) al modelo
 * relacional nuevo (WorkspaceCollection/Charge/Payment).
 *
 * Seguro: archiva los tableros viejos (no los borra) y copia la data de recaudo
 * (no la mueve) → reversible. Idempotente: si ya se corrió, no duplica.
 *
 * Uso: node scripts/consolidate-group-b.cjs "<STAGING_DATABASE_URL>"
 */
const { PrismaClient } = require('@prisma/client');

const GROUP_ID = 'cmm8il2vg000i1434n0o9kygc'; // Octavo B
const COURSE_NAME = 'Octavo B';

const url = process.argv[2];
if (!url) { console.error('Falta la URL de la BD'); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } } });

function chargeStatus(collected, unit) {
  if (unit <= 0) return 'PENDING';
  if (collected >= unit) return 'PAID';
  if (collected > 0) return 'PARTIAL';
  return 'PENDING';
}

async function main() {
  const boards = await prisma.workspaceBoard.findMany({
    where: { groupId: GROUP_ID, isArchived: false },
    include: { items: { where: { isArchived: false } } },
  });
  if (boards.length <= 1) { console.log('Nada que consolidar (≤1 tablero).'); return; }

  console.log(`Tableros de ${COURSE_NAME}:`, boards.map((b) => `${b.title}(${b.type},${b.items.length})`).join(', '));

  // Contenedor = un KANBAN vacío si existe, sino el de menos items
  let container = boards.find((b) => b.type === 'KANBAN' && b.items.length === 0)
    || [...boards].sort((a, b) => a.items.length - b.items.length)[0];
  console.log('Contenedor elegido:', container.title, container.id);

  const enabled = new Set(container.enabledModules || []);

  for (const board of boards) {
    if (board.id === container.id) continue;

    if (board.type === 'MICRO_COLLECT') {
      // ¿ya migrado?
      const exists = await prisma.workspaceCollection.findFirst({
        where: { boardId: container.id, name: board.title },
      });
      if (exists) { console.log(`  · Recaudo "${board.title}" ya existe, omito.`); enabled.add('recaudo'); }
      else {
        const amounts = board.items
          .map((i) => Number((i.metadata || {}).amountPaid || 0))
          .filter((n) => n > 0);
        // valor individual = monto más alto pagado (asume cuota uniforme)
        const unitValue = amounts.length ? Math.max(...amounts) : 0;

        const collection = await prisma.workspaceCollection.create({
          data: {
            boardId: container.id,
            institutionId: container.institutionId,
            name: board.title,
            unitValue,
          },
        });
        for (const it of board.items) {
          const meta = it.metadata || {};
          const paid = Number(meta.amountPaid || 0);
          const charge = await prisma.workspaceCollectionCharge.create({
            data: {
              collectionId: collection.id,
              studentId: meta.studentRecordId || it.id,
              studentName: it.title,
              status: chargeStatus(paid, unitValue),
            },
          });
          if (paid > 0) {
            await prisma.workspaceCollectionPayment.create({
              data: { chargeId: charge.id, amount: paid, note: 'Migrado del recaudo anterior' },
            });
          }
        }
        console.log(`  ✓ Recaudo "${board.title}" → ${board.items.length} cargos, valor ${unitValue}`);
        enabled.add('recaudo');
      }
    } else if (board.type === 'CLASSROOM_ROLES') {
      enabled.add('roles');
      console.log(`  ✓ Roles activado (de "${board.title}")`);
    } else {
      // Mover items al contenedor (bitácora/kanban/etc.)
      if (board.items.length) {
        await prisma.workspaceItem.updateMany({
          where: { boardId: board.id, isArchived: false },
          data: { boardId: container.id },
        });
        console.log(`  ✓ ${board.items.length} items movidos de "${board.title}"`);
      }
      if (board.type === 'KANBAN') enabled.add('tablero');
    }

    // Archivar el tablero viejo (no se borra)
    await prisma.workspaceBoard.update({
      where: { id: board.id },
      data: { isArchived: true },
    });
  }

  // Convertir contenedor en espacio de curso
  await prisma.workspaceBoard.update({
    where: { id: container.id },
    data: {
      title: COURSE_NAME,
      isCourseSpace: true,
      emoji: '🎓',
      enabledModules: Array.from(enabled),
    },
  });
  console.log(`\n✓ "${COURSE_NAME}" consolidado. Módulos: ${Array.from(enabled).join(', ')}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
