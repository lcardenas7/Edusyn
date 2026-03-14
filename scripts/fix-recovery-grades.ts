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

const prisma = new PrismaClient();

async function fixRecoveryGrades() {
  console.log('🔧 Iniciando corrección de notas de recuperación...\n');

  // Buscar todas las recuperaciones APPROVED que tienen finalScore
  const approvedRecoveries = await prisma.periodRecovery.findMany({
    where: {
      status: 'APPROVED',
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
