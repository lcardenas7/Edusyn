const ALLOWED_TAGS = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'title', 'desc'])
const ALLOWED_ATTRIBUTES = new Set([
  'xmlns', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry',
  'd', 'points', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-opacity', 'opacity', 'transform', 'role', 'aria-label', 'focusable',
])
const FORBIDDEN_SVG = /<\s*\/?\s*(?:script|style|foreignobject|iframe|object|embed|audio|video|image|use|a|animate|set)\b|(?:on[a-z]+|href|xlink:href)\s*=/i
const TAG_PATTERN = /<\s*(\/?)\s*([A-Za-z][\w:-]*)([^>]*)>/g
const ATTRIBUTE_PATTERN = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g

/** F0 permits a deliberately small SVG subset. */
export function sanitizeSvg(svg: string): string {
  const source = svg.trim()
  if (!source.startsWith('<svg') || source.length > 200_000 || FORBIDDEN_SVG.test(source)) {
    throw new Error('El SVG contiene contenido no permitido.')
  }
  let tagCount = 0
  for (const match of source.matchAll(TAG_PATTERN)) {
    tagCount += 1
    const closing = match[1] === '/'
    const tag = match[2].toLowerCase()
    const attributes = match[3] ?? ''
    if (!ALLOWED_TAGS.has(tag)) throw new Error('La etiqueta SVG no está permitida: ' + tag)
    if (closing) {
      if (attributes.trim()) throw new Error('Una etiqueta de cierre SVG no puede tener atributos.')
      continue
    }
    let rest = attributes
    for (const attribute of attributes.matchAll(ATTRIBUTE_PATTERN)) {
      const name = attribute[1]
      const value = attribute[3] ?? attribute[4] ?? ''
      const safeXmlns = name === 'xmlns' && value === 'http://www.w3.org/2000/svg'
      if (!ALLOWED_ATTRIBUTES.has(name) || (!safeXmlns && /(?:javascript:|data:|https?:|\/\/)/i.test(value))) {
        throw new Error('El atributo SVG no está permitido: ' + name)
      }
      rest = rest.replace(attribute[0], '')
    }
    if (rest.replace(/\/\s*$/, '').trim()) throw new Error('El SVG tiene atributos con un formato no permitido.')
  }
  if (!tagCount || !/<\/svg\s*>$/i.test(source)) throw new Error('El SVG no está completo.')
  return source
}
