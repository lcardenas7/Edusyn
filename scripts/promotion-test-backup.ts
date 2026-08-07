/**
 * BACKUP/RESTORE ACOTADO PARA LA PRUEBA DE CAMBIO DE AÑO (Pase 3).
 *
 * No es un backup de toda la BD: captura y revierte SOLO lo que el cierre +
 * promoción modifican en UNA institución (estados de matrícula, estado del año,
 * eventos de matrícula y las matrículas nuevas creadas por la promoción).
 * Version-independiente (va por el driver, no por pg_dump).
 *
 * Uso:
 *   # 1) ANTES de la prueba — crea el punto de restauración:
 *   DATABASE_URL="<staging público>" npx tsx scripts/promotion-test-backup.ts backup <institutionId> [archivo.json]
 *
 *   # 2) Para revertir la prueba:
 *   DATABASE_URL="<staging público>" npx tsx scripts/promotion-test-backup.ts restore <archivo.json>
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function backup(institutionId: string, outFile?: string) {
  const inst = await prisma.institution.findUnique({ where: { id: institutionId }, select: { id: true, name: true } });
  if (!inst) throw new Error(`Institución ${institutionId} no existe`);

  const years = await prisma.academicYear.findMany({
    where: { institutionId },
    select: { id: true, status: true, closedAt: true, closedById: true, activatedAt: true, activatedById: true },
  });
  const enrollments = await prisma.studentEnrollment.findMany({
    where: { institutionId },
    select: { id: true, status: true },
  });
  const events = await prisma.enrollmentEvent.findMany({
    where: { institutionId },
    select: { id: true },
  });

  const snapshot = {
    version: 1,
    createdAt: new Date().toISOString(),
    institutionId,
    institutionName: inst.name,
    years,
    enrollments,                       // id + status (para restaurar estado)
    enrollmentIds: enrollments.map(e => e.id),
    eventIds: events.map(e => e.id),   // eventos preexistentes (para borrar solo los nuevos)
  };

  const dir = 'C:/Users/LUIS C/edusyn-staging-backups';
  fs.mkdirSync(dir, { recursive: true });
  const file = outFile || path.join(dir, `promotion-backup_${institutionId}_${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(`✓ Backup creado: ${file}`);
  console.log(`  institución: ${inst.name}`);
  console.log(`  años: ${years.length} | matrículas: ${enrollments.length} | eventos preexistentes: ${events.length}`);
  console.log(`\n  Para revertir la prueba:`);
  console.log(`    npx tsx scripts/promotion-test-backup.ts restore "${file}"`);
}

async function restore(file: string) {
  const bk = JSON.parse(fs.readFileSync(file, 'utf8'));
  const institutionId: string = bk.institutionId;
  const enrollIds: string[] = bk.enrollmentIds;
  const eventIds: string[] = bk.eventIds;

  console.log(`Restaurando institución ${bk.institutionName} [${institutionId}] desde ${file}`);

  // 1. Borrar eventos creados durante la prueba (los que NO estaban en el backup).
  const delEvents = eventIds.length > 0
    ? await prisma.enrollmentEvent.deleteMany({ where: { institutionId, id: { notIn: eventIds } } })
    : await prisma.enrollmentEvent.deleteMany({ where: { institutionId } });
  console.log(`  eventos de matrícula nuevos eliminados: ${delEvents.count}`);

  // 2. Borrar matrículas creadas por la promoción (las que NO estaban en el backup).
  const delEnr = enrollIds.length > 0
    ? await prisma.studentEnrollment.deleteMany({ where: { institutionId, id: { notIn: enrollIds } } })
    : await prisma.studentEnrollment.deleteMany({ where: { institutionId } });
  console.log(`  matrículas nuevas (año destino) eliminadas: ${delEnr.count}`);

  // 3. Restaurar el estado de cada matrícula preexistente.
  let restored = 0;
  for (const e of bk.enrollments) {
    await prisma.studentEnrollment.update({ where: { id: e.id }, data: { status: e.status } });
    restored++;
  }
  console.log(`  estados de matrícula restaurados: ${restored}`);

  // 4. Restaurar el estado de los años lectivos (reabre el año cerrado por la prueba).
  for (const y of bk.years) {
    await prisma.academicYear.update({
      where: { id: y.id },
      data: {
        status: y.status,
        closedAt: y.closedAt ? new Date(y.closedAt) : null,
        closedById: y.closedById,
        activatedAt: y.activatedAt ? new Date(y.activatedAt) : null,
        activatedById: y.activatedById,
      },
    });
  }
  console.log(`  años lectivos restaurados: ${bk.years.length}`);
  console.log(`✓ Restauración completa.`);
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'backup') {
    const instId = process.argv[3];
    if (!instId) throw new Error('Falta <institutionId>');
    await backup(instId, process.argv[4]);
  } else if (mode === 'restore') {
    const file = process.argv[3];
    if (!file) throw new Error('Falta <archivo.json>');
    await restore(file);
  } else {
    throw new Error('Modo inválido. Usa: backup <institutionId> [archivo] | restore <archivo>');
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); }).finally(() => prisma.$disconnect());
