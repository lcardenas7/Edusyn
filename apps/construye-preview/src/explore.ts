/** Paso 5.1: el texto editable de un elemento, cuando su contenido es inequívoco. Lo calcula
 * `instrument.ts` con el parser; aquí solo viaja. */
export interface ExploreTextRange {
  start: number
  end: number
  value: string
  source: string
}

export interface ExploreRange {
  start: number
  end: number
  tagName: string
  text?: ExploreTextRange
}

export type ExploreOutcome =
  /** `text` solo está presente cuando el elemento cumple el criterio de "texto simple
   * editable"; su ausencia significa exactamente "aquí no se puede cambiar el texto". Viaja en
   * el MISMO resultado que usan el clic en el preview y el cursor en el código, para que la
   * edición de texto tenga una sola implementación en los dos sentidos. */
  | { status: 'exact'; start: number; end: number; tagName: string; text?: ExploreTextRange }
  | { status: 'none' }

export interface ExploreController {
  enable(): void
  disable(): void
  isEnabled(): boolean
  /** Código → Preview: resalta el elemento cuyo rango de origen contiene [start,end] (el
   * rango de la selección/cursor actual en el editor). `explicit` distingue una acción
   * deliberada (clic, selección de texto) de un simple movimiento de cursor — solo la
   * primera hace scrollIntoView, para no "saltar" el preview mientras el estudiante escribe.
   * Devuelve el mismo tipo de resultado que un clic en el preview, por la misma regla:
   * EXACTO si un rango lo contiene, NUNCA inventado si no. */
  showCodePosition(start: number, end: number, explicit: boolean): ExploreOutcome
  /** Quita el resaltado que puso showCodePosition (sin tocar hover/selección del mouse). Se
   * usa cuando el editor deja de poder mapear con certeza: cambia de pestaña, hay cambios sin
   * aplicar, o Explorar se apaga. */
  hideCodePosition(): void
  /** CSS → Preview: resalta TODOS los elementos que coinciden con la regla bajo el cursor.
   * Es una ruta paralela a la de HTML: usa su propio estado para no interferir con el hover
   * del mouse ni con la selección, y reutiliza el mismo lenguaje visual (outline, sin tocar
   * el layout). Devuelve cuántos se resaltaron de verdad, que puede ser menor que el total
   * cuando se aplica el tope visual — el conteo real lo reporta styles.ts, no esta función. */
  showCssMatches(elements: HTMLElement[]): number
  hideCssMatches(): void
  /** Paso 4.4 (contexto reactivo al viewport): vuelve a reportar el elemento ACTUALMENTE
   * seleccionado (por un clic real anterior), sin ninguna interacción nueva del estudiante.
   * Reutiliza el mismo `onPick` de siempre —tercer argumento `reevaluated=true`— para que
   * quien lo escuche (main.ts) recalcule sus datos dependientes del CSSOM (p. ej. reglas CSS
   * relacionadas y su `mediaActive`) con la MISMA identidad de elemento, nunca una nueva. No
   * hace nada si Explorar está apagado o si no hay ninguna selección vigente: no hay nada que
   * reevaluar. */
  reevaluateSelection(): void
}

/** Tope puramente visual: con muchas coincidencias, marcar cada una convierte el preview en
 * ruido. El número que se le muestra al estudiante sigue siendo el real. */
export const MAX_CSS_HIGHLIGHTS = 50

const ATTR_SELECTOR = '[data-edusyn-id]'
const ATTR_NAME = 'data-edusyn-id'

/** El estudiante nunca ve estos valores — son estilo aplicado en línea, temporal, dentro del
 * origen aislado del preview. No usan `border` para no alterar el layout (`outline` no
 * ocupa espacio propio). */
const HOVER_OUTLINE = '2px solid #4f46e5'
const SELECTED_OUTLINE = '3px solid #16a34a'

function readRange(target: Element, ranges: ExploreRange[]): ExploreRange | undefined {
  const raw = target.getAttribute(ATTR_NAME)
  if (raw === null) return undefined
  const id = Number(raw)
  return Number.isInteger(id) ? ranges[id] : undefined
}

/** Código → Preview: encuentra el rango MÁS INTERNO que contiene por completo [start,end] —
 * "más interno" porque para elementos anidados (p. ej. un <button> dentro de un <main>) el
 * cursor cae dentro de AMBOS rangos, y el más específico es la respuesta útil. Nunca compara
 * texto ni contenido: es aritmética pura sobre offsets, así que dos elementos idénticos
 * ("varias tarjetas iguales") siguen distinguiéndose solo por su posición real en el archivo.
 * Si ningún rango contiene la selección (p. ej. el cursor está antes de la primera etiqueta,
 * o entre elementos de nivel superior sin nada que los envuelva), no hay nada que inventar. */
