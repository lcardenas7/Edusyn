import { describe, expect, it } from 'vitest'
import { removeInlinedAssetReferences } from './virtualAssets'

describe('referencias a archivos ya inyectados en el preview', () => {
  it('quita solo las etiquetas duplicadas sin cambiar el código fuente persistido', () => {
    const html = '<!doctype html><html><head><link rel="stylesheet" href="./styles.css"></head><body><h1>Agenda</h1><script src="app.js"></script></body></html>'
    const result = removeInlinedAssetReferences(html)
    expect(result).toContain('<h1>Agenda</h1>')
    expect(result).not.toContain('<link')
    expect(result).not.toContain('<script')
    expect(html).toContain('styles.css')
  })

  it('conserva recursos realmente externos para que su fallo siga siendo visible', () => {
    const html = '<link rel="stylesheet" href="other.css"><script src="library.js"></script><img src="missing.png"><script>const text = "<link href=styles.css>"</script>'
    expect(removeInlinedAssetReferences(html)).toBe(html)
  })
})
