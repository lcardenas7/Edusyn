import { describeCssRuleAvailability } from './explanations'

/**
 * "¿Qué significa este código?" (Paso 4.3) — explicación determinística, sin IA, de una
 * DECLARACIÓN CSS concreta (propiedad + valor), en lenguaje de estudiante. Complementa a
 * `explanations.ts`: aquella responde "¿qué es esto?" para una etiqueta HTML; este archivo
 * responde "¿qué hace este código?" para una línea de CSS.
 *
 * Regla dura, igual que en todo Construye: nunca afirmar más de lo que es demostrable.
 * - La frase describe lo que la PROPIEDAD hace, nunca el resultado visual final ("esto pone
 *   azul la tarjeta" sería inventar, porque no resolvemos cascada/especificidad/herencia).
 * - Si la propiedad no está en el diccionario, o el valor no permite una frase segura,
 *   la función devuelve `null` — la ausencia de explicación es preferible a una dudosa.
 */

export interface CssDeclarationExplanationContext {
  /** Elementos que coinciden con el selector de la regla (Paso 4.1) — no específicamente con
   * esta declaración, pero es la mejor cota demostrable que tenemos. */
  matchedCount?: number
  mediaText?: string
  mediaActive?: boolean
  viewportLabel: string
}

export interface CssDeclarationExplanation {
  sentence: string
  /** Valor CSS válido para pintar una muestra de color informativa (nunca editable — eso es
   * un paso posterior). Solo presente cuando el valor es un color reconocible. */
  colorSwatch?: string
}

// --- Clasificación de valores -------------------------------------------------------------

/** Nombres de color CSS más comunes, traducidos. Deliberadamente NO es la lista completa de
 * ~150 colores con nombre de CSS — cubre los que un estudiante escribiría primero. Un color
 * fuera de esta lista (o un hex/rgb/hsl) se sigue reconociendo y mostrando, solo que sin
 * traducir: mejor mostrar el valor tal cual que inventar una traducción. */
const NAMED_COLOR_TRANSLATIONS: Record<string, string> = {
  red: 'rojo', blue: 'azul', green: 'verde', yellow: 'amarillo', black: 'negro', white: 'blanco',
  gray: 'gris', grey: 'gris', orange: 'naranja', purple: 'morado', pink: 'rosado', brown: 'café',
  navy: 'azul marino', teal: 'verde azulado', cyan: 'cian', magenta: 'magenta', lime: 'verde lima',
  maroon: 'granate', olive: 'oliva', silver: 'plateado', gold: 'dorado', indigo: 'índigo',
  violet: 'violeta', coral: 'coral', salmon: 'salmón', turquoise: 'turquesa', beige: 'beige',
  transparent: 'transparente',
}

interface ColorValue { displayValue: string; swatch: string }

/** Reconoce un valor de color simple: nombre, hex, rgb()/rgba(), hsl()/hsla(). Cualquier otra
 * cosa (var(), calc(), múltiples tokens, gradientes) NO es un color simple — se trata como
 * "valor avanzado" en vez de arriesgar una lectura incorrecta. */
function classifyColorValue(value: string): ColorValue | null {
  const v = value.trim()
  if (!v || /\s/.test(v)) return null
  if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return { displayValue: v, swatch: v }
  if (/^(rgb|rgba|hsl|hsla)\(.+\)$/i.test(v)) return { displayValue: v, swatch: v }
  if (/^[a-z]+$/i.test(v)) return { displayValue: NAMED_COLOR_TRANSLATIONS[v.toLowerCase()] ?? v, swatch: v }
  return null
}

type CssValueKind = 'simple' | 'complex'
interface ClassifiedValue { kind: CssValueKind; formatted: string }

const LENGTH_TOKEN = /^(-?\d+(?:\.\d+)?)(px|rem|em|vw|vh)$/
const SIMPLE_TOKEN = /^(-?\d+(?:\.\d+)?(px|rem|em|vw|vh|%)?|[a-zA-Z-]+)$/

function formatLengthToken(token: string): string {
  const m = token.match(LENGTH_TOKEN)
  return m ? `${m[1]} ${m[2]}` : token
}

