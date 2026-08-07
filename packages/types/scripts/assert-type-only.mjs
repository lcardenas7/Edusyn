#!/usr/bin/env node
/**
 * Barrera TYPE-ONLY de @edusyn/types (enmienda de contrato 2026-08-01, punto P0
 * de la revisión de arquitectura).
 *
 * Este paquete exporta ÚNICAMENTE tipos borrables. Cualquier valor runtime
 * (const, function, class, enum con cuerpo, export default) rompería apps/api
 * en build/runtime: node no carga .ts desde node_modules y tsc no lo emite.
 *
 * Este script FALLA (exit 1) si encuentra una declaración de valor exportada
 * en src/. Se ejecuta como parte de `npm run typecheck` del paquete, así que
 * la barrera corre en local y en CI sin configuración extra.
 *
 * Permitido:  export type ..., export interface ..., export type { ... } from ...
 * Prohibido:  export const/let/var/function/class/enum/namespace/default,
 *             const enum (aunque no se exporte: emite lookups en runtime).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

const FORBIDDEN = [
  { re: /^\s*export\s+(const|let|var)\b/, what: 'export de variable (const/let/var)' },
  { re: /^\s*export\s+(async\s+)?function\b/, what: 'export de función' },
  { re: /^\s*export\s+(abstract\s+)?class\b/, what: 'export de clase' },
  { re: /^\s*export\s+(const\s+)?enum\b/, what: 'export de enum (emite runtime)' },
  { re: /^\s*export\s+namespace\b/, what: 'export de namespace' },
  { re: /^\s*export\s+default\b/, what: 'export default' },
  { re: /^\s*const\s+enum\b/, what: 'const enum (emite lookups en runtime)' },
];

const files = readdirSync(srcDir).filter((f) => f.endsWith('.ts'));
let violations = 0;

for (const file of files) {
  const lines = readFileSync(join(srcDir, file), 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const { re, what } of FORBIDDEN) {
      if (re.test(line)) {
        console.error(`✗ src/${file}:${i + 1} — ${what} prohibido en @edusyn/types (paquete type-only)`);
        violations++;
      }
    }
  });
}

if (violations > 0) {
  console.error(`\n${violations} violación(es) de la barrera type-only. Mueve el valor a otro paquete o conviértelo en tipo.`);
  process.exit(1);
}

console.log(`✓ Barrera type-only: ${files.length} archivo(s) limpios, solo exports de tipos.`);
