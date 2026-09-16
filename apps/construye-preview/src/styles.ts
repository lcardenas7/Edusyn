import { parse, generate, type CssNode } from 'css-tree'

/** Una declaración concreta (`background-color: white`) con su posición exacta en el CSS que
 * el estudiante tiene en el editor. `start`/`end` cubren la declaración completa
 * ("background-color: white"); `valueStart`/`valueEnd` cubren SOLO el valor ("white"), para
 * que el Paso 4.3 pueda mostrar "Aquí usa white" sin tener que re-derivarlo del texto — se
 * conserva byte a byte lo que el estudiante escribió (mayúsculas, espacios, todo), nunca una
 * versión normalizada por el navegador. */
export interface CssDeclarationRange {
  property: string
  start: number
  end: number
  valueStart: number
  valueEnd: number
}

export interface CssRuleRange {
  /** Ruta de índices hasta la regla dentro de la hoja: [2] es la tercera regla de primer
   * nivel; [4,1] es la segunda regla dentro de la quinta (una @media). Se usa para encontrar
   * la MISMA regla en el CSSOM del navegador sin depender de contar en plano. */
  path: number[]
  start: number
  end: number
  /** Paso 5.3: rango del BLOQUE `{...}` de la regla, tal como lo reporta el parser — incluye
   * las llaves. Es lo que permite insertar una declaración nueva sin buscar la llave de cierre
   * con indexOf/regex: el punto de inserción sale de la estructura, no del texto. */
  blockStart: number
  blockEnd: number
  selectorText: string
  /** Condición de la @media que la envuelve, o null si la regla es incondicional. */
  mediaText: string | null
  declarations: CssDeclarationRange[]
}

/** Los dos lados escriben el mismo selector de forma distinta: css-tree genera `h1,h2` y el
 * CSSOM devuelve `h1, h2`. Se normaliza el ruido (espacios alrededor de comas, espacios
 * repetidos, mayúsculas) pero NO el espacio entre partes, que en `.card p` es significativo. */
export function normalizeSelector(selector: string): string {
  return selector.replace(/\s*,\s*/g, ',').replace(/\s+/g, ' ').trim().toLowerCase()
}

function isRuleLike(node: CssNode): boolean {
  return node.type === 'Rule' || node.type === 'Atrule'
}

/**
 * Analiza el CSS del estudiante con css-tree conservando posiciones. Nunca lanza: el CSS se
 * parsea mientras se escribe, así que estar a medias es lo normal, no un error. Lo que no se
 * pueda leer con seguridad simplemente no entra en la lista (y el runner responderá
 * "no determinable" en vez de inventar una relación).
 */
export function parseCssRules(css: string): CssRuleRange[] {
  const rules: CssRuleRange[] = []
  let ast: CssNode
  try {
    ast = parse(css, { positions: true, parseValue: false, parseAtrulePrelude: false })
  } catch {
    return rules
  }

  const collect = (children: unknown, mediaText: string | null, prefix: number[]): void => {
    const list = children as { forEach?: (fn: (node: CssNode) => void) => void } | undefined
    if (!list || typeof list.forEach !== 'function') return
    let index = 0
    list.forEach((node) => {
      if (!isRuleLike(node)) return
      const position = [...prefix, index]
      index += 1

      if (node.type === 'Rule') {
        const loc = node.loc
        if (!loc) return
        const declarations: CssDeclarationRange[] = []
        const block = node.block as { children?: { forEach?: (fn: (n: CssNode) => void) => void } } | undefined
        block?.children?.forEach?.((child) => {
          if (child.type === 'Declaration' && child.loc) {
            // Con parseValue:false el valor queda como nodo Raw, pero conserva su propia
            // ubicación exacta en el texto original — verificado: "12PX" o espacios extra
            // llegan intactos, css-tree nunca los reformatea.
            const valueLoc = (child.value as { loc?: { start: { offset: number }; end: { offset: number } } } | undefined)?.loc
            declarations.push({
              property: child.property,
              start: child.loc.start.offset,
              end: child.loc.end.offset,
              valueStart: valueLoc?.start.offset ?? child.loc.end.offset,
              valueEnd: valueLoc?.end.offset ?? child.loc.end.offset,
            })
          }
        })
        const blockLoc = (node.block as { loc?: { start: { offset: number }; end: { offset: number } } } | undefined)?.loc
        rules.push({
          path: position,
          start: loc.start.offset,
          end: loc.end.offset,
          blockStart: blockLoc?.start.offset ?? loc.start.offset,
          blockEnd: blockLoc?.end.offset ?? loc.end.offset,
          selectorText: normalizeSelector(generate(node.prelude)),
          mediaText,
          declarations,
        })
        return
      }

      // Solo se entra en @media: es la única at-rule cuyo contenido son reglas que el
      // estudiante puede señalar y cuya condición sabemos evaluar con matchMedia. El resto
      // (@keyframes, @supports…) ocupa su lugar en el índice pero no se explora.
      if (node.name === 'media') {
        const condition = node.prelude ? generate(node.prelude) : ''
        const block = node.block as { children?: unknown } | undefined
        collect(block?.children, condition.trim(), position)
      }
    })
  }

  collect((ast as { children?: unknown }).children, null, [])
  return rules
}

