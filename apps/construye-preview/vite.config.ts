import { defineConfig, type Plugin } from 'vite'
import { buildSync } from 'esbuild'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

// DESCUBIERTO 2026-09-14 verificando en un iframe real (no solo navegación directa): un
// <script src="..."> externo NUNCA se ejecuta dentro de un iframe sandbox="allow-scripts"
// SIN allow-same-origin (el modo real de producción), porque ese documento tiene origen
// opaco y Chrome no aplica el allowlist de script-src a recursos externos ahí — ni con
// 'self' ni con el origen explícito (ambos probados y descartados). Solo un <script> inline
// se ejecuta (probado con 'unsafe-inline'). Por eso el runner se compila con esbuild y se
// incrusta como texto plano en el HTML, en vez de cargarse con <script type="module" src>;
// esto es necesario en dev, build y cualquier hosting real, no solo una mejora de rendimiento.
// Coincide con nuestro propio <script> tanto en dev (Vite lo sirve tal cual, como
// /src/main.ts) como en build (Vite ya lo reescribió a /assets/<hash>.js antes de que este
// hook corra) — nunca con el /@vite/client que Vite inyecta aparte solo en dev.
const OWN_SCRIPT_TAG = /<script type="module"[^>]*\ssrc="(?:\/src\/main\.ts|\/assets\/[^"]+\.js)"[^>]*>\s*<\/script>/

function inlineRunnerPlugin(): Plugin {
  return {
    name: 'inline-runner-script',
    // 'post': en build, Vite reescribe el src de nuestro <script> al chunk final ANTES de
    // que corran los hooks sin orden explícito — sin 'post' este reemplazo nunca encontraba
    // el tag y el build quedaba, otra vez, sirviendo un <script src> externo (el mismo bug
    // de CSP que esto existe para evitar). Descubierto revisando el tamaño del bundle, no
    // asumido: `dist/index.html` seguía appuntando a un archivo externo hasta este cambio.
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!OWN_SCRIPT_TAG.test(html)) return html
        const result = buildSync({
          entryPoints: [rootDir + 'src/main.ts'],
          bundle: true,
          write: false,
          format: 'iife',
          target: 'es2018',
          platform: 'browser',
          logLevel: 'silent',
        })
        // Defensa: dentro de un <script> inline, tres secuencias cambian el estado del parser
        // HTML y corrompen el bundle entero. "</script" lo cierra antes de tiempo; "<!--" y
        // "-->" lo meten en "script data escaped".
        //
        // DESCUBIERTO en el Paso 4.1: css-tree implementa los tokens CDO/CDC de CSS, que son
        // literalmente "<!--" y "-->", así que al incluirlo el runner dejó de ejecutarse por
        // completo — sin error en consola, simplemente ningún listener quedaba registrado.
        // La barra invertida desaparece al evaluar el literal de cadena, así que el valor en
        // tiempo de ejecución es idéntico: css-tree sigue reconociendo esos tokens.
        const code = result.outputFiles[0].text
          .replace(/<\/script/gi, '<\\/script')
          .replace(/<!--/g, '<\\!--')
          .replace(/-->/g, '--\\>')
        // La forma de FUNCIÓN es obligatoria: con una cadena de reemplazo, String.replace
        // interpreta $&, $', $` y $1 como patrones. El bundle contiene "$'" (la gramática CSS
        // de css-tree lo usa en attr-matcher), así que la versión con cadena truncaba el
        // script justo ahí e insertaba el resto del HTML en su lugar — el runner quedaba a
        // medias y no registraba ningún listener. DESCUBIERTO en el Paso 4.1.
        return html.replace(OWN_SCRIPT_TAG, () => '<script>' + code + '</script>')
      },
    },
  }
}

/**
 * Cabeceras de seguridad del origen aislado. Se definen UNA vez y se usan en los tres sitios
 * donde el runner puede servirse: `vite dev`, `vite preview` y el build estático que despliega
 * el hosting real (a través del `serve.json` que emite `emitServeConfigPlugin`).
 *
 * Antes solo existían en `server`/`preview` de este archivo, así que un build servido por otro
 * origen se quedaba SIN CSP y nadie se enteraba: el sandbox del iframe seguía puesto, pero la
 * segunda barrera (sin red, sin recursos externos) desaparecía en silencio. Ese hueco está
 * anotado como pendiente en `docs/REGISTRO_DESPLIEGUES.md` (2026-09-13, punto 3).
 */
const securityHeaders: Record<string, string> = {
  'Content-Security-Policy': '',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Referrer-Policy': 'no-referrer',
}

/** Emite `serve.json` junto al build para que un servidor estático (`npx serve dist`, el mismo
 * patrón que ya usa `apps/web`) devuelva exactamente las mismas cabeceras que `vite dev`. Se
 * genera desde la misma constante: no hay una segunda copia de la CSP que pueda quedar vieja. */
function emitServeConfigPlugin(): Plugin {
  return {
    name: 'emit-serve-config',
    apply: 'build',
    generateBundle() {
      const headers = Object.entries(securityHeaders).map(([key, value]) => ({ key, value }))
      this.emitFile({
        type: 'asset',
        fileName: 'serve.json',
        // `**` cubre la raíz (`/` → index.html) y `**/*` el resto de archivos emitidos.
        source: JSON.stringify({ headers: [{ source: '**', headers }, { source: '**/*', headers }] }, null, 2),
      })
    },
  }
}

const previewCsp = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data: blob:",
  "font-src 'none'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

securityHeaders['Content-Security-Policy'] = previewCsp

export default defineConfig({
  plugins: [inlineRunnerPlugin(), emitServeConfigPlugin()],
  server: { port: 5174, headers: securityHeaders },
  preview: { port: 5174, headers: securityHeaders },
})
