import type { ConstruyeFilePath, ConstruyeManifest } from '../../lib/api/construye'
import type { PreviewProject } from './protocol'

/** Espejo del límite por archivo de ConstruyeService (apps/api). Se repite aquí solo
 * para dar retroalimentación inmediata sin esperar la respuesta del servidor; el
 * servidor sigue siendo la única fuente de verdad que valida antes de persistir. */
export const MAX_CONSTRUYE_FILE_BYTES = 250_000

export function projectToManifest(project: PreviewProject): ConstruyeManifest {
  return {
    files: [
      { path: 'index.html', content: project.html },
      { path: 'styles.css', content: project.css },
      { path: 'app.js', content: project.js },
    ],
  }
}

export function manifestToProject(manifest: ConstruyeManifest): PreviewProject {
  const byPath = new Map(manifest.files.map((file) => [file.path, file.content]))
  return {
    html: byPath.get('index.html') || '',
    css: byPath.get('styles.css') || '',
    js: byPath.get('app.js') || '',
  }
}

/** Archivos que superarían el límite del servidor si se intentara guardar esta versión. */
export function oversizedFiles(project: PreviewProject): ConstruyeFilePath[] {
  return projectToManifest(project).files
    .filter((file) => new TextEncoder().encode(file.content).byteLength > MAX_CONSTRUYE_FILE_BYTES)
    .map((file) => file.path)
}

/** Plantilla de partida de una aplicación para celular: barra superior, pantallas que se
 * cambian con un menú inferior y un dato que se recuerda (localStorage). Es pequeña a
 * propósito: se lee de un vistazo y se reemplaza por lo que el equipo diseñe. */
export const APP_STARTER: PreviewProject = {
  html: `<header class="barra">
  <h1>Mi app</h1>
</header>

<main>
  <section class="pantalla activa" id="inicio">
    <h2>Inicio</h2>
    <p>Escribe aquí para qué sirve tu app.</p>
    <button id="sumar">Sumar un punto</button>
    <p>Puntos: <strong id="puntos">0</strong></p>
  </section>

  <section class="pantalla" id="acerca">
    <h2>Acerca de</h2>
    <p>Quiénes hicimos esta app y a quién ayuda.</p>
  </section>
</main>

<nav class="menu">
  <button data-ir="inicio" class="activo">Inicio</button>
  <button data-ir="acerca">Acerca de</button>
</nav>`,
  css: `* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; font-size: 16px; background: #f1f5f9; color: #0f172a; min-height: 100vh; }
.barra { position: sticky; top: 0; padding: 14px 16px; background: #4f46e5; color: white; }
.barra h1 { margin: 0; font-size: 20px; }
main { padding: 16px 16px 90px; }
.pantalla { display: none; }
.pantalla.activa { display: block; }
h2 { font-size: 18px; margin: 0 0 8px; }
button { font: inherit; }
#sumar { width: 100%; padding: 14px; border: 0; border-radius: 12px; background: #4f46e5; color: white; font-weight: 600; }
.menu { position: fixed; left: 0; right: 0; bottom: 0; display: flex; background: white; border-top: 1px solid #e2e8f0; }
.menu button { flex: 1; padding: 14px 8px; border: 0; background: none; color: #64748b; }
.menu button.activo { color: #4f46e5; font-weight: 700; }`,
  js: `// Cambiar de pantalla con el menú inferior.
document.querySelectorAll(".menu button").forEach(boton => {
  boton.addEventListener("click", () => {
    document.querySelectorAll(".pantalla").forEach(p => p.classList.remove("activa"))
    document.querySelectorAll(".menu button").forEach(b => b.classList.remove("activo"))
    document.getElementById(boton.dataset.ir).classList.add("activa")
    boton.classList.add("activo")
  })
})

// La app recuerda los puntos aunque se cierre (localStorage).
let puntos = Number(localStorage.getItem("puntos") || 0)
document.getElementById("puntos").textContent = puntos
document.getElementById("sumar").addEventListener("click", () => {
  puntos = puntos + 1
  localStorage.setItem("puntos", puntos)
  document.getElementById("puntos").textContent = puntos
})`,
}

const escapeClose = (text: string, tag: 'script' | 'style') => text.replace(new RegExp('</(' + tag + ')', 'gi'), '<\/$1')
const escapeHtml = (text: string) => text.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!)

/** Un solo archivo .html con los tres archivos dentro: se abre con doble clic en un
 * computador o se comparte al celular sin instalar nada. */
export function projectToStandaloneHtml(project: PreviewProject, title: string): string {
  return [
    '<!doctype html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="theme-color" content="#4f46e5">',
    `<title>${escapeHtml(title.trim() || 'Mi proyecto')}</title>`,
    `<style>\n${escapeClose(project.css, 'style')}\n</style>`,
    '</head>',
    '<body>',
    project.html,
    `<script>\n${escapeClose(project.js, 'script')}\n</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

/** Nombre de archivo seguro a partir del título: "App de reciclaje" → "app-de-reciclaje.html". */
export function downloadFileName(title: string): string {
  const slug = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `${slug || 'mi-proyecto'}.html`
}
