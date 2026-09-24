import { defaultTreeAdapter, parseFragment, type DefaultTreeAdapterTypes } from 'parse5'

/**
 * El taller ya inyecta styles.css y app.js desde las otras dos pestañas. Algunos
 * proyectos antiguos traen además sus etiquetas <link>/<script> en index.html;
 * dentro del preview aislado esas rutas no existen y producen una falsa alerta.
 * Quitamos solo esas etiquetas del HTML renderizado, nunca del archivo del alumno.
 */
export function removeInlinedAssetReferences(html: string): string {
  const fragment = parseFragment(html, { sourceCodeLocationInfo: true })
  const removals: Array<{ start: number; end: number }> = []

  const walk = (node: DefaultTreeAdapterTypes.ChildNode): void => {
    if (!defaultTreeAdapter.isElementNode(node)) return
    const attr = (name: string) => node.attrs.find((item) => item.name === name)?.value.trim() ?? ''
    const isInlinedCss = node.tagName === 'link'
      && attr('rel').toLowerCase().split(/\s+/).includes('stylesheet')
      && /^(?:\.\/)?styles\.css(?:[?#].*)?$/i.test(attr('href'))
    const isInlinedJs = node.tagName === 'script'
      && /^(?:\.\/)?app\.js(?:[?#].*)?$/i.test(attr('src'))
    if ((isInlinedCss || isInlinedJs) && node.sourceCodeLocation) {
      removals.push({ start: node.sourceCodeLocation.startOffset, end: node.sourceCodeLocation.endOffset })
      return
    }
    node.childNodes.forEach(walk)
  }
  fragment.childNodes.forEach(walk)

  for (const { start, end } of removals.sort((a, b) => b.start - a.start)) {
    html = html.slice(0, start) + html.slice(end)
  }
  return html
}
