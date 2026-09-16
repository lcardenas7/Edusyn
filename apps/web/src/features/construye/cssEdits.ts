import { describeMediaCondition } from './explanations'
import { replaceExactRange, type SourceRange } from './sourceEdits'

/**
 * "Cambiar" (Paso 5.0) — primera edición visual determinística, sin IA. Decide qué
 * declaraciones puede modificar un estudiante desde la ficha pedagógica, qué valor exacto se
 * escribirá, y hace el reemplazo sobre el texto real de `styles.css`.
 *
 * Tres reglas duras, heredadas de todo Construye:
 * 1. El código es la fuente de verdad: editar significa cambiar el ARCHIVO, nunca aplicar un
 *    estilo paralelo (inline, variables ocultas, <style> extra) que el estudiante no vería.
 * 2. Nunca por búsqueda de texto: se reemplaza exactamente el rango que reportó el runner, y
 *    solo si lo que hay ahí sigue siendo el valor esperado. Si no coincide, no se edita.
 * 3. Nunca un valor inventado: solo se escriben valores que estas funciones puedan construir
 *    y validar por completo. Un valor que no entra en la gramática soportada se explica, pero
 *    no se ofrece editar.
 */

export const EDITABLE_CSS_PROPERTIES = ['background-color', 'color', 'font-size', 'border-radius'] as const
export type EditableCssProperty = (typeof EDITABLE_CSS_PROPERTIES)[number]

/** Unidades editables en este MVP. Deliberadamente NO incluye vw/vh/%/calc/clamp: solo lo que
 * un control numérico simple puede producir sin ambigüedad. */
export const EDITABLE_LENGTH_UNITS = ['px', 'rem', 'em'] as const
export type EditableLengthUnit = (typeof EDITABLE_LENGTH_UNITS)[number]

export type EditableValue =
  /** `swatch` siempre es #rrggbb (lo que necesita un selector de color); `current` es el texto
   * tal como está escrito en el archivo, que puede ser la forma corta (#fff). */
  | { kind: 'color'; property: EditableCssProperty; current: string; swatch: string }
  | { kind: 'length'; property: EditableCssProperty; current: string; amount: number; unit: EditableLengthUnit }

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const LENGTH_VALUE = /^(\d+(?:\.\d+)?)(px|rem|em)$/i
const COLOR_PROPERTIES = new Set<string>(['background-color', 'color'])
const LENGTH_PROPERTIES = new Set<string>(['font-size', 'border-radius'])

/** Tope defensivo: ningún control de este paso debería producir un número mayor, y un valor
 * absurdo escrito en el archivo del estudiante es un problema aunque sea sintácticamente
 * válido. */
const MAX_LENGTH_AMOUNT = 9_999

function expandHex(hex: string): string {
  const body = hex.slice(1)
  if (body.length !== 3) return hex.toLowerCase()
  return ('#' + body[0] + body[0] + body[1] + body[1] + body[2] + body[2]).toLowerCase()
}

/**
 * ¿Esta declaración se puede editar visualmente? `null` significa "no" — y "no" es la
 * respuesta correcta para todo lo que no podamos reemplazar con total seguridad: var(),
 * calc(), clamp(), gradientes, shorthands de varios valores (`10px 20px`), colores con nombre,
 * rgb()/hsl(), unidades fuera de la lista, o una propiedad fuera del MVP. En todos esos casos
 * la comprensión (Paso 4.3) sigue funcionando; solo desaparece el control de edición.
 *
 * Los colores con nombre (`white`) quedan fuera a propósito en 5.0: el control de color
 * trabaja en #rrggbb, y traducir nombre → hex para precargarlo exigiría una tabla nueva de
 * equivalencias que este paso no autoriza. Se explica, no se edita.
 */
export function classifyEditableValue(property: string, value: string): EditableValue | null {
  const prop = property.trim().toLowerCase()
  const raw = value.trim()
  if (!raw) return null

  if (COLOR_PROPERTIES.has(prop)) {
    if (!HEX_COLOR.test(raw)) return null
    return { kind: 'color', property: prop as EditableCssProperty, current: raw, swatch: expandHex(raw) }
  }

  if (LENGTH_PROPERTIES.has(prop)) {
    const match = raw.match(LENGTH_VALUE)
    if (!match) return null
    const amount = Number(match[1])
    if (!Number.isFinite(amount) || amount > MAX_LENGTH_AMOUNT) return null
    return { kind: 'length', property: prop as EditableCssProperty, current: raw, amount, unit: match[2].toLowerCase() as EditableLengthUnit }
  }

  return null
}

