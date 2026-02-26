/**
 * Script para agregar valores faltantes a enums de PostgreSQL.
 * Se ejecuta antes de prisma db push para evitar errores de sincronización.
 * Escribe SQL a un archivo temporal y usa prisma db execute --file.
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

try {
  fs.writeFileSync(tmpFile, statements.join('\n'));
  console.log('[fix-enums] Executing enum fixes...');
  execSync(`npx prisma db execute --file "${tmpFile}"`, {
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log('[fix-enums] Success');
} catch (err) {
  console.log(`[fix-enums] Warning: ${err.message || 'command failed (values may already exist)'}`);
} finally {
  try { fs.unlinkSync(tmpFile); } catch (_) {}
}

console.log('[fix-enums] Done');
