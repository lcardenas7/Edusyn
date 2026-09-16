import { parseFragment, defaultTreeAdapter, type DefaultTreeAdapterTypes } from 'parse5'

type ChildNode = DefaultTreeAdapterTypes.ChildNode

/** Paso 5.1: el nodo de texto ÚNICO de un elemento, cuando su contenido es inequívoco.
 * `start`/`end` son el tramo fuente exacto que ocupa ese texto en `index.html` (los da el
 * propio parser, no una búsqueda de texto: dos botones que digan "Comprar" tienen rangos
 * distintos). `value` es el texto YA DECODIFICADO — lo que el estudiante ve en pantalla
 * ("Tomás & Ana"), no lo que hay escrito en el archivo ("Tomás &amp; Ana"). */
export interface SourceTextRange {
  start: number
  end: number
  value: string
  /** El mismo texto tal como está ESCRITO en el archivo ("Tomás &amp; Ana"). Viaja aparte de
   * `value` porque cumplen funciones distintas: `value` es lo que se le muestra al estudiante
   * y `source` es contra lo que se comprueba, antes de escribir, que el archivo no haya
   * cambiado desde que lo seleccionó. */
  source: string
}

export interface SourceRange {
  /** Offset (inclusive) del elemento completo en el `index.html` original del estudiante. */
  start: number
  /** Offset (exclusivo) del elemento completo en el `index.html` original. */
  end: number
  tagName: string
  /** Presente SOLO si el elemento cumple el criterio de "texto simple editable" (ver
   * `simpleEditableText`). Su ausencia es la señal de "aquí no se puede ofrecer edición de
   * texto": ni el runner ni el host deben deducirlo de otra forma. */
  text?: SourceTextRange
}

/** Elementos cuyo contenido NO es texto normal y donde escapar `<`/`&` cambiaría el
 * significado o rompería el proyecto: `script`/`style` son texto crudo (las entidades no se
 * decodifican ahí), `textarea`/`title` tienen reglas propias, y en `pre` el espacio en blanco
 * es significativo. Ninguno se ofrece para edición de texto. */
const NON_TEXT_ELEMENTS = new Set(['script', 'style', 'textarea', 'title', 'pre'])

/** Espacio en blanco de HTML (solo ASCII): el que usa un estudiante para indentar. Se mira el
 * texto FUENTE, no el decodificado. */
const SURROUNDING_WHITESPACE = /^[ \t\n\r\f]|[ \t\n\r\f]$/

/**
 * Criterio EXACTO de "texto simple editable" (Paso 5.1). Deliberadamente estricto: es
 * preferible no ofrecer la edición a reformatear el HTML del estudiante sin avisar.
 *
 * Se exige que el elemento tenga UN ÚNICO hijo y que ese hijo sea un nodo de texto con
 * ubicación fuente propia. Así quedan fuera, por construcción y sin ninguna heurística, los
 * casos que el gate prohíbe: `<p>Hola <strong>Luis</strong></p>` (varios hijos),
 * `<p>Texto <br> siguiente</p>` (varios hijos), `<button><span>Comprar</span></button>`
 * (el hijo no es texto) y los elementos sin texto.
 *
 * Se exige además que el texto fuente no tenga espacio en blanco alrededor. Ese es el caso
 * `<h1>\n    Mi tienda\n</h1>`: ahí el nodo fuente incluye la indentación, y separar "texto"
 * de "formato" obligaría a decidir por heurística qué espacios son del estudiante y cuáles
 * del editor. Se deja fuera del MVP a propósito.
 */
function simpleEditableText(html: string, node: DefaultTreeAdapterTypes.Element): SourceTextRange | undefined {
  if (NON_TEXT_ELEMENTS.has(node.tagName)) return undefined
  if (node.childNodes.length !== 1) return undefined
  const child = node.childNodes[0]
  if (!defaultTreeAdapter.isTextNode(child)) return undefined
  const loc = child.sourceCodeLocation
  if (!loc) return undefined
  const raw = html.slice(loc.startOffset, loc.endOffset)
  if (!raw || SURROUNDING_WHITESPACE.test(raw)) return undefined
  if (!child.value) return undefined
  return { start: loc.startOffset, end: loc.endOffset, value: child.value, source: raw }
}

export interface InstrumentedHtml {
  /** El mismo HTML, con un atributo `data-edusyn-id="N"` agregado a los elementos con
   * ubicación fuente confiable. Nunca se le muestra al estudiante — vive solo en el
   * documento que arma el runner para renderizar, jamás en el archivo que edita. */
  html: string
  /** `ranges[N]` es el rango fuente del elemento marcado con `data-edusyn-id="N"`. */
  ranges: SourceRange[]
}

const ATTR_NAME = 'data-edusyn-id'

/**
 * Analiza `index.html` con el parser HTML5 real (parse5 — el mismo algoritmo de
 * recuperación de errores que usa un navegador, no una aproximación propia) y marca cada
 * elemento cuya posición en el código fuente es confiable.
 *
 * Un elemento queda SIN marcar (y por tanto invisible para "Explorar") cuando:
 * - el parser lo insertó implícitamente (p. ej. el `<tbody>` que HTML5 exige dentro de una
 *   tabla sin uno explícito) — `sourceCodeLocation` es `null` en ese caso, señal exacta de
 *   "esto no tiene un bloque de código real que resaltar";
 * - ya trae un atributo `data-edusyn-id` propio (para no pisar ni duplicar uno existente,
 *   por improbable que sea).
 *
 * Nunca inventa una relación: un elemento sin ubicación confiable simplemente no entra en
 * `ranges`, y el runner responderá "no encontrado" si el estudiante lo selecciona.
 */
export function instrumentHtml(html: string): InstrumentedHtml {
  const fragment = parseFragment(html, { sourceCodeLocationInfo: true })
  const ranges: SourceRange[] = []
  const insertions: { at: number; text: string }[] = []

  const walk = (node: ChildNode): void => {
    if (!defaultTreeAdapter.isElementNode(node)) return

    const loc = node.sourceCodeLocation
    const alreadyTagged = node.attrs.some((attr) => attr.name === ATTR_NAME)
    if (loc && !alreadyTagged) {
      const tagLoc = loc.startTag ?? loc
      const id = ranges.length
      ranges.push({ start: loc.startOffset, end: loc.endOffset, tagName: node.tagName, text: simpleEditableText(html, node) })
      insertions.push({ at: tagLoc.endOffset - 1, text: ` ${ATTR_NAME}="${id}"` })
    }

    node.childNodes.forEach(walk)
  }
  fragment.childNodes.forEach(walk)

  insertions.sort((a, b) => b.at - a.at)
  let instrumented = html
  for (const { at, text } of insertions) {
    instrumented = instrumented.slice(0, at) + text + instrumented.slice(at)
  }

  return { html: instrumented, ranges }
}