function findInnermostRangeId(ranges: ExploreRange[], start: number, end: number): number | null {
  let bestId: number | null = null
  let bestSpan = Infinity
  for (let id = 0; id < ranges.length; id++) {
    const range = ranges[id]
    if (range.start <= start && end <= range.end) {
      const span = range.end - range.start
      if (span < bestSpan) {
        bestSpan = span
        bestId = id
      }
    }
  }
  return bestId
}

/**
 * Controla el modo "Explorar" dentro del documento ya renderizado por el runner, en las dos
 * direcciones del circuito: Preview → Código (clic/hover sobre el preview, esta clase) y
 * Código → Preview (`showCodePosition`, llamado desde afuera con la posición del cursor en el
 * editor). Se activa y desactiva de forma explícita; al desactivarse, no debe quedar ningún
 * listener, estilo temporal ni estado residual — el proyecto del estudiante vuelve
 * exactamente a como estaba.
 *
 * Nunca decide "a ojo" qué elemento corresponde a un clic o a una posición de código: solo
 * reconoce el elemento exacto marcado por `instrumentHtml` (atributo `data-edusyn-id`) y
 * consulta su rango en `getRanges()`. Si no hay marca o el rango no lo contiene, reporta
 * `{status:'none'}` — la regla de "nunca inventar" se sostiene aquí, no solo en el análisis
 * del HTML, y es simétrica en ambas direcciones.
 */
