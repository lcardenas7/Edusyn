/**
 * Script para agregar valores faltantes a enums de PostgreSQL.
 * Se ejecuta antes de prisma db push para evitar errores de sincronización.
 * 
 * IMPORTANTE: Prisma (tanto $executeRawUnsafe como db execute) envuelve 
 * queries en transacciones implícitas. PostgreSQL prohíbe ALTER TYPE ADD VALUE
 * dentro de transacciones. Por eso usamos el driver 'pg' directamente,
 * que ejecuta cada query en autocommit (sin transacción).
 */
const { Client } = require('pg');

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
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`[fix-enums] Connected to PostgreSQL. Executing ${statements.length} enum fixes...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await client.query(stmt);
      console.log(`[fix-enums] [${i + 1}/${statements.length}] OK: ${stmt}`);
    } catch (err) {
      const msg = err.message || String(err);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log(`[fix-enums] [${i + 1}/${statements.length}] Already exists (OK): ${stmt}`);
      } else {
        console.error(`[fix-enums] [${i + 1}/${statements.length}] ERROR: ${msg}`);
      }
    }
  }

  await client.end();
  console.log('[fix-enums] Done');
  process.exit(0);
}

main().catch(err => {
  console.error('[fix-enums] Fatal error:', err.message || err);
  process.exit(0); // Don't block app startup
});
