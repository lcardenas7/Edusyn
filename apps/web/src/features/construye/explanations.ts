/** "¿Qué es esto?" — explicación determinística, sin IA, de un elemento HTML común. Responde
 * "¿qué es esto en mi app?" en lenguaje de estudiante, no la definición técnica de la etiqueta.
 *
 * Esto es un concepto distinto de la futura "¿Qué hace esto?" (explicación de código,
 * probablemente con IA, sobre un fragmento seleccionado) — no se implementa todavía. No hay
 * abstracción de proveedor aquí a propósito: el día que se agregue, el punto de extensión
 * natural es un segundo diccionario/función junto a este, no una reescritura de este archivo. */
const EXPLANATIONS: Record<string, string> = {
  h1: 'Este es un título principal.',
  h2: 'Este es un título de sección.',
  h3: 'Este es un título más pequeño, dentro de una sección.',
  p: 'Este es un texto o párrafo.',
  button: 'Este es un botón que el usuario puede presionar.',
  img: 'Esta es una imagen.',
  a: 'Este es un enlace.',
  input: 'Este es un campo donde el usuario puede escribir o seleccionar información.',
  form: 'Este es un formulario que reúne información.',
  div: 'Este es un contenedor que agrupa otros elementos.',
  section: 'Esta es una sección que organiza una parte de la página.',
  ul: 'Esta es una lista.',
  ol: 'Esta es una lista numerada.',
  li: 'Este es un elemento de una lista.',
  span: 'Este es un fragmento de texto o contenido dentro de otro elemento.',
  label: 'Este es el texto que describe un campo cercano.',
  header: 'Esta es la parte superior de la página o de una sección.',
  footer: 'Esta es la parte final de la página o de una sección.',
  nav: 'Este es un menú de navegación.',
  table: 'Esta es una tabla.',
}

/** `null` cuando no hay una explicación preparada para esa etiqueta — se muestra honestamente
 * como "sin explicación disponible", nunca se inventa una genérica. */
export function getElementExplanation(tagName: string): string | null {
  return EXPLANATIONS[tagName.toLowerCase()] ?? null
}

/** Traduce una condición de @media a lenguaje de estudiante. Solo se traducen los dos patrones
 * que sabemos leer con certeza; cualquier otra condición se devuelve tal cual el estudiante la
 * escribió. Interpretar creativamente una condición que no entendemos sería inventar. */
export function describeMediaCondition(mediaText: string): string {
  const max = mediaText.match(/^\(\s*max-width\s*:\s*(\d+)px\s*\)$/i)
  if (max) return `pantallas de hasta ${max[1]} px`
  const min = mediaText.match(/^\(\s*min-width\s*:\s*(\d+)px\s*\)$/i)
  if (min) return `pantallas desde ${min[1]} px`
  return mediaText
}

export interface CssMatchSummaryInput {
  status: 'exact' | 'none'
  matchedCount: number
  mediaText?: string
  mediaActive?: boolean
  viewportLabel: string
}

/**
 * Frase que ve el estudiante para "CSS → Preview". Nunca afirma que ESTE código sea el
 * responsable del aspecto final (hay cascada, herencia y especificidad que el Paso 4.1 no
 * resuelve): solo dice a qué elementos corresponde y si la regla se está aplicando ahora.
 *
 * Distingue deliberadamente dos casos que parecen el mismo: "no corresponde a nada" y
 * "corresponde a algo pero hoy no se aplica por el tamaño de pantalla" — esa diferencia es la
 * que enseña responsive sin tener que explicar antes la teoría de media queries.
 */
export function describeCssMatch({ status, matchedCount, mediaText, mediaActive, viewportLabel }: CssMatchSummaryInput): string | null {
  if (status !== 'exact') return null

  const cuantos = matchedCount === 1 ? 'este elemento' : `${matchedCount} elementos`

  if (mediaText && mediaActive === false) {
    if (matchedCount === 0) return `Este estilo es para ${describeMediaCondition(mediaText)} y ahora no se aplica porque estás viendo ${viewportLabel}.`
    return `Este estilo corresponde a ${cuantos}, pero ahora no se aplica porque estás viendo ${viewportLabel}.`
  }

  if (matchedCount === 0) return 'Este estilo no afecta ningún elemento de la vista actual.'

  const base = matchedCount === 1 ? 'Este estilo afecta este elemento.' : `Este estilo afecta ${matchedCount} elementos.`
  return mediaText && mediaActive ? `${base} Se aplica ahora, en ${describeMediaCondition(mediaText)}.` : base
}

/** Preview → CSS (Paso 4.2): cuántos estilos están relacionados con el elemento que se acaba
 * de seleccionar. Deliberadamente NO dice "estos son los estilos que lo controlan": solo se
 * sabe que el selector coincide, nunca cuál (si alguno) gana la cascada. */
export function describeCssRelatedCount(total: number): string {
  return total === 1 ? 'Este elemento tiene 1 estilo relacionado.' : `Este elemento tiene ${total} estilos relacionados.`
}

/**
 * Nota de disponibilidad para UNA regla relacionada, en la ficha de Preview → CSS. `null`
 * cuando la regla no depende de ninguna condición de pantalla (no hay nada que aclarar).
 * Reutiliza `describeMediaCondition` para no duplicar la traducción de condiciones.
 */
export function describeCssRuleAvailability(mediaText: string | undefined, mediaActive: boolean | undefined, viewportLabel: string): string | null {
  if (!mediaText) return null
  if (mediaActive) return `Se aplica ahora, en ${describeMediaCondition(mediaText)}.`
  return `Ahora no se aplica porque estás viendo ${viewportLabel}.`
}
