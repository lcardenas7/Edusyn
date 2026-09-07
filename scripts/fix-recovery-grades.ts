/**
 * OBSOLETO — pendiente de retirada. No ejecutar sin revisarlo antes.
 *
 * Fue un relleno puntual de marzo de 2026: propagaba a mano las notas de
 * recuperacion aprobadas porque el codigo no lo hacia. Ese fallo se corrigio en
 * el mismo commit, y hoy la propagacion ocurre por el adaptador unico de
 * escritura de la nota final, con auditoria y contraste de institucion.
 *
 * Se conserva por trazabilidad, no porque haga falta. Su retirada esta
 * propuesta y requiere su propia decision: nadie lo invoca desde package.json,
 * la integracion continua, el codigo ni la documentacion.
 */
/**
 * Script para propagar notas de recuperación aprobadas a PeriodFinalGrade
 * 
 * Problema: Las recuperaciones aprobadas no actualizaban PeriodFinalGrade,
 * causando que los boletines no reflejaran las notas recuperadas.
 * 
 * Este script corrige los datos existentes.
 * 
 * Uso: npx ts-node scripts/fix-recovery-grades.ts
 */

import { PrismaClient } from '@prisma/client';

// La conexion NUNCA se escribe aqui: llega por entorno. Una cadena embebida en
// el repositorio es una credencial publicada, aunque el repositorio parezca privado.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    'Falta DATABASE_URL. Exportala antes de ejecutar este script; no la escribas en el fichero.',
  );
}

const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

async function fixRecoveryGrades() {
  console.log('🔧 Iniciando corrección de notas de recuperación...\n');
  
  // Verificar conexión y mostrar todas las recuperaciones
  console.log('🔍 Buscando TODAS las recuperaciones...');
  const allRecoveries = await prisma.periodRecovery.findMany({
    where: {
      finalScore: { not: null },
    },
    include: {
      studentEnrollment: {
        include: {
          student: { select: { firstName: true, lastName: true } },
        },
      },
      subject: { select: { name: true } },
      academicTerm: { select: { name: true } },
    },
    take: 10, // Limitar a 10 para no saturar
  });
  
  console.log(`📋 Encontradas ${allRecoveries.length} recuperaciones (primeras 10):`);
  allRecoveries.forEach(r => {
    console.log(`   - ${r.studentEnrollment.student.lastName} ${r.studentEnrollment.student.firstName} | ${r.subject.name}: ${r.originalScore} → ${r.recoveryScore} → ${r.finalScore} [${r.status}]`);
  });

  // Buscar todas las recuperaciones APPROVED o COMPLETED que tienen finalScore
  const approvedRecoveries = await prisma.periodRecovery.findMany({
    where: {
      status: { in: ['APPROVED', 'COMPLETED'] },
      finalScore: { not: null },
    },
    include: {
      studentEnrollment: {
        include: {
          student: { select: { firstName: true, lastName: true } },
        },
      },
      subject: { select: { name: true } },
      academicTerm: { select: { name: true } },
    },
  });

  console.log(`📋 Encontradas ${approvedRecoveries.length} recuperaciones aprobadas\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const recovery of approvedRecoveries) {
    const studentName = `${recovery.studentEnrollment.student.lastName} ${recovery.studentEnrollment.student.firstName}`;
    const subjectName = recovery.subject.name;
    const termName = recovery.academicTerm.name;

    try {
      // Buscar el PeriodFinalGrade correspondiente
      const periodGrade = await prisma.periodFinalGrade.findFirst({
        where: {
          studentEnrollmentId: recovery.studentEnrollmentId,
          subjectId: recovery.subjectId,
          academicTermId: recovery.academicTermId,
        },
      });

      if (!periodGrade) {
        console.log(`⚠️  No se encontró PeriodFinalGrade para ${studentName} - ${subjectName} (${termName})`);
        skipped++;
        continue;
      }

      // Verificar si ya tiene la nota correcta
      if (Number(periodGrade.finalScore) === Number(recovery.finalScore)) {
        console.log(`✓  ${studentName} - ${subjectName}: Ya tiene nota correcta (${recovery.finalScore})`);
        skipped++;
        continue;
      }

      // Actualizar la nota
      await prisma.periodFinalGrade.update({
        where: { id: periodGrade.id },
        data: {
          finalScore: recovery.finalScore!,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ ${studentName} - ${subjectName} (${termName}): ${periodGrade.finalScore} → ${recovery.finalScore}`);
      updated++;
    } catch (error) {
      console.error(`❌ Error procesando ${studentName} - ${subjectName}:`, error);
      errors++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📊 RESUMEN:');
  console.log(`   ✅ Actualizadas: ${updated}`);
  console.log(`   ⏭️  Omitidas (ya correctas o no encontradas): ${skipped}`);
  console.log(`   ❌ Errores: ${errors}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (updated > 0) {
    console.log('⚠️  IMPORTANTE: Después de ejecutar este script, debes:');
    console.log('   1. Reabrir el período (si está finalizado)');
    console.log('   2. Volver a finalizar para regenerar los snapshots');
    console.log('   O usar el endpoint POST /reports/terms/:termId/re-snapshot\n');
  }
}

fixRecoveryGrades()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
