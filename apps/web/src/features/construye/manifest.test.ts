import { describe, expect, it } from 'vitest'
import { manifestToProject, oversizedFiles, projectToManifest } from './manifest'
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
