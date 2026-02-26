/**
 * Script para agregar valores faltantes a enums de PostgreSQL.
 * Se ejecuta antes de prisma db push para evitar errores de sincronización.
 * 
 * IMPORTANTE: Cada ALTER TYPE ADD VALUE debe ejecutarse en su propia transacción.
 * PostgreSQL no permite ADD VALUE dentro de una transacción multi-statement.
 * Por eso ejecutamos cada statement como un archivo separado.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log('[fix-enums] No DATABASE_URL found, skipping');
  process.exit(0);
}

const statements = [
  `ALTER TYPE "SystemModule" ADD VALUE IF NOT EXISTS 'DIAGNOSIS';`,
  `ALTER TYPE "SystemModule" ADD VALUE IF NOT EXISTS 'TEACHER_WORKSPACE';`,
  `ALTER TYPE "Module" ADD VALUE IF NOT EXISTS 'TEACHER_WORKSPACE';`,
];

const tmpFile = path.join(__dirname, '_fix-enums.sql');

console.log(`[fix-enums] Executing ${statements.length} enum fixes...`);

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  try {
    fs.writeFileSync(tmpFile, stmt);
    execSync(`npx prisma db execute --file "${tmpFile}"`, {
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log(`[fix-enums] [${i + 1}/${statements.length}] OK: ${stmt.substring(0, 60)}...`);
  } catch (err) {
    console.log(`[fix-enums] [${i + 1}/${statements.length}] Skipped (already exists or error): ${stmt.substring(0, 60)}...`);
  }
}

try { fs.unlinkSync(tmpFile); } catch (_) {}
console.log('[fix-enums] Done');
