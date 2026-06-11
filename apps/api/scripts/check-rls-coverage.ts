/**
 * check-rls-coverage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Verifica la cobertura de Row Level Security (RLS) multi-tenant.
 *
 * Para CADA tabla con columna "institutionId" reporta:
 *   - rls_enabled : RLS habilitado (ENABLE ROW LEVEL SECURITY)
 *   - rls_forced  : RLS forzado (FORCE ROW LEVEL SECURITY) → aplica incluso al
 *                   owner de la tabla (postgres/Prisma). SIN esto, el backend
 *                   bypassa las políticas y el aislamiento depende solo de
 *                   filtros manuales por institutionId.
 *   - has_policy  : existe al menos una policy en la tabla.
 *
 * Una tabla está PROTEGIDA solo si: rls_enabled && rls_forced && has_policy.
 *
 * Uso:
 *   npx ts-node scripts/check-rls-coverage.ts
 *
 * Salida:
 *   - exit code 0 → todas las tablas con institutionId están protegidas.
 *   - exit code 1 → hay tablas sin RLS forzado/policy (brecha de aislamiento).
 *
 * Apto para CI: falla el pipeline si una nueva tabla tenant-scoped queda
 * sin protección RLS.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RlsRow {
  table_name: string;
  rls_enabled: boolean;
  rls_forced: boolean;
  has_policy: boolean;
}

async function main() {
  const rows = (await prisma.$queryRawUnsafe(`
    SELECT
      c.relname AS table_name,
      c.relrowsecurity AS rls_enabled,
      c.relforcerowsecurity AS rls_forced,
      EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = n.nspname AND p.tablename = c.relname
      ) AS has_policy
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
      AND a.attname = 'institutionId'
      AND a.attnum > 0
      AND NOT a.attisdropped
    WHERE c.relkind = 'r' AND n.nspname = 'public'
    ORDER BY c.relname;
  `)) as RlsRow[];

  if (rows.length === 0) {
    console.log('No se encontraron tablas con columna "institutionId".');
    return;
  }

  const isProtected = (r: RlsRow) => r.rls_enabled && r.rls_forced && r.has_policy;

  const protectedRows = rows.filter(isProtected);
  const unprotected = rows.filter((r) => !isProtected(r));

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' COBERTURA RLS — tablas con institutionId');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(
    ' ' +
      'TABLA'.padEnd(34) +
      'ENABLED'.padEnd(9) +
      'FORCED'.padEnd(8) +
      'POLICY'.padEnd(8) +
      'OK',
  );
  console.log('───────────────────────────────────────────────────────────────');
  for (const r of rows) {
    console.log(
      ' ' +
        r.table_name.padEnd(34) +
        String(r.rls_enabled).padEnd(9) +
        String(r.rls_forced).padEnd(8) +
        String(r.has_policy).padEnd(8) +
        (isProtected(r) ? 'OK' : 'XX'),
    );
  }
  console.log('───────────────────────────────────────────────────────────────');
  console.log(
    ` Total: ${rows.length} | Protegidas: ${protectedRows.length} | Sin proteger: ${unprotected.length}`,
  );

  if (unprotected.length > 0) {
    console.log('\n⚠️  TABLAS SIN PROTECCIÓN RLS COMPLETA:');
    for (const r of unprotected) {
      const missing: string[] = [];
      if (!r.rls_enabled) missing.push('ENABLE');
      if (!r.rls_forced) missing.push('FORCE');
      if (!r.has_policy) missing.push('POLICY');
      console.log(`   - ${r.table_name}: falta ${missing.join(', ')}`);
    }
    console.log(
      '\nEjecuta los scripts en prisma/sql/rls/ (enable_rls.sql + force_rls_all_tables.sql)\n' +
        'o agrega las tablas faltantes a force_rls_all_tables.sql y vuelve a correrlos.',
    );
    process.exitCode = 1;
  } else {
    console.log('\n✅ Todas las tablas con institutionId tienen RLS habilitado, forzado y con policy.');
  }
}

main()
  .catch((err) => {
    console.error('Error verificando cobertura RLS:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
