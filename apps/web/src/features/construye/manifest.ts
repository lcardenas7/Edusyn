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