export interface CssMatchResult {
  /** 'exact': encontramos la regla en el CSS y la MISMA regla en el navegador, verificada por
   * selector. 'none': no determinable — el cursor no está en una regla, o lo que el navegador
   * tiene en esa posición no coincide con lo que leímos del texto. Nunca se rellena a ojo. */
  status: 'exact' | 'none'
  matchedCount: number
  elements: HTMLElement[]
  selector?: string
  /** Propiedad concreta bajo el cursor (se conserva para 4.3; 4.1 no la explica todavía). */
  property?: string
  mediaText?: string
  /** undefined cuando la regla no está dentro de una @media, o cuando el entorno no puede
   * evaluarla (jsdom no implementa matchMedia; eso se verifica en navegador real). */
  mediaActive?: boolean
}

const NO_MATCH: CssMatchResult = { status: 'none', matchedCount: 0, elements: [] }

/**
 * Puente AST ⇄ CSSOM. Navega hasta la MISMA regla por su ruta de índices y solo la acepta si
 * el selector que el navegador reporta coincide con el que leímos del texto del estudiante.
 * Si no coinciden (CSS que el navegador descartó, escapes, recuperación distinta del parser…)
 * devuelve "no determinable": preferimos perder una relación antes que mostrar una falsa.
 */
export function resolveCssRuleInDocument(root: Document, hit: CssPositionHit): CssMatchResult {
  let rules: CSSRuleList | undefined
  try {
    rules = root.styleSheets[0]?.cssRules
  } catch {
    return NO_MATCH
  }

  let current: CSSRule | undefined
  for (const index of hit.rule.path) {
    current = rules?.[index]
    if (!current) return NO_MATCH
    rules = (current as CSSGroupingRule).cssRules
  }

  const styleRule = current as CSSStyleRule | undefined
  if (!styleRule || typeof styleRule.selectorText !== 'string') return NO_MATCH
  if (normalizeSelector(styleRule.selectorText) !== hit.rule.selectorText) return NO_MATCH

  let elements: HTMLElement[] = []
  try {
    elements = Array.from(root.querySelectorAll(styleRule.selectorText)) as HTMLElement[]
  } catch {
    return NO_MATCH
  }

  const parent = styleRule.parentRule as CSSMediaRule | null
  const mediaText = parent && typeof parent.media?.mediaText === 'string' ? parent.media.mediaText : undefined
  const matchMedia = root.defaultView?.matchMedia
  const mediaActive = mediaText && typeof matchMedia === 'function'
    ? matchMedia.call(root.defaultView, mediaText).matches
    : undefined

  return {
    status: 'exact',
    matchedCount: elements.length,
    elements,
    selector: styleRule.selectorText,
    property: hit.declaration?.property,
    mediaText,
    mediaActive,
  }
}

export interface CssPositionHit {
  rule: CssRuleRange
  /** La declaración concreta bajo el cursor, si el cursor está dentro de una. */
  declaration: CssDeclarationRange | null
}

/** Resultado de evaluar un rango de CSS contra el CSSOM real, en un solo lugar (Paso 4.4).
 * Mismo contenido que ya viajaba en `css-position-status`, pero como valor de retorno puro —
 * sin `send` ni resaltado — para poder repetir EXACTAMENTE el mismo cálculo cuando cambia el
 * viewport, sin volver a analizar el CSS ni tocar el DOM de otra forma. */
