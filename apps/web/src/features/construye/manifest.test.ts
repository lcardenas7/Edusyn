import { describe, expect, it } from 'vitest'
import { APP_STARTER, downloadFileName, manifestToProject, oversizedFiles, projectToManifest, projectToStandaloneHtml } from './manifest'
import type { PreviewProject } from './protocol'

const project: PreviewProject = { html: '<main>ok</main>', css: 'main{color:teal}', js: 'console.log(1)' }

describe('projectToManifest / manifestToProject', () => {
  it('maps html/css/js to the file paths the API expects', () => {
    const manifest = projectToManifest(project)
    expect(manifest.files).toEqual([
      { path: 'index.html', content: project.html },
      { path: 'styles.css', content: project.css },
      { path: 'app.js', content: project.js },
    ])
  })

  it('round-trips back to the same project', () => {
    expect(manifestToProject(projectToManifest(project))).toEqual(project)
  })

  it('fills missing files with empty strings instead of throwing', () => {
    expect(manifestToProject({ files: [{ path: 'index.html', content: '<main/>' }] }))
      .toEqual({ html: '<main/>', css: '', js: '' })
  })
})

describe('oversizedFiles', () => {
  it('reports no files when everything fits the server limit', () => {
    expect(oversizedFiles(project)).toEqual([])
  })

  it('flags exactly the files that would be rejected by the server', () => {
    const huge = 'x'.repeat(300_000)
    expect(oversizedFiles({ ...project, js: huge })).toEqual(['app.js'])
    expect(oversizedFiles({ html: huge, css: huge, js: huge })).toEqual(['index.html', 'styles.css', 'app.js'])
  })
})


describe('descarga del proyecto como un solo archivo', () => {
  it('mete los tres archivos en un html que se abre solo', () => {
    const html = projectToStandaloneHtml({ html: '<h1>Hola</h1>', css: 'h1{color:red}', js: 'console.log(1)' }, 'Mi app')
    expect(html).toMatch(/^<!doctype html>/)
    expect(html).toContain('<meta name="viewport"')
    expect(html).toContain('<title>Mi app</title>')
    expect(html).toContain('h1{color:red}')
    expect(html).toContain('<h1>Hola</h1>')
    expect(html).toContain('console.log(1)')
  })

  it('no deja que el código cierre antes de tiempo su etiqueta ni que el título inyecte marcado', () => {
    const html = projectToStandaloneHtml({ html: '', css: 'a{} </style><b>', js: 'const s = "</script>"' }, '<b>x</b>')
    expect(html).toContain('<\/style><b>')
    expect(html).toContain('"<\/script>"')
    expect(html).toContain('<title>&lt;b&gt;x&lt;/b&gt;</title>')
  })

  it('nombra el archivo a partir del título', () => {
    expect(downloadFileName('App de Reciclaje ♻ 2026')).toBe('app-de-reciclaje-2026.html')
    expect(downloadFileName('Canción')).toBe('cancion.html')
    expect(downloadFileName('  ')).toBe('mi-proyecto.html')
  })

  it('la plantilla de app trae pantallas con menú inferior y un dato que se recuerda', () => {
    expect(APP_STARTER.html).toContain('class="menu"')
    expect(APP_STARTER.js).toContain('localStorage')
  })
})