/** "Simple" = uno o más tokens separados por espacios, cada uno un número con unidad conocida
 * (o sin unidad), un porcentaje, o una palabra clave — sin paréntesis, sin `var()`/`calc()`.
 * Un shorthand como "10px 20px" es simple (se muestra completo, sin descomponer en
 * arriba/derecha/abajo/izquierda: eso exigiría saber CUÁNTOS valores tiene cada shorthand,
 * que es la profundidad que este paso explícitamente pospone). */
function classifyCssValue(value: string): ClassifiedValue {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('(')) return { kind: 'complex', formatted: trimmed }
  const tokens = trimmed.split(/\s+/)
  if (!tokens.every((t) => SIMPLE_TOKEN.test(t))) return { kind: 'complex', formatted: trimmed }
  return { kind: 'simple', formatted: tokens.map(formatLengthToken).join(' ') }
}

// --- Composición de la frase ---------------------------------------------------------------

/** Umbral puramente de redacción: con pocos elementos, decir el número ayuda ("4 elementos
 * relacionados"); con muchos, decirlo suena raro y no aporta ("37 elementos relacionados") —
 * se prefiere "los elementos relacionados" sin número. No cambia ningún dato, solo la frase. */
const MANY_ELEMENTS_THRESHOLD = 10

function describeAffectedElements(matchedCount: number): string {
  if (matchedCount === 1) return 'Afecta a este elemento.'
  if (matchedCount <= MANY_ELEMENTS_THRESHOLD) return `Afecta a ${matchedCount} elementos relacionados.`
  return 'Afecta a los elementos relacionados.'
}

const ADVANCED_VALUE = 'Aquí utiliza un valor más avanzado.'

function simpleValueSentence(purpose: string, value: string): string {
  const classified = classifyCssValue(value)
  return classified.kind === 'complex' ? `${purpose} ${ADVANCED_VALUE}` : `${purpose} Aquí usa ${classified.formatted}.`
}

function colorPropertySentence(purpose: string, value: string): CssDeclarationExplanation {
  const color = classifyColorValue(value)
  if (!color) return { sentence: `${purpose} ${ADVANCED_VALUE}` }
  return { sentence: `${purpose} Aquí está usando ${color.displayValue}.`, colorSwatch: color.swatch }
}

function explainBackgroundShorthand(value: string): CssDeclarationExplanation {
  const color = classifyColorValue(value)
  if (color) return { sentence: `Cambia el color de fondo. Aquí está usando ${color.displayValue}.`, colorSwatch: color.swatch }
  return { sentence: `Esta propiedad controla el fondo. ${ADVANCED_VALUE}` }
}

function explainFontWeight(value: string): string | null {
  const v = value.trim().toLowerCase()
  if (v === 'bold' || v === 'bolder') return 'Hace que el texto se vea más grueso.'
  if (v === 'normal') return 'Hace que el texto tenga su grosor normal.'
  if (v === 'lighter') return 'Hace que el texto se vea más delgado.'
  const n = Number(v)
  if (Number.isInteger(n) && n >= 100 && n <= 900 && n % 100 === 0) {
    if (n >= 600) return 'Hace que el texto se vea más grueso.'
    if (n <= 300) return 'Hace que el texto se vea más delgado.'
    return `Cambia el grosor del texto. Aquí usa ${n}.`
  }
  return null
}

function explainTextAlign(value: string): string | null {
  switch (value.trim().toLowerCase()) {
    case 'center': return 'Centra el texto horizontalmente.'
    case 'left': return 'Alinea el texto a la izquierda.'
    case 'right': return 'Alinea el texto a la derecha.'
    case 'justify': return 'Justifica el texto, estirando las líneas para llenar el ancho disponible.'
    default: return null
  }
}

function explainMaxWidth(value: string): string {
  const classified = classifyCssValue(value)
  return classified.kind === 'complex'
    ? `Limita el ancho máximo del elemento. ${ADVANCED_VALUE}`
    : `Limita el ancho máximo del elemento a ${classified.formatted}.`
}

/** `display: none` es la propiedad donde más se nota lo responsive: compone su propia frase
 * con el estado de la media query en vez de la composición genérica de abajo — es exactamente
 * el ejemplo pedagógico pedido ("oculta, pero ahora no se aplica porque..."). Los demás
 * valores de `display` (flex/grid/block) sí usan la composición genérica del final. */
