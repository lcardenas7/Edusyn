#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2] || 'apps/api/prisma/migrations';
const EXTS = ['.sql', '.prisma'];
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

const offenders = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (EXTS.some((e) => p.endsWith(e))) {
      const head = Buffer.alloc(3);
      const fd = readFileSync(p);
      fd.copy(head, 0, 0, 3);
      if (head.equals(BOM)) offenders.push(p);
    }
  }
}

walk(ROOT);

if (offenders.length) {
  console.error('\n❌ Archivos con BOM detectados:');
  for (const f of offenders) console.error('  - ' + f);
  console.error('\nQuita el BOM antes de hacer commit. Ejemplo:');
  console.error('  sed -i \'1s/^\\xEF\\xBB\\xBF//\' <archivo>\n');
  process.exit(1);
}

console.log(`✅ Sin BOM en ${ROOT}`);
