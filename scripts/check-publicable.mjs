#!/usr/bin/env node
/**
 * Chequeo previo a publicar: detecta contenido que no debe llegar al
 * repositorio público.
 *
 * Nunca imprime el valor encontrado. Informa fichero, categoría y motivo, que
 * es lo necesario para corregirlo sin volver a exponerlo en un registro, en la
 * salida de una integración continua o en una captura de pantalla.
 *
 * Uso:  node scripts/check-publicable.mjs [rutas...]
 * Sin argumentos revisa todo lo que Git tiene rastreado.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

/** Rutas reservadas a documentación interna: no deben estar rastreadas. */
const RUTAS_RESERVADAS = [
  { patron: /^docs\/security\//, motivo: 'documentación interna de seguridad' },
  { patron: /^docs\/internal\//, motivo: 'documentación interna' },
  { patron: /(^|\/)evidence\//, motivo: 'evidencia de auditoría interna' },
];

/** Ficheros que nunca se publican por su naturaleza. */
const FICHEROS_PROHIBIDOS = [
  // `.env.example` y equivalentes son plantillas con marcadores: sí se publican.
  { patron: /(^|\/)\.env(\.(?!example$|sample$|template$)|$)/, motivo: 'fichero de entorno' },
  { patron: /\.(dump|bak)$/, motivo: 'volcado o respaldo' },
  { patron: /\.(log)$/, motivo: 'registro de ejecución' },
  { patron: /_dump\.sql(\.gz)?$/, motivo: 'volcado de base de datos' },
  { patron: /^(prod|staging|local)_.*\.sql$/, motivo: 'exportación de entorno' },
  { patron: /(^|\/)scratch|(^|\/)tmp\//, motivo: 'fichero temporal' },
];

/**
 * Contenido que delata un secreto. Cada regla describe QUÉ se encontró, nunca
 * su valor. El objetivo es detectar, no catalogar.
 */
const REGLAS_CONTENIDO = [
  { nombre: 'clave privada', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { nombre: 'token de proveedor', re: /\b(gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|xox[abpr]-[A-Za-z0-9-]{10,})\b/ },
  { nombre: 'JSON Web Token', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  {
    nombre: 'cadena de conexión con credencial',
    re: /\b[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9_.-]+:(?![A-Z_]{4,}[@/])[^@/\s"'`]{8,}@/,
  },
];

const TEXTO = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|sql|ya?ml|env|txt|sh|ps1)$/i;
const LIMITE_BYTES = 2 * 1024 * 1024;

function rastreados() {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 1e8 })
    .split('\n')
    .filter(Boolean);
}

const objetivo = process.argv.slice(2);
const ficheros = objetivo.length
  ? rastreados().filter((f) => objetivo.some((o) => f.startsWith(o)))
  : rastreados();

const hallazgos = [];

for (const f of ficheros) {
  for (const { patron, motivo } of RUTAS_RESERVADAS) {
    if (patron.test(f)) hallazgos.push({ f, categoria: 'RUTA_RESERVADA', motivo });
  }
  for (const { patron, motivo } of FICHEROS_PROHIBIDOS) {
    if (patron.test(f)) hallazgos.push({ f, categoria: 'FICHERO_PROHIBIDO', motivo });
  }
  if (!TEXTO.test(f)) continue;
  try {
    if (statSync(f).size > LIMITE_BYTES) continue;
    const contenido = readFileSync(f, 'utf8');
    for (const { nombre, re } of REGLAS_CONTENIDO) {
      if (re.test(contenido)) hallazgos.push({ f, categoria: 'POSIBLE_SECRETO', motivo: nombre });
    }
  } catch {
    /* ilegible: no es competencia de este chequeo */
  }
}

if (!hallazgos.length) {
  console.log(`✅ Nada que no deba publicarse (${ficheros.length} ficheros rastreados)`);
  process.exit(0);
}

console.error(`❌ ${hallazgos.length} hallazgo(s). No se imprime ningún valor sensible:\n`);
for (const h of hallazgos) {
  console.error(`  ${h.categoria.padEnd(18)} ${h.motivo.padEnd(38)} ${h.f}`);
}
console.error('\nLa documentación interna vive FUERA de este repositorio. Ver docs/CONVENCION_DOCUMENTACION.md');
process.exit(1);