function explainDisplayNone(context: CssDeclarationExplanationContext, elementsClause: string): CssDeclarationExplanation {
  const nucleo = context.mediaText !== undefined
    ? context.mediaActive
      ? 'Esta propiedad oculta el elemento. Esta regla se aplica ahora.'
      : `Esta propiedad oculta el elemento, pero esta regla no se aplica ahora porque estás viendo ${context.viewportLabel}.`
    : 'Oculta el elemento mientras esta regla se esté aplicando.'
  return { sentence: [nucleo, elementsClause].filter(Boolean).join(' ') }
}

/** Propiedades cuyo significado no depende del valor concreto más allá de "simple vs.
 * avanzado" — la frase base es fija y solo cambia el valor mostrado. */
const SIMPLE_VALUE_PROPERTIES: Record<string, string> = {
  'font-size': 'Cambia el tamaño del texto.',
  'border-radius': 'Redondea las esquinas.',
  padding: 'Agrega espacio dentro del elemento, entre su contenido y sus bordes.',
  margin: 'Agrega espacio por fuera del elemento, separándolo de otros elementos.',
  width: 'Indica cuánto ancho puede ocupar el elemento.',
  gap: 'Agrega separación entre los elementos organizados dentro de este contenedor.',
}

const DISPLAY_PURPOSES: Record<string, string> = {
  flex: 'Organiza este elemento usando una distribución flexible para acomodar su contenido.',
  grid: 'Organiza su contenido en una cuadrícula.',
  block: 'Hace que el elemento ocupe todo el ancho disponible, en su propia línea.',
}

/**
 * Explica una declaración CSS concreta para el estudiante. `property`/`value` son EXACTAMENTE
 * lo que escribió (sin normalizar) — vienen de `css-position-status` (Paso 4.1), que a su vez
 * los recorta del CSS aplicado con los rangos de `styles.ts`. `context.matchedCount` viene del
 * mismo mensaje: son los elementos que coinciden con la REGLA que contiene la declaración, no
 * un cálculo nuevo — nunca se inventa una relación aparte para 4.3.
 *
 * Devuelve `null` cuando: la propiedad no está en el diccionario, el valor está vacío (CSS a
 * medio escribir), o `matchedCount` es 0 (explicar qué hace una propiedad que no afecta a
 * ningún elemento de la vista actual no aporta nada — la propia ficha de 4.1 ya lo informa).
 */
export function explainCssDeclaration(property: string, value: string, context: CssDeclarationExplanationContext): CssDeclarationExplanation | null {
  const trimmedValue = value.trim()
  if (!trimmedValue) return null
  if (context.matchedCount === 0) return null

  const prop = property.trim().toLowerCase()
  const elementsClause = context.matchedCount === undefined ? '' : describeAffectedElements(context.matchedCount)

  if (prop === 'display') {
    const v = trimmedValue.toLowerCase()
    if (v === 'none') return explainDisplayNone(context, elementsClause)
    const purpose = DISPLAY_PURPOSES[v]
    if (!purpose) return null
    const disponibilidad = describeCssRuleAvailability(context.mediaText, context.mediaActive, context.viewportLabel)
    return { sentence: [purpose, elementsClause, disponibilidad].filter(Boolean).join(' ') }
  }

  let base: CssDeclarationExplanation | null = null
  if (prop === 'color') base = colorPropertySentence('Cambia el color del texto.', trimmedValue)
  else if (prop === 'background-color') base = colorPropertySentence('Cambia el color de fondo.', trimmedValue)
  else if (prop === 'background') base = explainBackgroundShorthand(trimmedValue)
  else if (prop === 'font-weight') { const t = explainFontWeight(trimmedValue); base = t ? { sentence: t } : null }
  else if (prop === 'text-align') { const t = explainTextAlign(trimmedValue); base = t ? { sentence: t } : null }
  else if (prop === 'max-width') base = { sentence: explainMaxWidth(trimmedValue) }
  else if (SIMPLE_VALUE_PROPERTIES[prop]) base = { sentence: simpleValueSentence(SIMPLE_VALUE_PROPERTIES[prop], trimmedValue) }

  if (!base) return null

  const disponibilidad = describeCssRuleAvailability(context.mediaText, context.mediaActive, context.viewportLabel)
  const sentence = [base.sentence, elementsClause, disponibilidad].filter(Boolean).join(' ')
  return { sentence, colorSwatch: base.colorSwatch }
}
