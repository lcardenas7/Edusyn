/**
 * Script para agregar valores faltantes a enums de PostgreSQL.
 * Se ejecuta antes de prisma db push para evitar errores de sincronización.
 * 
 * IMPORTANTE: prisma db execute wraps SQL in a transaction, and PostgreSQL
 * forbids ALTER TYPE ADD VALUE inside transactions. So we use PrismaClient
 * $executeRawUnsafe which does NOT wrap in a transaction by default.
 */
const { PrismaClient } = require('@prisma/client');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log('[fix-enums] No DATABASE_URL found, skipping');
  process.exit(0);
}

const statements = [
  `ALTER TYPE "SystemModule" ADD VALUE IF NOT EXISTS 'DIAGNOSIS'`,
  `ALTER TYPE "SystemModule" ADD VALUE IF NOT EXISTS 'TEACHER_WORKSPACE'`,
  `ALTER TYPE "SystemModule" ADD VALUE IF NOT EXISTS 'PAYMENTS'`,
  `ALTER TYPE "SystemModule" ADD VALUE IF NOT EXISTS 'FINANCE'`,
];

async function main() {
  const prisma = new PrismaClient();
  console.log(`[fix-enums] Executing ${statements.length} enum fixes via PrismaClient...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`[fix-enums] [${i + 1}/${statements.length}] OK: ${stmt}`);
    } catch (err) {
      // "already exists" is expected and safe to ignore
      const msg = err.message || String(err);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log(`[fix-enums] [${i + 1}/${statements.length}] Already exists (OK): ${stmt}`);
      } else {
        console.error(`[fix-enums] [${i + 1}/${statements.length}] ERROR: ${msg}`);
      }
    }
  }

  await prisma.$disconnect();
  console.log('[fix-enums] Done');
  process.exit(0);
}

main().catch(err => {
  console.error('[fix-enums] Fatal error:', err.message || err);
  process.exit(0); // Don't block app startup
});