export function createExploreController(
  root: Document,
  getRanges: () => ExploreRange[],
  /** El segundo argumento es el elemento EXACTO que recibió el clic, sin pasar por
   * `findTarget` — se entrega incluso cuando `outcome.status` es 'none' (elemento sin
   * `data-edusyn-id`, p. ej. creado por JS). Preview → HTML necesita el atributo para no
   * inventar una posición de origen; Preview → CSS (Paso 4.2) no necesita ninguna posición de
   * origen, solo el elemento real, así que ambas preguntas se resuelven de forma independiente
   * sobre el mismo clic. */
  /** El tercer argumento (`reevaluated`) distingue una elección real (clic, `false`) de una
   * repetición automática del mismo resultado tras un cambio de viewport (Paso 4.4, `true`) —
   * quien escucha usa esa distinción para refrescar datos sin repetir efectos de "elección
   * nueva" (cambiar de pestaña en el editor, saltar el cursor, replegar una lista). */
  onPick: (outcome: ExploreOutcome, target: HTMLElement | null, reevaluated: boolean) => void,
): ExploreController {
  let enabled = false
  let hovered: HTMLElement | null = null
  let selected: HTMLElement | null = null
  // Resaltado que viene del CÓDIGO (cursor pasivo), separado de `hovered` (mouse) y
  // `selected` (clic en preview o acción explícita en código): son señales independientes y
  // pueden coexistir — mover el cursor por el código no debe apagar lo que el mouse esté
  // señalando, ni viceversa.
  let codeHover: HTMLElement | null = null
  // Ruta CSS (Paso 4.1), independiente de las anteriores: una regla puede afectar a varios
  // elementos a la vez, y apagarla no debe borrar lo que el mouse o el cursor HTML señalen.
  let cssHighlighted: HTMLElement[] = []

  const clear = (el: HTMLElement | null) => {
    if (!el) return
    el.style.outline = ''
    el.style.outlineOffset = ''
    el.style.cursor = ''
  }

  const elementForRangeId = (id: number): HTMLElement | null => root.querySelector(`[${ATTR_NAME}="${id}"]`)

  // Compartido por el clic en preview y por una acción explícita en código: ambos significan
  // "esto es lo elegido ahora", así que usan el mismo estilo y el mismo estado `selected`, sin
  // importar por cuál de las dos direcciones llegó — eso es justamente lo que hace que
  // Código → Preview → Código conserve la misma correspondencia.
  const applySelected = (target: HTMLElement | null) => {
    if (selected) clear(selected)
    selected = target
    if (selected) {
      selected.style.outline = SELECTED_OUTLINE
      selected.style.outlineOffset = '1px'
    }
  }

  // Solo el elemento exacto que recibió el evento cuenta: instrumentHtml marca TODO nodo
  // que vino del HTML original, así que un elemento legítimo siempre trae su propia marca
  // directamente (nunca hace falta subir por los ancestros para encontrarla). Si el target
  // no la tiene, es porque el propio JavaScript del estudiante lo creó después de renderizar
  // (fuera de lo que parse5 pudo ver) — en ese caso, subir al ancestro marcado más cercano
  // señalaría un rango real del archivo que NO corresponde a lo que se clickeó: eso es
  // exactamente el tipo de invención que la regla "nunca inventar una correspondencia" prohíbe.
  const findTarget = (event: Event): HTMLElement | null => {
    const target = event.target
    if (!(target instanceof Element)) return null
    return target.hasAttribute(ATTR_NAME) ? (target as HTMLElement) : null
  }

  const onMouseOver = (event: Event) => {
    const target = findTarget(event)
    if (target === hovered) return
    if (hovered && hovered !== selected) clear(hovered)
    hovered = target
    if (hovered && hovered !== selected) {
      hovered.style.outline = HOVER_OUTLINE
      hovered.style.outlineOffset = '1px'
      hovered.style.cursor = 'pointer'
    }
  }

  const onMouseOut = (event: Event) => {
    const related = (event as MouseEvent).relatedTarget
    const stillInside = related instanceof Element && !!related.closest(ATTR_SELECTOR)
    if (stillInside) return
    if (hovered && hovered !== selected) clear(hovered)
    hovered = null
  }

  // Captura, siempre, para poder suprimir la acción normal del elemento (navegar, enviar un
  // formulario, alternar un checkbox) mientras se está inspeccionando — sin esto, un clic en
  // "Explorar" ejecutaría la app en vez de solo señalar su código.
  const onClick = (event: Event) => {
    event.preventDefault()
    event.stopPropagation()

    const rawTarget = event.target instanceof Element ? (event.target as HTMLElement) : null
    const target = findTarget(event)
    const range = target ? readRange(target, getRanges()) : undefined
    if (!target || !range) {
      applySelected(null)
      onPick({ status: 'none' }, rawTarget, false)
      return
    }

    applySelected(target)
    onPick({ status: 'exact', start: range.start, end: range.end, tagName: range.tagName, text: range.text }, target, false)
  }

  return {
    enable() {
      if (enabled) return
      enabled = true
      root.addEventListener('mouseover', onMouseOver, true)
      root.addEventListener('mouseout', onMouseOut, true)
      root.addEventListener('click', onClick, true)
    },
    disable() {
      if (!enabled) return
      enabled = false
      root.removeEventListener('mouseover', onMouseOver, true)
      root.removeEventListener('mouseout', onMouseOut, true)
      root.removeEventListener('click', onClick, true)
      clear(hovered)
      hovered = null
      clear(selected)
      selected = null
      clear(codeHover)
      codeHover = null
      cssHighlighted.forEach(clear)
      cssHighlighted = []
    },
    isEnabled: () => enabled,
    showCodePosition(start, end, explicit) {
      if (!enabled) return { status: 'none' }

      const ranges = getRanges()
      const id = findInnermostRangeId(ranges, start, end)
      const range = id === null ? undefined : ranges[id]
      const target = id === null ? null : elementForRangeId(id)

      // Un cursor pasivo (no explícito) usa el mismo estilo que el hover del mouse y su
      // propio estado — así no interfiere con lo que el estudiante ya tenga seleccionado por
      // clic. Una acción explícita (clic o selección en el código) SÍ reemplaza la selección,
      // igual que un clic en el preview: es la misma acción de "elegir", solo que llegó desde
      // el otro lado del circuito.
      if (explicit) {
        clear(codeHover)
        codeHover = null
        applySelected(target)
        if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      } else {
        if (codeHover && codeHover !== target) clear(codeHover)
        codeHover = target
        if (codeHover && codeHover !== selected) {
          codeHover.style.outline = HOVER_OUTLINE
          codeHover.style.outlineOffset = '1px'
        }
      }

      if (!target || !range) return { status: 'none' }
      return { status: 'exact', start: range.start, end: range.end, tagName: range.tagName, text: range.text }
    },
    hideCodePosition() {
      clear(codeHover)
      codeHover = null
    },
    showCssMatches(elements) {
      if (!enabled) return 0
      cssHighlighted.forEach(clear)
      cssHighlighted = elements.slice(0, MAX_CSS_HIGHLIGHTS)
      cssHighlighted.forEach((el) => {
        el.style.outline = HOVER_OUTLINE
        el.style.outlineOffset = '1px'
      })
      return cssHighlighted.length
    },
    hideCssMatches() {
      cssHighlighted.forEach(clear)
      cssHighlighted = []
    },
    reevaluateSelection() {
      if (!enabled || !selected) return
      const target = selected
      const range = readRange(target, getRanges())
      onPick(range ? { status: 'exact', start: range.start, end: range.end, tagName: range.tagName, text: range.text } : { status: 'none' }, target, true)
    },
  }
}