/**
 * Texto que se escribirá en el archivo para un color. Solo acepta #rgb/#rrggbb y siempre
 * devuelve #rrggbb en minúsculas: un formato único hace que la edición sea predecible y que
 * el valor escrito nunca pueda contener nada fuera de su gramática (ni `;`, ni `}`, ni
 * `url(`, ni un segundo token). `null` = no se escribe nada.
 */
export function formatColorValue(raw: string): string | null {
  const trimmed = raw.trim()
  if (!HEX_COLOR.test(trimmed)) return null
  return expandHex(trimmed)
}

/**
 * Texto que se escribirá para una longitud. El número se valida aparte de la unidad, y la
 * unidad solo puede ser una de las ya soportadas — por eso es imposible que este control
 * produzca `12px; color: red` o similar. Se recortan los decimales sobrantes para no escribir
 * `16.000000000000004px` por un redondeo de coma flotante.
 */
export function formatLengthValue(amount: number, unit: string): string | null {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_LENGTH_AMOUNT) return null
  if (!(EDITABLE_LENGTH_UNITS as readonly string[]).includes(unit)) return null
  const rounded = Math.round(amount * 100) / 100
  return `${rounded}${unit}`
}

/** Etiqueta del control, en lenguaje de estudiante — nunca el nombre técnico de la propiedad
 * como título (ese sigue siendo la "segunda capa" del Paso 4.3). */
export function editableControlLabel(property: EditableCssProperty): string {
  switch (property) {
    case 'background-color': return 'Color de fondo'
    case 'color': return 'Color del texto'
    case 'font-size': return 'Tamaño del texto'
    case 'border-radius': return 'Redondeo de las esquinas'
  }
}

/** Lo que la ficha pide cuando el estudiante confirma un cambio. Viaja con `expectedValue`
 * para que quien escriba pueda comprobar que el archivo no cambió entre medias. */
export interface CssValueEditRequest {
  valueStart: number
  valueEnd: number
  expectedValue: string
  newValue: string
  property: string
}

export type CssValueRange = SourceRange

export interface CssValueEditResult {
  css: string
  /** Dónde quedó el valor NUEVO, para poder seleccionarlo en el editor y que el estudiante vea
   * exactamente qué línea cambió. */
  range: CssValueRange
}

/**
 * Reemplazo atómico del valor de una declaración. Delega en `replaceExactRange`, la única
 * puerta de escritura de Construye (compartida con la edición de texto HTML del Paso 5.1), y
 * conserva su contrato: se sustituye SOLO [start, end), el resto del archivo queda byte a byte
 * igual, y si el texto en ese rango ya no es el esperado no se escribe nada ni se busca el
 * valor en otro sitio.
 */
export function replaceCssValueAtRange(css: string, range: CssValueRange, expectedValue: string, newValue: string): CssValueEditResult | null {
  const resultado = replaceExactRange(css, range, expectedValue, newValue)
  return resultado ? { css: resultado.content, range: resultado.range } : null
}

/** Antes de confirmar: a cuántos elementos alcanzará este cambio. Usa el `matchedCount` que ya
 * calculó el runner (Paso 4.1) — nunca una cuenta nueva, y nunca deja creer que se está
 * modificando solo el elemento que el estudiante tocó. */
export function describeEditImpact(matchedCount: number | undefined): string | null {
  if (matchedCount === undefined || matchedCount <= 0) return null
  if (matchedCount === 1) return 'Este cambio afectará este elemento.'
  return `Este cambio afectará ${matchedCount} elementos.`
}

/** Aviso pedagógico cuando la regla vive en una @media que ahora no se aplica: se puede editar
 * igual (conocemos el código exacto), pero el estudiante debe saber por qué no verá el cambio
 * en la pantalla que está mirando. `null` cuando no hay nada que aclarar. */
export function describeEditMediaWarning(mediaText: string | undefined, mediaActive: boolean | undefined, viewportLabel: string): string | null {
  if (!mediaText || mediaActive) return null
  return `Este cambio corresponde a ${describeMediaCondition(mediaText)}. Ahora estás viendo ${viewportLabel}.`
}