export interface CssPositionEvaluation {
  status: 'exact' | 'none'
  matchedCount: number
  elements: HTMLElement[]
  selector?: string
  property?: string
  value?: string
  /** Paso 5.0: posición EXACTA del valor dentro del CSS aplicado. El host la necesita para
   * poder reemplazar solo ese tramo al editar — nunca para buscar el valor por texto. Van
   * juntas con `value`: quien edite debe comprobar que el texto en ese rango sigue siendo
   * exactamente `value` antes de escribir (ver `cssEdits.ts` en el host). */
  valueStart?: number
  valueEnd?: number
  mediaText?: string
  mediaActive?: boolean
}

const NO_POSITION: CssPositionEvaluation = { status: 'none', matchedCount: 0, elements: [] }

/**
 * Localiza la regla/declaración que contiene `range` y la resuelve contra el documento real —
 * exactamente lo que el runner necesitaba inline para responder a `highlight-code-position`
 * (Paso 4.1/4.3). Paso 4.4 la extrae como función pura para reutilizarla, sin cambios, cuando
 * cambia el viewport: reevaluar es llamar otra vez a esta misma función con el mismo `range`,
 * nunca volver a parsear `rules` ni reinstrumentar nada. `css` es el texto APLICADO (el que
 * ya usó `parseCssRules` para producir `rules`), para recortar el valor exacto de la
 * declaración (Paso 4.3) byte a byte, sin volver a analizarlo.
 */
export function evaluateCssPosition(root: Document, rules: CssRuleRange[], css: string, range: { start: number; end: number }): CssPositionEvaluation {
  const hit = findCssRuleAtOffset(rules, range.start, range.end)
  if (!hit) return NO_POSITION
  const match = resolveCssRuleInDocument(root, hit)
  if (match.status !== 'exact') return NO_POSITION
  const value = hit.declaration ? css.slice(hit.declaration.valueStart, hit.declaration.valueEnd) : undefined
  return {
    status: 'exact',
    matchedCount: match.matchedCount,
    elements: match.elements,
    selector: match.selector,
    property: match.property,
    value,
    valueStart: hit.declaration?.valueStart,
    valueEnd: hit.declaration?.valueEnd,
    mediaText: match.mediaText,
    mediaActive: match.mediaActive,
  }
}

/** Qué regla (y, si aplica, qué declaración) contiene la selección del editor. Igual que en
 * HTML, es aritmética de offsets: sin adivinar por texto ni por parecido. */
export function findCssRuleAtOffset(rules: CssRuleRange[], start: number, end: number): CssPositionHit | null {
  let best: CssRuleRange | null = null
  for (const rule of rules) {
    if (rule.start <= start && end <= rule.end) {
      if (!best || rule.end - rule.start < best.end - best.start) best = rule
    }
  }
  if (!best) return null
  const declaration = best.declarations.find((d) => d.start <= start && end <= d.end) ?? null
  return { rule: best, declaration }
}

/** Preview → CSS (Paso 4.2): una regla del CSS aplicado, demostrablemente relacionada con un
 * elemento del preview. */
export interface CssRelatedDeclaration {
  property: string
  /** El valor tal como está ESCRITO en el archivo, y su rango exacto. Es lo que el host
   * necesita para poder ofrecer (y luego ejecutar) una modificación sin buscar nada por texto. */
  value: string
  valueStart: number
  valueEnd: number
  /** Paso 5.3: rango de la declaración COMPLETA (`color:#000`, sin el `;`). El host lo usa para
   * saber dónde termina la última declaración y poder insertar otra a continuación. */
  start: number
  end: number
}

export interface CssRelatedRule {
  selector: string
  start: number
  end: number
  /** Paso 5.3: rango estructural del bloque, para poder insertar una declaración nueva. */
  blockStart: number
  blockEnd: number
  mediaText?: string
  mediaActive?: boolean
  /** Paso 5.2: cuántos elementos coinciden con esta regla — el mismo conteo demostrable del
   * Paso 4.1, para poder advertir "esto afectará a 4 elementos" antes de confirmar. */
  matchedCount: number
  /** Paso 5.2: solo las declaraciones de propiedades que el host sabe editar hoy. Se filtran
   * aquí para que el mensaje no crezca con hojas de estilo grandes; la autoridad sobre qué es
   * editable de verdad sigue siendo `cssEdits.ts` en el host, que revalida todo por su cuenta. */
  declarations: CssRelatedDeclaration[]
  /** Paso 5.3: cuántas declaraciones tiene la regla EN TOTAL (no solo las certificadas) y dónde
   * termina la última. Sin esto, insertar "después de la última declaración" se calcularía
   * sobre la lista filtrada y podría caer en medio de la regla. `lastDeclarationEnd` es
   * `undefined` en una regla vacía. */
  declarationTotal: number
  lastDeclarationEnd?: number
}

/** Espejo de la lista certificada del host (`EDITABLE_CSS_PROPERTIES` en cssEdits.ts). Aquí
 * solo sirve para no enviar declaraciones que nadie podría editar: si las dos listas se
 * desajustaran, el host simplemente no ofrecería la capacidad — nunca al revés. */
const CAPABILITY_PROPERTIES = new Set(['background-color', 'color', 'font-size', 'border-radius'])

/** Cuántas reglas relacionadas se envían al host como máximo — protege el tamaño del mensaje
 * ante una hoja de estilos patológicamente grande. El conteo REAL (sin recortar) lo calcula
 * quien llama a esta función contando `findCssRulesForElement(...).length` antes de recortar;
 * nunca se le muestra al estudiante un total falso. */
export const MAX_RELATED_CSS_RULES = 40

/**
 * Preview → CSS: qué reglas del CSS aplicado coinciden DEMOSTRABLEMENTE con `element`, en el
 * orden en que aparecen en el archivo — nunca se ordena por una "importancia" que no podemos
 * demostrar (ni cascada, ni especificidad, ni !important). "Coincide" es exactamente
 * `element.matches(selectorText)` sobre el selector que el propio navegador reporta para esa
 * regla, así que selectores múltiples (`h1, h2`) y descendientes (`.card p`) se resuelven
 * correctamente sin lógica propia: matches() ya entiende ambos casos, incluida la ascendencia
 * real del DOM (un `.card p` NUNCA coincide con el propio `.card`). Por la misma razón, una
 * regla de herencia (`body { color: black }`) nunca aparece para un `<p>` que no la selecciona
 * directamente — 4.2 no resuelve herencia, solo relación directa por selector.
 *
 * Reutiliza `resolveCssRuleInDocument` para conservar la misma protección AST⇄CSSOM del Paso
 * 4.1: si una regla no puede verificarse con seguridad contra el CSSOM real, se omite en
 * silencio — nunca se muestra una regla vecina como si fuera la correcta.
 *
 * No exige que `element` tenga un rango HTML fuente: un nodo creado por el propio JavaScript
 * del estudiante no tiene `data-edusyn-id`, pero si su clase coincide con una regla real, esa
 * relación CSS sigue siendo demostrable y se reporta igual — Preview → HTML y Preview → CSS
 * son, deliberadamente, dos preguntas independientes sobre el mismo clic.
 */
export function findCssRulesForElement(root: Document, rules: CssRuleRange[], element: Element, css = ''): CssRelatedRule[] {
  const related: CssRelatedRule[] = []
  for (const rule of rules) {
    const match = resolveCssRuleInDocument(root, { rule, declaration: null })
    if (match.status !== 'exact' || !match.selector) continue
    let matches = false
    try {
      matches = element.matches(match.selector)
    } catch {
      matches = false
    }
    if (!matches) continue
    const declarations = rule.declarations
      .filter((declaration) => CAPABILITY_PROPERTIES.has(declaration.property.toLowerCase()))
      .map((declaration) => ({
        property: declaration.property,
        value: css.slice(declaration.valueStart, declaration.valueEnd),
        valueStart: declaration.valueStart,
        valueEnd: declaration.valueEnd,
        start: declaration.start,
        end: declaration.end,
      }))
    related.push({
      selector: match.selector,
      start: rule.start,
      end: rule.end,
      blockStart: rule.blockStart,
      blockEnd: rule.blockEnd,
      declarationTotal: rule.declarations.length,
      lastDeclarationEnd: rule.declarations.length > 0 ? Math.max(...rule.declarations.map((d) => d.end)) : undefined,
      mediaText: match.mediaText,
      mediaActive: match.mediaActive,
      matchedCount: match.matchedCount,
      declarations,
    })
  }
  return related
}
